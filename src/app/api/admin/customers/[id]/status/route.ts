import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Administrator sign-in required.' }, 401);

  const { data: administrator } = await supabase
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin =
    administrator?.is_active === true &&
    (administrator.role === 'super_admin' || administrator.role === 'admin_staff');
  if (!isAdmin) return json({ error: 'Administrator access required.' }, 403);

  const { id } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as { active?: unknown };
  if (typeof payload.active !== 'boolean') {
    return json({ error: 'A valid active status is required.' }, 400);
  }
  if (id === user.id && payload.active === false) {
    return json({ error: 'You cannot deactivate your own administrator account.' }, 400);
  }

  const { data: target } = await supabase
    .from('user_profiles')
    .select('id,role,is_active')
    .eq('id', id)
    .maybeSingle();
  if (!target) return json({ error: 'Account not found.' }, 404);

  const targetIsAdmin = target.role === 'super_admin' || target.role === 'admin_staff';
  if (targetIsAdmin && administrator.role !== 'super_admin') {
    return json({ error: 'Only a super administrator can change another administrator.' }, 403);
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ is_active: payload.active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('Admin account status update failed', { code: error.code, message: error.message });
    return json({ error: 'The account status could not be updated.' }, 503);
  }

  return json({ updated: true, id, active: payload.active });
}
