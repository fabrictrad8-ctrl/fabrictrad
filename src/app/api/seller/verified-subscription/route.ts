import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpayCredentials } from '@/lib/razorpayCredentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRICE_PAISE = 20_000;
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
const authHeader = (keyId: string, keySecret: string) => `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

type Membership = {
  seller_id: string;
  source: 'early_bird' | 'subscription';
  status: string;
  early_bird_number: number | null;
  monthly_price_paise: number;
  razorpay_plan_id: string | null;
  razorpay_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

async function sellerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, seller: null };
  const { data: seller } = await supabase.from('seller_profiles').select('id,user_id,is_active,verification_status,email').eq('user_id', user.id).maybeSingle();
  const eligible = seller?.is_active === true && ['verified', 'approved', 'active'].includes(String(seller.verification_status || '').toLowerCase());
  return { supabase, user, seller: eligible ? seller : null };
}

async function syncProviderMembership(membership: Membership) {
  if (membership.source !== 'subscription' || !membership.razorpay_subscription_id) return membership;
  const credentials = await getRazorpayCredentials();
  if (!credentials) return membership;
  try {
    const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(membership.razorpay_subscription_id)}`, {
      headers: { Authorization: authHeader(credentials.keyId, credentials.keySecret), Accept: 'application/json' },
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    const provider = await response.json().catch(() => ({})) as { status?: string; current_start?: number; current_end?: number };
    if (!response.ok) return membership;
    const mapped = ['active', 'authenticated'].includes(String(provider.status || '')) ? 'active' : provider.status === 'halted' ? 'past_due' : ['cancelled', 'completed'].includes(String(provider.status || '')) ? 'cancelled' : membership.status;
    const start = provider.current_start ? new Date(provider.current_start * 1000).toISOString() : membership.current_period_start;
    const end = provider.current_end ? new Date(provider.current_end * 1000).toISOString() : membership.current_period_end;
    const admin = createAdminClient();
    await admin.from('seller_verified_memberships').update({ status: mapped, current_period_start: start, current_period_end: end, updated_at: new Date().toISOString() }).eq('seller_id', membership.seller_id);
    return { ...membership, status: mapped, current_period_start: start, current_period_end: end };
  } catch { return membership; }
}

export async function GET() {
  const { user, seller } = await sellerContext();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  if (!seller) return json({ error: 'An active verified seller account is required.' }, 403);
  const admin = createAdminClient();
  const { data } = await admin.from('seller_verified_memberships').select('*').eq('seller_id', seller.id).maybeSingle();
  const membership = data ? await syncProviderMembership(data as Membership) : null;
  const { count } = await admin.from('seller_verified_memberships').select('id', { count: 'exact', head: true }).eq('source', 'early_bird');
  return json({
    membership,
    verified: membership?.status === 'active' && (membership.source === 'early_bird' || !membership.current_period_end || new Date(membership.current_period_end).getTime() > Date.now()),
    earlyBirdClaimed: count || 0,
    earlyBirdRemaining: Math.max(0, 100 - (count || 0)),
    monthlyPricePaise: PRICE_PAISE,
    monthlyPriceRupees: 200,
  });
}

