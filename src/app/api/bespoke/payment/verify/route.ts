import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getRazorpayCredentials } from '@/lib/razorpayCredentials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
const roundMoney = (value: number) => Math.round(value * 100) / 100;

const signatureMatches = (orderId: string, paymentId: string, signature: string, secret: string) => {
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(signature);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Authentication required.' }, 401);

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  const orderId = String(body.orderId || '').trim();
  const razorpayOrderId = String(body.razorpay_order_id || '').trim();
  const paymentId = String(body.razorpay_payment_id || '').trim();
  const signature = String(body.razorpay_signature || '').trim();
  if (!orderId || !razorpayOrderId || !paymentId || !signature) {
    return json({ error: 'Payment verification details are incomplete.' }, 400);
  }

  const credentials = await getRazorpayCredentials();
  if (!credentials) return json({ error: 'Payment verification service is unavailable.' }, 503);
  if (!signatureMatches(razorpayOrderId, paymentId, signature, credentials.keySecret)) {
    return json({ error: 'Payment signature is invalid.' }, 400);
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from('bespoke_orders')
    .select('id,user_id,stage,quoted_amount,paid_amount,razorpay_order_id')
    .eq('id', orderId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (orderError) return json({ error: 'Custom order could not be loaded.' }, 503);
  if (!order) return json({ error: 'Custom order not found.' }, 404);
  if (order.razorpay_order_id !== razorpayOrderId) return json({ error: 'Payment order does not match this custom order.' }, 409);

  const providerResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!providerResponse) return json({ error: 'Razorpay could not be reached for verification.' }, 503);
  const provider = (await providerResponse.json().catch(() => ({}))) as {
    id?: string;
    order_id?: string;
    amount?: number;
    currency?: string;
    status?: string;
    captured?: boolean;
    error?: { description?: string };
  };
  if (!providerResponse.ok) return json({ error: provider.error?.description || 'Razorpay could not verify this payment.' }, 503);
  if (
    provider.id !== paymentId ||
    provider.order_id !== razorpayOrderId ||
    provider.currency !== 'INR' ||
    !['captured', 'authorized'].includes(String(provider.status || '').toLowerCase())
  ) {
    return json({ error: 'Razorpay has not confirmed this payment as payable/captured.' }, 409);
  }

  const paymentRupees = roundMoney(Number(provider.amount || 0) / 100);
  if (!(paymentRupees > 0)) return json({ error: 'Verified payment amount is invalid.' }, 409);
  const quoted = roundMoney(Number(order.quoted_amount || 0));
  const previousPaid = roundMoney(Number(order.paid_amount || 0));

  // The same payment ID can be submitted multiple times by the browser callback.
  // Once attached to this order, verification is idempotent and does not add it twice.
  if ((order as Record<string, unknown>).razorpay_payment_id === paymentId) {
    return json({ verified: true, orderId, alreadyProcessed: true });
  }

  const newPaid = Math.min(quoted, roundMoney(previousPaid + paymentRupees));
  const remaining = Math.max(0, roundMoney(quoted - newPaid));
  const fullyPaid = quoted > 0 && remaining < 0.01;
  const nextStage = order.stage === 'balance_payment' && fullyPaid ? 'delivery_or_pickup' : 'stitching';

  const { data: updated, error: updateError } = await admin
    .from('bespoke_orders')
    .update({
      razorpay_payment_id: paymentId,
      paid_amount: newPaid,
      balance_amount: remaining,
      payment_status: fullyPaid ? 'paid' : 'part_paid',
      stage: nextStage,
      human_action_required: false,
      human_action_reason: null,
      stitching_status: nextStage === 'stitching' ? 'queued' : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select('*')
    .single();
  if (updateError) return json({ error: 'Payment is verified but the order could not be reconciled.' }, 500);

  await admin
    .from('bespoke_follow_up_jobs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('bespoke_order_id', orderId)
    .eq('job_type', 'payment_reminder')
    .eq('status', 'pending');

  return json({ verified: true, order: updated, paidAmount: newPaid, balanceAmount: remaining, fullyPaid });
}
