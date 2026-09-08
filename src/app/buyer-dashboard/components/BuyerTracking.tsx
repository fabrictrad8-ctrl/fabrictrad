'use client';
import { validTrackingUrl } from '@/lib/shippingValidation';
import { pillClassForStatus, pillLabel } from '@/lib/statusPill';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useHorizontalSwipe } from '@/lib/hooks/useHorizontalSwipe';

const TRACKING_FILTERS = ['active', 'delivered', 'all'] as const;

type TrackingEvent = {
  event?: string;
  status?: string;
  activity?: string;
  time?: string;
  date?: string;
  timestamp?: string;
  location?: string;
};

type ShipmentRow = {
  id: string;
  order_id: string;
  seller_id: string;
  buyer_id: string | null;
  courier_type: string | null;
  courier_name: string | null;
  awb_number: string | null;
  tracking_url: string | null;
  estimated_delivery: string | null;
  tracking_events: TrackingEvent[] | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  bulk_order_id: string | null;
  catalog_order_id: string | null;
};

type ShipmentView = ShipmentRow & {
  product: string;
  orderRef: string;
};

const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'failed', 'rto', 'rto_delivered']);
const DELIVERED_STATUSES = new Set(['delivered']);
const TRACKER_STEPS = ['Ordered', 'Confirmed', 'Dispatched', 'Delivered'] as const;

function trackerStepIndex(status: string): number {
  const s = status.toLowerCase();
  if (s.includes('deliver')) return 3;
  if (s.includes('transit') || s.includes('out for') || s.includes('shipped') || s.includes('dispatch') || s.includes('pickup') || s.includes('manifest')) return 2;
  if (s.includes('confirm') || s.includes('accept') || s === 'paid') return 1;
  return 0;
}

