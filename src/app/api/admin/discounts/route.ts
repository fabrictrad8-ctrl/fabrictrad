import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CAMPAIGN_TYPES = [
  'Website-wide',
  'Product-specific',
  'Category',
  'Seller-specific',
  'Buyer-specific',
  'First-order',
  'Flash Sale',
  'Coupon Code',
  'Festival Offer',
  'Free Shipping',
] as const;
const FUNDED_BY = ['FabricTrad', 'Seller', 'Shared 50/50', 'Custom Split'] as const;

type AdminAccess = { user: User; error?: never } | { user?: never; error: NextResponse };

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

async function requireAdministrator(): Promise<AdminAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: json({ error: 'Administrator sign-in required.' }, 401) };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .maybeSingle();

  const allowed = profile?.is_active === true && (profile.role === 'super_admin' || profile.role === 'admin_staff');
  if (!allowed) return { error: json({ error: 'Administrator access required.' }, 403) };
  return { user };
}

function displayStatus(row: { status: string; start_date: string; end_date: string }): string {
  if (row.status === 'paused') return 'paused';
  const today = new Date().toISOString().slice(0, 10);
  if (row.end_date < today) return 'expired';
  if (row.start_date > today) return 'scheduled';
  return row.status === 'scheduled' ? 'active' : row.status;
}

export async function GET() {
  const access = await requireAdministrator();
  if (access.error) return access.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('discount_campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 503);

  const campaigns = (data || []).map((row) => ({ ...row, displayStatus: displayStatus(row) }));
  return json({ campaigns });
}

export async function POST(request: NextRequest) {
  const access = await requireAdministrator();
  if (access.error) return access.error;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name || '').trim();
  const campaignType = String(body.campaignType || '');
  const discountPercent = Number(body.discountPercent);
  const minOrderValue = Number(body.minOrderValue || 0);
  const maxDiscount = body.maxDiscount === '' || body.maxDiscount == null ? null : Number(body.maxDiscount);
  const usageLimit = body.usageLimit === '' || body.usageLimit == null ? null : Number(body.usageLimit);
  const startDate = String(body.startDate || '');
  const endDate = String(body.endDate || '');
  const fundedBy = String(body.fundedBy || 'FabricTrad');
  const targetProductKey = body.targetProductKey ? String(body.targetProductKey).trim() : null;

  if (name.length < 3 || name.length > 120) return json({ error: 'Campaign name must be 3-120 characters.' }, 400);
  if (!CAMPAIGN_TYPES.includes(campaignType as (typeof CAMPAIGN_TYPES)[number])) return json({ error: 'Invalid campaign type.' }, 400);
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) return json({ error: 'Discount must be between 1 and 100%.' }, 400);
  if (!Number.isFinite(minOrderValue) || minOrderValue < 0) return json({ error: 'Minimum order value is invalid.' }, 400);
  if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount < 0)) return json({ error: 'Max discount cap is invalid.' }, 400);
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) return json({ error: 'Usage limit must be a positive whole number.' }, 400);
  if (!startDate || !endDate || endDate < startDate) return json({ error: 'End date must be on or after the start date.' }, 400);
  if (!FUNDED_BY.includes(fundedBy as (typeof FUNDED_BY)[number])) return json({ error: 'Invalid funding source.' }, 400);
  if (campaignType === 'Product-specific' && !targetProductKey) return json({ error: 'Product-specific campaigns need a target product.' }, 400);
  if (campaignType === 'Category' && !targetProductKey) return json({ error: 'Category campaigns need a target category.' }, 400);
  if (campaignType === 'Seller-specific' && !targetProductKey) return json({ error: 'Seller-specific campaigns need a target seller.' }, 400);

  const today = new Date().toISOString().slice(0, 10);
  const status = startDate > today ? 'scheduled' : 'active';

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('discount_campaigns')
    .insert({
      name,
      campaign_type: campaignType,
      target_product_key: targetProductKey,
      discount_percent: discountPercent,
      min_order_value: minOrderValue,
      max_discount: maxDiscount,
      usage_limit: usageLimit,
      start_date: startDate,
      end_date: endDate,
      funded_by: fundedBy,
      status,
      created_by: access.user.id,
    })
    .select('*')
    .single();
  if (error) return json({ error: error.message }, 400);

  return json({ campaign: { ...data, displayStatus: displayStatus(data) } }, 201);
}
