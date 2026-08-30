'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { firstOrderItem, formatMoney, useSellerBulkOrders } from '@/lib/hooks/useAccountOrders';

type OrderKind = 'bulk' | 'catalog';
type CourierType = 'shiprocket' | 'local';

type CatalogOrder = {
  id: string;
  buyer_id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  seller_products?: { name?: string | null } | null;
};

type OrderOption = {
  id: string;
  kind: OrderKind;
  buyerId: string;
  product: string;
  buyer: string;
  amount: number;
};

type ShipmentRow = {
  id: string;
  order_id: string;
  bulk_order_id: string | null;
  catalog_order_id: string | null;
  courier_type: string | null;
  courier_name: string | null;
  shiprocket_courier_id: string | null;
  awb_number: string | null;
  tracking_url: string | null;
  estimated_delivery: string | null;
  pickup_location_name: string | null;
  shipping_cost: number | null;
  label_url: string | null;
  manifest_url: string | null;
  pickup_scheduled: boolean | null;
  status: string | null;
  updated_at: string;
};

type ShiprocketStatus = {
  configured?: boolean;
  authenticated?: boolean | null;
  webhookConfigured?: boolean;
  source?: 'vault' | 'environment';
};

type ManualCourierForm = {
  courierName: string;
  awbNumber: string;
  trackingUrl: string;
  estimatedDelivery: string;
};

const EMPTY_FORM: ManualCourierForm = {
  courierName: '',
  awbNumber: '',
  trackingUrl: '',
  estimatedDelivery: '',
};

const orderKey = (order: OrderOption) => `${order.kind}:${order.id}`;

