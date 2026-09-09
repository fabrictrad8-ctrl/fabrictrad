import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SellerAccess =
  | { user: User; supabase: SupabaseClient; sellerId: string; error?: never }
  | { user?: never; supabase?: never; sellerId?: never; error: NextResponse };

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

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
    return { error: json({ error: 'Your seller account must be verified before you can manage campaigns.' }, 403) };
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireSeller();
  if (access.error) return access.error;
  const { supabase, user } = access;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');

  // RLS (discount_campaigns_seller_update) scopes every write below to rows
  // this seller created - a spoofed id from another shop simply matches zero
  // rows rather than being modified.
  if (action === 'pause' || action === 'activate') {
    const { data, error } = await supabase
      .from('discount_campaigns')
      .update({ status: action === 'pause' ? 'paused' : 'active' })
      .eq('id', id)
      .eq('created_by', user.id)
      .select('*')
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: 'That campaign was not found.' }, 404);
    return json({ campaign: { ...data, displayStatus: displayStatus(data) } });
  }

  if (action === 'edit') {
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 3 || name.length > 120) return json({ error: 'Campaign name must be 3-120 characters.' }, 400);
      updates.name = name;
    }
    if (body.discountPercent !== undefined) {
      const discountPercent = Number(body.discountPercent);
      if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) return json({ error: 'Discount must be between 1 and 100%.' }, 400);
      updates.discount_percent = discountPercent;
    }
    if (body.minOrderValue !== undefined) {
      const minOrderValue = Number(body.minOrderValue);
      if (!Number.isFinite(minOrderValue) || minOrderValue < 0) return json({ error: 'Minimum order value is invalid.' }, 400);
      updates.min_order_value = minOrderValue;
    }
    if (body.maxDiscount !== undefined) {
      const maxDiscount = body.maxDiscount === '' || body.maxDiscount === null ? null : Number(body.maxDiscount);
      if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount < 0)) return json({ error: 'Max discount cap is invalid.' }, 400);
      updates.max_discount = maxDiscount;
    }
    if (body.usageLimit !== undefined) {
      const usageLimit = body.usageLimit === '' || body.usageLimit === null ? null : Number(body.usageLimit);
      if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) return json({ error: 'Usage limit must be a positive whole number.' }, 400);
      updates.usage_limit = usageLimit;
    }
    if (body.startDate !== undefined) updates.start_date = String(body.startDate);
    if (body.endDate !== undefined) updates.end_date = String(body.endDate);
    if (Object.keys(updates).length === 0) return json({ error: 'No changes supplied.' }, 400);

    const { data, error } = await supabase
      .from('discount_campaigns')
      .update(updates)
      .eq('id', id)
      .eq('created_by', user.id)
      .select('*')
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: 'That campaign was not found.' }, 404);
    return json({ campaign: { ...data, displayStatus: displayStatus(data) } });
  }

  return json({ error: 'Unsupported action.' }, 400);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireSeller();
  if (access.error) return access.error;
  const { supabase, user } = access;
  const { id } = await params;

  const { data, error } = await supabase.from('discount_campaigns').delete().eq('id', id).eq('created_by', user.id).select('id').maybeSingle();
  if (error) return json({ error: error.message }, 400);
  if (!data) return json({ error: 'That campaign was not found.' }, 404);
  return json({ success: true });
}
