'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

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

const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusProgress = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes('deliver')) return 100;
  if (normalized.includes('out for')) return 85;
  if (normalized.includes('transit') || normalized.includes('shipped')) return 65;
  if (normalized.includes('pickup') || normalized.includes('manifest')) return 40;
  if (normalized.includes('cancel') || normalized.includes('fail') || normalized.includes('rto')) return 20;
  return 15;
};

export default function BuyerTracking() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<ShipmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data || []).forEach((order: any) => {
        const sp = order.seller_products;
        const name = Array.isArray(sp) ? sp[0]?.name : sp?.name;
        catalogNames.set(order.id as string, name || 'Catalogue product');
      });
    }
    if (bulkIds.length) {
      const { data } = await supabase
        .from('bulk_orders')
        .select('id,bulk_order_items(product_name)')
        .in('id', bulkIds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data || []).forEach((order: any) => {
        const items = order.bulk_order_items;
        const name = Array.isArray(items) ? items[0]?.product_name : items?.product_name;
        bulkNames.set(order.id as string, name || 'Bulk fabric order');
      });
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

  const activeCount = useMemo(() => shipments.filter((shipment) => !['delivered', 'cancelled', 'failed', 'rto_delivered'].includes(String(shipment.status || '').toLowerCase())).length, [shipments]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-800 text-foreground">Track shipments</h1>
          <p className="mt-1 text-xs text-muted-foreground">{activeCount} active shipment{activeCount === 1 ? '' : 's'} for this buyer account.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50">
          <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="mb-5 rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-14 text-center"><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : shipments.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center">
          <Icon name="TruckIcon" size={34} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-800 text-foreground">No shipments for this account</p>
          <p className="mt-1 text-xs text-muted-foreground">Tracking appears here after a paid order is dispatched by its seller.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {shipments.map((shipment) => {
            const status = String(shipment.status || 'pending');
            const events = Array.isArray(shipment.tracking_events) ? shipment.tracking_events : [];
            return (
              <article key={shipment.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border bg-muted/30 px-5 py-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2"><span className="mono-id">{shipment.orderRef}</span><span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-700 text-primary">{titleCase(status)}</span></div>
                      <p className="text-sm font-800 text-foreground">{shipment.product}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Shipment {shipment.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-700 text-foreground">{shipment.courier_name || (shipment.courier_type === 'shiprocket' ? 'Shiprocket courier' : 'Seller-managed courier')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">AWB: {shipment.awb_number || 'Awaiting assignment'}</p>
                      <p className="text-xs text-primary">EDD: {shipment.estimated_delivery ? new Date(shipment.estimated_delivery).toLocaleDateString('en-IN') : 'Not yet provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between text-xs"><span className="font-700 text-foreground">Delivery progress</span><span className="text-muted-foreground">{statusProgress(status)}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${statusProgress(status)}%` }} /></div>
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
                    {shipment.tracking_url && <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-800 text-primary hover:underline"><Icon name="ArrowTopRightOnSquareIcon" size={12} /> Open courier tracking</a>}
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
