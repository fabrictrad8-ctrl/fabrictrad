import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdministrator();
  if (access.error) return access.error;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');

  const supabase = await createClient();

  if (action === 'pause' || action === 'activate') {
    const { data, error } = await supabase
      .from('discount_campaigns')
      .update({ status: action === 'pause' ? 'paused' : 'active' })
      .eq('id', id)
      .select('*')
      .single();
    if (error) return json({ error: error.message }, 400);
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

    const { data, error } = await supabase.from('discount_campaigns').update(updates).eq('id', id).select('*').single();
    if (error) return json({ error: error.message }, 400);
    return json({ campaign: { ...data, displayStatus: displayStatus(data) } });
  }

  return json({ error: 'Unsupported action.' }, 400);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdministrator();
  if (access.error) return access.error;
  const { id } = await params;

  const supabase = await createClient();
  const { error } = await supabase.from('discount_campaigns').delete().eq('id', id);
  if (error) return json({ error: error.message }, 400);
  return json({ success: true });
}
