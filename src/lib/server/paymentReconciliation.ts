import { createAdminClient } from '@/lib/supabase/admin';

export type Reconciliation = {
  paymentStatus: string;
  amountPaid: number;
  amountRefunded: number;
  captured: number;
  refunded: number;
  gstAmount: number;
  effectiveGstRate: number;
  needsReview: boolean;
};

export async function reconcileMarketplacePayment(admin: ReturnType<typeof createAdminClient>, kind: 'catalog' | 'bulk', orderId: string) {
  const { data, error } = await admin.rpc('reconcile_marketplace_payment', { p_kind: kind, p_order_id: orderId });
  if (error || !data) throw error || new Error('Order reconciliation failed.');
  return data as Reconciliation;
}
