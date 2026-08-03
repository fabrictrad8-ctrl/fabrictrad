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

type PaymentRow = {
  id: string;
  order_id: string;
  status?: string | null;
  refund_status?: string | null;
  razorpay_transfer_id?: string | null;
  seller_payable?: number | string | null;
};

const amount = (value: unknown) => Number(value || 0);
const activeDisputeStatuses = new Set(['open', 'under_review', 'escalated']);
const terminalCatalogStatuses = new Set(['cancelled', 'fulfilled']);
const terminalBulkStatuses = new Set(['cancelled', 'delivered']);
const pendingRefundStatuses = new Set(['requested', 'pending', 'processing']);

const orderStillBlocksDeletion = (order: OrderRow, terminalStatuses: Set<string>) => {
  const status = String(order.status || '').toLowerCase();
  if (!terminalStatuses.has(status)) return true;
  // A cancelled paid order remains blocked until its money is fully refunded.
  if (status === 'cancelled' && amount(order.amount_paid) > amount(order.amount_refunded)) {
    return true;
  }
  // Fulfilled/delivered orders remain in statutory records but do not prevent
  // the person from closing their login and anonymising personal profile data.
  return false;
};

const uniqueIds = (rows: OrderRow[]) => [...new Set(rows.map((row) => row.id).filter(Boolean))];

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

  const buyerCatalogRows = (buyerCatalog.data || []) as OrderRow[];
  const buyerBulkRows = (buyerBulk.data || []) as OrderRow[];
  const sellerCatalogRows = (sellerCatalog.data || []) as OrderRow[];
  const sellerBulkRows = (sellerBulk.data || []) as OrderRow[];
  const catalogueOrders = [...buyerCatalogRows, ...sellerCatalogRows];
  const bulkOrders = [...buyerBulkRows, ...sellerBulkRows];

  const openCatalogue = catalogueOrders.filter((order) =>
    orderStillBlocksDeletion(order, terminalCatalogStatuses)
  );
  const openBulk = bulkOrders.filter((order) =>
    orderStillBlocksDeletion(order, terminalBulkStatuses)
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

  const catalogIds = uniqueIds(catalogueOrders);
  const bulkIds = uniqueIds(bulkOrders);
  const sellerCatalogIds = new Set(uniqueIds(sellerCatalogRows));
  const sellerBulkIds = new Set(uniqueIds(sellerBulkRows));

  const [catalogPaymentsResult, bulkPaymentsResult] = await Promise.all([
    catalogIds.length
      ? admin
          .from('catalog_order_payments')
          .select('id,catalog_order_id,status,refund_status,razorpay_transfer_id,seller_payable')
          .in('catalog_order_id', catalogIds)
      : Promise.resolve({ data: [], error: null }),
    bulkIds.length
      ? admin
          .from('bulk_order_payments')
          .select('id,bulk_order_id,status,refund_status,razorpay_transfer_id,seller_payable')
          .in('bulk_order_id', bulkIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (catalogPaymentsResult.error || bulkPaymentsResult.error) {
    throw catalogPaymentsResult.error || bulkPaymentsResult.error;
  }

  const catalogPayments: PaymentRow[] = (catalogPaymentsResult.data || []).map((row) => ({
    ...row,
    order_id: String(row.catalog_order_id),
  }));
  const bulkPayments: PaymentRow[] = (bulkPaymentsResult.data || []).map((row) => ({
    ...row,
    order_id: String(row.bulk_order_id),
  }));
  const allPayments = [...catalogPayments, ...bulkPayments];
  const refundsPending = allPayments.filter((payment) =>
    pendingRefundStatuses.has(String(payment.refund_status || '').toLowerCase())
  );
  if (refundsPending.length) {
    blockers.push({
      code: 'REFUNDS_PENDING',
      title: 'Payment refunds are pending',
      detail: 'Wait for Razorpay to confirm every pending refund before deleting the account.',
      count: refundsPending.length,
    });
  }

  if (sellerId) {
    const unsettled = [
      ...catalogPayments.filter((payment) => sellerCatalogIds.has(payment.order_id)),
      ...bulkPayments.filter((payment) => sellerBulkIds.has(payment.order_id)),
    ].filter(
      (payment) =>
        ['captured', 'paid'].includes(String(payment.status || '').toLowerCase()) &&
        !payment.razorpay_transfer_id &&
        amount(payment.seller_payable) > 0
    );
    if (unsettled.length) {
      blockers.push({
        code: 'SELLER_SETTLEMENT_PENDING',
        title: 'Seller settlements are pending',
        detail: 'FabricTrad must complete or reconcile seller payouts before the account can be deleted.',
        count: unsettled.length,
      });
    }
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
