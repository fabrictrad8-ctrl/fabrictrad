import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { paiseToRupees, rupeesToPaise } from '@/lib/razorpayIntegrity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonObject = Record<string, unknown>;
type PaymentKind = 'bulk' | 'catalog';

type PaymentRecord = {
  id: string;
  fabrictradOrderId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  amount: number;
  currency: string;
  refundedAmount: number;
  refundRequestedAmount: number;
  refundStatus: string;
  platformCommission: number;
  sellerPayable: number;
  kind: PaymentKind;
};

const entityFrom = (event: JsonObject, name: string): JsonObject => {
  const payload = event.payload as JsonObject | undefined;
  const wrapper = payload?.[name] as JsonObject | undefined;
  return (wrapper?.entity as JsonObject | undefined) || wrapper || {};
};
const roundMoney = (value: number) => Math.round(value * 100) / 100;

async function recordDeadLetter(
  key: string,
  eventType: string,
  payload: unknown,
  errorMessage: string
) {
  try {
    await createAdminClient().from('webhook_dead_letter_queue').insert({
      idempotency_key: key,
      source: 'razorpay',
      event_type: eventType || 'unknown',
      payload,
      error_message: errorMessage.slice(0, 2000),
      retry_count: 0,
      next_retry_at: new Date(Date.now() + 60_000).toISOString(),
    });
  } catch (error) {
    console.error('Unable to record Razorpay dead letter:', error);
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const supabaseServerSecret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!webhookSecret || !supabaseServerSecret) {
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest();
  const supplied = Buffer.from(signature, 'hex');
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(expected, supplied)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let event: JsonObject;
  try {
    event = JSON.parse(rawBody) as JsonObject;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const eventType = typeof event.event === 'string' ? event.event : 'unknown';
  const eventId =
    (typeof event.id === 'string' && event.id) ||
    crypto.createHash('sha256').update(rawBody).digest('hex');
  const idempotencyKey = `rzp_${eventId}`;
  const admin = createAdminClient();

  const { data: prior } = await admin
    .from('webhook_events')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (prior) return NextResponse.json({ received: true, duplicate: true });

  const normalizePayment = (
    data: Record<string, unknown>,
    kind: PaymentKind,
    foreignKey: string
  ): PaymentRecord => ({
    id: String(data.id),
    fabrictradOrderId: String(data[foreignKey]),
    razorpayOrderId: String(data.razorpay_order_id || ''),
    razorpayPaymentId: data.razorpay_payment_id
      ? String(data.razorpay_payment_id)
      : null,
    amount: Number(data.amount || 0),
    currency: String(data.currency || 'INR'),
    refundedAmount: Number(data.refunded_amount || 0),
    refundRequestedAmount: Number(data.refund_requested_amount || 0),
    refundStatus: String(data.refund_status || 'none'),
    platformCommission: Number(data.platform_commission || 0),
    sellerPayable: Number(data.seller_payable || 0),
    kind,
  });

  const findPaymentByOrder = async (razorpayOrderId: string): Promise<PaymentRecord | null> => {
    const { data: bulk, error: bulkError } = await admin
      .from('bulk_order_payments')
      .select('bulk_order_id,id,razorpay_order_id,razorpay_payment_id,amount,currency,refunded_amount,refund_requested_amount,refund_status,platform_commission,seller_payable')
      .eq('razorpay_order_id', razorpayOrderId)
      .maybeSingle();
    if (bulkError) throw bulkError;
    if (bulk) return normalizePayment(bulk, 'bulk', 'bulk_order_id');
    const { data: catalog, error: catalogError } = await admin
      .from('catalog_order_payments')
      .select('catalog_order_id,id,razorpay_order_id,razorpay_payment_id,amount,currency,refunded_amount,refund_requested_amount,refund_status,platform_commission,seller_payable')
      .eq('razorpay_order_id', razorpayOrderId)
      .maybeSingle();
    if (catalogError) throw catalogError;
    return catalog ? normalizePayment(catalog, 'catalog', 'catalog_order_id') : null;
  };

  const findPaymentByPaymentId = async (paymentId: string): Promise<PaymentRecord | null> => {
    const { data: bulk, error: bulkError } = await admin
      .from('bulk_order_payments')
      .select('bulk_order_id,id,razorpay_order_id,razorpay_payment_id,amount,currency,refunded_amount,refund_requested_amount,refund_status,platform_commission,seller_payable')
      .eq('razorpay_payment_id', paymentId)
      .maybeSingle();
    if (bulkError) throw bulkError;
    if (bulk) return normalizePayment(bulk, 'bulk', 'bulk_order_id');
    const { data: catalog, error: catalogError } = await admin
      .from('catalog_order_payments')
      .select('catalog_order_id,id,razorpay_order_id,razorpay_payment_id,amount,currency,refunded_amount,refund_requested_amount,refund_status,platform_commission,seller_payable')
      .eq('razorpay_payment_id', paymentId)
      .maybeSingle();
    if (catalogError) throw catalogError;
    return catalog ? normalizePayment(catalog, 'catalog', 'catalog_order_id') : null;
  };

  const reconcileOrder = async (payment: PaymentRecord) => {
    const paymentTable =
      payment.kind === 'bulk' ? 'bulk_order_payments' : 'catalog_order_payments';
    const orderTable = payment.kind === 'bulk' ? 'bulk_orders' : 'catalog_order_requests';
    const foreignKey = payment.kind === 'bulk' ? 'bulk_order_id' : 'catalog_order_id';
    const totalColumn = payment.kind === 'bulk' ? 'net_total' : 'total_amount';
    const paymentsResult = await admin
      .from(paymentTable)
      .select('amount,refunded_amount,status')
      .eq(foreignKey, payment.fabrictradOrderId);
    const orderResult = payment.kind === 'bulk'
      ? await admin
          .from('bulk_orders')
          .select('id,status,net_total,gross_total,gst_total,seller_id')
          .eq('id', payment.fabrictradOrderId)
          .maybeSingle()
      : await admin
          .from('catalog_order_requests')
          .select('id,status,total_amount,gst_amount,gst_rate,seller_id')
          .eq('id', payment.fabrictradOrderId)
          .maybeSingle();
    const payments = paymentsResult.data;
    const paymentsError = paymentsResult.error;
    const order = orderResult.data as Record<string, unknown> | null;
    const orderError = orderResult.error;
    if (paymentsError || orderError || !order) {
      throw paymentsError || orderError || new Error('FabricTrad order was not found during reconciliation.');
    }

    const captured = (payments || [])
      .filter((item) =>
        ['captured', 'partially_refunded', 'refunded'].includes(String(item.status))
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const refunded = (payments || []).reduce(
      (sum, item) => sum + Number(item.refunded_amount || 0),
      0
    );
    const netPaid = Math.max(0, roundMoney(captured - refunded));
    const total = roundMoney(Number(order[totalColumn] || 0));
    const paymentStatus =
      captured > 0 && refunded + 0.01 >= captured
        ? 'refunded'
        : refunded > 0
          ? 'partially_refunded'
          : netPaid + 0.01 >= total
            ? 'paid'
            : netPaid > 0
              ? 'partial'
              : 'unpaid';

    const patch: Record<string, unknown> = {
      amount_paid: roundMoney(captured),
      amount_refunded: roundMoney(refunded),
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    };
    if (paymentStatus === 'paid') {
      patch.status = 'paid';
      if (payment.kind === 'catalog') patch.paid_at = new Date().toISOString();
    }
    const { error: updateError } = await admin
      .from(orderTable)
      .update(patch)
      .eq('id', payment.fabrictradOrderId);
    if (updateError) throw updateError;

    const gstAmount = Number(
      payment.kind === 'bulk' ? order.gst_total || 0 : order.gst_amount || 0
    );
    const taxableValue = Number(
      payment.kind === 'bulk'
        ? order.gross_total || Math.max(0, total - gstAmount)
        : Math.max(0, total - gstAmount)
    );
    const effectiveGstRate =
      payment.kind === 'catalog'
        ? Number(order.gst_rate || 0)
        : taxableValue > 0
          ? roundMoney((gstAmount / taxableValue) * 100)
          : 0;

    return {
      order,
      captured: roundMoney(captured),
      refunded: roundMoney(refunded),
      paymentStatus,
      gstAmount,
      effectiveGstRate,
    };
  };

  try {
    if (eventType === 'payment.authorized' || eventType === 'payment.captured') {
      const entity = entityFrom(event, 'payment');
      const razorpayOrderId = String(entity.order_id || '');
      const razorpayPaymentId = String(entity.id || '');
      if (!razorpayOrderId || !razorpayPaymentId) throw new Error('Payment identifiers missing.');

      const payment = await findPaymentByOrder(razorpayOrderId);
      if (!payment) throw new Error('FabricTrad payment record not found.');
      if (String(entity.currency || '') !== payment.currency) {
        throw new Error('Webhook currency does not match the stored payment.');
      }
      if (Number(entity.amount || 0) !== rupeesToPaise(payment.amount)) {
        throw new Error('Webhook amount does not match the stored FabricTrad payment.');
      }

      const captured = eventType === 'payment.captured' || entity.captured === true;
      const timestamp = new Date().toISOString();
      const paymentTable =
        payment.kind === 'bulk' ? 'bulk_order_payments' : 'catalog_order_payments';
      const { error: paymentError } = await admin
        .from(paymentTable)
        .update({
          razorpay_payment_id: razorpayPaymentId,
          status: captured ? 'captured' : 'authorized',
          captured_amount: captured ? paiseToRupees(Number(entity.amount || 0)) : null,
          payment_method: entity.method ? String(entity.method) : null,
          razorpay_fee_actual: paiseToRupees(Number(entity.fee || 0)),
          razorpay_tax_actual: paiseToRupees(Number(entity.tax || 0)),
          captured_at: captured ? timestamp : null,
          failure_reason: null,
          last_webhook_event: eventType,
          last_webhook_at: timestamp,
          updated_at: timestamp,
        })
        .eq('id', payment.id);
      if (paymentError) throw paymentError;

      if (captured) {
        const reconciliation = await reconcileOrder(payment);
        const { error: splitError } = await admin.from('taxation_splits').upsert(
          {
            order_id: payment.fabrictradOrderId,
            transaction_id: razorpayPaymentId,
            gross_amount: payment.amount,
            gst_amount: reconciliation.gstAmount,
            gst_rate: reconciliation.effectiveGstRate,
            platform_fee: payment.platformCommission,
            seller_payout: payment.sellerPayable,
            status: 'processed',
            split_at: timestamp,
          },
          { onConflict: 'transaction_id' }
        );
        if (splitError) throw splitError;
      }
    } else if (eventType === 'payment.failed') {
      const entity = entityFrom(event, 'payment');
      const razorpayOrderId = String(entity.order_id || '');
      if (!razorpayOrderId) throw new Error('Payment order identifier missing.');
      const payment = await findPaymentByOrder(razorpayOrderId);
      if (!payment) throw new Error('FabricTrad payment record not found.');
      const table = payment.kind === 'bulk' ? 'bulk_order_payments' : 'catalog_order_payments';
      const timestamp = new Date().toISOString();
      const { error } = await admin
        .from(table)
        .update({
          status: 'failed',
          razorpay_payment_id: entity.id ? String(entity.id) : null,
          payment_method: entity.method ? String(entity.method) : null,
          failure_reason: String(entity.error_description || 'Payment failed').slice(0, 1000),
          last_webhook_event: eventType,
          last_webhook_at: timestamp,
          updated_at: timestamp,
        })
        .eq('id', payment.id);
      if (error) throw error;

      const orderTable = payment.kind === 'bulk' ? 'bulk_orders' : 'catalog_order_requests';
      await admin
        .from(orderTable)
        .update({ payment_status: 'failed', updated_at: timestamp })
        .eq('id', payment.fabrictradOrderId)
        .eq('amount_paid', 0);
    } else if (
      eventType === 'refund.created' ||
      eventType === 'refund.processed' ||
      eventType === 'refund.failed'
    ) {
      const entity = entityFrom(event, 'refund');
      const paymentId = String(entity.payment_id || '');
      const refundId = String(entity.id || '');
      const refundAmount = paiseToRupees(Number(entity.amount || 0));
      if (!paymentId || !refundId || refundAmount <= 0) {
        throw new Error('Refund identifiers or amount are missing.');
      }
      const payment = await findPaymentByPaymentId(paymentId);
      if (!payment) throw new Error('FabricTrad payment record for refund not found.');
      if (refundAmount > roundMoney(payment.amount - payment.refundedAmount)) {
        throw new Error('Refund webhook amount exceeds the stored refundable balance.');
      }

      const table = payment.kind === 'bulk' ? 'bulk_order_payments' : 'catalog_order_payments';
      const timestamp = new Date().toISOString();
      if (eventType === 'refund.created') {
        const { error } = await admin
          .from(table)
          .update({
            refund_status: 'requested',
            refund_requested_amount: refundAmount,
            last_refund_request_id: refundId,
            last_webhook_event: eventType,
            last_webhook_at: timestamp,
            updated_at: timestamp,
          })
          .eq('id', payment.id);
        if (error) throw error;
      } else if (eventType === 'refund.failed') {
        const { error } = await admin
          .from(table)
          .update({
            refund_status: 'failed',
            refund_requested_amount: 0,
            last_refund_request_id: refundId,
            failure_reason: String(entity.error_description || 'Refund failed').slice(0, 1000),
            last_webhook_event: eventType,
            last_webhook_at: timestamp,
            updated_at: timestamp,
          })
          .eq('id', payment.id);
        if (error) throw error;
      } else {
        const nextRefunded = Math.min(
          payment.amount,
          roundMoney(payment.refundedAmount + refundAmount)
        );
        const nextStatus =
          nextRefunded + 0.01 >= payment.amount ? 'refunded' : 'partially_refunded';
        const { error } = await admin
          .from(table)
          .update({
            status: nextStatus,
            refunded_amount: nextRefunded,
            refund_status: 'processed',
            refund_requested_amount: 0,
            last_refund_request_id: refundId,
            last_webhook_event: eventType,
            last_webhook_at: timestamp,
            updated_at: timestamp,
          })
          .eq('id', payment.id);
        if (error) throw error;
        await reconcileOrder({ ...payment, refundedAmount: nextRefunded });

        await admin
          .from('payment_ledger')
          .update({
            razorpay_refund_id: refundId,
            reconciliation_status: 'pending',
          })
          .eq('razorpay_payment_id', paymentId);
      }
    } else if (eventType === 'transfer.processed') {
      const entity = entityFrom(event, 'transfer');
      const transferId = String(entity.id || '');
      const source = String(entity.source || '');
      if (transferId && source) {
        const timestamp = new Date().toISOString();
        for (const table of ['bulk_order_payments', 'catalog_order_payments']) {
          const { error } = await admin
            .from(table)
            .update({
              razorpay_transfer_id: transferId,
              transfer_status: 'processed',
              last_webhook_event: eventType,
              last_webhook_at: timestamp,
              updated_at: timestamp,
            })
            .or(`razorpay_order_id.eq.${source},razorpay_payment_id.eq.${source}`);
          if (error) throw error;
        }
      }
    }

    const { error: eventError } = await admin.from('webhook_events').insert({
      idempotency_key: idempotencyKey,
      source: 'razorpay',
      event_type: eventType,
      payload: event,
      processed_at: new Date().toISOString(),
    });
    if (eventError && eventError.code !== '23505') throw eventError;
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    console.error(`Razorpay webhook failed for ${eventType}:`, message);
    await recordDeadLetter(idempotencyKey, eventType, event, message);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
