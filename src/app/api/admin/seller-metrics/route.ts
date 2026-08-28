import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isConfiguredAdminEmail } from '@/lib/adminAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const numberValue = (value: unknown) => Number(value || 0);
const textValue = (value: unknown) => String(value || '').trim();
const normalizedStatus = (value: unknown) => textValue(value).toLowerCase();
const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const validDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const cityFromAddress = (value: unknown) => {
  if (!value || typeof value !== 'object') return '';
  const address = value as Record<string, unknown>;
  return [address.city, address.state].map(textValue).filter(Boolean).join(', ');
};

async function requireAdministrator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isConfiguredAdminEmail(user.email)) return false;

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (error) return false;
  return (
    profile?.is_active === true &&
    (profile.role === 'super_admin' || profile.role === 'admin_staff')
  );
}

type SellerMetric = {
  id: string;
  sellerRef: string;
  name: string;
  city: string;
  businessType: string;
  verificationStatus: string;
  gstinVerified: boolean;
  active: boolean;
  joinedAt: string | null;
  orders: number;
  acceptedOrders: number;
  fulfilledOrders: number;
  paidOrders: number;
  refundedOrders: number;
  gmv: number;
  commission: number;
  ratingTotal: number;
  reviews: number;
  activeListings: number;
};

export async function GET(request: NextRequest) {
  if (!(await requireAdministrator())) {
    return json({ error: 'Administrator access required.' }, 403);
  }

  const fromDate = validDate(request.nextUrl.searchParams.get('from'));
  const toInput = validDate(request.nextUrl.searchParams.get('to'));
  const toDate = toInput
    ? new Date(toInput.getFullYear(), toInput.getMonth(), toInput.getDate() + 1)
    : null;
  const fromIso = fromDate?.toISOString() || null;
  const toIso = toDate?.toISOString() || null;
  const admin = createAdminClient();

  let catalogOrdersQuery = admin
    .from('catalog_order_requests')
    .select('id,seller_id,status,total_amount,amount_paid,amount_refunded,created_at')
    .limit(5000);
  let bulkOrdersQuery = admin
    .from('bulk_orders')
    .select('id,seller_id,status,net_total,amount_paid,amount_refunded,created_at')
    .limit(5000);
  let catalogPaymentsQuery = admin
    .from('catalog_order_payments')
    .select('catalog_order_id,status,platform_commission,created_at')
    .limit(5000);
  let bulkPaymentsQuery = admin
    .from('bulk_order_payments')
    .select('bulk_order_id,status,platform_commission,created_at')
    .limit(5000);
  let reviewsQuery = admin
    .from('seller_reviews')
    .select('seller_id,rating,created_at')
    .limit(5000);

  for (const boundary of [
    { value: fromIso, method: 'gte' as const },
    { value: toIso, method: 'lt' as const },
  ]) {
    if (!boundary.value) continue;
    catalogOrdersQuery = catalogOrdersQuery[boundary.method]('created_at', boundary.value);
    bulkOrdersQuery = bulkOrdersQuery[boundary.method]('created_at', boundary.value);
    catalogPaymentsQuery = catalogPaymentsQuery[boundary.method]('created_at', boundary.value);
    bulkPaymentsQuery = bulkPaymentsQuery[boundary.method]('created_at', boundary.value);
    reviewsQuery = reviewsQuery[boundary.method]('created_at', boundary.value);
  }

  const [
    sellersResult,
    catalogOrdersResult,
    bulkOrdersResult,
    catalogPaymentsResult,
    bulkPaymentsResult,
    reviewsResult,
    productsResult,
  ] = await Promise.all([
    admin
      .from('seller_profiles')
      .select(
        'id,seller_ref,display_name,legal_business_name,business_type,verification_status,gstin_verified,is_active,pickup_address,created_at'
      )
      .order('created_at', { ascending: false })
      .limit(2000),
    catalogOrdersQuery,
    bulkOrdersQuery,
    catalogPaymentsQuery,
    bulkPaymentsQuery,
    reviewsQuery,
    admin
      .from('seller_products')
      .select('seller_id,status,approval_status')
      .limit(10000),
  ]);

  const queryError = [
    sellersResult.error,
    catalogOrdersResult.error,
    bulkOrdersResult.error,
    catalogPaymentsResult.error,
    bulkPaymentsResult.error,
    reviewsResult.error,
    productsResult.error,
  ].find(Boolean);

  if (queryError) {
    console.error('Admin seller metrics query failed', {
      code: queryError.code,
      message: queryError.message,
    });
    return json({ error: 'Live seller metrics could not be loaded.' }, 503);
  }

  const metrics = new Map<string, SellerMetric>();
  for (const seller of sellersResult.data || []) {
    metrics.set(seller.id, {
      id: seller.id,
      sellerRef: seller.seller_ref || seller.id.slice(0, 8),
      name: seller.display_name || seller.legal_business_name || 'Unnamed seller',
      city: cityFromAddress(seller.pickup_address) || 'Not provided',
      businessType: seller.business_type || 'Seller',
      verificationStatus: normalizedStatus(seller.verification_status) || 'pending',
      gstinVerified: seller.gstin_verified === true,
      active: seller.is_active === true,
      joinedAt: seller.created_at || null,
      orders: 0,
      acceptedOrders: 0,
      fulfilledOrders: 0,
      paidOrders: 0,
      refundedOrders: 0,
      gmv: 0,
      commission: 0,
      ratingTotal: 0,
      reviews: 0,
      activeListings: 0,
    });
  }

  const orderToSeller = new Map<string, string>();
  const acceptedStatuses = new Set([
    'accepted',
    'confirmed',
    'paid',
    'processing',
    'packed',
    'shipped',
    'delivered',
    'fulfilled',
    'completed',
  ]);
  const fulfilledStatuses = new Set(['shipped', 'delivered', 'fulfilled', 'completed']);

  const applyOrder = (order: {
    id: string;
    seller_id: string | null;
    status: string | null;
    amount_paid: number | null;
    amount_refunded: number | null;
  }) => {
    if (!order.seller_id) return;
    orderToSeller.set(order.id, order.seller_id);
    const metric = metrics.get(order.seller_id);
    if (!metric) return;

    const status = normalizedStatus(order.status);
    const paid = Math.max(0, numberValue(order.amount_paid) - numberValue(order.amount_refunded));
    metric.orders += 1;
    if (acceptedStatuses.has(status)) metric.acceptedOrders += 1;
    if (fulfilledStatuses.has(status)) metric.fulfilledOrders += 1;
    if (numberValue(order.amount_paid) > 0) metric.paidOrders += 1;
    if (numberValue(order.amount_refunded) > 0) metric.refundedOrders += 1;
    metric.gmv += paid;
  };

  for (const order of catalogOrdersResult.data || []) applyOrder(order);
  for (const order of bulkOrdersResult.data || []) applyOrder(order);

  const capturedStatuses = new Set(['authorized', 'captured', 'partially_refunded', 'refunded']);
  for (const payment of catalogPaymentsResult.data || []) {
    if (!capturedStatuses.has(normalizedStatus(payment.status))) continue;
    const sellerId = orderToSeller.get(payment.catalog_order_id);
    const metric = sellerId ? metrics.get(sellerId) : null;
    if (metric) metric.commission += numberValue(payment.platform_commission);
  }
  for (const payment of bulkPaymentsResult.data || []) {
    if (!capturedStatuses.has(normalizedStatus(payment.status))) continue;
    const sellerId = orderToSeller.get(payment.bulk_order_id);
    const metric = sellerId ? metrics.get(sellerId) : null;
    if (metric) metric.commission += numberValue(payment.platform_commission);
  }

  for (const review of reviewsResult.data || []) {
    const metric = metrics.get(review.seller_id);
    if (!metric) continue;
    metric.ratingTotal += numberValue(review.rating);
    metric.reviews += 1;
  }

  for (const product of productsResult.data || []) {
    const metric = metrics.get(product.seller_id);
    if (!metric) continue;
    if (
      normalizedStatus(product.status) === 'active' &&
      normalizedStatus(product.approval_status) === 'approved'
    ) {
      metric.activeListings += 1;
    }
  }

  const sellers = Array.from(metrics.values())
    .map((metric) => ({
      id: metric.id,
      sellerRef: metric.sellerRef,
      name: metric.name,
      city: metric.city,
      businessType: metric.businessType,
      verificationStatus: metric.active ? metric.verificationStatus : 'inactive',
      gstinVerified: metric.gstinVerified,
      joinedAt: metric.joinedAt,
      orders: metric.orders,
      gmv: round(metric.gmv),
      commission: round(metric.commission),
      avgOrderValue: metric.paidOrders ? round(metric.gmv / metric.paidOrders) : 0,
      rating: metric.reviews ? round(metric.ratingTotal / metric.reviews, 1) : 0,
      reviews: metric.reviews,
      acceptanceRate: metric.orders ? round((metric.acceptedOrders / metric.orders) * 100, 1) : 0,
      fulfillmentRate: metric.acceptedOrders
        ? round((metric.fulfilledOrders / metric.acceptedOrders) * 100, 1)
        : 0,
      refundRate: metric.paidOrders
        ? round((metric.refundedOrders / metric.paidOrders) * 100, 1)
        : 0,
      activeListings: metric.activeListings,
    }))
    .sort((a, b) => b.gmv - a.gmv || b.orders - a.orders || a.name.localeCompare(b.name));

  return json({
    generatedAt: new Date().toISOString(),
    range: {
      from: fromIso,
      to: toInput?.toISOString() || null,
    },
    sellers,
    summary: {
      sellers: sellers.length,
      activeSellers: sellers.filter((seller) => seller.verificationStatus !== 'inactive').length,
      orders: sellers.reduce((sum, seller) => sum + seller.orders, 0),
      gmv: round(sellers.reduce((sum, seller) => sum + seller.gmv, 0)),
      commission: round(sellers.reduce((sum, seller) => sum + seller.commission, 0)),
    },
  });
}
