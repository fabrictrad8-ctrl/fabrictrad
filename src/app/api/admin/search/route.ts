import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const cleanSearch = (value: string) =>
  value
    .trim()
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json({ error: 'Administrator sign-in required.' }, 401);

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin =
    profile?.is_active === true &&
    (profile.role === 'super_admin' || profile.role === 'admin_staff');
  if (!isAdmin) return json({ error: 'Administrator access required.' }, 403);

  const query = cleanSearch(request.nextUrl.searchParams.get('q') || '');
  if (query.length < 2) return json({ query, results: [] });
  const term = `%${query}%`;

  const [customersResult, sellersResult, productsResult, ordersResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id,full_name,email,phone,business_name,role,is_active,can_buy,can_sell')
      .or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term},business_name.ilike.${term}`)
      .limit(8),
    supabase
      .from('seller_profiles')
      .select('id,user_id,display_name,legal_business_name,gstin,verification_status,is_active')
      .or(`display_name.ilike.${term},legal_business_name.ilike.${term},gstin.ilike.${term},seller_ref.ilike.${term}`)
      .limit(8),
    supabase
      .from('seller_products')
      .select('id,seller_id,name,sku,category,status,approval_status,available_quantity')
      .or(`name.ilike.${term},sku.ilike.${term},category.ilike.${term},search_terms.ilike.${term}`)
      .limit(8),
    supabase
      .from('orders')
      .select('id,order_ref,status,total_amount,created_at,buyer_id,seller_id')
      .or(`order_ref.ilike.${term},purchase_order_number.ilike.${term}`)
      .limit(8),
  ]);

  const firstError = [
    customersResult.error,
    sellersResult.error,
    productsResult.error,
    ordersResult.error,
  ].find(Boolean);
  if (firstError) {
    console.error('Admin search failed', {
      code: firstError.code,
      message: firstError.message,
    });
    return json({ error: 'Search is temporarily unavailable.' }, 503);
  }

  const results = [
    ...(customersResult.data || []).map((customer) => ({
      id: `customer-${customer.id}`,
      kind: 'Customer',
      title: customer.full_name || customer.business_name || customer.email,
      subtitle: `${customer.email || ''}${customer.role ? ` · ${customer.role}` : ''}`,
      href: `/admin-portal?tab=customers&focus=${customer.id}`,
      icon: 'UsersIcon',
    })),
    ...(sellersResult.data || []).map((seller) => ({
      id: `seller-${seller.id}`,
      kind: 'Seller',
      title: seller.display_name || seller.legal_business_name || 'Seller',
      subtitle: `${seller.gstin || 'GSTIN pending'} · ${seller.verification_status || 'pending'}`,
      href: `/admin-portal?tab=sellers&focus=${seller.id}`,
      icon: 'BuildingStorefrontIcon',
    })),
    ...(productsResult.data || []).map((product) => ({
      id: `product-${product.id}`,
      kind: 'Product',
      title: product.name || 'Product',
      subtitle: `${product.sku || product.category || 'No SKU'} · ${product.approval_status || product.status || 'draft'}`,
      href: `/admin-portal?tab=listings&focus=${product.id}`,
      icon: 'TagIcon',
    })),
    ...(ordersResult.data || []).map((order) => ({
      id: `order-${order.id}`,
      kind: 'Order',
      title: order.order_ref || `Order ${String(order.id).slice(0, 8)}`,
      subtitle: `${order.status || 'pending'} · ₹${Number(order.total_amount || 0).toLocaleString('en-IN')}`,
      href: `/admin-portal?tab=orders&focus=${order.id}`,
      icon: 'ShoppingBagIcon',
    })),
  ].slice(0, 24);

  return json({ query, results });
}
