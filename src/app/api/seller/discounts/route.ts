import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CAMPAIGN_TYPES = ['Product-specific', 'Seller-specific', 'Coupon Code'] as const;

type SellerAccess =
  | { user: User; supabase: SupabaseClient; sellerId: string; error?: never }
  | { user?: never; supabase?: never; sellerId?: never; error: NextResponse };

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

// Mirrors can_current_user_sell()/my_seller_id() so the API can give a clear
// error before RLS would otherwise just reject the write outright.
async function requireSeller(): Promise<SellerAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: json({ error: 'Seller sign-in required.' }, 401) };

  const { data: profile } = await supabase.from('user_profiles').select('role,is_active,can_sell').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'seller' || profile.is_active !== true || profile.can_sell !== true) {
    return { error: json({ error: 'Seller access is required.' }, 403) };
  }

  const { data: seller } = await supabase.from('seller_profiles').select('id,is_active,verification_status').eq('user_id', user.id).maybeSingle();
  if (!seller || seller.is_active !== true || seller.verification_status !== 'verified') {
    return { error: json({ error: 'Your seller account must be verified before you can create campaigns.' }, 403) };
  }

  return { user, supabase, sellerId: seller.id };
}

function displayStatus(row: { status: string; start_date: string; end_date: string }): string {
  if (row.status === 'paused') return 'paused';
  const today = new Date().toISOString().slice(0, 10);
  if (row.end_date < today) return 'expired';
  if (row.start_date > today) return 'scheduled';
  return row.status === 'scheduled' ? 'active' : row.status;
}

export async function GET() {
  const access = await requireSeller();
  if (access.error) return access.error;

  const { data, error } = await access.supabase
    .from('discount_campaigns')
    .select('*')
    .eq('created_by', access.user.id)
    .order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 503);

  const campaigns = (data || []).map((row) => ({ ...row, displayStatus: displayStatus(row) }));
  return json({ campaigns });
}

export async function POST(request: NextRequest) {
  const access = await requireSeller();
  if (access.error) return access.error;
  const { supabase, user, sellerId } = access;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name || '').trim();
  const campaignType = String(body.campaignType || '');
  const discountPercent = Number(body.discountPercent);
  const minOrderValue = Number(body.minOrderValue || 0);
  const maxDiscount = body.maxDiscount === '' || body.maxDiscount == null ? null : Number(body.maxDiscount);
  const usageLimit = body.usageLimit === '' || body.usageLimit == null ? null : Number(body.usageLimit);
  const startDate = String(body.startDate || '');
  const endDate = String(body.endDate || '');
  const rawTargetProductKey = body.targetProductKey ? String(body.targetProductKey).trim() : null;
  const rawCode = typeof body.code === 'string' ? body.code.trim() : '';

  if (name.length < 3 || name.length > 120) return json({ error: 'Campaign name must be 3-120 characters.' }, 400);
  if (!CAMPAIGN_TYPES.includes(campaignType as (typeof CAMPAIGN_TYPES)[number])) return json({ error: 'Invalid campaign type.' }, 400);
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) return json({ error: 'Discount must be between 1 and 100%.' }, 400);
  if (!Number.isFinite(minOrderValue) || minOrderValue < 0) return json({ error: 'Minimum order value is invalid.' }, 400);
  if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount < 0)) return json({ error: 'Max discount cap is invalid.' }, 400);
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) return json({ error: 'Usage limit must be a positive whole number.' }, 400);
  if (!startDate || !endDate || endDate < startDate) return json({ error: 'End date must be on or after the start date.' }, 400);

  // A seller can only ever fund their own campaigns and can never target
  // another shop's products or shop-wide scope - the RLS policy this mirrors
  // (discount_campaigns_seller_insert) rejects anything else regardless.
  let targetProductKey: string;
  if (campaignType === 'Product-specific') {
    if (!rawTargetProductKey) return json({ error: 'Pick which product this campaign applies to.' }, 400);
    const { data: product, error: productError } = await supabase
      .from('seller_products')
      .select('id,seller_id')
      .eq('id', rawTargetProductKey)
      .maybeSingle();
    if (productError) return json({ error: 'The product could not be looked up.' }, 503);
    if (!product || product.seller_id !== sellerId) return json({ error: 'That product does not belong to your shop.' }, 400);
    targetProductKey = product.id;
  } else {
    targetProductKey = sellerId;
  }

  let code: string | null = null;
  if (campaignType === 'Coupon Code') {
    if (!rawCode) return json({ error: 'Coupon Code campaigns need the code buyers will type in.' }, 400);
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(rawCode)) {
      return json({ error: 'Codes must be 3-32 characters: letters, numbers, hyphens or underscores only.' }, 400);
    }
    code = rawCode.toUpperCase();
    const { data: existingCode, error: codeLookupError } = await supabase
      .from('discount_campaigns')
      .select('id')
      .ilike('code', code)
      .maybeSingle();
    if (codeLookupError) return json({ error: 'The code could not be checked for uniqueness.' }, 503);
    if (existingCode?.id) return json({ error: 'That code is already in use by another campaign.' }, 409);
  }

  const today = new Date().toISOString().slice(0, 10);
  const status = startDate > today ? 'scheduled' : 'active';

  const { data, error } = await supabase
    .from('discount_campaigns')
    .insert({
      name,
      campaign_type: campaignType,
      target_product_key: targetProductKey,
      code,
      discount_percent: discountPercent,
      min_order_value: minOrderValue,
      max_discount: maxDiscount,
      usage_limit: usageLimit,
      start_date: startDate,
      end_date: endDate,
      funded_by: 'Seller',
      status,
      created_by: user.id,
    })
    .select('*')
    .single();
  if (error) return json({ error: error.message }, 400);

  return json({ campaign: { ...data, displayStatus: displayStatus(data) } }, 201);
}
