import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const startForRange = (range: string) => {
  const now = new Date();
  if (range === 'today') {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  const days = range === '30d' ? 30 : range === '7d' ? 7 : 1;
  return new Date(Date.now() - days * 86_400_000).toISOString();
};

const numberValue = (value: unknown) => Number(value || 0);
const normalizedStatus = (value: unknown) => String(value || '').toLowerCase();

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

  const range = request.nextUrl.searchParams.get('range') || 'today';
  const start = startForRange(range);

  const [
    ordersResult,
    paymentsResult,
    profilesResult,
    sellersResult,
    productsResult,
    disputesResult,
    shipmentsResult,
    errorLogsResult,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id,order_ref,buyer_id,seller_id,status,total_amount,created_at,updated_at')
      .gte('created_at', start)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('payments')
      .select('id,order_id,amount,status,failure_reason,captured_at,created_at')
      .gte('created_at', start)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('user_profiles')
      .select('id,email,full_name,role,is_active,can_buy,can_sell,created_at')
      .gte('created_at', start)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('seller_profiles')
      .select('id,user_id,display_name,legal_business_name,verification_status,gstin_verified,settlement_eligible,is_active,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(500),
    supabase
      .from('seller_products')
      .select('id,seller_id,name,status,approval_status,available_quantity,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(500),
    supabase
      .from('disputes')
      .select('id,order_id,status,dispute_type,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase
      .from('shipments')
      .select('id,order_id,status,awb_number,courier_name,estimated_delivery,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(500),
    supabase
      .from('error_logs')
      .select('id,severity,resolved,created_at,message')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const queryError = [
    ordersResult.error,
    paymentsResult.error,
    profilesResult.error,
    sellersResult.error,
    productsResult.error,
    disputesResult.error,
    shipmentsResult.error,
    errorLogsResult.error,
  ].find(Boolean);

  if (queryError) {
    console.error('Admin overview query failed', {
      code: queryError.code,
      message: queryError.message,
    });
    return json({ error: 'The live commerce overview could not be loaded.' }, 503);
  }

  const orders = ordersResult.data || [];
  const payments = paymentsResult.data || [];
  const profiles = profilesResult.data || [];
  const sellers = sellersResult.data || [];
  const products = productsResult.data || [];
  const disputes = disputesResult.data || [];
  const shipments = shipmentsResult.data || [];
  const errorLogs = errorLogsResult.data || [];

  const capturedPayments = payments.filter((payment) =>
    ['captured', 'paid', 'authorized'].includes(normalizedStatus(payment.status))
  );
  const gmv = capturedPayments.reduce((total, payment) => total + numberValue(payment.amount), 0);
  const commissionRate = Number(process.env.PLATFORM_COMMISSION_RATE || 0.1);
  const commission = Math.round(gmv * commissionRate * 100) / 100;

  const orderStatus = orders.reduce<Record<string, number>>((summary, order) => {
    const status = normalizedStatus(order.status) || 'pending';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});

  const pendingSellers = sellers.filter((seller) =>
    ['pending', 'under_review', 'submitted'].includes(normalizedStatus(seller.verification_status))
  );
  const pendingProducts = products.filter((product) =>
    ['pending', 'pending_review', 'submitted', 'draft'].includes(
      normalizedStatus(product.approval_status || product.status)
    )
  );
  const failedPayments = payments.filter((payment) =>
    ['failed', 'cancelled'].includes(normalizedStatus(payment.status))
  );
  const openDisputes = disputes.filter(
    (dispute) => !['resolved', 'closed', 'cancelled'].includes(normalizedStatus(dispute.status))
  );
  const shipmentExceptions = shipments.filter((shipment) =>
    ['failed', 'exception', 'rto', 'lost', 'cancelled'].includes(normalizedStatus(shipment.status))
  );
  const unresolvedErrors = errorLogs.filter((entry) => entry.resolved !== true);

  const recentActivity = [
    ...orders.slice(0, 5).map((order) => ({
      id: `order-${order.id}`,
      type: 'order',
      title: `Order ${order.order_ref || String(order.id).slice(0, 8)}`,
      detail: `${normalizedStatus(order.status) || 'pending'} · ₹${numberValue(order.total_amount).toLocaleString('en-IN')}`,
      at: order.updated_at || order.created_at,
      href: '/admin-portal?tab=orders',
    })),
    ...sellers.slice(0, 5).map((seller) => ({
      id: `seller-${seller.id}`,
      type: 'seller',
      title: seller.display_name || seller.legal_business_name || 'Seller application',
      detail: normalizedStatus(seller.verification_status) || 'pending',
      at: seller.updated_at || seller.created_at,
      href: '/admin-portal?tab=sellers',
    })),
    ...products.slice(0, 5).map((product) => ({
      id: `product-${product.id}`,
      type: 'product',
      title: product.name || 'Product listing',
      detail: normalizedStatus(product.approval_status || product.status) || 'draft',
      at: product.updated_at || product.created_at,
      href: '/admin-portal?tab=listings',
    })),
  ]
    .filter((item) => item.at)
    .sort((a, b) => new Date(String(b.at)).getTime() - new Date(String(a.at)).getTime())
    .slice(0, 10);

  return json({
    range,
    generatedAt: new Date().toISOString(),
    metrics: {
      orders: orders.length,
      gmv,
      commission,
      registrations: profiles.length,
      sellerApplications: sellers.filter((seller) => String(seller.created_at) >= start).length,
      listings: products.filter((product) => String(product.created_at) >= start).length,
      failedPayments: failedPayments.length,
      openDisputes: openDisputes.length,
    },
    tasks: {
      pendingSellers: pendingSellers.length,
      pendingProducts: pendingProducts.length,
      failedPayments: failedPayments.length,
      openDisputes: openDisputes.length,
      shipmentExceptions: shipmentExceptions.length,
      unresolvedErrors: unresolvedErrors.length,
    },
    orderStatus,
    inventory: {
      activeProducts: products.filter((product) => normalizedStatus(product.status) === 'active').length,
      lowStockProducts: products.filter(
        (product) => numberValue(product.available_quantity) > 0 && numberValue(product.available_quantity) <= 10
      ).length,
      outOfStockProducts: products.filter((product) => numberValue(product.available_quantity) <= 0).length,
    },
    recentActivity,
  });
}
