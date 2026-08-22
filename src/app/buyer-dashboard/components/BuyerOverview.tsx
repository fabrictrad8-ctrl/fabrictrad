'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { firstOrderItem, formatMoney, formatOrderDate, useBuyerBulkOrders } from '@/lib/hooks/useAccountOrders';

type DashTab = 'overview' | 'orders' | 'tracking' | 'wishlist' | 'account';

type Props = { onNavigate: (tab: DashTab) => void };

type CatalogOrder = {
  id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  quantity: number;
  unit: string;
  created_at: string;
  seller_id: string;
  seller_products?: { name?: string | null } | null;
};

type Shipment = { id: string; status: string | null; updated_at: string };

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const thisMonth = (value?: string | null) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

export default function BuyerOverview({ onNavigate }: Props) {
  const { user, profile } = useAuth();
  const { orders: bulkOrders, loading: bulkLoading } = useBuyerBulkOrders();
  const [catalogOrders, setCatalogOrders] = useState<CatalogOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setCatalogOrders([]);
      setShipments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const [catalogResult, shipmentResult] = await Promise.all([
      supabase
        .from('catalog_order_requests')
        .select('id,status,payment_status,total_amount,quantity,unit,created_at,seller_id,seller_products(name)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('seller_shipments')
        .select('id,status,updated_at')
        .eq('buyer_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(200),
    ]);
    if (!catalogResult.error) setCatalogOrders((catalogResult.data || []) as unknown as CatalogOrder[]);
    if (!shipmentResult.error) setShipments((shipmentResult.data || []) as Shipment[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const buyerName = profile?.full_name || user?.email?.split('@')[0] || 'Buyer';
  const combined = useMemo(() => {
    const catalog = catalogOrders.map((order) => ({
      id: `FT-CAT-${order.id.slice(0, 8).toUpperCase()}`,
      rawId: order.id,
      kind: 'catalog' as const,
      product: order.seller_products?.name || 'Catalogue product',
      seller: `Seller ${order.seller_id.slice(0, 6).toUpperCase()}`,
      qty: `${Number(order.quantity || 0).toLocaleString('en-IN')} ${order.unit || 'units'}`,
      amount: Number(order.total_amount || 0),
      status: order.status || 'pending',
      paymentStatus: order.payment_status || 'unpaid',
      createdAt: order.created_at,
    }));
    const bulk = bulkOrders.map((order) => {
      const item = firstOrderItem(order);
      return {
        id: `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`,
        rawId: order.id,
        kind: 'bulk' as const,
        product: item?.product_name || 'Bulk fabric order',
        seller: order.seller_id ? `Seller ${order.seller_id.slice(0, 6).toUpperCase()}` : 'Seller pending',
        qty: item?.quantity_mtrs ? `${Number(item.quantity_mtrs).toLocaleString('en-IN')} mtrs` : 'Quantity pending',
        amount: Number(order.net_total || 0),
        status: order.status || 'draft',
        paymentStatus: order.payment_status || 'unpaid',
        createdAt: order.created_at || '',
      };
    });
    return [...catalog, ...bulk].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bulkOrders, catalogOrders]);

  const monthOrders = combined.filter((order) => thisMonth(order.createdAt));
  const pendingSeller = combined.filter((order) => ['pending', 'draft', 'quote_sent'].includes(order.status));
  const paymentDue = combined.filter((order) => ['accepted', 'confirmed'].includes(order.status) && order.paymentStatus !== 'paid');
  const monthPaid = monthOrders.filter((order) => order.paymentStatus === 'paid' || ['paid', 'fulfilled', 'shipped', 'delivered'].includes(order.status));
  const activeShipments = shipments.filter((shipment) => !['delivered', 'cancelled', 'failed', 'rto_delivered'].includes(String(shipment.status || '').toLowerCase()));
  const recentOrders = combined.slice(0, 5);
  const busy = loading || bulkLoading;

  const statCards = [
    { label: 'Awaiting seller', value: String(pendingSeller.length), icon: 'ClockIcon', color: 'text-warning', bg: 'bg-warning/10 border-warning/20', tab: 'orders' as DashTab },
    { label: 'Payment due', value: String(paymentDue.length), icon: 'CreditCardIcon', color: 'text-primary', bg: 'bg-primary/10 border-primary/20', tab: 'orders' as DashTab },
    { label: 'Active shipments', value: String(activeShipments.length), icon: 'TruckIcon', color: 'text-purple-700', bg: 'bg-purple-500/10 border-purple-500/20', tab: 'tracking' as DashTab },
    { label: 'Paid this month', value: formatMoney(monthPaid.reduce((sum, order) => sum + order.amount, 0)), icon: 'CurrencyRupeeIcon', color: 'text-success', bg: 'bg-success/10 border-success/20', tab: 'orders' as DashTab },
  ];

  return (
    <div>
      <div className="mb-6"><h1 className="text-xl font-800 text-foreground">{greeting()}, {buyerName}</h1><p className="text-sm text-muted-foreground">Live catalogue, bulk, payment and delivery status for this account</p></div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => <button key={card.label} type="button" onClick={() => onNavigate(card.tab)} className={`stat-card border text-left transition hover:-translate-y-0.5 hover:shadow-md ${card.bg}`}><Icon name={card.icon} size={20} className={card.color} /><p className={`mt-3 text-2xl font-800 ${card.color}`}>{busy ? '—' : card.value}</p><p className="mt-1 text-xs font-700 leading-tight text-muted-foreground">{card.label}</p></button>)}
      </div>

      <section className="mb-6 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-800 text-foreground">Recent orders</h2><p className="mt-0.5 text-xs text-muted-foreground">{monthOrders.length} created this month across catalogue and bulk purchasing</p></div><button type="button" onClick={() => onNavigate('orders')} className="text-xs font-800 text-primary hover:underline">View all</button></div>
        {busy ? <div className="px-5 py-10 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : recentOrders.length ? <div className="divide-y divide-border">{recentOrders.map((order) => <button key={`${order.kind}:${order.rawId}`} type="button" onClick={() => onNavigate('orders')} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/30"><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><p className="mono-id">{order.id}</p><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-800 uppercase">{order.kind}</span><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-600 order-status-${order.status}`}>{order.status.replaceAll('_', ' ')}</span></div><p className="truncate text-sm font-700 text-foreground">{order.product}</p><p className="text-xs text-muted-foreground">{order.seller} · {order.qty} · {formatOrderDate(order.createdAt)}</p></div><p className="shrink-0 text-sm font-800 text-foreground">{formatMoney(order.amount)}</p><Icon name="ChevronRightIcon" size={15} className="text-muted-foreground" /></button>)}</div> : <div className="px-5 py-10 text-center"><Icon name="ShoppingBagIcon" size={32} className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm font-700 text-foreground">No orders for this account yet</p><p className="mt-1 text-xs text-muted-foreground">Orders appear here after you submit a catalogue request or bulk order.</p></div>}
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-800 text-foreground">Shipments in transit</h2><p className="mt-0.5 text-xs text-muted-foreground">Live seller shipment records for this buyer</p></div><button type="button" onClick={() => onNavigate('tracking')} className="text-xs font-800 text-primary hover:underline">Track all</button></div>
        {activeShipments.length ? <button type="button" onClick={() => onNavigate('tracking')} className="flex w-full items-center gap-3 p-5 text-left hover:bg-muted/30"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-700"><Icon name="TruckIcon" size={20} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-800 text-foreground">{activeShipments.length} shipment{activeShipments.length === 1 ? '' : 's'} moving</span><span className="block text-xs text-muted-foreground">Last update {new Date(activeShipments[0].updated_at).toLocaleString('en-IN')}</span></span><Icon name="ChevronRightIcon" size={15} className="text-muted-foreground" /></button> : <div className="p-8 text-center"><Icon name="TruckIcon" size={32} className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm font-700 text-foreground">No active shipments</p><p className="mt-1 text-xs text-muted-foreground">Tracking appears after a fully paid order is dispatched.</p></div>}
      </section>
    </div>
  );
}