export async function POST() {
  const { supabase, user, seller } = await sellerContext();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  if (!seller) return json({ error: 'An active verified seller account is required.' }, 403);
  const admin = createAdminClient();
  const { data: existing } = await admin.from('seller_verified_memberships').select('*').eq('seller_id', seller.id).maybeSingle();
  if (existing?.status === 'active') return json({ membership: existing, verified: true, message: existing.source === 'early_bird' ? `Early Bird #${existing.early_bird_number} — Verified free.` : 'Verified Seller subscription is active.' });

  if (!existing) {
    const early = await supabase.rpc('claim_verified_seller_early_bird', { p_seller_id: seller.id });
    if (!early.error && early.data) return json({ membership: early.data, verified: true, earlyBird: true, message: `Early Bird #${early.data.early_bird_number} — Verified free.` });
  }

  const credentials = await getRazorpayCredentials();
  if (!credentials) return json({ error: 'Razorpay subscription service is unavailable.' }, 503);
  let planId = existing?.razorpay_plan_id || null;
  if (!planId) {
    const { data: planRow } = await admin.from('seller_verified_memberships').select('razorpay_plan_id').not('razorpay_plan_id', 'is', null).limit(1).maybeSingle();
    planId = planRow?.razorpay_plan_id || null;
  }
  if (!planId) {
    const response = await fetch('https://api.razorpay.com/v1/plans', {
      method: 'POST',
      headers: { Authorization: authHeader(credentials.keyId, credentials.keySecret), 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: 'monthly', interval: 1, item: { name: 'FabricTrad Verified Seller', amount: PRICE_PAISE, currency: 'INR', description: 'FabricTrad Verified Seller — ₹200/month' }, notes: { product: 'fabrictrad_verified_seller' } }),
      cache: 'no-store', signal: AbortSignal.timeout(20_000),
    });
    const plan = await response.json().catch(() => ({})) as { id?: string; error?: { description?: string } };
    if (!response.ok || !plan.id) return json({ error: plan.error?.description || 'Razorpay could not create the Verified Seller plan.' }, 502);
    planId = plan.id;
  }

  const subResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: { Authorization: authHeader(credentials.keyId, credentials.keySecret), 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan_id: planId, total_count: 100, quantity: 1, customer_notify: 1, notes: { seller_id: seller.id, user_id: user.id, product: 'fabrictrad_verified_seller' } }),
    cache: 'no-store', signal: AbortSignal.timeout(20_000),
  });
  const subscription = await subResponse.json().catch(() => ({})) as { id?: string; error?: { description?: string } };
  if (!subResponse.ok || !subscription.id) return json({ error: subscription.error?.description || 'Razorpay could not start the Verified Seller subscription.' }, 502);

  const row = { seller_id: seller.id, user_id: user.id, source: 'subscription', status: 'pending', early_bird_number: null, monthly_price_paise: PRICE_PAISE, currency: 'INR', razorpay_plan_id: planId, razorpay_subscription_id: subscription.id, updated_at: new Date().toISOString() };
  const { data: saved, error: saveError } = await admin.from('seller_verified_memberships').upsert(row, { onConflict: 'seller_id' }).select('*').single();
  if (saveError) return json({ error: 'Subscription was created but the FabricTrad membership record could not be saved.' }, 500);
  return json({ membership: saved, keyId: credentials.keyId, subscriptionId: subscription.id, monthlyPricePaise: PRICE_PAISE });
}

export async function PUT(request: NextRequest) {
  const { user, seller } = await sellerContext();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  if (!seller) return json({ error: 'Seller access required.' }, 403);
  const body = await request.json().catch(() => ({})) as { razorpay_payment_id?: string; razorpay_subscription_id?: string; razorpay_signature?: string };
  if (!body.razorpay_payment_id || !body.razorpay_subscription_id || !body.razorpay_signature) return json({ error: 'Incomplete Razorpay subscription verification.' }, 400);
  const credentials = await getRazorpayCredentials();
  if (!credentials) return json({ error: 'Razorpay verification is unavailable.' }, 503);
  const expected = crypto.createHmac('sha256', credentials.keySecret).update(`${body.razorpay_payment_id}|${body.razorpay_subscription_id}`).digest('hex');
  const received = body.razorpay_signature;
  if (expected.length !== received.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) return json({ error: 'Invalid Razorpay subscription signature.' }, 400);
  const admin = createAdminClient();
  const { data: membership } = await admin.from('seller_verified_memberships').select('*').eq('seller_id', seller.id).eq('razorpay_subscription_id', body.razorpay_subscription_id).maybeSingle();
  if (!membership) return json({ error: 'Subscription does not belong to this seller.' }, 404);
  const now = new Date();
  const end = new Date(now); end.setMonth(end.getMonth() + 1);
  const { data: active, error } = await admin.from('seller_verified_memberships').update({ status: 'active', current_period_start: now.toISOString(), current_period_end: end.toISOString(), updated_at: now.toISOString() }).eq('seller_id', seller.id).select('*').single();
  if (error) return json({ error: 'Payment verified but membership activation failed.' }, 500);
  return json({ verified: true, membership: active, message: 'Verified Seller activated at ₹200/month.' });
}
