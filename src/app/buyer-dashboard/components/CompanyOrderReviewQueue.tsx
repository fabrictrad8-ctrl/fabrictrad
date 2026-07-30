'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type ReviewOrder = {
  id: string;
  quantity: number;
  unit: string;
  total_amount: number;
  purchase_order_number: string | null;
  payment_terms: string;
  deposit_percent: number;
  review_status: 'pending' | 'approved' | 'rejected' | 'not_required';
  status: string;
  created_at: string;
  seller_products?: { name?: string | null; sku?: string | null } | null;
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

export default function CompanyOrderReviewQueue() {
  const { user, isDemoAccount } = useAuth();
  const [orders, setOrders] = useState<ReviewOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    if (isDemoAccount) {
      setOrders([
        {
          id: 'demo-review-order',
          quantity: 100,
          unit: 'mtr',
          total_amount: 82950,
          purchase_order_number: 'PO-DEMO-2026',
          payment_terms: 'net_30',
          deposit_percent: 20,
          review_status: 'pending',
          status: 'pending',
          created_at: new Date().toISOString(),
          seller_products: { name: 'Pure Dyeable Soft Net', sku: 'STM-NET-001' },
          seller_product_variants: { color_name: 'Ivory', design_name: 'Standard' },
        },
      ]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('catalog_order_requests')
      .select('id,quantity,unit,total_amount,purchase_order_number,payment_terms,deposit_percent,review_status,status,created_at,seller_products(name,sku),seller_product_variants(color_name,design_name)')
      .eq('buyer_id', user.id)
      .eq('requires_review', true)
      .eq('review_status', 'pending')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setOrders((data || []) as unknown as ReviewOrder[]);
    setLoading(false);
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const review = async (orderId: string, decision: 'approve' | 'reject') => {
    setBusyId(orderId);
    try {
      if (isDemoAccount) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        setOrders((current) => current.filter((order) => order.id !== orderId));
      } else {
        const supabase = createClient();
        const { error } = await supabase.rpc('review_company_catalog_order', {
          p_order_id: orderId,
          p_decision: decision,
        });
        if (error) throw error;
        await loadOrders();
      }
      toast.success(decision === 'approve' ? 'Order approved and released to the seller.' : 'Order rejected and cancelled.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The review decision could not be saved.');
    } finally {
      setBusyId(null);
    }
  };

  if (!loading && orders.length === 0) return null;

  return (
    <section className="ft-section mb-6 overflow-hidden">
      <div className="flex flex-col justify-between gap-3 border-b border-border bg-warning/5 p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="ClipboardDocumentCheckIcon" size={18} className="text-warning" />
            <h2 className="font-800 text-foreground">Orders awaiting company approval</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">The seller cannot accept or reserve stock until an authorised company admin reviews these requests.</p>
        </div>
        <span className="ft-badge ft-badge--warning">{loading ? 'Loading' : `${orders.length} pending`}</span>
      </div>

      {loading ? (
        <div className="py-10 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : (
        <div className="divide-y divide-border">
          {orders.map((order) => (
            <article key={order.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-800 text-foreground">{order.seller_products?.name || 'Catalogue product'}</p>
                    <span className="ft-badge ft-badge--warning">Review required</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.seller_products?.sku || order.id.slice(0, 8).toUpperCase()}
                    {order.seller_product_variants?.color_name ? ` · ${order.seller_product_variants.color_name}` : ''}
                    {order.seller_product_variants?.design_name ? ` · ${order.seller_product_variants.design_name}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="ft-orange-chip">{Number(order.quantity).toLocaleString('en-IN')} {order.unit}</span>
                    <span className="ft-orange-chip">{PAYMENT_TERMS[order.payment_terms] || order.payment_terms}</span>
                    <span className="ft-orange-chip">{Number(order.deposit_percent) ? `${order.deposit_percent}% deposit` : 'No deposit'}</span>
                    {order.purchase_order_number && <span className="ft-orange-chip">PO {order.purchase_order_number}</span>}
                  </div>
                </div>
                <div className="lg:text-right">
                  <p className="text-xl font-800 text-primary">₹{Number(order.total_amount).toLocaleString('en-IN')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <button type="button" disabled={busyId === order.id} onClick={() => void review(order.id, 'approve')} className="btn-primary rounded-xl px-4 py-2.5 text-xs disabled:opacity-50">
                  <Icon name="CheckCircleIcon" size={15} /> Approve order
                </button>
                <button type="button" disabled={busyId === order.id} onClick={() => void review(order.id, 'reject')} className="btn-secondary rounded-xl px-4 py-2.5 text-xs text-error disabled:opacity-50">
                  <Icon name="XCircleIcon" size={15} /> Reject order
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}