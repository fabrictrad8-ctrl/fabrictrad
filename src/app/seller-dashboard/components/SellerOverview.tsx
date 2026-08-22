'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { formatMoney, useSellerBulkOrders } from '@/lib/hooks/useAccountOrders';

type SellerTab = 'orders' | 'inventory' | 'upload' | 'courier' | 'earnings' | 'analytics';
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
};

type Shipment = {
  id: string;
  status: string | null;
  updated_at: string;
};

const activeShipmentStatuses = (status?: string | null) =>
  !['delivered', 'cancelled', 'failed', 'rto_delivered'].includes(String(status || '').toLowerCase());

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
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data: seller, error: sellerError } = await supabase
      .from('seller_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sellerError || !seller?.id) {
      setError(sellerError?.message || 'Seller profile is not available.');
      setLoading(false);
      return;
    }

    const [catalogResult, productResult, shipmentResult] = await Promise.all([
      supabase
        .from('catalog_order_requests')
        .select('id,status,payment_status,total_amount,amount_paid,created_at,seller_products(name)')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false })
        .limit(250),
      supabase
        .from('seller_products')
        .select('id,name,status,approval_status,available_quantity,reserved_quantity,min_stock')
        .eq('seller_id', seller.id)
        .order('updated_at', { ascending: false })
        .limit(1000),
      supabase
        .from('seller_shipments')
        .select('id,status,updated_at')
        .eq('seller_id', seller.id)
        .order('updated_at', { ascending: false })
        .limit(250),
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
  const capturedSales = catalogOrders
    .filter((order) => order.payment_status === 'paid')
    .reduce((sum, order) => sum + Number(order.amount_paid || order.total_amount || 0), 0)
    + bulkOrders.filter((order) => order.payment_status === 'paid').reduce((sum, order) => sum + Number(order.amount_paid || order.net_total || 0), 0);

  const recent = useMemo(() => {
    const catalog = catalogOrders.map((order) => ({
      id: `FT-CAT-${order.id.slice(0, 8).toUpperCase()}`,
      product: order.seller_products?.name || 'Catalogue product',
      status: order.status,
      paymentStatus: order.payment_status,
      amount: Number(order.total_amount || 0),
      createdAt: order.created_at,
      kind: 'Catalogue',
    }));
    const bulk = bulkOrders.map((order) => ({
      id: `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`,
      product: order.bulk_order_items?.[0]?.product_name || 'Bulk fabric order',
      status: String(order.status || 'draft'),
      paymentStatus: String(order.payment_status || 'unpaid'),
      amount: Number(order.net_total || 0),
      createdAt: String(order.created_at || ''),
      kind: 'Bulk',
    }));
    return [...catalog, ...bulk]
      .filter((order) => order.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [bulkOrders, catalogOrders]);

  const storeName = profile?.business_name || profile?.full_name || 'Your store';
  const busy = loading || bulkLoading;

  const stats = [
    { label: 'Orders needing action', value: pendingCatalog.length + pendingBulk.length, icon: 'ClockIcon', color: 'text-warning', tab: 'orders' as SellerTab },
    { label: 'Payment due from buyers', value: paymentDue.length, icon: 'CreditCardIcon', color: 'text-primary', tab: 'orders' as SellerTab },
    { label: 'Active shipments', value: activeShipments.length, icon: 'TruckIcon', color: 'text-secondary', tab: 'courier' as SellerTab },
    { label: 'Captured sales', value: formatMoney(capturedSales), icon: 'BanknotesIcon', color: 'text-success', tab: 'earnings' as SellerTab },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="ft-route-kicker">Seller home</p>
            <h1 className="mt-2 text-3xl font-800 tracking-tight text-foreground">{storeName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Live orders, products, payments and shipments from the same production database used by buyers.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => onNavigate('upload')} className="ft-primary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm"><Icon name="PlusIcon" size={15} /> Add product</button>
              <button type="button" onClick={() => onNavigate('orders')} className="ft-secondary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm"><Icon name="ShoppingBagIcon" size={15} /> View orders</button>
              <button type="button" onClick={() => onNavigate('inventory')} className="ft-secondary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm"><Icon name="ArchiveBoxIcon" size={15} /> Manage products</button>
            </div>
          </div>
          <div className="grid min-w-60 grid-cols-2 gap-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Live products</p><p className="mt-1 text-2xl font-800 text-foreground">{busy ? '—' : liveProducts.length}</p></div>
            <div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Low stock</p><p className={`mt-1 text-2xl font-800 ${lowStock.length ? 'text-error' : 'text-success'}`}>{busy ? '—' : lowStock.length}</p></div>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => <button key={stat.label} type="button" onClick={() => onNavigate(stat.tab)} className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><Icon name={stat.icon} size={20} className={stat.color} /><p className={`mt-3 text-2xl font-800 ${stat.color}`}>{busy ? '—' : stat.value}</p><p className="mt-1 text-xs font-700 leading-tight text-muted-foreground">{stat.label}</p></button>)}
      </div>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-800 text-foreground">Recent orders</h2><p className="mt-1 text-xs text-muted-foreground">Catalogue and bulk orders in one queue</p></div><button type="button" onClick={() => onNavigate('orders')} className="text-xs font-800 text-primary hover:underline">Open order queue</button></div>
        {busy ? <div className="py-12 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : recent.length ? <div className="divide-y divide-border">{recent.map((order) => <button key={`${order.kind}:${order.id}`} type="button" onClick={() => onNavigate('orders')} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/30"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="mono-id">{order.id}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-800 uppercase">{order.kind}</span><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-800 capitalize text-primary">{order.status.replaceAll('_', ' ')}</span></div><p className="mt-1 truncate text-sm font-700 text-foreground">{order.product}</p><p className="mt-1 text-xs text-muted-foreground">Payment: {order.paymentStatus.replaceAll('_', ' ')} · {new Date(order.createdAt).toLocaleString('en-IN')}</p></div><p className="shrink-0 text-sm font-800 text-foreground">{formatMoney(order.amount)}</p><Icon name="ChevronRightIcon" size={15} className="text-muted-foreground" /></button>)}</div> : <div className="px-5 py-10 text-center"><Icon name="ShoppingBagIcon" size={30} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-800">No buyer orders yet</p><p className="mt-1 text-xs text-muted-foreground">Real orders will appear here as soon as buyers submit them.</p></div>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-800">Inventory health</h2><p className="mt-1 text-xs text-muted-foreground">{products.length} total product record{products.length === 1 ? '' : 's'}</p></div><button type="button" onClick={() => onNavigate('inventory')} className="text-xs font-800 text-primary hover:underline">Manage</button></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-success/10 p-3"><p className="text-xl font-800 text-success">{liveProducts.length}</p><p className="text-[10px] text-muted-foreground">Live</p></div><div className="rounded-xl bg-warning/10 p-3"><p className="text-xl font-800 text-warning">{products.filter((product) => product.status === 'draft').length}</p><p className="text-[10px] text-muted-foreground">Draft</p></div><div className="rounded-xl bg-error/10 p-3"><p className="text-xl font-800 text-error">{lowStock.length}</p><p className="text-[10px] text-muted-foreground">Low stock</p></div></div></section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-800">Shipping</h2><p className="mt-1 text-xs text-muted-foreground">Current seller shipment ledger</p></div><button type="button" onClick={() => onNavigate('courier')} className="text-xs font-800 text-primary hover:underline">Open shipping</button></div>{activeShipments.length ? <div className="mt-4 rounded-xl bg-secondary/10 p-4"><p className="text-2xl font-800 text-secondary">{activeShipments.length}</p><p className="mt-1 text-xs text-muted-foreground">shipment{activeShipments.length === 1 ? '' : 's'} currently active</p><p className="mt-2 text-xs text-muted-foreground">Latest update {new Date(activeShipments[0].updated_at).toLocaleString('en-IN')}</p></div> : <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center"><Icon name="TruckIcon" size={26} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-800">No active shipments</p></div>}</section>
      </div>
    </div>
  );
}
