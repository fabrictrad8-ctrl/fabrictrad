import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdministrator } from '@/lib/server/requireAdministrator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!await requireAdministrator()) return json({ error: 'Administrator access required.' }, 403);
  const daysParam = Number(request.nextUrl.searchParams.get('days') || 30);
  const days = Number.isFinite(daysParam) ? Math.min(365, Math.max(1, Math.round(daysParam))) : 30;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('admin_analytics_trends', { p_days: days });
  if (error || !data) { console.error('Admin analytics trends unavailable', { code: error?.code }); return json({ error: 'Live analytics could not be loaded.' }, 503); }
  return json(data);
}
