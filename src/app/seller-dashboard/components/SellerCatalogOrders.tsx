'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type CatalogOrder = {
  id: string;
  buyer_id: string;
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

export default function SellerCatalogOrders() {
  const { user, isDemoAccount } = useAuth();
  const [orders, setOrders] = useState<CatalogOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (isDemoAccount || !user?.id) {
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
      setOrders([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('catalog_order_requests')
      .select(
        'id,buyer_id,product_id,variant_id,quantity,unit,price_per_unit,subtotal,gst_amount,total_amount,status,notes,created_at,seller_products(name,sku),seller_product_variants(color_name,design_name)'
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
        action === 'accept'
          ? 'Order accepted and stock reserved. The buyer can now pay.'
          : 'Order request rejected and the buyer status was updated.'
      );
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update the order request.');
    } finally {
      setBusyId(null);
    }
  };

  const markFulfilled = async (order: CatalogOrder) => {
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
        .eq('status', 'paid');
      if (error) throw error;
      toast.success('Paid order marked fulfilled.');
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
            Accept only available quantities, reserve inventory, receive payment and fulfil orders.
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
        <div className="mt-5 space-y-3">
          {orders.map((order) => {
            const product = order.seller_products;
            const variant = order.seller_product_variants;
            const pending = order.status === 'pending';
            const paid = order.status === 'paid';
            return (
              <article key={order.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-800 text-foreground">
                        {product?.name || 'Catalogue product'}
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
                        {order.status === 'accepted' ? 'Awaiting buyer payment' : order.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product?.sku || order.product_id.slice(0, 8)}
                      {variant?.color_name ? ` · ${variant.color_name}` : ''}
                      {variant?.design_name ? ` · ${variant.design_name}` : ''}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {Number(order.quantity).toLocaleString('en-IN')} {order.unit} × ₹
                      {Number(order.price_per_unit).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-lg font-800 text-primary">
                      ₹{Number(order.total_amount).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(order.created_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                {order.notes && (
                  <p className="mt-3 whitespace-pre-line rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                    {order.notes}
                  </p>
                )}

                {pending && (
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

                {order.status === 'accepted' && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-xs font-700 text-warning">
                    <Icon name="ClockIcon" size={15} /> Stock is reserved while the buyer completes payment.
                  </div>
                )}

                {paid && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                    <span className="inline-flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-xs font-800 text-success">
                      <Icon name="CheckCircleIcon" size={15} /> Payment captured
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
