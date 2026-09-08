import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdministrator } from '@/lib/server/requireAdministrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

type ActivityEvent = {
  id: string;
  type: 'catalog_order' | 'bulk_order' | 'dispute' | 'seller_product' | 'wishlist' | 'seller_application';
  title: string;
  detail: string;
  amount: number | null;
  status: string | null;
  at: string;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdministrator()) return json({ error: 'Administrator access required.' }, 403);
  const { id } = await params;
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('id,full_name,email,phone,business_name,role,is_active,can_buy,can_sell,account_kind,verification_status,gstin,city,state,created_at')
    .eq('id', id)
    .maybeSingle();
  if (profileError || !profile) return json({ error: 'Account could not be found.' }, 404);

  const { data: sellerProfile } = await admin
    .from('seller_profiles')
    .select('id,display_name,legal_business_name,verification_status,is_active,is_early_bird,created_at')
    .eq('user_id', id)
    .maybeSingle();

  const [buyerCatalogOrders, buyerBulkOrders, sellerCatalogOrders, sellerBulkOrders, disputes, wishlist, sellerProducts] = await Promise.all([
    admin.from('catalog_order_requests').select('id,status,payment_status,total_amount,created_at,seller_products(name)').eq('buyer_id', id).order('created_at', { ascending: false }).limit(15),
    admin.from('bulk_orders').select('id,status,payment_status,net_total,created_at').eq('buyer_id', id).order('created_at', { ascending: false }).limit(15),
    sellerProfile?.id
      ? admin.from('catalog_order_requests').select('id,status,payment_status,total_amount,created_at,seller_products(name)').eq('seller_id', sellerProfile.id).order('created_at', { ascending: false }).limit(15)
      : Promise.resolve({ data: [] as unknown[] }),
    sellerProfile?.id
      ? admin.from('bulk_orders').select('id,status,payment_status,net_total,created_at').eq('seller_id', sellerProfile.id).order('created_at', { ascending: false }).limit(15)
      : Promise.resolve({ data: [] as unknown[] }),
    admin.from('disputes').select('id,status,reason,created_at').or(`buyer_id.eq.${id},seller_id.eq.${sellerProfile?.id || '00000000-0000-0000-0000-000000000000'}`).order('created_at', { ascending: false }).limit(10),
    admin.from('buyer_wishlist').select('id,product_data,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    sellerProfile?.id
      ? admin.from('seller_products').select('id,name,status,approval_status,created_at').eq('seller_id', sellerProfile.id).order('created_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const events: ActivityEvent[] = [];

  (buyerCatalogOrders.data || []).forEach((row: any) => events.push({
    id: `bco-${row.id}`, type: 'catalog_order',
    title: row.seller_products?.name || 'Catalogue order',
    detail: `Bought · ${row.status || 'pending'} · ${row.payment_status || 'unpaid'}`,
    amount: Number(row.total_amount || 0), status: row.status, at: row.created_at,
  }));
  (buyerBulkOrders.data || []).forEach((row: any) => events.push({
    id: `bbo-${row.id}`, type: 'bulk_order', title: 'Bulk order',
    detail: `Bought · ${row.status || 'pending'} · ${row.payment_status || 'unpaid'}`,
    amount: Number(row.net_total || 0), status: row.status, at: row.created_at,
  }));
  (sellerCatalogOrders.data || []).forEach((row: any) => events.push({
    id: `sco-${row.id}`, type: 'catalog_order', title: row.seller_products?.name || 'Catalogue order',
    detail: `Sold · ${row.status || 'pending'} · ${row.payment_status || 'unpaid'}`,
    amount: Number(row.total_amount || 0), status: row.status, at: row.created_at,
  }));
  (sellerBulkOrders.data || []).forEach((row: any) => events.push({
    id: `sbo-${row.id}`, type: 'bulk_order', title: 'Bulk order',
    detail: `Sold · ${row.status || 'pending'} · ${row.payment_status || 'unpaid'}`,
    amount: Number(row.net_total || 0), status: row.status, at: row.created_at,
  }));
  (disputes.data || []).forEach((row: any) => events.push({
    id: `dsp-${row.id}`, type: 'dispute', title: 'Dispute',
    detail: row.reason || 'No reason recorded', amount: null, status: row.status, at: row.created_at,
  }));
  (wishlist.data || []).forEach((row: any) => events.push({
    id: `wl-${row.id}`, type: 'wishlist', title: row.product_data?.name || 'Product saved',
    detail: 'Added to wishlist', amount: null, status: null, at: row.created_at,
  }));
  (sellerProducts.data || []).forEach((row: any) => events.push({
    id: `sp-${row.id}`, type: 'seller_product', title: row.name || 'Product listed',
    detail: `${row.status || 'draft'} · ${row.approval_status || 'pending'}`, amount: null, status: row.approval_status, at: row.created_at,
  }));
  if (sellerProfile) events.push({
    id: `sa-${sellerProfile.id}`, type: 'seller_application',
    title: sellerProfile.display_name || sellerProfile.legal_business_name || 'Seller application',
    detail: `Verification: ${sellerProfile.verification_status}${sellerProfile.is_early_bird ? ' · Founding seller' : ''}`,
    amount: null, status: sellerProfile.verification_status, at: sellerProfile.created_at,
  });

  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const paidStatuses = new Set(['paid', 'captured']);
  const buyerSpend = [...(buyerCatalogOrders.data || []), ...(buyerBulkOrders.data || [])]
    .filter((row: any) => paidStatuses.has(String(row.payment_status || '')))
    .reduce((sum: number, row: any) => sum + Number(row.total_amount ?? row.net_total ?? 0), 0);
  const sellerRevenue = [...(sellerCatalogOrders.data || []), ...(sellerBulkOrders.data || [])]
    .filter((row: any) => paidStatuses.has(String(row.payment_status || '')))
    .reduce((sum: number, row: any) => sum + Number(row.total_amount ?? row.net_total ?? 0), 0);

  return json({
    profile,
    sellerProfile: sellerProfile || null,
    summary: {
      buyerOrders: (buyerCatalogOrders.data || []).length + (buyerBulkOrders.data || []).length,
      buyerSpend,
      sellerOrders: (sellerCatalogOrders.data || []).length + (sellerBulkOrders.data || []).length,
      sellerRevenue,
      disputes: (disputes.data || []).length,
      wishlistItems: (wishlist.data || []).length,
      listedProducts: (sellerProducts.data || []).length,
    },
    events: events.slice(0, 40),
  });
}
