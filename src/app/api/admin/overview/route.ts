import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdministrator } from '@/lib/server/requireAdministrator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!await requireAdministrator()) return json({ error: 'Administrator access required.' }, 403);
  const range = request.nextUrl.searchParams.get('range') || 'today';
  const start = range === 'today'
    ? new Date(new Date(Date.now() + 19_800_000).toISOString().slice(0, 10) + 'T00:00:00+05:30').toISOString()
    : new Date(Date.now() - (range === '30d' ? 30 : 7) * 86_400_000).toISOString();
  const admin = createAdminClient();
  const [totals, orders, sellers, products] = await Promise.all([
    admin.rpc('admin_marketplace_totals', { p_start: start }),
    admin.from('admin_marketplace_orders').select('id,reference,status,amount,created_at,updated_at').order('updated_at', { ascending: false }).limit(5),
    admin.from('seller_profiles').select('id,display_name,legal_business_name,verification_status,created_at,updated_at').order('updated_at', { ascending: false }).limit(5),
    admin.from('seller_products').select('id,name,approval_status,status,created_at,updated_at').order('updated_at', { ascending: false }).limit(5),
  ]);
  const error = totals.error || orders.error || sellers.error || products.error;
  if (error || !totals.data) { console.error('Admin overview unavailable', { code: error?.code }); return json({ error: 'The live overview could not be loaded.' }, 503); }
  const t = totals.data;
  const recentActivity = [
    ...(orders.data || []).map(o => ({ id: 'order-' + o.id, type: 'order', title: o.reference, detail: o.status + ' · ₹' + Number(o.amount).toLocaleString('en-IN'), at: o.updated_at || o.created_at, href: '/admin-portal?tab=orders' })),
    ...(sellers.data || []).map(s => ({ id: 'seller-' + s.id, type: 'seller', title: s.display_name || s.legal_business_name, detail: s.verification_status, at: s.updated_at || s.created_at, href: '/admin-portal?tab=sellers' })),
    ...(products.data || []).map(p => ({ id: 'product-' + p.id, type: 'product', title: p.name, detail: p.approval_status || p.status, at: p.updated_at || p.created_at, href: '/admin-portal?tab=listings' })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 10);
  return json({
    range, generatedAt: new Date().toISOString(),
    metrics: { orders: t.orders, gmv: t.gmv, commission: t.commission, registrations: t.registrations,
      sellerApplications: t.sellerApplications, listings: t.listings, failedPayments: t.failedPayments, openDisputes: t.openDisputes },
    tasks: { pendingSellers: t.pendingSellers, pendingProducts: t.pendingProducts, failedPayments: t.failedPayments,
      openDisputes: t.openDisputes, shipmentExceptions: t.shipmentExceptions, unresolvedErrors: t.unresolvedErrors,
      invoiceEmailsPending: t.invoiceEmailsPending, whatsappFailures: t.whatsappFailures, sellersMissingPayoutAccount: t.sellersMissingPayoutAccount },
    orderStatus: t.orderStatus,
    inventory: { activeProducts: t.activeProducts, lowStockProducts: t.lowStockProducts, outOfStockProducts: t.outOfStockProducts },
    recentActivity,
  });
}
