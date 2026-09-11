'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import OrderLifecyclePanel from '@/components/commerce/OrderLifecyclePanel';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { validTrackingUrl } from '@/lib/shippingValidation';
import { pillClassForStatus, pillLabel } from '@/lib/statusPill';

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

type Shipment = {
  id: string;
  catalog_order_id: string | null;
  courier_type: string | null;
  courier_name: string | null;
  awb_number: string | null;
  tracking_url: string | null;
  estimated_delivery: string | null;
  status: string | null;
};

/**
 * The reachable seller-side stages of a catalogue order.
 *
 * This marketplace is instant-buy: `submit_catalog_order_request` creates the
 * order already `accepted` and decrements `seller_products.available_quantity`
 * in the same statement, so sellers never approve orders. The one exception is
 * a B2B order flagged `requires_review`, which starts `pending` with stock held
 * in `reserved_quantity` until the *buyer's* company admin approves it — that
 * approval sets `review_status='approved'` and `status='accepted'` atomically,
 * so `pending` is never a seller decision either.
 */
type Stage = 'buyer_review' | 'awaiting_payment' | 'to_dispatch' | 'in_transit' | 'completed' | 'cancelled';

const STAGE_TABS: Array<{ key: Stage | 'all'; label: string }> = [
  { key: 'to_dispatch', label: 'To dispatch' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'awaiting_payment', label: 'Awaiting payment' },
  { key: 'buyer_review', label: 'Buyer approval' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

const STAGE_COPY: Record<Stage, string> = {
  buyer_review: 'Held for the buyer company to approve. Stock is reserved, not sold. Nothing to do here.',
  awaiting_payment: 'Stock is committed to this buyer. It is released automatically if the payment window lapses.',
  to_dispatch: 'Paid and waiting on you. Book the shipment below.',
  in_transit: 'On its way. Keep the shipment status current so the buyer can track it.',
  completed: 'Delivered and fulfilled.',
  cancelled: 'Closed. Any committed stock has been returned to your inventory.',
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
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));

const shipmentDelivered = (shipment?: Shipment | null) =>
  String(shipment?.status || '').toLowerCase() === 'delivered';

/** Statuses `save_my_manual_shipment` accepts as the *previous* state of a delivery confirmation. */
const DISPATCHED = new Set(['in_transit', 'out_for_delivery', 'picked_up']);

function stageOf(order: CatalogOrder, shipment?: Shipment | null): Stage {
  if (order.status === 'rejected' || order.status === 'cancelled') return 'cancelled';
  if (order.status === 'fulfilled') return 'completed';
  if (order.status === 'pending') return 'buyer_review';
  if (order.status === 'paid') return shipment ? 'in_transit' : 'to_dispatch';
  return 'awaiting_payment';
}

function dueLabel(value: string | null) {
  if (!value) return null;
  const due = new Date(value).getTime();
  if (!Number.isFinite(due)) return null;
  const hours = Math.round((due - Date.now()) / 3600000);
  if (hours < 0) return 'Payment window lapsed';
  if (hours < 1) return 'Payment due within the hour';
  if (hours < 48) return `Payment due in ${hours} h`;
  return `Payment due ${new Date(value).toLocaleDateString('en-IN')}`;
}

export default function SellerCatalogOrders() {
  const { user, isDemoAccount } = useAuth();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [orders, setOrders] = useState<CatalogOrder[]>([]);
  const [shipments, setShipments] = useState<Record<string, Shipment>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Stage | 'all'>('to_dispatch');
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>({});

  const loadOrders = useCallback(async () => {
    if (isDemoAccount || !user?.id) {
      setSellerId(null);
      setOrders([]);
      setShipments({});
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
      setShipments({});
      setLoading(false);
      return;
    }
    setSellerId(seller.id);

    const [orderResult, shipmentResult] = await Promise.all([
      supabase
        .from('catalog_order_requests')
        .select(
          'id,buyer_id,seller_id,product_id,variant_id,quantity,unit,price_per_unit,subtotal,gst_amount,total_amount,status,payment_status,amount_paid,amount_refunded,notes,created_at,purchase_order_number,payment_terms,deposit_percent,payment_due_at,requires_review,review_status,seller_products!catalog_order_requests_product_id_fkey(name,sku,hsn_code),seller_product_variants!catalog_order_requests_variant_id_fkey(color_name,design_name)'
        )
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('seller_shipments')
        .select('id,catalog_order_id,courier_type,courier_name,awb_number,tracking_url,estimated_delivery,status')
        .eq('seller_id', seller.id)
        .not('catalog_order_id', 'is', null)
        .limit(500),
    ]);

    if (orderResult.error) toast.error(orderResult.error.message);
    // A shipment read failure must not hide orders — it only costs the dispatch
    // controls, so the list still renders with shipment state unknown.
    if (shipmentResult.error) toast.error(shipmentResult.error.message);

    setOrders((orderResult.data || []) as unknown as CatalogOrder[]);
    setShipments(
      Object.fromEntries(
        ((shipmentResult.data || []) as Shipment[])
          .filter((shipment) => shipment.catalog_order_id)
          .map((shipment) => [String(shipment.catalog_order_id), shipment])
      )
    );
    setLoading(false);
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  /**
   * The genuine seller escape hatch. `seller_reject_catalog_order` only accepts
   * an `accepted` order with nothing captured; anything with money on it has to
   * be refunded first, after which `finalize_seller_rejection_after_refund()`
   * closes it. We never offer the button in that case.
   */
  const cancelOrder = async (order: CatalogOrder) => {
    const reason = window.prompt('Tell the buyer why you cannot fulfil this order:')?.trim() || '';
    if (!reason) return;
    if (!window.confirm('Cancel this order and return the committed stock to your inventory?')) return;

    setBusyId(order.id);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('seller_reject_catalog_order', {
        p_order_id: order.id,
        p_reason: reason,
      });
      if (error) throw error;
      toast.success('Order cancelled, the buyer was told why, and the stock is back in your inventory.');
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to cancel this order.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Advance a manually-couriered shipment. Shiprocket shipments are driven by
   * the courier webhook, which also fulfils the order on delivery, so these
   * controls are only offered for `courier_type` other than 'shiprocket'.
   */
  const advanceShipment = async (order: CatalogOrder, shipment: Shipment, status: 'out_for_delivery' | 'delivered') => {
    const tracking = (trackingDrafts[order.id] ?? shipment.tracking_url ?? '').trim();
    if (!validTrackingUrl(tracking)) {
      toast.error('Add the courier tracking link (https://…) before updating this shipment.');
      return;
    }
    if (!shipment.courier_name?.trim() || !shipment.awb_number?.trim()) {
      toast.error('This shipment is missing its courier name or AWB. Add them in the shipment card below first.');
      return;
    }

    setBusyId(order.id);
    try {
      const response = await fetch('/api/seller/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          orderId: order.id,
          orderType: 'catalog',
          courierName: shipment.courier_name,
          awbNumber: shipment.awb_number,
          trackingUrl: tracking,
          estimatedDelivery: shipment.estimated_delivery || '',
          status,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!response.ok || !result.success) throw new Error(result.error || 'Shipment could not be updated.');
      toast.success(status === 'delivered' ? 'Delivery confirmed.' : 'Marked out for delivery.');
      setTrackingDrafts((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shipment could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * `protect_catalog_order_request_state()` only lets a seller move paid →
   * fulfilled once a delivered shipment exists, so the button is gated on the
   * same condition rather than letting the database throw at the seller.
   */
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
        .eq('status', 'paid')
        .eq('payment_status', 'paid');
      if (error) throw error;
      toast.success('Order closed as fulfilled.');
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to complete the order.');
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const tally: Record<string, number> = { all: orders.length };
    orders.forEach((order) => {
      const stage = stageOf(order, shipments[order.id]);
      tally[stage] = (tally[stage] || 0) + 1;
    });
    return tally;
  }, [orders, shipments]);

  // The default stage is "to dispatch", which is empty for most sellers most of
  // the time — landing there showed "N need you" beside "Nothing in this stage",
  // leaving the seller to hunt for the orders. Land once on the first stage that
  // actually holds something, most urgent first, without overriding a manual
  // choice afterwards.
  const autoStagePicked = useRef(false);
  useEffect(() => {
    if (autoStagePicked.current || loading || !orders.length) return;
    autoStagePicked.current = true;
    if (counts[tab]) return;
    const firstPopulated = (['to_dispatch', 'in_transit', 'awaiting_payment', 'buyer_review', 'completed'] as const)
      .find((stage) => counts[stage]);
    setTab(firstPopulated ?? 'all');
  }, [counts, loading, orders.length, tab]);

  const visibleOrders = useMemo(
    () => (tab === 'all' ? orders : orders.filter((order) => stageOf(order, shipments[order.id]) === tab)),
    [orders, shipments, tab]
  );

  const needsAttention = (counts.to_dispatch || 0) + (counts.in_transit || 0);

  return (
    <section className="ft-order-board ft-shopify-card overflow-hidden">
      <div className="ft-order-board-head flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-850 uppercase tracking-[0.12em] text-primary">Marketplace orders</p>
          <h2 className="mt-1 text-base font-850 text-foreground">Fulfilment queue</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Buyers check out instantly and stock is committed at that moment — there is nothing to accept. Your job is
            payment, dispatch, delivery.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!loading && needsAttention > 0 && (
            <span className="ft-pill ft-pill-pending whitespace-nowrap">{needsAttention} need you</span>
          )}
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={loading}
            className="ft-icon-button"
            aria-label="Refresh catalogue orders"
          >
            <Icon name="ArrowPathIcon" size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="ft-order-tabs flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2 sm:px-5">
        {STAGE_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-pressed={tab === item.key}
            className={`ft-order-tab shrink-0 rounded-lg px-3 py-1.5 text-xs font-750 ${tab === item.key ? 'is-active' : ''}`}
          >
            {item.label}
            <span className="ml-1.5 tabular-nums opacity-70">{loading ? '·' : counts[item.key] || 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2 p-4 sm:p-5">
          {[0, 1, 2].map((key) => (
            <div key={key} className="ft-skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : visibleOrders.length ? (
        <div className="divide-y divide-border">
          {visibleOrders.map((order) => {
            const product = order.seller_products;
            const variant = order.seller_product_variants;
            const shipment = shipments[order.id] || null;
            const stage = stageOf(order, shipment);
            const netPaid = Math.max(0, Number(order.amount_paid || 0) - Number(order.amount_refunded || 0));
            const remaining = Math.max(0, Number(order.total_amount || 0) - netPaid);
            const depositAmount =
              Math.round(Number(order.total_amount) * (Number(order.deposit_percent || 0) / 100) * 100) / 100;
            const delivered = shipmentDelivered(shipment);
            const manualCourier = Boolean(shipment) && shipment?.courier_type !== 'shiprocket';
            const dispatched = DISPATCHED.has(String(shipment?.status || '').toLowerCase());
            const canCancel = order.status === 'accepted' && netPaid <= 0;
            const capturedButUnfinished = order.status === 'accepted' && netPaid > 0;
            const canFulfil = order.status === 'paid' && order.payment_status === 'paid' && delivered;
            const busy = busyId === order.id;

            return (
              <article key={order.id} data-focus-id={`catalog_order-${order.id}`} className="ft-order-row px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono-id">FT-CAT-{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className={pillClassForStatus(order.status)}>{pillLabel(order.status)}</span>
                      {order.payment_status !== 'unpaid' && (
                        <span className={pillClassForStatus(order.payment_status)}>
                          {pillLabel(order.payment_status)}
                        </span>
                      )}
                      {shipment?.status && (
                        <span className={pillClassForStatus(shipment.status)}>{pillLabel(shipment.status)}</span>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-800 text-foreground">
                      {product?.name || 'Catalogue product'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {product?.sku || order.product_id.slice(0, 8)}
                      {variant?.color_name ? ` · ${variant.color_name}` : ''}
                      {variant?.design_name ? ` · ${variant.design_name}` : ''}
                      {' · '}
                      {Number(order.quantity).toLocaleString('en-IN')} {order.unit} × {money(order.price_per_unit)}
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{STAGE_COPY[stage]}</p>
                    {!product?.hsn_code && (
                      <p className="mt-1 text-xs font-700 text-error">
                        HSN code missing — add it to the listing before issuing a GST invoice.
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="text-lg font-850 text-foreground">{money(order.total_amount)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(order.created_at).toLocaleString('en-IN')}
                    </p>
                    {netPaid > 0 && <p className="mt-1 text-xs font-700 text-success">Captured {money(netPaid)}</p>}
                    {remaining > 0 && <p className="text-xs font-700 text-warning">Remaining {money(remaining)}</p>}
                    {stage === 'awaiting_payment' && dueLabel(order.payment_due_at) && (
                      <p className="mt-1 text-[11px] text-muted-foreground">{dueLabel(order.payment_due_at)}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="ft-order-fact">
                    <p className="ft-order-fact-label">Purchase order</p>
                    <p className="ft-order-fact-value">{order.purchase_order_number || 'Not supplied'}</p>
                  </div>
                  <div className="ft-order-fact">
                    <p className="ft-order-fact-label">Payment terms</p>
                    <p className="ft-order-fact-value">{PAYMENT_TERMS[order.payment_terms] || order.payment_terms}</p>
                  </div>
                  <div className="ft-order-fact">
                    <p className="ft-order-fact-label">Opening deposit</p>
                    <p className="ft-order-fact-value">
                      {Number(order.deposit_percent) > 0 && Number(order.deposit_percent) < 100
                        ? `${order.deposit_percent}% · ${money(depositAmount)}`
                        : 'Full balance'}
                    </p>
                  </div>
                  <div className="ft-order-fact">
                    <p className="ft-order-fact-label">Buyer company approval</p>
                    <p className="ft-order-fact-value">
                      {order.requires_review ? pillLabel(order.review_status) : 'Not required'}
                    </p>
                  </div>
                </div>

                {order.notes && (
                  <p className="mt-3 whitespace-pre-line rounded-lg bg-muted p-2.5 text-xs leading-5 text-muted-foreground">
                    {order.notes}
                  </p>
                )}

                {stage === 'buyer_review' && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs font-700 leading-5 text-warning">
                    <Icon name="ClockIcon" size={15} className="mt-0.5 shrink-0" />
                    Waiting on an authorised admin at the buyer&apos;s company. This stock is reserved, not sold — it
                    returns to you automatically if they decline.
                  </div>
                )}

                {(canCancel || capturedButUnfinished || canFulfil || (manualCourier && !delivered)) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {canFulfil && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void markFulfilled(order)}
                        className="ft-primary-action px-4 py-2 text-xs disabled:opacity-50"
                      >
                        {busy ? 'Closing…' : 'Mark fulfilled'}
                      </button>
                    )}

                    {manualCourier && shipment && !delivered && (
                      <>
                        {!dispatched && (
                          <span className="text-xs text-muted-foreground">
                            Shipment saved as {pillLabel(shipment.status)} — book or dispatch it below to progress.
                          </span>
                        )}
                        {dispatched && (
                          <>
                            {String(shipment.status).toLowerCase() !== 'out_for_delivery' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void advanceShipment(order, shipment, 'out_for_delivery')}
                                className="ft-secondary-action px-3 py-2 text-xs disabled:opacity-50"
                              >
                                Mark out for delivery
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void advanceShipment(order, shipment, 'delivered')}
                              className="ft-secondary-action px-3 py-2 text-xs disabled:opacity-50"
                            >
                              Confirm delivered
                            </button>
                            {!validTrackingUrl(shipment.tracking_url || '') && (
                              <label className="flex min-w-[210px] flex-1 flex-col text-[11px] font-700 text-muted-foreground">
                                Tracking link required to update
                                <input
                                  type="url"
                                  inputMode="url"
                                  value={trackingDrafts[order.id] ?? ''}
                                  onChange={(event) =>
                                    setTrackingDrafts((current) => ({ ...current, [order.id]: event.target.value }))
                                  }
                                  placeholder="https://courier.example/track/AWB"
                                  className="input-base mt-1 w-full rounded-lg px-2.5 py-2 text-xs"
                                />
                              </label>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cancelOrder(order)}
                        className="ml-auto rounded-lg border border-error/25 px-3 py-2 text-xs font-800 text-error transition hover:bg-error/10 disabled:opacity-50"
                      >
                        Can&apos;t fulfil — cancel
                      </button>
                    )}

                    {capturedButUnfinished && (
                      <p className="ml-auto max-w-md text-right text-[11px] leading-4 text-muted-foreground">
                        {money(netPaid)} is already captured on this order. Refund it from the payment record first —
                        the order then closes itself once the refund settles.
                      </p>
                    )}
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
        <div className="px-5 py-12 text-center">
          <Icon name="ShoppingBagIcon" size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-800 text-foreground">
            {tab === 'all' ? 'No catalogue orders yet' : 'Nothing in this stage'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tab === 'all'
              ? 'Orders appear here the moment a buyer checks out from one of your live listings.'
              : 'Try another stage above.'}
          </p>
        </div>
      )}
    </section>
  );
}
