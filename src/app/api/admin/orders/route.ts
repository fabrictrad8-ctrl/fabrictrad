import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdministrator } from '@/lib/server/requireAdministrator';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!await requireAdministrator()) return json({ error: 'Administrator access required.' }, 403);
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Math.min(100_000, Math.floor(Number(params.get('page')) || 1)));
  const kind = params.get('kind') || 'all';
  if (!['all', 'catalog', 'bulk'].includes(kind)) return json({ error: 'Invalid order type.' }, 400);
  let query = createAdminClient().from('admin_marketplace_orders').select('*', { count: 'exact' })
    .order('created_at', { ascending: false }).order('id').range((page - 1) * 30, page * 30 - 1);
  if (kind !== 'all') query = query.eq('kind', kind);
  if (params.get('shipment') === '1') query = query.eq('has_shipment', true);
  const search = (params.get('search') || '').trim().slice(0, 160);
  if (search) query = query.ilike('search_text', '%' + search.replace(/[%_\\]/g, '\\$&') + '%');
  for (const key of ['from', 'to']) {
    const date = params.get(key);
    if (!date) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) return json({ error: 'Invalid date.' }, 400);
    query = key === 'from' ? query.gte('created_at', date + 'T00:00:00Z') : query.lt('created_at', new Date(Date.parse(date) + 86_400_000).toISOString());
  }
  const { data, count, error } = await query;
  if (error) { console.error('Admin orders failed', { code: error.code }); return json({ error: 'Orders could not be loaded.' }, 503); }
  return json({ orders: data || [], total: count || 0, page, pageSize: 30 });
}
