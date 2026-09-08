import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpayCredentials } from '@/lib/razorpayCredentials';
import { assertRazorpayPaymentMatches, fetchRazorpayPayment, paiseToRupees, verifyCheckoutSignature } from '@/lib/razorpayIntegrity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Sign in to confirm this payment.' }, 401);

  const body = (await request.json().catch(() => ({}))) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  const orderId = String(body.razorpay_order_id || '').trim();
  const paymentId = String(body.razorpay_payment_id || '').trim();
  const signature = String(body.razorpay_signature || '').trim();
  if (!orderId || !paymentId || !signature) return json({ error: 'Incomplete payment confirmation.' }, 400);

  const admin = createAdminClient();
  const { data: purchase, error: purchaseError } = await admin
    .from('drape_credit_purchases')
    .select('id,buyer_id,credits,amount_paise,razorpay_order_id,status')
    .eq('razorpay_order_id', orderId)
    .maybeSingle();
  if (purchaseError || !purchase) return json({ error: 'This payment order was not found.' }, 404);
  if (purchase.buyer_id !== user.id) return json({ error: 'This payment order belongs to a different account.' }, 403);

  const credentials = await getRazorpayCredentials();
  if (!credentials) return json({ error: 'Payments are not configured yet.', code: 'RAZORPAY_NOT_CONFIGURED' }, 503);

  if (!verifyCheckoutSignature({ storedOrderId: orderId, paymentId, signature, keySecret: credentials.keySecret })) {
    return json({ error: 'Payment signature could not be verified.' }, 400);
  }

  try {
    const payment = await fetchRazorpayPayment({ paymentId, keyId: credentials.keyId, keySecret: credentials.keySecret });
    assertRazorpayPaymentMatches({
      payment,
      expectedPaymentId: paymentId,
      expectedOrderId: orderId,
      expectedAmountRupees: paiseToRupees(purchase.amount_paise),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Payment could not be confirmed.' }, 502);
  }

  const { data: credited, error: creditError } = await admin.rpc('credit_drape_purchase', {
    p_razorpay_order_id: orderId,
    p_razorpay_payment_id: paymentId,
  });
  if (creditError) return json({ error: 'Payment was confirmed but credits could not be applied. Contact support.' }, 500);

  const { data: balance } = await supabase.rpc('get_drape_credit_balance');
  return json({
    ok: true,
    alreadyCredited: credited?.alreadyCredited === true,
    creditsAdded: credited?.creditsAdded ?? purchase.credits,
    balance: balance || null,
  });
}
