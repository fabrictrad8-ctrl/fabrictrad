'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { RazorpayCheckout } from '@/components/RazorpayCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type CatalogOrder = {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit: string;
  price_per_unit: number;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'paid' | 'fulfilled';
  notes: string | null;
  created_at: string;
  seller_products?: { name?: string | null; sku?: string | null } | null;
  seller_product_variants?: { color_name?: string | null; design_name?: string | null } | null;
};

const statusLabel: Record<CatalogOrder['status'], string> = {
  pending: 'Waiting for seller',
  accepted: 'Accepted — payment due',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  paid: 'Paid',
  fulfilled: 'Fulfilled',
};

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
        'id,product_id,variant_id,quantity,unit,price_per_unit,subtotal,gst_amount,total_amount,status,notes,created_at,seller_products(name,sku),seller_product_variants(color_name,design_name)'
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
    if (!window.confirm('Cancel this marketplace order request?')) return;
    setBusyId(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('catalog_order_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('buyer_id', user?.id)
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
            Track seller acceptance, complete secure payment and follow fulfilment here.
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
        <div className="mt-5 space-y-3">
          {orders.map((order) => {
            const product = order.seller_products;
            const variant = order.seller_product_variants;
            const canCancel = order.status === 'pending' || order.status === 'accepted';
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
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product?.sku || `FT-CAT-${order.id.slice(0, 8).toUpperCase()}`}
                      {variant?.color_name ? ` · ${variant.color_name}` : ''}
                      {variant?.design_name ? ` · ${variant.design_name}` : ''}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {Number(order.quantity).toLocaleString('en-IN')} {order.unit} × ₹
                      {Number(order.price_per_unit).toLocaleString('en-IN')}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(order.created_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-lg font-800 text-primary">
                      ₹{Number(order.total_amount).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[11px] text-muted-foreground">including GST</p>
                  </div>
                </div>

                {order.notes && (
                  <p className="mt-3 whitespace-pre-line rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                    {order.notes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-3">
                  {order.status === 'accepted' && (
                    <div className="w-full max-w-xs">
                      <RazorpayCheckout
                        amount={Number(order.total_amount)}
                        orderId={order.id}
                        buttonText="Pay securely"
                        onSuccess={() => {
                          toast.success('Payment authorized. Waiting for capture confirmation.');
                          window.setTimeout(() => void loadOrders(), 2000);
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
                  {order.status === 'paid' && (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-success/10 px-4 py-2 text-xs font-800 text-success">
                      <Icon name="CheckCircleIcon" size={15} /> Payment received — seller is fulfilling
                    </span>
                  )}
                  {order.status === 'fulfilled' && (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-success/10 px-4 py-2 text-xs font-800 text-success">
                      <Icon name="CheckBadgeIcon" size={15} /> Order fulfilled
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
