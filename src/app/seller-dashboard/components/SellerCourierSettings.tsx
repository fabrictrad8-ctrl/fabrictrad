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
  status: string;
  paymentStatus: string;
};

type ShipmentRow = {
  id: string;
  order_id: string;
  bulk_order_id: string | null;
  catalog_order_id: string | null;
  courier_type: string | null;
  courier_name: string | null;
  awb_number: string | null;
  tracking_url: string | null;
  estimated_delivery: string | null;
  status: string | null;
  updated_at: string;
};

export default function SellerCourierSettings() {
  const { user } = useAuth();
  const { orders: bulkOrders, loading: bulkLoading, refresh: refreshBulk } = useSellerBulkOrders();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [catalogOrders, setCatalogOrders] = useState<CatalogOrder[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [shiprocketConfigured, setShiprocketConfigured] = useState<boolean | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<CourierType>('shiprocket');
  const [activeKey, setActiveKey] = useState('');
  const [form, setForm] = useState({ courierName: '', awbNumber: '', trackingUrl: '', estimatedDelivery: '' });
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
      fetch('/api/shiprocket/status', { cache: 'no-store' }).catch(() => null),
    ]);
    if (statusResponse?.ok) {
      const status = (await statusResponse.json().catch(() => ({}))) as { configured?: boolean };
      setShiprocketConfigured(status.configured === true);
    } else {
      setShiprocketConfigured(false);
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
        .select('id,order_id,bulk_order_id,catalog_order_id,courier_type,courier_name,awb_number,tracking_url,estimated_delivery,status,updated_at')
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
      .filter((order) => order.status === 'paid' && order.payment_status === 'paid' && Boolean(order.buyer_id))
      .map((order) => ({
        id: order.id,
        kind: 'bulk',
        buyerId: String(order.buyer_id),
        product: firstOrderItem(order)?.product_name || 'Bulk fabric order',
        buyer: order.buyer_company || order.buyer_name || 'Buyer',
        amount: Number(order.net_total || 0),
        status: String(order.status || ''),
        paymentStatus: String(order.payment_status || ''),
      }));
    const catalog: OrderOption[] = catalogOrders.map((order) => ({
      id: order.id,
      kind: 'catalog',
      buyerId: order.buyer_id,
      product: order.seller_products?.name || 'Catalogue product',
      buyer: 'Catalogue buyer',
      amount: Number(order.total_amount || 0),
      status: order.status,
      paymentStatus: order.payment_status,
    }));
    return [...catalog, ...bulk];
  }, [bulkOrders, catalogOrders]);

  const selectedOrder = orders.find((order) => `${order.kind}:${order.id}` === activeKey) || orders[0] || null;
  const selectedShipment = selectedOrder
    ? shipments.find((shipment) => selectedOrder.kind === 'catalog' ? shipment.catalog_order_id === selectedOrder.id : shipment.bulk_order_id === selectedOrder.id) || null
    : null;

  useEffect(() => {
    if (!selectedOrder) return;
    const key = `${selectedOrder.kind}:${selectedOrder.id}`;
    if (!activeKey) setActiveKey(key);
  }, [activeKey, selectedOrder]);

  useEffect(() => {
    if (selectedShipment) {
      setSelectedCourier(selectedShipment.courier_type === 'shiprocket' ? 'shiprocket' : 'local');
      setForm({
        courierName: selectedShipment.courier_name || '',
        awbNumber: selectedShipment.awb_number || '',
        trackingUrl: selectedShipment.tracking_url || '',
        estimatedDelivery: selectedShipment.estimated_delivery || '',
      });
    } else {
      setForm({ courierName: '', awbNumber: '', trackingUrl: '', estimatedDelivery: '' });
    }
  }, [selectedShipment]);

  const createShiprocket = async () => {
    if (!selectedOrder || selectedOrder.kind !== 'bulk') return toast.error('Shiprocket automatic order creation currently supports paid bulk orders. Use Own Delivery Partner for catalogue orders.');
    if (!shiprocketConfigured) return toast.error('Shiprocket credentials are not configured on the live server.');
    setSaving(true);
    try {
      const response = await fetch('/api/shiprocket/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ orderId: selectedOrder.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Shiprocket order creation failed.');
      toast.success('Shiprocket shipment created and saved.');
      await Promise.all([load(), refreshBulk()]);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Shiprocket order creation failed.');
    } finally {
      setSaving(false);
    }
  };

  const saveLocal = async () => {
    if (!selectedOrder || !sellerId) return;
    if (!form.courierName.trim() || !form.awbNumber.trim()) return toast.error('Courier name and AWB / tracking number are required.');
    if (form.trackingUrl && !/^https?:\/\//i.test(form.trackingUrl)) return toast.error('Tracking URL must begin with http:// or https://.');
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
      const { error: saveError } = await supabase.from('seller_shipments').upsert(payload, { onConflict: conflict });
      if (saveError) throw saveError;
      toast.success('Courier details saved. The buyer can now see them in Tracking.');
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
          <p className="ft-route-kicker">Shipping</p>
          <h1 className="mt-1 text-2xl font-800 text-foreground">Courier & shipping</h1>
          <p className="mt-1 text-sm text-muted-foreground">Only fully paid orders are dispatchable. Shipment records are saved to the real seller shipment ledger and shown to buyers.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50"><Icon name="ArrowPathIcon" size={14} className={busy ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {error && <div className="mb-5 rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>}

      <section className="mb-5 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Paid orders ready to ship</p><p className="mt-1 text-xs text-muted-foreground">Catalogue and bulk orders are listed together.</p></div><span className="ft-orange-chip">{orders.length} ready</span></div>
        {busy ? <div className="rounded-xl border border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">Loading paid orders…</div> : orders.length ? <div className="space-y-2">{orders.map((order) => {
          const key = `${order.kind}:${order.id}`;
          const shipment = shipments.find((item) => order.kind === 'catalog' ? item.catalog_order_id === order.id : item.bulk_order_id === order.id);
          return <button key={key} type="button" onClick={() => setActiveKey(key)} className={`w-full rounded-xl border p-3 text-left transition ${selectedOrder && `${selectedOrder.kind}:${selectedOrder.id}` === key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-800">{order.kind === 'catalog' ? 'FT-CAT' : 'FT-BULK'}-{order.id.slice(0, 8).toUpperCase()}</p><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-800 uppercase">{order.kind}</span>{shipment && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-800 text-success">shipment saved</span>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{order.product} · {order.buyer}</p></div><p className="shrink-0 text-sm font-800 text-primary">{formatMoney(order.amount)}</p></div></button>;
        })}</div> : <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center"><Icon name="TruckIcon" size={28} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-800">No fully paid orders ready to ship</p><p className="mt-1 text-xs text-muted-foreground">An order appears here only after its complete payment has been captured.</p></div>}
      </section>

      {selectedOrder && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-800 uppercase tracking-wide text-primary">Selected order</p><h2 className="mt-1 text-lg font-800">{selectedOrder.product}</h2><p className="mt-1 text-xs text-muted-foreground">{selectedOrder.kind === 'catalog' ? 'FT-CAT' : 'FT-BULK'}-{selectedOrder.id.slice(0, 8).toUpperCase()} · fully paid</p></div>{selectedShipment && <div className="text-right"><p className="text-xs font-800 text-success">Existing shipment: {String(selectedShipment.status || 'pending').replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-muted-foreground">AWB {selectedShipment.awb_number || 'pending'}</p></div>}</div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setSelectedCourier('shiprocket')} className={`rounded-xl border-2 p-4 text-left ${selectedCourier === 'shiprocket' ? 'border-primary bg-primary/5' : 'border-border'}`}><div className="flex items-center gap-2"><Icon name="TruckIcon" size={18} className="text-primary" /><span className="text-sm font-800">Shiprocket</span>{shiprocketConfigured !== null && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-800 ${shiprocketConfigured ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>{shiprocketConfigured ? 'configured' : 'not configured'}</span>}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Automatic Shiprocket creation is available for fully paid bulk orders.</p></button>
            <button type="button" onClick={() => setSelectedCourier('local')} className={`rounded-xl border-2 p-4 text-left ${selectedCourier === 'local' ? 'border-secondary bg-secondary/5' : 'border-border'}`}><div className="flex items-center gap-2"><Icon name="MapPinIcon" size={18} className="text-secondary" /><span className="text-sm font-800">Own delivery partner</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Use any courier and save its AWB, tracking URL and ETA for the buyer.</p></button>
          </div>

          {selectedCourier === 'shiprocket' ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-800 text-foreground">Shiprocket dispatch</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedOrder.kind === 'bulk' ? shiprocketConfigured ? 'Ready to create the courier order using the live server credentials.' : 'Shiprocket credentials are missing from the live server.' : 'Catalogue orders currently use the seller-managed shipment form. This prevents pretending an unsupported Shiprocket order was created.'}</p><button type="button" onClick={() => void createShiprocket()} disabled={saving || selectedOrder.kind !== 'bulk' || !shiprocketConfigured} className="btn-primary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs disabled:opacity-50"><Icon name="TruckIcon" size={14} /> {saving ? 'Creating…' : 'Create Shiprocket shipment'}</button></div>
          ) : (
            <div className="space-y-4 rounded-xl border border-secondary/20 bg-secondary/5 p-4"><div><p className="text-sm font-800 text-foreground">Seller-managed shipment</p><p className="mt-1 text-xs text-muted-foreground">These details are persisted and become buyer-visible immediately.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-700">Courier company *<input value={form.courierName} onChange={(event) => setForm({ ...form, courierName: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5 text-sm" placeholder="DTDC, Blue Dart, Delhivery…" /></label><label className="text-xs font-700">AWB / tracking number *<input value={form.awbNumber} onChange={(event) => setForm({ ...form, awbNumber: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5 text-sm" /></label><label className="text-xs font-700">Live tracking URL<input type="url" value={form.trackingUrl} onChange={(event) => setForm({ ...form, trackingUrl: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5 text-sm" placeholder="https://…" /></label><label className="text-xs font-700">Estimated delivery<input type="date" value={form.estimatedDelivery} onChange={(event) => setForm({ ...form, estimatedDelivery: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5 text-sm" /></label></div><button type="button" onClick={() => void saveLocal()} disabled={saving} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs disabled:opacity-50"><Icon name="CheckIcon" size={14} /> {saving ? 'Saving…' : 'Save shipment for buyer'}</button></div>
          )}
        </section>
      )}

      <section className="mt-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-800">Saved shipments</h2><p className="mt-1 text-xs text-muted-foreground">Real records currently visible under buyer tracking.</p></div><span className="ft-orange-chip">{shipments.length}</span></div>
        {shipments.length ? <div className="mt-4 divide-y divide-border">{shipments.slice(0, 30).map((shipment) => <div key={shipment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="mono-id">{shipment.catalog_order_id ? `FT-CAT-${shipment.catalog_order_id.slice(0, 8).toUpperCase()}` : shipment.bulk_order_id ? `FT-BULK-${shipment.bulk_order_id.slice(0, 8).toUpperCase()}` : shipment.order_id}</p><p className="mt-1 text-xs text-muted-foreground">{shipment.courier_name || shipment.courier_type || 'Courier pending'} · AWB {shipment.awb_number || 'pending'}</p></div><div className="text-right"><p className="text-xs font-800 capitalize">{String(shipment.status || 'pending').replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-muted-foreground">Updated {new Date(shipment.updated_at).toLocaleString('en-IN')}</p></div></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-xs text-muted-foreground">No shipment records yet.</div>}
      </section>
    </div>
  );
}
