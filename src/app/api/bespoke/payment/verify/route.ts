import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getRazorpayCredentials } from '@/lib/razorpayCredentials';
import {
  recordBespokePaymentAuthorization,
  recordBespokePaymentCapture,
  type BespokePaymentLedger,
  type RazorpayPaymentEntity,
} from '@/lib/server/bespokePaymentReconciliation';

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
  const [{ data: order, error: orderError }, { data: ledger, error: ledgerError }] = await Promise.all([
    admin
      .from('bespoke_orders')
      .select('id,user_id,stage,quoted_amount,paid_amount,razorpay_order_id')
      .eq('id', orderId)
      .eq('user_id', auth.user.id)
      .maybeSingle(),
    admin
      .from('bespoke_payments')
      .select('id,bespoke_order_id,user_id,razorpay_order_id,razorpay_payment_id,payment_purpose,amount,currency,status,refunded_amount,refund_status,last_refund_id')
      .eq('bespoke_order_id', orderId)
      .eq('user_id', auth.user.id)
      .eq('razorpay_order_id', razorpayOrderId)
      .maybeSingle(),
  ]);
  if (orderError || ledgerError) return json({ error: 'Custom payment state could not be loaded.' }, 503);
  if (!order || !ledger) return json({ error: 'Custom payment session not found.' }, 404);
  if (order.razorpay_order_id !== razorpayOrderId) {
    return json({ error: 'Payment order does not match the active custom-order checkout.' }, 409);
  }

  const alreadyProcessed =
    ledger.razorpay_payment_id === paymentId &&
    ['captured', 'partially_refunded', 'refunded'].includes(String(ledger.status));

  const { data: duplicatePayment } = await admin
    .from('bespoke_payments')
    .select('id,bespoke_order_id,status')
    .eq('razorpay_payment_id', paymentId)
    .maybeSingle();
  if (duplicatePayment?.id && duplicatePayment.id !== ledger.id) {
    return json({ error: 'This Razorpay payment was already reconciled to another payment session.' }, 409);
  }

  const providerResponse = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    }
  ).catch(() => null);
  if (!providerResponse) return json({ error: 'Razorpay could not be reached for verification.' }, 503);
  const provider = (await providerResponse.json().catch(() => ({}))) as RazorpayPaymentEntity & {
    error?: { description?: string };
  };
  if (!providerResponse.ok) {
    return json({ error: provider.error?.description || 'Razorpay could not verify this payment.' }, 503);
  }

  const providerStatus = String(provider.status || '').toLowerCase();
  if (
    provider.id !== paymentId ||
    provider.order_id !== razorpayOrderId ||
    provider.currency !== 'INR'
  ) {
    return json({ error: 'Razorpay payment identity does not match this checkout.' }, 409);
  }
  if (providerStatus !== 'captured' && provider.captured !== true) {
    const authorized = providerStatus === 'authorized';
    if (authorized) {
      await recordBespokePaymentAuthorization(admin, {
        ledger: ledger as BespokePaymentLedger,
        entity: provider,
        eventType: 'browser.payment.authorized',
      });
    } else {
      await admin
        .from('bespoke_payments')
        .update({
          provider_status: providerStatus || 'unknown',
          provider_payload: provider,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ledger.id);
    }
    return json(
      {
        error: 'Razorpay has authorized the payment but has not confirmed capture yet. Refresh shortly; FabricTrad will not mark an uncaptured payment as paid.',
        code: 'PAYMENT_CAPTURE_PENDING',
      },
      409
    );
  }

  const paymentRupees = roundMoney(Number(provider.amount || 0) / 100);
  if (!(paymentRupees > 0) || paymentRupees !== roundMoney(Number(ledger.amount || 0))) {
    return json({ error: 'Verified payment amount does not match the reserved amount.' }, 409);
  }

  let reconciliation;
  try {
    reconciliation = await recordBespokePaymentCapture(admin, {
      ledger: ledger as BespokePaymentLedger,
      entity: provider,
      eventType: 'browser.payment.captured',
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === '23505') {
      return json({ error: 'This Razorpay payment has already been reconciled.' }, 409);
    }
    console.error('Bespoke browser payment reconciliation failed', {
      orderId,
      paymentId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return json({ error: 'Payment is captured but the custom order could not be reconciled.' }, 500);
  }

  return json({
    verified: true,
    order: reconciliation.order,
    paidAmount: reconciliation.paidAmount,
    balanceAmount: reconciliation.balanceAmount,
    fullyPaid: reconciliation.fullyPaid,
    alreadyProcessed,
  });
}
