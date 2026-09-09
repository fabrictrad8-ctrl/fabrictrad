import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FUNDED_BY = ['Seller', 'FabricTrad', 'Shared 50/50', 'Custom Split'] as const;
const NOTES_MAX = 500;

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
  return 'active';
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
      .from('sponsored_placements')
      .update({ status: action === 'pause' ? 'paused' : 'active' })
      .eq('id', id)
      .select('*')
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ placement: { ...data, displayStatus: displayStatus(data) } });
  }

  if (action === 'edit') {
    // product_id and seller_id are intentionally not editable here — a sponsored
    // placement always belongs to the product it was created for, matching how
    // AdminDiscounts locks its type/target fields once a campaign exists.
    const updates: Record<string, unknown> = {};
    if (body.startDate !== undefined) updates.start_date = String(body.startDate);
    if (body.endDate !== undefined) updates.end_date = String(body.endDate);
    if (body.startDate !== undefined || body.endDate !== undefined) {
      const { data: current, error: currentError } = await supabase
        .from('sponsored_placements')
        .select('start_date,end_date')
        .eq('id', id)
        .maybeSingle();
      if (currentError) return json({ error: 'The placement could not be looked up.' }, 503);
      if (!current) return json({ error: 'That placement does not exist.' }, 404);
      const nextStart = String(updates.start_date ?? current.start_date);
      const nextEnd = String(updates.end_date ?? current.end_date);
      if (nextEnd < nextStart) return json({ error: 'End date must be on or after the start date.' }, 400);
    }
    if (body.fundedBy !== undefined) {
      const fundedBy = String(body.fundedBy);
      if (!FUNDED_BY.includes(fundedBy as (typeof FUNDED_BY)[number])) return json({ error: 'Invalid funding source.' }, 400);
      updates.funded_by = fundedBy;
    }
    if (body.dailyRate !== undefined) {
      const dailyRate = body.dailyRate === '' || body.dailyRate === null ? null : Number(body.dailyRate);
      if (dailyRate !== null && (!Number.isFinite(dailyRate) || dailyRate < 0)) return json({ error: 'Daily rate is invalid.' }, 400);
      updates.daily_rate = dailyRate;
    }
    if (body.notes !== undefined) {
      const notes = body.notes === null ? null : String(body.notes).trim() || null;
      if (notes !== null && notes.length > NOTES_MAX) return json({ error: `Notes must be ${NOTES_MAX} characters or fewer.` }, 400);
      updates.notes = notes;
    }
    if (Object.keys(updates).length === 0) return json({ error: 'No changes supplied.' }, 400);

    const { data, error } = await supabase.from('sponsored_placements').update(updates).eq('id', id).select('*').single();
    if (error) return json({ error: error.message }, 400);
    return json({ placement: { ...data, displayStatus: displayStatus(data) } });
  }

  return json({ error: 'Unsupported action.' }, 400);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdministrator();
  if (access.error) return access.error;
  const { id } = await params;

  const supabase = await createClient();
  const { error } = await supabase.from('sponsored_placements').delete().eq('id', id);
  if (error) return json({ error: error.message }, 400);
  return json({ success: true });
}
