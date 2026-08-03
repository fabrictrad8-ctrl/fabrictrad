import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  assertRazorpayPaymentMatches,
  fetchRazorpayPayment,
  paiseToRupees,
  verifyCheckoutSignature,
} from '@/lib/razorpayIntegrity';

type PaymentKind = 'bulk' | 'catalog';
type VerifyBody = {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const roundMoney = (value: number) => Math.round(value * 100) / 100;

async function reconcileOrderPayment(input: {
  admin: ReturnType<typeof createAdminClient>;
  kind: PaymentKind;
  orderId: string;
}) {
  const paymentTable = input.kind === 'catalog' ? 'catalog_order_payments' : 'bulk_order_payments';
  const orderTable = input.kind === 'catalog' ? 'catalog_order_requests' : 'bulk_orders';
  const foreignKey = input.kind === 'catalog' ? 'catalog_order_id' : 'bulk_order_id';
  const totalColumn = input.kind === 'catalog' ? 'total_amount' : 'net_total';

  const [{ data: payments }, { data: order }] = await Promise.all([
    input.admin
      .from(paymentTable)
      .select('amount,refunded_amount,status')
      .eq(foreignKey, input.orderId),
    input.admin
      .from(orderTable)
      .select(`id,status,${totalColumn}`)
      .eq('id', input.orderId)
      .maybeSingle(),
  ]);
  if (!order) throw new Error('The FabricTrad order is unavailable for reconciliation.');

  const captured = (payments || [])
    .filter((payment) => ['captured', 'partially_refunded', 'refunded'].includes(String(payment.status)))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const refunded = (payments || []).reduce(
    (sum, payment) => sum + Number(payment.refunded_amount || 0),
    0
  );
  const netPaid = Math.max(0, roundMoney(captured - refunded));
  const total = roundMoney(Number(order[totalColumn] || 0));
  const paymentStatus =
    refunded >= captured && captured > 0
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
  if (paymentStatus === 'paid') patch.status = 'paid';
  await input.admin.from(orderTable).update(patch).eq('id', input.orderId);
  return { paymentStatus, amountPaid: roundMoney(captured), amountRefunded: roundMoney(refunded) };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return json({ error: 'Invalid verification request.' }, 400);
  }

  const suppliedOrderId =
    typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id.trim() : '';
  const paymentId =
    typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id.trim() : '';
  const signature =
    typeof body.razorpay_signature === 'string' ? body.razorpay_signature.trim() : '';
  if (!suppliedOrderId || !paymentId || !signature) {
    return json({ error: 'Payment verification details are incomplete.' }, 400);
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    return json(
      { error: 'Payment verification is temporarily unavailable.', code: 'PAYMENT_SERVICE_UNAVAILABLE' },
      503
    );
  }

  const admin = createAdminClient();
  let kind: PaymentKind | null = null;
  let record: Record<string, unknown> | null = null;

  const { data: catalogPayment } = await admin
    .from('catalog_order_payments')
    .select('id,catalog_order_id,razorpay_order_id,amount,currency,status')
    .eq('razorpay_order_id', suppliedOrderId)
    .maybeSingle();
  if (catalogPayment) {
    kind = 'catalog';
    record = { ...catalogPayment, fabrictradOrderId: catalogPayment.catalog_order_id };
  } else {
    const { data: bulkPayment } = await admin
      .from('bulk_order_payments')
      .select('id,bulk_order_id,razorpay_order_id,amount,currency,status')
      .eq('razorpay_order_id', suppliedOrderId)
      .maybeSingle();
    if (bulkPayment) {
      kind = 'bulk';
      record = { ...bulkPayment, fabrictradOrderId: bulkPayment.bulk_order_id };
    }
  }
  if (!kind || !record) return json({ error: 'Stored payment order not found.' }, 404);

  const storedRazorpayOrderId = String(record.razorpay_order_id || '');
  if (storedRazorpayOrderId !== suppliedOrderId) {
    return json({ error: 'Payment order reference does not match the server record.' }, 400);
  }
  if (
    !verifyCheckoutSignature({
      storedOrderId: storedRazorpayOrderId,
      paymentId,
      signature,
      keySecret,
    })
  ) {
    return json({ error: 'Payment signature is invalid.' }, 400);
  }

  const fabrictradOrderId = String(record.fabrictradOrderId || '');
  const orderTable = kind === 'catalog' ? 'catalog_order_requests' : 'bulk_orders';
  const { data: ownedOrder } = await admin
    .from(orderTable)
    .select('id,buyer_id')
    .eq('id', fabrictradOrderId)
    .eq('buyer_id', user.id)
    .maybeSingle();
  if (!ownedOrder) return json({ error: 'This payment does not belong to your account.' }, 403);

  let payment;
  try {
    payment = await fetchRazorpayPayment({ paymentId, keyId, keySecret });
    assertRazorpayPaymentMatches({
      payment,
      expectedPaymentId: paymentId,
      expectedOrderId: storedRazorpayOrderId,
      expectedAmountRupees: Number(record.amount || 0),
      expectedCurrency: String(record.currency || 'INR'),
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Razorpay payment confirmation failed.' },
      409
    );
  }

  const paymentTable = kind === 'catalog' ? 'catalog_order_payments' : 'bulk_order_payments';
  const nextStatus = payment.status === 'captured' || payment.captured ? 'captured' : 'authorized';
  const update: Record<string, unknown> = {
    razorpay_payment_id: payment.id,
    razorpay_signature: signature,
    status: nextStatus,
    captured_amount: nextStatus === 'captured' ? paiseToRupees(payment.amount) : null,
    payment_method: payment.method || null,
    razorpay_fee_actual: paiseToRupees(payment.fee),
    razorpay_tax_actual: paiseToRupees(payment.tax),
    failure_reason: null,
    updated_at: new Date().toISOString(),
  };
  if (nextStatus === 'captured') update.captured_at = new Date().toISOString();
  const { error: updateError } = await admin
    .from(paymentTable)
    .update(update)
    .eq('id', String(record.id));
  if (updateError) return json({ error: 'Payment confirmation could not be stored.' }, 503);

  const reconciliation =
    nextStatus === 'captured'
      ? await reconcileOrderPayment({ admin, kind, orderId: fabrictradOrderId })
      : null;

  return json({
    verified: true,
    status: nextStatus,
    paymentId: payment.id,
    orderId: fabrictradOrderId,
    orderType: kind,
    reconciliation,
    message:
      nextStatus === 'captured'
        ? 'Payment captured and order records reconciled.'
        : 'Payment authorised. Capture confirmation will be completed by the signed webhook.',
  });
}
