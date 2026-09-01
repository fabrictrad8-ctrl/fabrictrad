import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getRazorpayCredentials } from '@/lib/razorpayCredentials';
import { rupeesToPaise } from '@/lib/razorpayIntegrity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Authentication required.' }, 401);

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    choice?: 'advance' | 'full';
  };
  const orderId = String(body.orderId || '').trim();
  const choice = body.choice === 'advance' ? 'advance' : 'full';
  if (!orderId) return json({ error: 'Custom order is required.' }, 400);

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from('bespoke_orders')
    .select('id,user_id,stage,quoted_amount,advance_amount,paid_amount,balance_amount,payment_status')
    .eq('id', orderId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (orderError) return json({ error: 'Custom order could not be loaded.' }, 503);
  if (!order) return json({ error: 'Custom order not found.' }, 404);
  if (!['advance_or_full_payment', 'balance_payment'].includes(String(order.stage))) {
    return json({ error: 'This custom order is not ready for payment.' }, 409);
  }

  const quoted = roundMoney(Number(order.quoted_amount || 0));
  const paid = roundMoney(Number(order.paid_amount || 0));
  const remaining = Math.max(0, roundMoney(quoted - paid));
  if (!(quoted > 0) || remaining < 0.01) return json({ error: 'There is no payable balance on this order.' }, 409);

  let due = remaining;
  let purpose: 'advance' | 'full' | 'balance' = order.stage === 'balance_payment' ? 'balance' : 'full';
  if (order.stage === 'advance_or_full_payment' && choice === 'advance') {
    const configuredAdvance = roundMoney(Number(order.advance_amount || 0));
    if (!(configuredAdvance > 0) || configuredAdvance >= quoted) {
      return json({ error: 'An advance amount has not been configured for this quotation. Pay in full or contact FabricTrad.' }, 409);
    }
    due = Math.min(remaining, configuredAdvance);
    purpose = 'advance';
  }

  const credentials = await getRazorpayCredentials();
  if (!credentials) return json({ error: 'Payment service is temporarily unavailable.' }, 503);
  const amountPaise = rupeesToPaise(due);
  if (amountPaise < 100) return json({ error: 'Payment amount is below the supported minimum.' }, 400);

  const providerResponse = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: `bespoke_${orderId.replace(/-/g, '').slice(0, 24)}`,
      notes: {
        fabrictrad_order_type: 'bespoke',
        fabrictrad_bespoke_order_id: orderId,
        fabrictrad_payment_purpose: purpose,
        fabrictrad_user_id: auth.user.id,
      },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);

  if (!providerResponse) return json({ error: 'Razorpay could not be reached. Please retry.' }, 503);
  const provider = (await providerResponse.json().catch(() => ({}))) as {
    id?: string;
    amount?: number;
    currency?: string;
    error?: { description?: string };
  };
  if (!providerResponse.ok || !provider.id || provider.amount !== amountPaise || provider.currency !== 'INR') {
    return json({ error: provider.error?.description || 'Razorpay could not create this payment.' }, 503);
  }

  const { error: saveError } = await admin
    .from('bespoke_orders')
    .update({
      razorpay_order_id: provider.id,
      payment_choice: choice,
      payment_status: 'payment_link_created',
      balance_amount: remaining,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);
  if (saveError) return json({ error: 'Payment was created but could not be attached to the custom order.' }, 500);

  return json({
    keyId: credentials.keyId,
    razorpayOrderId: provider.id,
    amount: amountPaise,
    amountRupees: due,
    currency: 'INR',
    orderId,
    purpose,
    remainingBeforePayment: remaining,
  });
}