function relativeEta(dateStr: string | null): string {
  if (!dateStr) return 'Not yet provided';
  const target = new Date(dateStr);
  const diffDays = Math.round((target.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const formatted = target.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  if (diffDays < 0) return `${formatted} · overdue`;
  if (diffDays === 0) return `${formatted} · today`;
  if (diffDays === 1) return `${formatted} · tomorrow`;
  return `${formatted} · in ${diffDays} days`;
}

export default function BuyerTracking() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<ShipmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'active' | 'delivered' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!user?.id) {
      setShipments([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: shipmentRows, error: shipmentError } = await supabase
      .from('seller_shipments')
      .select('id,order_id,seller_id,buyer_id,courier_type,courier_name,awb_number,tracking_url,estimated_delivery,tracking_events,status,created_at,updated_at,bulk_order_id,catalog_order_id')
      .eq('buyer_id', user.id)
      .order('updated_at', { ascending: false });

    if (shipmentError) {
      setError(shipmentError.message);
      setShipments([]);
      setLoading(false);
      return;
    }

    const rows = (shipmentRows || []) as ShipmentRow[];
    const catalogIds = rows.map((row) => row.catalog_order_id).filter(Boolean) as string[];
    const bulkIds = rows.map((row) => row.bulk_order_id).filter(Boolean) as string[];
    const catalogNames = new Map<string, string>();
    const bulkNames = new Map<string, string>();

    if (catalogIds.length) {
      const { data } = await supabase
        .from('catalog_order_requests')
        .select('id,seller_products(name)')
        .in('id', catalogIds);
      (data || []).forEach((order: any) => catalogNames.set(order.id, order.seller_products?.name || 'Catalogue product'));
    }
    if (bulkIds.length) {
      const { data } = await supabase
        .from('bulk_orders')
        .select('id,bulk_order_items(product_name)')
        .in('id', bulkIds);
      (data || []).forEach((order: any) => bulkNames.set(order.id, order.bulk_order_items?.[0]?.product_name || 'Bulk fabric order'));
    }

    setShipments(rows.map((row) => ({
      ...row,
      product: row.catalog_order_id ? catalogNames.get(row.catalog_order_id) || 'Catalogue product' : row.bulk_order_id ? bulkNames.get(row.bulk_order_id) || 'Bulk fabric order' : 'FabricTrad order',
      orderRef: row.catalog_order_id ? `FT-CAT-${row.catalog_order_id.slice(0, 8).toUpperCase()}` : row.bulk_order_id ? `FT-BULK-${row.bulk_order_id.slice(0, 8).toUpperCase()}` : `FT-${row.order_id.slice(0, 8).toUpperCase()}`,
    })));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(() => shipments.filter((shipment) => {
    const s = String(shipment.status || '').toLowerCase();
    return !DELIVERED_STATUSES.has(s) && !CANCELLED_STATUSES.has(s);
  }).length, [shipments]);
  const deliveredCount = useMemo(() => shipments.filter((shipment) => DELIVERED_STATUSES.has(String(shipment.status || '').toLowerCase())).length, [shipments]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return shipments.filter((shipment) => {
      const s = String(shipment.status || '').toLowerCase();
      const matchesFilter =
        filter === 'all' ? true :
        filter === 'delivered' ? DELIVERED_STATUSES.has(s) :
        !DELIVERED_STATUSES.has(s) && !CANCELLED_STATUSES.has(s);
      if (!matchesFilter) return false;
      if (!query) return true;
      return shipment.orderRef.toLowerCase().includes(query)
        || shipment.product.toLowerCase().includes(query)
        || (shipment.awb_number || '').toLowerCase().includes(query);
    });
  }, [shipments, filter, search]);

  const filterIndex = TRACKING_FILTERS.indexOf(filter);
  const swipeHandlers = useHorizontalSwipe(
    () => setFilter(TRACKING_FILTERS[Math.min(filterIndex + 1, TRACKING_FILTERS.length - 1)]),
    () => setFilter(TRACKING_FILTERS[Math.max(filterIndex - 1, 0)])
  );

  const copyAwb = async (shipment: ShipmentView) => {
    if (!shipment.awb_number) return;
    try {
      await navigator.clipboard.writeText(shipment.awb_number);
      setCopiedId(shipment.id);
      toast.success('AWB copied to clipboard');
      window.setTimeout(() => setCopiedId((current) => (current === shipment.id ? null : current)), 1600);
    } catch {
      toast.error('Could not copy — select and copy manually.');
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-800 text-foreground">Track shipments</h1>
          <p className="mt-1 text-xs text-muted-foreground">{activeCount} active · {deliveredCount} delivered</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50">
          <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {!loading && shipments.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {([
              ['active', `Active (${activeCount})`],
              ['delivered', `Delivered (${deliveredCount})`],
              ['all', `All (${shipments.length})`],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-lg px-3 py-1.5 text-xs font-700 transition ${filter === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{label}</button>
            ))}
          </div>
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Icon name="MagnifyingGlassIcon" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, product or AWB"
              className="input-base w-full rounded-xl py-2 pl-9 pr-3 text-xs"
            />
          </div>
        </div>
      )}

      {error && <div className="mb-5 rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>}

      {loading ? (
        <div className="space-y-5" aria-hidden="true">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border bg-muted/30 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2"><div className="h-4 w-32 rounded bg-muted" /><div className="h-3.5 w-40 rounded bg-muted" /></div>
                  <div className="space-y-2 text-right"><div className="ml-auto h-3.5 w-28 rounded bg-muted" /><div className="ml-auto h-3 w-24 rounded bg-muted" /></div>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <div className="h-2.5 w-full rounded-full bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : shipments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-14 text-center">
          <Icon name="TruckIcon" size={34} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-800 text-foreground">No shipments for this account yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Tracking appears here automatically once a paid order is confirmed and dispatched by its seller — no separate tracking number to enter.</p>
          <Link href="/marketplace" className="btn-primary mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"><Icon name="BuildingStorefrontIcon" size={14} /> Browse the marketplace</Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
          <Icon name="MagnifyingGlassIcon" size={28} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-800 text-foreground">No shipments match this view</p>
          <p className="mt-1 text-xs text-muted-foreground">Try a different filter or clear your search.</p>
        </div>
      ) : (
        <div className="space-y-5" {...swipeHandlers}>
          {visible.map((shipment) => {
            const status = String(shipment.status || 'pending');
            const statusLower = status.toLowerCase();
            const isCancelled = CANCELLED_STATUSES.has(statusLower);
            const events = Array.isArray(shipment.tracking_events) ? shipment.tracking_events : [];
            const stepIndex = trackerStepIndex(status);
            return (
              <article key={shipment.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border bg-muted/30 px-5 py-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2"><span className="mono-id">{shipment.orderRef}</span><span className={pillClassForStatus(status)}>{pillLabel(status)}</span></div>
                      <p className="text-sm font-800 text-foreground">{shipment.product}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Shipment {shipment.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-700 text-foreground">{shipment.courier_name || (shipment.courier_type === 'shiprocket' ? 'Shiprocket courier' : 'Seller-managed courier')}</p>
                      <button
                        type="button"
                        onClick={() => void copyAwb(shipment)}
                        disabled={!shipment.awb_number}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground"
                        title={shipment.awb_number ? 'Copy AWB number' : undefined}
                      >
                        AWB: {shipment.awb_number || 'Awaiting assignment'}
                        {shipment.awb_number && <Icon name={copiedId === shipment.id ? 'CheckIcon' : 'ClipboardDocumentListIcon'} size={11} />}
                      </button>
                      <p className="text-xs text-primary">EDD: {relativeEta(shipment.estimated_delivery)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-5">
                    {isCancelled ? (
                      <div className="flex items-center gap-2 rounded-xl bg-error/5 p-3 text-sm font-700 text-error"><Icon name="ExclamationTriangleIcon" size={16} /> {pillLabel(status)} — contact the seller from Messages &amp; disputes if this is unexpected.</div>
                    ) : (
                      <div className="ft-tracker">
                        {TRACKER_STEPS.map((label, index) => (
                          <div key={label} className={`ft-tracker-step ${index < stepIndex ? 'is-done' : index === stepIndex ? 'is-current' : ''}`}>
                            <div className="ft-tracker-dot" />
                            <span className="ft-tracker-label">{label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {events.length ? (
                    <div className="space-y-3">
                      <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Courier updates</p>
                      {[...events].reverse().slice(0, 8).map((event, index) => {
                        const eventName = event.activity || event.event || event.status || 'Shipment update';
                        const eventTime = event.timestamp || event.time || event.date || '';
                        return (
                          <div key={`${eventName}-${eventTime}-${index}`} className="flex gap-3">
                            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${index === 0 ? 'bg-primary' : 'bg-success'}`} />
                            <div><p className="text-sm font-700 text-foreground">{eventName}</p><p className="mt-0.5 text-xs text-muted-foreground">{event.location ? `${event.location} · ` : ''}{eventTime ? new Date(eventTime).toLocaleString('en-IN') : 'Time not supplied'}</p></div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center"><p className="text-sm font-700 text-foreground">Courier timeline is not available yet</p><p className="mt-1 text-xs text-muted-foreground">The shipment status above is the latest saved update.</p></div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Last update: {new Date(shipment.updated_at).toLocaleString('en-IN')}</p>
                    {shipment.tracking_url && validTrackingUrl(shipment.tracking_url) && <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-800 text-primary hover:underline"><Icon name="ArrowTopRightOnSquareIcon" size={12} /> Open courier tracking</a>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
