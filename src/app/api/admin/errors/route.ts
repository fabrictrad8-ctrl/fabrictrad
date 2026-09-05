import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdministrator } from '@/lib/server/requireAdministrator';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: NextRequest) {
  if (!await requireAdministrator()) return json({ error: 'Administrator access required.' }, 403);
  const page = Math.max(1, Math.floor(Number(request.nextUrl.searchParams.get('page')) || 1));
  const { data, count, error } = await createAdminClient().from('error_logs')
    .select('id,severity,message,resolved,created_at', { count: 'exact' })
    .order('created_at', { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  return error ? json({ error: 'Errors could not be loaded.' }, 503) : json({ errors: data || [], total: count || 0 });
}
export async function PATCH(request: NextRequest) {
  if (!await requireAdministrator()) return json({ error: 'Administrator access required.' }, 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string') return json({ error: 'Error reference required.' }, 400);
  const { error } = await createAdminClient().from('error_logs').update({ resolved: true }).eq('id', body.id);
  return error ? json({ error: 'Resolution could not be saved.' }, 503) : json({ resolved: true });
}
