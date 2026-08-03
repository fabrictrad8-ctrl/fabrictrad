import type { SupabaseClient } from '@supabase/supabase-js';

type Blocker = {
  code: string;
  title: string;
  detail: string;
  count: number;
};

type OrderRow = {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  amount_paid?: number | string | null;
  amount_refunded?: number | string | null;
};

const amount = (value: unknown) => Number(value || 0);
const activeDisputeStatuses = new Set(['open', 'under_review', 'escalated']);
const terminalCatalogStatuses = new Set(['cancelled', 'fulfilled']);
const terminalBulkStatuses = new Set(['cancelled', 'delivered']);

export async function accountDeletionBlockers(admin: SupabaseClient, userId: string) {
  const blockers: Blocker[] = [];
  const { data: seller } = await admin
    .from('seller_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  const sellerId = seller?.id ? String(seller.id) : null;

  const [buyerCatalog, buyerBulk, sellerCatalog, sellerBulk, buyerDisputes, sellerDisputes] =
    await Promise.all([
      admin
        .from('catalog_order_requests')
        .select('id,status,payment_status,amount_paid,amount_refunded')
        .eq('buyer_id', userId),
      admin
        .from('bulk_orders')
        .select('id,status,payment_status,amount_paid,amount_refunded')
        .eq('buyer_id', userId),
      sellerId
        ? admin
            .from('catalog_order_requests')
            .select('id,status,payment_status,amount_paid,amount_refunded')
            .eq('seller_id', sellerId)
        : Promise.resolve({ data: [], error: null }),
      sellerId
        ? admin
            .from('bulk_orders')
            .select('id,status,payment_status,amount_paid,amount_refunded')
            .eq('seller_id', sellerId)
        : Promise.resolve({ data: [], error: null }),
      admin.from('disputes').select('id,status').eq('buyer_user_id', userId),
      sellerId
        ? admin.from('disputes').select('id,status').eq('seller_id', sellerId)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const queryError =
    buyerCatalog.error ||
    buyerBulk.error ||
    sellerCatalog.error ||
    sellerBulk.error ||
    buyerDisputes.error ||
    sellerDisputes.error;
  if (queryError) throw queryError;

  const catalogueOrders = [
    ...((buyerCatalog.data || []) as OrderRow[]),
    ...((sellerCatalog.data || []) as OrderRow[]),
  ];
  const bulkOrders = [
    ...((buyerBulk.data || []) as OrderRow[]),
    ...((sellerBulk.data || []) as OrderRow[]),
  ];
  const openCatalogue = catalogueOrders.filter(
    (order) =>
      !terminalCatalogStatuses.has(String(order.status || '').toLowerCase()) ||
      amount(order.amount_paid) > amount(order.amount_refunded)
  );
  const openBulk = bulkOrders.filter(
    (order) =>
      !terminalBulkStatuses.has(String(order.status || '').toLowerCase()) ||
      amount(order.amount_paid) > amount(order.amount_refunded)
  );
  const activeDisputes = [
    ...(buyerDisputes.data || []),
    ...(sellerDisputes.data || []),
  ].filter((row) => activeDisputeStatuses.has(String(row.status || '').toLowerCase()));

  if (openCatalogue.length) {
    blockers.push({
      code: 'CATALOG_ORDERS_OPEN',
      title: 'Catalogue orders still require action',
      detail: 'Complete delivery, cancellation and any required refund before deleting the account.',
      count: openCatalogue.length,
    });
  }
  if (openBulk.length) {
    blockers.push({
      code: 'BULK_ORDERS_OPEN',
      title: 'Bulk orders still require action',
      detail: 'Complete delivery, cancellation and any required refund before deleting the account.',
      count: openBulk.length,
    });
  }
  if (activeDisputes.length) {
    blockers.push({
      code: 'DISPUTES_OPEN',
      title: 'Returns or disputes are still open',
      detail: 'Resolve every return, refund and dispute before account deletion.',
      count: activeDisputes.length,
    });
  }

  if (sellerId) {
    const orderIds = [
      ...(sellerCatalog.data || []).map((row) => row.id),
      ...(sellerBulk.data || []).map((row) => row.id),
    ];
    const [catalogPayments, bulkPayments] = await Promise.all([
      (sellerCatalog.data || []).length
        ? admin
            .from('catalog_order_payments')
            .select('id,status,refund_status,razorpay_transfer_id,seller_payable')
            .in('catalog_order_id', (sellerCatalog.data || []).map((row) => row.id))
        : Promise.resolve({ data: [], error: null }),
      (sellerBulk.data || []).length
        ? admin
            .from('bulk_order_payments')
            .select('id,status,refund_status,razorpay_transfer_id,seller_payable')
            .in('bulk_order_id', (sellerBulk.data || []).map((row) => row.id))
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (catalogPayments.error || bulkPayments.error) throw catalogPayments.error || bulkPayments.error;
    const unsettled = [...(catalogPayments.data || []), ...(bulkPayments.data || [])].filter(
      (payment) =>
        ['captured', 'paid'].includes(String(payment.status || '').toLowerCase()) &&
        !payment.razorpay_transfer_id &&
        amount(payment.seller_payable) > 0
    );
    const refundsPending = [...(catalogPayments.data || []), ...(bulkPayments.data || [])].filter(
      (payment) => ['requested', 'pending', 'processing'].includes(String(payment.refund_status || '').toLowerCase())
    );
    if (unsettled.length) {
      blockers.push({
        code: 'SELLER_SETTLEMENT_PENDING',
        title: 'Seller settlements are pending',
        detail: 'FabricTrad must complete or reconcile seller payouts before the account can be deleted.',
        count: unsettled.length,
      });
    }
    if (refundsPending.length) {
      blockers.push({
        code: 'REFUNDS_PENDING',
        title: 'Payment refunds are pending',
        detail: 'Wait for Razorpay to confirm every pending refund before deleting the account.',
        count: refundsPending.length,
      });
    }
    void orderIds;
  }

  return { blockers, sellerId };
}

export async function removeUserPrefixedStorage(admin: SupabaseClient, userId: string) {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;

  for (const bucket of buckets || []) {
    try {
      const { data: files } = await admin.storage.from(bucket.id).list(userId, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      });
      const paths = (files || [])
        .filter((entry) => entry.id)
        .map((entry) => `${userId}/${entry.name}`);
      if (paths.length) await admin.storage.from(bucket.id).remove(paths);
    } catch {
      // The SQL anonymisation function detaches any remaining private objects.
    }
  }
}

export type { Blocker };
