'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { RazorpayCheckout } from '@/components/RazorpayCheckout';
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
  payment_terms: string;
  deposit_percent: number;
  payment_due_at: string | null;
  notes: string | null;
  created_at: string;
  seller_products?: { name?: string | null; sku?: string | null } | null;
  seller_product_variants?: { color_name?: string | null; design_name?: string | null } | null;
};

const statusLabel: Record<CatalogOrder['status'], string> = {
  pending: 'Waiting for seller',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  paid: 'Paid — seller fulfilling',
  fulfilled: 'Fulfilled',
};
const paymentLabel: Record<CatalogOrder['payment_status'], string> = {
  unpaid: 'Payment due',
  partial: 'Deposit paid — balance due',
  paid: 'Fully paid',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
  failed: 'Payment failed — retry available',
};
const termsLabel: Record<string, string> = {
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

export default function BuyerCatalogOrders() {
  const { user, isDemoAccount } = useAuth();
  const [orders, setOrders] = useState<CatalogOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user?.id || isDemoAccount) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('catalog_order_requests')
      .select(
        'id,buyer_id,seller_id,product_id,variant_id,quantity,unit,price_per_unit,subtotal,gst_amount,total_amount,status,payment_status,amount_paid,amount_refunded,payment_terms,deposit_percent,payment_due_at,notes,created_at,seller_products!catalog_order_requests_product_id_fkey(name,sku),seller_product_variants!catalog_order_requests_variant_id_fkey(color_name,design_name)'
      )
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setOrders((data || []) as unknown as CatalogOrder[]);
    setLoading(false);
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const cancelOrder = async (order: CatalogOrder) => {
    if (Number(order.amount_paid || 0) > 0) {
      toast.error('A paid or partially paid order must be refunded before cancellation.');
      return;
    }
    if (!window.confirm('Cancel this marketplace order request?')) return;
    setBusyId(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('catalog_order_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('buyer_id', user?.id)
        .eq('amount_paid', 0)
        .in('status', ['pending', 'accepted']);
      if (error) throw error;
      toast.success('Order request cancelled.');
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The order could not be cancelled.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <section className="mb-7 rounded-2xl border border-border bg-card py-12 text-center">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </section>
    );
  }

  return (
    <section className="mb-7 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-800 uppercase tracking-[0.14em] text-primary">Marketplace purchases</p>
          <h2 className="mt-1 text-lg font-800 text-foreground">Direct product orders</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Seller acceptance, deposits/balances, GST invoices and shipment tracking are stored here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadOrders()}
          className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs"
        >
          <Icon name="ArrowPathIcon" size={14} /> Refresh
        </button>
      </div>

      {!orders.length ? (
        <div className="mt-5 rounded-xl border border-dashed border-border py-9 text-center">
          <Icon name="ShoppingBagIcon" size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-800 text-foreground">No marketplace orders yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submit an order from a live product page and it will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {orders.map((order) => {
            const product = order.seller_products;
            const variant = order.seller_product_variants;
            const netPaid = Math.max(
              0,
              Number(order.amount_paid || 0) - Number(order.amount_refunded || 0)
            );
            const remaining = Math.max(0, Number(order.total_amount || 0) - netPaid);
            const canCancel =
              Number(order.amount_paid || 0) === 0 &&
              (order.status === 'pending' || order.status === 'accepted');
            const canPay =
              order.status === 'accepted' &&
              remaining > 0.009 &&
              !['paid', 'refunded'].includes(order.payment_status);
            return (
              <article key={order.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-800 text-foreground">
                        {product?.name || 'Marketplace product'}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-800 uppercase ${
                          order.status === 'paid' || order.status === 'fulfilled'
                            ? 'bg-success/10 text-success'
                            : order.status === 'rejected' || order.status === 'cancelled'
                              ? 'bg-error/10 text-error'
                              : 'bg-warning/10 text-warning'
                        }`}
                      >
                        {statusLabel[order.status]}
                      </span>
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-800 text-muted-foreground">
                        {paymentLabel[order.payment_status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product?.sku || `FT-CAT-${order.id.slice(0, 8).toUpperCase()}`}
                      {variant?.color_name ? ` · ${variant.color_name}` : ''}
                      {variant?.design_name ? ` · ${variant.design_name}` : ''}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {Number(order.quantity).toLocaleString('en-IN')} {order.unit} × {money(order.price_per_unit)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(order.created_at).toLocaleString('en-IN')} ·{' '}
                      {termsLabel[order.payment_terms] || order.payment_terms}
                      {Number(order.deposit_percent || 0) > 0 && Number(order.deposit_percent) < 100
                        ? ` · ${Number(order.deposit_percent)}% opening deposit`
                        : ''}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-lg font-800 text-primary">{money(order.total_amount)}</p>
                    <p className="text-[11px] text-muted-foreground">including GST</p>
                    {remaining > 0 && netPaid > 0 && (
                      <p className="mt-1 text-xs font-800 text-warning">Balance {money(remaining)}</p>
                    )}
                  </div>
                </div>

                {order.notes && (
                  <p className="mt-3 whitespace-pre-line rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                    {order.notes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-3">
                  {canPay && (
                    <div className="w-full max-w-sm">
                      <RazorpayCheckout
                        amount={remaining}
                        orderId={order.id}
                        orderType="catalog"
                        buttonText={netPaid > 0 ? 'Pay remaining balance' : 'Pay amount due'}
                        onSuccess={({ status }) => {
                          toast.success(
                            status === 'captured'
                              ? 'Payment captured and order updated.'
                              : 'Payment authorised. Waiting for capture confirmation.'
                          );
                          window.setTimeout(() => void loadOrders(), 1200);
                        }}
                        onError={(error) => toast.error(error.message)}
                      />
                    </div>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void cancelOrder(order)}
                      className="rounded-xl border border-error/20 bg-error/5 px-4 py-2 text-xs font-800 text-error disabled:opacity-50"
                    >
                      {busyId === order.id ? 'Cancelling…' : 'Cancel request'}
                    </button>
                  )}
                  {order.payment_status === 'paid' && order.status === 'accepted' && (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-success/10 px-4 py-2 text-xs font-800 text-success">
                      <Icon name="CheckCircleIcon" size={15} /> Fully paid — reconciling fulfilment
                    </span>
                  )}
                </div>

                <OrderLifecyclePanel
                  orderKind="catalog"
                  orderId={order.id}
                  viewerRole="buyer"
                  orderStatus={order.status}
                  paymentStatus={order.payment_status}
                  amountPaid={order.amount_paid}
                  amountRefunded={order.amount_refunded}
                  buyerId={order.buyer_id}
                  sellerId={order.seller_id}
                  onChanged={loadOrders}
                />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
