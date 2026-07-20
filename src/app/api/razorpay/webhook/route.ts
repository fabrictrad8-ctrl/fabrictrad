import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

type JsonObject = Record<string, unknown>;

const entityFrom = (event: JsonObject, name: string): JsonObject => {
  const payload = event.payload as JsonObject | undefined;
  const wrapper = payload?.[name] as JsonObject | undefined;
  return (wrapper?.entity as JsonObject | undefined) || wrapper || {};
};

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
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

  try {
    if (eventType === 'payment.captured') {
      const entity = entityFrom(event, 'payment');
      const razorpayOrderId = String(entity.order_id || '');
      const razorpayPaymentId = String(entity.id || '');
      if (!razorpayOrderId || !razorpayPaymentId) throw new Error('Payment identifiers missing.');

      const { data: payment, error: paymentLookupError } = await admin
        .from('bulk_order_payments')
        .select(
          'id,bulk_order_id,amount,platform_commission,razorpay_fee,gst_on_commission,seller_payable'
        )
        .eq('razorpay_order_id', razorpayOrderId)
        .maybeSingle();
      if (paymentLookupError || !payment) throw new Error('FabricTrad payment record not found.');

      const capturedAt = new Date().toISOString();
      const { error: updatePaymentError } = await admin
        .from('bulk_order_payments')
        .update({
          razorpay_payment_id: razorpayPaymentId,
          status: 'captured',
          captured_at: capturedAt,
          updated_at: capturedAt,
        })
        .eq('id', payment.id);
      if (updatePaymentError) throw updatePaymentError;

      const { data: order, error: orderError } = await admin
        .from('bulk_orders')
        .update({ status: 'paid', updated_at: capturedAt })
        .eq('id', payment.bulk_order_id)
        .in('status', ['confirmed', 'paid'])
        .select('id,seller_id,gst_total')
        .single();
      if (orderError || !order) throw new Error('Unable to mark bulk order paid.');

      const { error: splitError } = await admin.from('taxation_splits').upsert(
        {
          order_id: order.id,
          transaction_id: razorpayPaymentId,
          gross_amount: payment.amount,
          gst_amount: Number(order.gst_total || 0),
          gst_rate: Number(order.gst_total || 0) > 0 ? 5 : 0,
          platform_fee: Number(payment.platform_commission || 0),
          seller_payout: Number(payment.seller_payable || 0),
          status: 'processed',
          split_at: capturedAt,
        },
        { onConflict: 'transaction_id' }
      );
      if (splitError) throw splitError;
    } else if (eventType === 'payment.failed') {
      const entity = entityFrom(event, 'payment');
      const razorpayOrderId = String(entity.order_id || '');
      if (!razorpayOrderId) throw new Error('Payment order identifier missing.');
      const { error } = await admin
        .from('bulk_order_payments')
        .update({
          status: 'failed',
          razorpay_payment_id: entity.id ? String(entity.id) : null,
          failure_reason: String(entity.error_description || 'Payment failed').slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq('razorpay_order_id', razorpayOrderId);
      if (error) throw error;
    } else if (eventType === 'refund.processed') {
      const entity = entityFrom(event, 'refund');
      const paymentId = String(entity.payment_id || '');
      if (!paymentId) throw new Error('Refund payment identifier missing.');
      const { error } = await admin
        .from('bulk_order_payments')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('razorpay_payment_id', paymentId);
      if (error) throw error;
    } else if (eventType === 'transfer.processed') {
      const entity = entityFrom(event, 'transfer');
      const transferId = String(entity.id || '');
      const source = String(entity.source || '');
      if (transferId && source) {
        await admin
          .from('bulk_order_payments')
          .update({ razorpay_transfer_id: transferId, updated_at: new Date().toISOString() })
          .eq('razorpay_order_id', source);
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
    // A non-2xx response lets Razorpay retry. The DLQ remains a secondary safety net.
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
