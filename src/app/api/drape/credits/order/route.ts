import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRazorpayCredentials } from '@/lib/razorpayCredentials';
import { rupeesToPaise } from '@/lib/razorpayIntegrity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

// ₹150 per pack of 10 Virtual Drape credits (₹15/credit), linear for larger packs.
const CREDITS_PER_PACK = 10;
const RUPEES_PER_PACK = 150;
const MAX_PACKS = 20;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Sign in to buy Virtual Drape credits.' }, 401);

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,can_buy,is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'buyer' || !profile?.is_active || !profile?.can_buy) {
    return json({ error: 'A buyer account is required to purchase Virtual Drape credits.' }, 403);
  }

  const body = (await request.json().catch(() => ({}))) as { packs?: number };
  const packs = Math.floor(Number(body.packs));
  if (!Number.isInteger(packs) || packs < 1 || packs > MAX_PACKS) {
    return json({ error: `Choose between 1 and ${MAX_PACKS} packs of ${CREDITS_PER_PACK} credits.` }, 400);
  }

  const credentials = await getRazorpayCredentials();
  if (!credentials) return json({ error: 'Payments are not configured yet.', code: 'RAZORPAY_NOT_CONFIGURED' }, 503);

  const credits = packs * CREDITS_PER_PACK;
  const amountRupees = packs * RUPEES_PER_PACK;
  const receipt = `drape_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

  let providerOrder: { id?: string; error?: { description?: string } };
  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: rupeesToPaise(amountRupees),
        currency: 'INR',
        receipt,
        notes: { fabrictrad_purpose: 'virtual_drape_credits', fabrictrad_buyer_id: user.id, credits: String(credits) },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    providerOrder = await response.json().catch(() => ({}));
    if (!response.ok || !providerOrder.id) {
      throw new Error(providerOrder.error?.description || 'Razorpay could not create the order.');
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Payment order could not be created.' }, 503);
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin.from('drape_credit_purchases').insert({
    buyer_id: user.id,
    credits,
    amount_paise: rupeesToPaise(amountRupees),
    razorpay_order_id: providerOrder.id,
    status: 'created',
  });
  if (insertError) return json({ error: 'Payment order could not be recorded.' }, 503);

  return json({
    orderId: providerOrder.id,
    keyId: credentials.keyId,
    amountPaise: rupeesToPaise(amountRupees),
    credits,
    currency: 'INR',
  });
}