export default function SellerCourierSettings() {
  const { user } = useAuth();
  const { orders: bulkOrders, loading: bulkLoading, refresh: refreshBulk } = useSellerBulkOrders();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [catalogOrders, setCatalogOrders] = useState<CatalogOrder[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [shiprocket, setShiprocket] = useState<ShiprocketStatus>({});
  const [activeKey, setActiveKey] = useState('');
  const [courierByOrder, setCourierByOrder] = useState<Record<string, CourierType>>({});
  const [manualByOrder, setManualByOrder] = useState<Record<string, ManualCourierForm>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!user?.id) {
      setSellerId(null);
      setCatalogOrders([]);
      setShipments([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const [{ data: seller, error: sellerError }, statusResponse] = await Promise.all([
      supabase.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle(),
      fetch('/api/shiprocket/status', { cache: 'no-store', credentials: 'same-origin' }).catch(
        () => null
      ),
    ]);

    if (statusResponse?.ok) {
      setShiprocket((await statusResponse.json().catch(() => ({}))) as ShiprocketStatus);
    } else {
      setShiprocket({ configured: false, authenticated: false, webhookConfigured: false });
    }

    if (sellerError || !seller?.id) {
      setError(sellerError?.message || 'Seller profile is not available.');
      setLoading(false);
      return;
    }
    setSellerId(seller.id);

    const [catalogResult, shipmentResult] = await Promise.all([
      supabase
        .from('catalog_order_requests')
        .select('id,buyer_id,status,payment_status,total_amount,seller_products(name)')
        .eq('seller_id', seller.id)
        .in('status', ['paid', 'fulfilled'])
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false }),
      supabase
        .from('seller_shipments')
        .select(
          'id,order_id,bulk_order_id,catalog_order_id,courier_type,courier_name,shiprocket_courier_id,awb_number,tracking_url,estimated_delivery,pickup_location_name,shipping_cost,label_url,manifest_url,pickup_scheduled,status,updated_at'
        )
        .eq('seller_id', seller.id)
        .order('updated_at', { ascending: false }),
    ]);

    const queryError = catalogResult.error || shipmentResult.error;
    if (queryError) setError(queryError.message);
    setCatalogOrders((catalogResult.data || []) as unknown as CatalogOrder[]);
    setShipments((shipmentResult.data || []) as ShipmentRow[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const orders = useMemo<OrderOption[]>(() => {
    const bulk: OrderOption[] = bulkOrders
      .filter(
        (order) =>
          order.status === 'paid' && order.payment_status === 'paid' && Boolean(order.buyer_id)
      )
      .map((order) => ({
        id: order.id,
        kind: 'bulk',
        buyerId: String(order.buyer_id),
        product: firstOrderItem(order)?.product_name || 'Bulk fabric order',
        buyer: order.buyer_company || order.buyer_name || 'Buyer',
        amount: Number(order.net_total || 0),
      }));

    const catalog: OrderOption[] = catalogOrders.map((order) => ({
      id: order.id,
      kind: 'catalog',
      buyerId: order.buyer_id,
      product: order.seller_products?.name || 'Catalogue product',
      buyer: 'Catalogue buyer',
      amount: Number(order.total_amount || 0),
    }));
    return [...catalog, ...bulk];
  }, [bulkOrders, catalogOrders]);

  const selectedOrder =
    orders.find((order) => orderKey(order) === activeKey) || orders[0] || null;
  const selectedKey = selectedOrder ? orderKey(selectedOrder) : '';
  const selectedShipment = selectedOrder
    ? shipments.find((shipment) =>
        selectedOrder.kind === 'catalog'
          ? shipment.catalog_order_id === selectedOrder.id
          : shipment.bulk_order_id === selectedOrder.id
      ) || null
    : null;

  const selectedCourier: CourierType = selectedShipment
    ? selectedShipment.courier_type === 'shiprocket'
      ? 'shiprocket'
      : 'local'
    : courierByOrder[selectedKey] || (shiprocket.configured ? 'shiprocket' : 'local');
  const form = manualByOrder[selectedKey] || EMPTY_FORM;

  useEffect(() => {
    if (!selectedOrder) return;
    if (!activeKey) setActiveKey(orderKey(selectedOrder));
  }, [activeKey, selectedOrder]);

  useEffect(() => {
    if (!selectedShipment || !selectedKey) return;
    setCourierByOrder((current) => ({
      ...current,
      [selectedKey]: selectedShipment.courier_type === 'shiprocket' ? 'shiprocket' : 'local',
    }));
    setManualByOrder((current) => ({
      ...current,
      [selectedKey]: {
        courierName: selectedShipment.courier_name || '',
        awbNumber: selectedShipment.awb_number || '',
        trackingUrl: selectedShipment.tracking_url || '',
        estimatedDelivery: selectedShipment.estimated_delivery || '',
      },
    }));
  }, [selectedKey, selectedShipment]);

  const chooseCourier = (courier: CourierType) => {
    if (!selectedKey || selectedShipment) return;
    setCourierByOrder((current) => ({ ...current, [selectedKey]: courier }));
  };

  const updateForm = (patch: Partial<ManualCourierForm>) => {
    if (!selectedKey || selectedShipment) return;
    setManualByOrder((current) => ({
      ...current,
      [selectedKey]: { ...(current[selectedKey] || EMPTY_FORM), ...patch },
    }));
  };

  const createShiprocket = async () => {
    if (!selectedOrder) return;
    if (!shiprocket.configured) {
      chooseCourier('local');
      return toast.error('Shiprocket is not connected. Choose your own / third-party courier for this order.');
    }

    setSaving(true);
    try {
      const response = await fetch('/api/shiprocket/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ orderId: selectedOrder.id, orderType: selectedOrder.kind }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        existing?: boolean;
        awb?: string | null;
        courierName?: string | null;
        shippingCost?: number | null;
        error?: string;
      };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Shiprocket booking failed.');
      }
      toast.success(
        payload.existing
          ? 'This order already has a shipment.'
          : payload.awb
            ? `${payload.courierName || 'Courier'} booked · AWB ${payload.awb}`
            : `${payload.courierName || 'Courier'} booked. AWB assignment is in progress.`
      );
      await Promise.all([load(), refreshBulk()]);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Shiprocket booking failed.');
    } finally {
      setSaving(false);
    }
  };

  const saveLocal = async () => {
    if (!selectedOrder || !sellerId) return;
    if (!form.courierName.trim() || !form.awbNumber.trim()) {
      return toast.error('Courier name and AWB / tracking number are required.');
    }
    if (form.trackingUrl && !/^https?:\/\//i.test(form.trackingUrl)) {
      return toast.error('Tracking URL must begin with http:// or https://.');
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        order_id: selectedOrder.id,
        seller_id: sellerId,
        buyer_id: selectedOrder.buyerId,
        bulk_order_id: selectedOrder.kind === 'bulk' ? selectedOrder.id : null,
        catalog_order_id: selectedOrder.kind === 'catalog' ? selectedOrder.id : null,
        courier_type: 'local',
        courier_name: form.courierName.trim(),
        awb_number: form.awbNumber.trim(),
        tracking_url: form.trackingUrl.trim() || null,
        estimated_delivery: form.estimatedDelivery || null,
        status: 'in_transit',
        updated_at: new Date().toISOString(),
      };
      const conflict = selectedOrder.kind === 'bulk' ? 'bulk_order_id' : 'catalog_order_id';
      const { error: saveError } = await supabase
        .from('seller_shipments')
        .upsert(payload, { onConflict: conflict });
      if (saveError) throw saveError;
      toast.success('Third-party courier details saved. The buyer can now track this order.');
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Shipment details could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const busy = loading || bulkLoading;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ft-route-kicker">Fulfilment</p>
          <h1 className="mt-1 text-2xl font-800 text-foreground">Order-by-order shipping</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Choose Shiprocket or your own third-party courier separately for every paid order. There is no marketplace-wide shipping-method switch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="btn-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
        >
          <Icon name="ArrowPathIcon" size={14} className={busy ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-success/20 bg-success/5 p-4">
          <p className="text-[11px] font-800 uppercase tracking-wide text-success">Seller pickup</p>
          <p className="mt-2 text-sm font-800 text-foreground">From Business settings</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Business name, pickup address, email, mobile and verified seller GST status are loaded automatically.
          </p>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-[11px] font-800 uppercase tracking-wide text-primary">Buyer delivery</p>
          <p className="mt-2 text-sm font-800 text-foreground">From the paid order</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Delivery address, email, mobile, company and verified buyer GSTIN come from that specific order/profile.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-800 uppercase tracking-wide text-muted-foreground">Shiprocket connection</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-800 ${
                shiprocket.configured ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
              }`}
            >
              {shiprocket.configured ? 'connected' : 'setup required'}
            </span>
          </div>
          <p className="mt-2 text-sm font-800 text-foreground">Connection only, not a default</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            A connected Shiprocket account only makes the option available. The seller still chooses the method on each order.
          </p>
        </div>
      </section>

      {error && (
        <div className="mb-5 rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">
          {error}
        </div>
      )}

      <section className="mb-5 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">
              Paid orders ready to pack & ship
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Select an order first. Its shipping choice and courier details stay attached only to that order.
            </p>
          </div>
          <span className="ft-orange-chip">{orders.length} ready</span>
        </div>

        {busy ? (
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
            Loading paid orders…
          </div>
        ) : orders.length ? (
          <div className="space-y-2">
            {orders.map((order) => {
              const key = orderKey(order);
              const shipment = shipments.find((item) =>
                order.kind === 'catalog'
                  ? item.catalog_order_id === order.id
                  : item.bulk_order_id === order.id
              );
              const selected = selectedKey === key;
              const draftCourier = courierByOrder[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveKey(key)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-800">
                          {order.kind === 'catalog' ? 'FT-CAT' : 'FT-BULK'}-{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-800 uppercase">
                          {order.kind}
                        </span>
                        {shipment ? (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-800 text-success">
                            {shipment.courier_type === 'shiprocket' ? 'Shiprocket booked' : 'Third-party booked'}
                          </span>
                        ) : draftCourier ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-800 text-primary">
                            {draftCourier === 'shiprocket' ? 'Shiprocket selected' : 'Third-party selected'}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {order.product} · {order.buyer}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-800 text-primary">{formatMoney(order.amount)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <Icon name="TruckIcon" size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm font-800">No paid orders ready to ship</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fully paid orders appear here automatically after Razorpay confirms payment.
            </p>
          </div>
        )}
      </section>

      {selectedOrder && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-800 uppercase tracking-wide text-primary">Selected paid order</p>
              <h2 className="mt-1 text-lg font-800">{selectedOrder.product}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedOrder.kind === 'catalog' ? 'FT-CAT' : 'FT-BULK'}-{selectedOrder.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            {selectedShipment && (
              <div className="text-right">
                <p className="text-xs font-800 text-success">
                  {String(selectedShipment.status || 'pending').replaceAll('_', ' ')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  AWB {selectedShipment.awb_number || 'pending'}
                </p>
              </div>
            )}
          </div>

          {selectedShipment ? (
            <div className="space-y-4 rounded-2xl border border-success/20 bg-success/5 p-4">
              <div className="flex items-start gap-3">
                <Icon name="CheckCircleIcon" size={20} className="mt-0.5 text-success" />
                <div>
                  <p className="text-sm font-800 text-foreground">Shipment created for this order</p>
                  <p className="mt-1 text-xs font-700 text-foreground">
                    Method: {selectedShipment.courier_type === 'shiprocket' ? 'Shiprocket' : 'Own / third-party courier'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedShipment.courier_name || 'Courier'} · {selectedShipment.awb_number || 'AWB pending'}
                  </p>
                  {selectedShipment.pickup_location_name && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pickup: {selectedShipment.pickup_location_name}
                    </p>
                  )}
                  {Number(selectedShipment.shipping_cost || 0) > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Courier charge: {formatMoney(Number(selectedShipment.shipping_cost))}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedShipment.tracking_url && (
                  <a href={selectedShipment.tracking_url} target="_blank" rel="noreferrer" className="btn-secondary inline-flex min-h-10 items-center gap-1 rounded-xl px-3 py-2 text-xs font-800">
                    Track shipment <Icon name="ArrowTopRightOnSquareIcon" size={12} />
                  </a>
                )}
                {selectedShipment.label_url && (
                  <a href={selectedShipment.label_url} target="_blank" rel="noreferrer" className="btn-secondary inline-flex min-h-10 items-center gap-1 rounded-xl px-3 py-2 text-xs font-800">
                    Shipping label
                  </a>
                )}
                {selectedShipment.manifest_url && (
                  <a href={selectedShipment.manifest_url} target="_blank" rel="noreferrer" className="btn-secondary inline-flex min-h-10 items-center gap-1 rounded-xl px-3 py-2 text-xs font-800">
                    Manifest
                  </a>
                )}
              </div>
              <p className="rounded-xl border border-border bg-card/70 p-3 text-[11px] leading-5 text-muted-foreground">
                This shipping method belongs only to this order. Once a shipment/AWB has been created, FabricTrad keeps the method locked here to prevent duplicate courier bookings or pickups.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <p className="text-sm font-800 text-foreground">Shipping method for this order</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  This selection applies only to {selectedOrder.kind === 'catalog' ? 'FT-CAT' : 'FT-BULK'}-{selectedOrder.id.slice(0, 8).toUpperCase()}. Every other order can use a different method.
                </p>
              </div>

              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => chooseCourier('shiprocket')}
                  disabled={!shiprocket.configured}
                  className={`rounded-xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    selectedCourier === 'shiprocket' ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name="BoltIcon" size={18} className="text-primary" />
                    <span className="text-sm font-800">Shiprocket</span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-800 ${shiprocket.configured ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                      {shiprocket.configured ? 'available' : 'not connected'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    FabricTrad books the courier, stores the Shiprocket order/shipment IDs, AWB, pickup and tracking for this order.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => chooseCourier('local')}
                  className={`rounded-xl border-2 p-4 text-left transition ${
                    selectedCourier === 'local' ? 'border-secondary bg-secondary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon name="MapPinIcon" size={18} className="text-secondary" />
                    <span className="text-sm font-800">Own / third-party courier</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Use Blue Dart, DTDC, Delhivery, a local transporter or any other courier and enter its tracking details for this order.
                  </p>
                </button>
              </div>

              {selectedCourier === 'shiprocket' ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-800 text-foreground">Ship this order with Shiprocket</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    FabricTrad uses the seller pickup profile and this buyer order's delivery details, then stores courier, AWB, tracking, label and manifest against this order.
                  </p>
                  <button type="button" onClick={() => void createShiprocket()} disabled={saving || !shiprocket.configured} className="btn-primary mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl px-5 py-3 text-sm disabled:opacity-50">
                    <Icon name="TruckIcon" size={16} />
                    {saving ? 'Finding courier & booking…' : 'Book this order with Shiprocket'}
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
                  <label className="text-xs font-700">Courier / transporter *<input value={form.courierName} onChange={(event) => updateForm({ courierName: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Blue Dart, DTDC, local transporter…" /></label>
                  <label className="text-xs font-700">AWB / tracking number *<input value={form.awbNumber} onChange={(event) => updateForm({ awbNumber: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" /></label>
                  <label className="text-xs font-700">Tracking URL<input type="url" value={form.trackingUrl} onChange={(event) => updateForm({ trackingUrl: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" placeholder="https://…" /></label>
                  <label className="text-xs font-700">Estimated delivery<input type="date" value={form.estimatedDelivery} onChange={(event) => updateForm({ estimatedDelivery: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" /></label>
                  <button type="button" onClick={() => void saveLocal()} disabled={saving} className="btn-primary sm:col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl py-3 text-sm disabled:opacity-50">
                    <Icon name="CloudArrowUpIcon" size={16} />
                    {saving ? 'Saving…' : 'Save this order shipment & notify buyer'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
