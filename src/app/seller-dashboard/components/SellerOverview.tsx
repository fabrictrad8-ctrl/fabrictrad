'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { formatMoney, useSellerBulkOrders } from '@/lib/hooks/useAccountOrders';

type SellerTab = 'orders' | 'inventory' | 'upload' | 'courier' | 'earnings' | 'analytics' | 'profile' | 'billing';
type Props = { onNavigate: (tab: SellerTab) => void };

type CatalogOrder = {
  id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  amount_paid: number;
  created_at: string;
  seller_products?: { name?: string | null } | null;
};

type Product = {
  id: string;
  name: string;
  status: string;
  approval_status: string | null;
  available_quantity: number;
  reserved_quantity: number;
  min_stock: number;
  hsn_code: string | null;
};

type Shipment = { id: string; status: string | null; updated_at: string };
const activeShipmentStatuses = (status?: string | null) => !['delivered', 'cancelled', 'failed', 'rto_delivered'].includes(String(status || '').toLowerCase());

export default function SellerOverview({ onNavigate }: Props) {
  const { user, profile } = useAuth();
  const { orders: bulkOrders, loading: bulkLoading } = useSellerBulkOrders();
  const [catalogOrders, setCatalogOrders] = useState<CatalogOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!user?.id) { setLoading(false); return; }
    const supabase = createClient();
    const { data: seller, error: sellerError } = await supabase.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle();
    if (sellerError || !seller?.id) {
      setError(sellerError?.message || 'Seller profile is not available.');
      setLoading(false);
      return;
    }

    const [catalogResult, productResult, shipmentResult] = await Promise.all([
      supabase.from('catalog_order_requests').select('id,status,payment_status,total_amount,amount_paid,created_at,seller_products(name)').eq('seller_id', seller.id).order('created_at', { ascending: false }).limit(250),
      supabase.from('seller_products').select('id,name,status,approval_status,available_quantity,reserved_quantity,min_stock,hsn_code').eq('seller_id', seller.id).order('updated_at', { ascending: false }).limit(1000),
      supabase.from('seller_shipments').select('id,status,updated_at').eq('seller_id', seller.id).order('updated_at', { ascending: false }).limit(250),
    ]);

    const queryError = catalogResult.error || productResult.error || shipmentResult.error;
    if (queryError) setError(queryError.message);
    setCatalogOrders((catalogResult.data || []) as unknown as CatalogOrder[]);
    setProducts((productResult.data || []) as Product[]);
    setShipments((shipmentResult.data || []) as Shipment[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const pendingCatalog = catalogOrders.filter((order) => order.status === 'pending');
  const pendingBulk = bulkOrders.filter((order) => ['draft', 'quote_sent'].includes(String(order.status || '')));
  const paymentDue = [
    ...catalogOrders.filter((order) => order.status === 'accepted' && order.payment_status !== 'paid'),
    ...bulkOrders.filter((order) => order.status === 'confirmed' && order.payment_status !== 'paid'),
  ];
  const activeShipments = shipments.filter((shipment) => activeShipmentStatuses(shipment.status));
  const liveProducts = products.filter((product) => product.status === 'active' && product.approval_status === 'approved');
  const lowStock = liveProducts.filter((product) => Math.max(0, Number(product.available_quantity || 0) - Number(product.reserved_quantity || 0)) <= Number(product.min_stock || 0));
  const missingHsn = liveProducts.filter((product) => !product.hsn_code?.trim());
  const capturedSales = catalogOrders.filter((order) => order.payment_status === 'paid').reduce((sum, order) => sum + Number(order.amount_paid || order.total_amount || 0), 0)
    + bulkOrders.filter((order) => order.payment_status === 'paid').reduce((sum, order) => sum + Number(order.amount_paid || order.net_total || 0), 0);

  const recent = useMemo(() => {
    const catalog = catalogOrders.map((order) => ({ id: `FT-CAT-${order.id.slice(0, 8).toUpperCase()}`, product: order.seller_products?.name || 'Catalogue product', status: order.status, paymentStatus: order.payment_status, amount: Number(order.total_amount || 0), createdAt: order.created_at, kind: 'Catalogue' }));
    const bulk = bulkOrders.map((order) => ({ id: `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`, product: order.bulk_order_items?.[0]?.product_name || 'Bulk fabric order', status: String(order.status || 'draft'), paymentStatus: String(order.payment_status || 'unpaid'), amount: Number(order.net_total || 0), createdAt: String(order.created_at || ''), kind: 'Bulk' }));
    return [...catalog, ...bulk].filter((order) => order.createdAt).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);
  }, [bulkOrders, catalogOrders]);

  const storeName = profile?.business_name || profile?.full_name || 'Your store';
  const busy = loading || bulkLoading;
  const verificationComplete = ['verified', 'approved', 'active'].includes(String(profile?.verification_status || '').toLowerCase());
  const setupSteps = [
    { label: 'Business verification', detail: verificationComplete ? 'Verified and ready to sell' : 'Complete business and GST verification', complete: verificationComplete, tab: 'profile' as SellerTab },
    { label: 'Publish your first product', detail: liveProducts.length ? `${liveProducts.length} live product${liveProducts.length === 1 ? '' : 's'}` : 'Add a product buyers can actually order', complete: liveProducts.length > 0, tab: liveProducts.length ? 'inventory' as SellerTab : 'upload' as SellerTab },
    { label: 'Complete HSN codes', detail: missingHsn.length ? `${missingHsn.length} live product${missingHsn.length === 1 ? '' : 's'} still need HSN` : 'Automatic GST invoices have product tax codes', complete: liveProducts.length > 0 && missingHsn.length === 0, tab: 'inventory' as SellerTab },
    { label: 'Pickup and shipping profile', detail: profile?.city && profile?.state ? `${profile.city}, ${profile.state}` : 'Add pickup location before dispatch', complete: Boolean(profile?.city && profile?.state), tab: 'courier' as SellerTab },
  ];
  const setupComplete = setupSteps.filter((step) => step.complete).length;

  const actionItems = [
    { label: 'Orders waiting for your decision', count: pendingCatalog.length + pendingBulk.length, icon: 'ClockIcon', tone: 'text-warning', tab: 'orders' as SellerTab },
    { label: 'Buyers waiting to pay', count: paymentDue.length, icon: 'CreditCardIcon', tone: 'text-primary', tab: 'orders' as SellerTab },
    { label: 'Products at or below minimum stock', count: lowStock.length, icon: 'ExclamationTriangleIcon', tone: lowStock.length ? 'text-error' : 'text-success', tab: 'inventory' as SellerTab },
    { label: 'Live products missing HSN', count: missingHsn.length, icon: 'DocumentTextIcon', tone: missingHsn.length ? 'text-warning' : 'text-success', tab: 'inventory' as SellerTab },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-850 text-muted-foreground">Home</p>
          <h1 className="ft-admin-page-title mt-1 text-2xl sm:text-3xl">{storeName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything that needs attention in your store, in priority order.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigate('orders')} className="ft-secondary-action inline-flex items-center gap-2 px-3 py-2 text-xs"><Icon name="ShoppingBagIcon" size={15} /> Orders</button>
          <button type="button" onClick={() => onNavigate('upload')} className="ft-primary-action inline-flex items-center gap-2 px-3 py-2 text-xs"><Icon name="PlusIcon" size={15} /> Add product</button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>}

      <section className="ft-shopify-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div><h2 className="text-sm font-850 text-foreground">Today</h2><p className="mt-0.5 text-xs text-muted-foreground">Tasks that could block sales, payment or fulfilment</p></div>
          <button type="button" onClick={() => void load()} className="ft-icon-button" aria-label="Refresh seller home"><Icon name="ArrowPathIcon" size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4">
          {actionItems.map((item, index) => (
            <button key={item.label} type="button" onClick={() => onNavigate(item.tab)} className={`flex items-center gap-3 p-4 text-left transition hover:bg-muted/35 ${index ? 'border-t border-border md:border-l md:border-t-0' : ''}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon name={item.icon} size={18} className={item.tone} /></span>
              <span className="min-w-0"><span className={`block text-xl font-850 ${item.tone}`}>{busy ? '—' : item.count}</span><span className="block text-xs leading-5 text-muted-foreground">{item.label}</span></span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.65fr)]">
        <section className="ft-shopify-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-850 text-foreground">Recent orders</h2><p className="mt-1 text-xs text-muted-foreground">Catalogue and bulk orders in one queue</p></div><button type="button" onClick={() => onNavigate('orders')} className="text-xs font-850 text-primary hover:underline">View all</button></div>
          {busy ? <div className="py-12 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : recent.length ? <div className="divide-y divide-border">{recent.map((order) => <button key={`${order.kind}:${order.id}`} type="button" onClick={() => onNavigate('orders')} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/30"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="mono-id">{order.id}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-850 uppercase">{order.kind}</span><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-850 capitalize text-primary">{order.status.replaceAll('_', ' ')}</span></div><p className="mt-1 truncate text-sm font-750 text-foreground">{order.product}</p><p className="mt-1 text-xs text-muted-foreground">Payment: {order.paymentStatus.replaceAll('_', ' ')} · {new Date(order.createdAt).toLocaleString('en-IN')}</p></div><p className="shrink-0 text-sm font-850 text-foreground">{formatMoney(order.amount)}</p><Icon name="ChevronRightIcon" size={15} className="text-muted-foreground" /></button>)}</div> : <div className="px-5 py-10 text-center"><Icon name="ShoppingBagIcon" size={30} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-850">No buyer orders yet</p><p className="mt-1 text-xs text-muted-foreground">Orders appear here as soon as buyers submit them.</p></div>}
        </section>

        <section className="ft-setup-guide overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-850 text-foreground">Store setup</h2><p className="mt-1 text-xs text-muted-foreground">{setupComplete} of {setupSteps.length} essentials complete</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-850 text-primary">{Math.round((setupComplete / setupSteps.length) * 100)}%</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${(setupComplete / setupSteps.length) * 100}%` }} /></div>
          </div>
          <div>
            {setupSteps.map((step) => (
              <button key={step.label} type="button" onClick={() => onNavigate(step.tab)} className={`ft-setup-step w-full text-left hover:bg-muted/30 ${step.complete ? 'is-complete' : ''}`}>
                <span className="ft-setup-dot">{step.complete ? <Icon name="CheckIcon" size={13} /> : <Icon name="ArrowRightIcon" size={12} />}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-800 text-foreground">{step.label}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{step.detail}</span></span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Live products', value: liveProducts.length, icon: 'ArchiveBoxIcon', tone: 'text-foreground', tab: 'inventory' as SellerTab },
          { label: 'Active shipments', value: activeShipments.length, icon: 'TruckIcon', tone: 'text-secondary', tab: 'courier' as SellerTab },
          { label: 'Captured sales', value: formatMoney(capturedSales), icon: 'BanknotesIcon', tone: 'text-success', tab: 'earnings' as SellerTab },
          { label: 'Low stock', value: lowStock.length, icon: 'ExclamationTriangleIcon', tone: lowStock.length ? 'text-error' : 'text-success', tab: 'inventory' as SellerTab },
        ].map((stat) => <button key={stat.label} type="button" onClick={() => onNavigate(stat.tab)} className="ft-shopify-card p-4 text-left transition hover:border-[#b8bec6]"><Icon name={stat.icon} size={18} className={stat.tone} /><p className={`mt-3 text-xl font-850 ${stat.tone}`}>{busy ? '—' : stat.value}</p><p className="mt-1 text-xs font-700 text-muted-foreground">{stat.label}</p></button>)}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="ft-shopify-card p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-850">Inventory health</h2><p className="mt-1 text-xs text-muted-foreground">{products.length} total product record{products.length === 1 ? '' : 's'}</p></div><button type="button" onClick={() => onNavigate('inventory')} className="text-xs font-850 text-primary hover:underline">Manage</button></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-success/10 p-3"><p className="text-xl font-850 text-success">{liveProducts.length}</p><p className="text-[10px] text-muted-foreground">Live</p></div><div className="rounded-lg bg-warning/10 p-3"><p className="text-xl font-850 text-warning">{products.filter((product) => product.status === 'draft').length}</p><p className="text-[10px] text-muted-foreground">Draft</p></div><div className="rounded-lg bg-error/10 p-3"><p className="text-xl font-850 text-error">{lowStock.length}</p><p className="text-[10px] text-muted-foreground">Low stock</p></div></div></section>
        <section className="ft-shopify-card p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-850">Shipping</h2><p className="mt-1 text-xs text-muted-foreground">Current shipment ledger</p></div><button type="button" onClick={() => onNavigate('courier')} className="text-xs font-850 text-primary hover:underline">Open shipping</button></div>{activeShipments.length ? <div className="mt-4 rounded-lg bg-secondary/10 p-4"><p className="text-2xl font-850 text-secondary">{activeShipments.length}</p><p className="mt-1 text-xs text-muted-foreground">shipment{activeShipments.length === 1 ? '' : 's'} currently active</p><p className="mt-2 text-xs text-muted-foreground">Latest update {new Date(activeShipments[0].updated_at).toLocaleString('en-IN')}</p></div> : <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center"><Icon name="TruckIcon" size={26} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-850">No active shipments</p></div>}</section>
      </div>
    </div>
  );
}
