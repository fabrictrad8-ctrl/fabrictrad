'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import OrderLifecyclePanel from '@/components/commerce/OrderLifecyclePanel';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type CatalogOrder = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit: string;
  price_per_unit: number;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'paid' | 'fulfilled';
  payment_status: 'unpaid' | 'partial' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
  amount_paid: number;
  amount_refunded: number;
  notes: string | null;
  created_at: string;
  purchase_order_number: string | null;
  payment_terms: string;
  deposit_percent: number;
  payment_due_at: string | null;
  requires_review: boolean;
  review_status: 'not_required' | 'pending' | 'approved' | 'rejected';
  seller_products?: { name?: string | null; sku?: string | null; hsn_code?: string | null } | null;
  seller_product_variants?: { color_name?: string | null; design_name?: string | null } | null;
};

const PAYMENT_TERMS: Record<string, string> = {
  due_on_order: 'Due on order',
  due_on_fulfillment: 'Due on fulfilment',
  net_7: 'Net 7',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
  net_90: 'Net 90',
};
const money = (value: unknown) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    Number(value || 0)
  );

export default function SellerCatalogOrders() {
  const { user, isDemoAccount } = useAuth();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [orders, setOrders] = useState<CatalogOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (isDemoAccount || !user?.id) {
      setSellerId(null);
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: seller, error: sellerError } = await supabase
      .from('seller_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sellerError) toast.error(sellerError.message);
    if (!seller?.id) {
      setSellerId(null);
      setOrders([]);
      setLoading(false);
      return;
    }
    setSellerId(seller.id);
    const { data, error } = await supabase
      .from('catalog_order_requests')
      .select(
        'id,buyer_id,seller_id,product_id,variant_id,quantity,unit,price_per_unit,subtotal,gst_amount,total_amount,status,payment_status,amount_paid,amount_refunded,notes,created_at,purchase_order_number,payment_terms,deposit_percent,payment_due_at,requires_review,review_status,seller_products!catalog_order_requests_product_id_fkey(name,sku,hsn_code),seller_product_variants!catalog_order_requests_variant_id_fkey(color_name,design_name)'
      )
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setOrders((data || []) as unknown as CatalogOrder[]);
    setLoading(false);
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const decideOrder = async (order: CatalogOrder, action: 'accept' | 'reject') => {
    if (order.requires_review && order.review_status !== 'approved') {
      toast.error('The buyer company must approve this order before you can act on it.');
      return;
    }
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Reason for rejecting this request:')?.trim() || '';
      if (!reason) return;
    } else {
      reason = window.prompt('Optional acceptance or dispatch note:')?.trim() || '';
    }

    setBusyId(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('seller_decide_catalog_order', {
        p_order_id: order.id,
        p_action: action,
        p_reason: reason || null,
      });
      if (error) throw error;
      toast.success(
        action === 'accept' ?'Order accepted and stock reserved. The buyer sees the server-calculated deposit or balance.' :'Order request rejected and the buyer status was updated.'
      );
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update the order request.');
    } finally {
      setBusyId(null);
    }
  };

  const markFulfilled = async (order: CatalogOrder) => {
    if (order.payment_status !== 'paid') {
      toast.error('The complete order balance must be captured before fulfilment.');
      return;
    }
    setBusyId(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('catalog_order_requests')
        .update({
          status: 'fulfilled',
          fulfilled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('status', 'paid')
        .eq('payment_status', 'paid');
      if (error) throw error;
      toast.success('Fully paid order marked fulfilled.');
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to complete the order.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-800 uppercase tracking-[0.14em] text-primary">Website catalogue</p>
          <h2 className="mt-1 text-lg font-800 text-foreground">Direct buyer orders</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Accept orders, monitor captured deposits/balances, issue GST invoices and publish tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadOrders()}
          disabled={loading}
          className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs disabled:opacity-50"
        >
          <Icon name="ArrowPathIcon" size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : orders.length ? (
        <div className="mt-5 space-y-4">
          {orders.map((order) => {
            const product = order.seller_products;
            const variant = order.seller_product_variants;
            const pending = order.status === 'pending';
            const fullyPaid = order.payment_status === 'paid';
            const waitingForReview = order.requires_review && order.review_status === 'pending';
            const canDecide = pending && !waitingForReview && order.review_status !== 'rejected';
            const netPaid = Math.max(
              0,
              Number(order.amount_paid || 0) - Number(order.amount_refunded || 0)
            );
            const remaining = Math.max(0, Number(order.total_amount || 0) - netPaid);
            const depositAmount =
              Math.round(
                Number(order.total_amount) * (Number(order.deposit_percent || 0) / 100) * 100
              ) / 100;
            return (
              <article
                key={order.id}
                className="rounded-xl border border-border p-4 transition hover:border-primary/25 hover:shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-800 text-foreground">
                        {product?.name || 'Catalogue product'}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-800 uppercase ${
                          fullyPaid || order.status === 'fulfilled' ?'bg-success/10 text-success'
                            : order.status === 'rejected'|| order.status === 'cancelled' ?'bg-error/10 text-error' :'bg-warning/10 text-warning'
                        }`}
                      >
                        {waitingForReview
                          ? 'Company review pending'
                          : order.status === 'accepted'
                            ? order.payment_status === 'partial' ?'Deposit captured · balance due' :'Awaiting buyer payment'
                            : order.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product?.sku || order.product_id.slice(0, 8)}
                      {variant?.color_name ? ` · ${variant.color_name}` : ''}
                      {variant?.design_name ? ` · ${variant.design_name}` : ''}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {Number(order.quantity).toLocaleString('en-IN')} {order.unit} × {money(order.price_per_unit)}
                    </p>
                    {!product?.hsn_code && (
                      <p className="mt-1 text-xs font-700 text-error">
                        HSN code missing — add it to the listing before issuing a GST invoice.
                      </p>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <p className="text-lg font-800 text-primary">{money(order.total_amount)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(order.created_at).toLocaleString('en-IN')}
                    </p>
                    {netPaid > 0 && <p className="mt-1 text-xs text-success">Captured {money(netPaid)}</p>}
                    {remaining > 0 && <p className="text-xs text-warning">Remaining {money(remaining)}</p>}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Purchase order</p><p className="mt-1 text-xs font-800">{order.purchase_order_number || 'Not supplied'}</p></div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Payment terms</p><p className="mt-1 text-xs font-800">{PAYMENT_TERMS[order.payment_terms] || order.payment_terms}</p></div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Opening deposit</p><p className="mt-1 text-xs font-800">{Number(order.deposit_percent) > 0 && Number(order.deposit_percent) < 100 ? `${order.deposit_percent}% · ${money(depositAmount)}` : 'Full balance'}</p></div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Company review</p><p className={`mt-1 text-xs font-800 ${order.review_status === 'approved' ? 'text-success' : waitingForReview ? 'text-warning' : order.review_status === 'rejected' ? 'text-error' : ''}`}>{order.review_status.replaceAll('_', ' ')}</p></div>
                </div>

                {order.notes && (
                  <p className="mt-3 whitespace-pre-line rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                    {order.notes}
                  </p>
                )}

                {waitingForReview && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs font-700 text-warning">
                    <Icon name="ClockIcon" size={15} /> Waiting for an authorised buyer-company admin. Stock has not been reserved.
                  </div>
                )}

                {canDecide && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void decideOrder(order, 'accept')}
                      className="rounded-xl bg-success px-4 py-2 text-xs font-800 text-white disabled:opacity-50"
                    >
                      Accept and reserve stock
                    </button>
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void decideOrder(order, 'reject')}
                      className="rounded-xl border border-error/20 px-4 py-2 text-xs font-800 text-error disabled:opacity-50"
                    >
                      Reject with reason
                    </button>
                  </div>
                )}

                {fullyPaid && order.status === 'paid' && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                    <span className="inline-flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-xs font-800 text-success">
                      <Icon name="CheckCircleIcon" size={15} /> Complete payment captured
                    </span>
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void markFulfilled(order)}
                      className="btn-primary rounded-xl px-4 py-2 text-xs disabled:opacity-50"
                    >
                      Mark fulfilled
                    </button>
                  </div>
                )}

                <OrderLifecyclePanel
                  orderKind="catalog"
                  orderId={order.id}
                  viewerRole="seller"
                  orderStatus={order.status}
                  paymentStatus={order.payment_status}
                  amountPaid={order.amount_paid}
                  amountRefunded={order.amount_refunded}
                  buyerId={order.buyer_id}
                  sellerId={sellerId || order.seller_id}
                  onChanged={loadOrders}
                />
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-border py-10 text-center">
          <Icon name="ShoppingBagIcon" size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-800 text-foreground">No direct catalogue orders yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            They appear here when buyers submit orders from live listings.
          </p>
        </div>
      )}
    </section>
  );
}
