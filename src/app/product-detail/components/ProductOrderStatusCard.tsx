'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { RazorpayCheckout } from '@/components/RazorpayCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useProduct } from '@/lib/hooks/useProduct';

type CatalogOrder = {
  id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  amount_paid: number;
  amount_refunded: number;
  created_at: string;
  updated_at: string;
};

type Shipment = {
  status: string | null;
  courier_name: string | null;
  awb_number: string | null;
  tracking_url: string | null;
  estimated_delivery: string | null;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value || 0);

export default function ProductOrderStatusCard() {
  const { user } = useAuth();
  const { product } = useProduct();
  const supabase = useMemo(() => createClient(), []);
  const [order, setOrder] = useState<CatalogOrder | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || product.source !== 'seller' || !product.rawProductId) {
      setOrder(null);
      setShipment(null);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('catalog_order_requests')
      .select('id,status,payment_status,total_amount,amount_paid,amount_refunded,created_at,updated_at')
      .eq('buyer_id', user.id)
      .eq('product_id', product.rawProductId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      setLoading(false);
      return;
    }

    const rows = (data || []) as CatalogOrder[];
    const active =
      rows.find((row) => !['rejected', 'cancelled'].includes(String(row.status))) || null;
    setOrder(active);

    if (active) {
      const { data: shipmentRow } = await supabase
        .from('seller_shipments')
        .select('status,courier_name,awb_number,tracking_url,estimated_delivery')
        .eq('catalog_order_id', active.id)
        .maybeSingle();
      setShipment((shipmentRow || null) as Shipment | null);
    } else {
      setShipment(null);
    }
    setLoading(false);
  }, [product.rawProductId, product.source, supabase, user?.id]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  if (!user?.id || !order) return null;

  const netPaid = Math.max(0, Number(order.amount_paid || 0) - Number(order.amount_refunded || 0));
  const remaining = Math.max(0, Number(order.total_amount || 0) - netPaid);
  const canPay =
    order.status === 'accepted' &&
    remaining > 0.009 &&
    !['paid', 'refunded'].includes(order.payment_status);
  const paid = order.payment_status === 'paid' || ['paid', 'fulfilled'].includes(order.status);

  return (
    <section id="order-status" className="rounded-2xl border border-primary/25 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-800 uppercase tracking-[0.14em] text-primary">Your current order</p>
          <h2 className="mt-1 text-base font-800 text-foreground">
            {canPay
              ? 'Seller accepted — payment is ready'
              : paid
                ? shipment
                  ? 'Paid — shipment in progress' :'Payment complete — awaiting dispatch' :'Order sent — waiting for seller'}
          </h2>
        </div>
        <button type="button" onClick={() => void load()} className="ft-icon-button !min-h-8 !min-w-8" aria-label="Refresh order status">
          <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="mt-3 rounded-xl bg-muted/45 p-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Order</span>
          <span className="font-mono font-700 text-foreground">FT-CAT-{order.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Total</span>
          <span className="font-800 text-foreground">{money(Number(order.total_amount || 0))}</span>
        </div>
        {netPaid > 0 && remaining > 0 && (
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Remaining</span>
            <span className="font-800 text-warning">{money(remaining)}</span>
          </div>
        )}
      </div>

      {canPay && (
        <div className="mt-4">
          <RazorpayCheckout
            amount={remaining}
            orderId={order.id}
            orderType="catalog"
            buttonText={netPaid > 0 ? 'Pay remaining balance' : 'Pay now with Razorpay'}
            onSuccess={() => {
              toast.success('Payment recorded. Preparing your order for dispatch.');
              window.setTimeout(() => void load(), 800);
            }}
            onError={(error) => toast.error(error.message)}
          />
          <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
            The amount is loaded again from the server before Razorpay opens. FabricTrad never marks the order paid until payment verification succeeds.
          </p>
        </div>
      )}

      {order.status === 'pending' && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs text-warning">
          <Icon name="ClockIcon" size={15} /> The seller has not accepted this order yet. This card refreshes automatically.
        </div>
      )}

      {paid && !shipment && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 p-3 text-xs text-success">
          <Icon name="CheckCircleIcon" size={15} /> Payment captured. The seller has been notified to book dispatch.
        </div>
      )}

      {shipment && (
        <div className="mt-3 rounded-xl border border-success/20 bg-success/5 p-3 text-xs">
          <p className="font-800 text-success">{String(shipment.status || 'Shipment created').replaceAll('_', ' ')}</p>
          <p className="mt-1 text-muted-foreground">
            {shipment.courier_name || 'Courier'} · {shipment.awb_number || 'AWB pending'}
          </p>
          {shipment.estimated_delivery && <p className="mt-1 text-muted-foreground">ETA {shipment.estimated_delivery}</p>}
          {shipment.tracking_url && (
            <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-800 text-primary underline">
              Track shipment <Icon name="ArrowTopRightOnSquareIcon" size={12} />
            </a>
          )}
        </div>
      )}

      <Link href={`/buyer-dashboard?tab=orders&order=${order.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-800 text-primary">
        Open full order <Icon name="ArrowRightIcon" size={12} />
      </Link>
    </section>
  );
}
