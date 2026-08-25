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
const activeShipmentStatuses = (status?: string | null) =>
  !['delivered', 'cancelled', 'failed', 'rto_delivered'].includes(String(status || '').toLowerCase());

const statusBadge = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'paid' || s === 'fulfilled' || s === 'delivered') return 'bg-[#008060]/10 text-[#008060]';
  if (s === 'pending') return 'bg-amber-50 text-amber-700';
  if (s === 'accepted' || s === 'confirmed') return 'bg-blue-50 text-blue-700';
  if (s === 'rejected' || s === 'cancelled') return 'bg-red-50 text-red-600';
  return 'bg-gray-100 text-gray-600';
};

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

  const pendingCatalog = catalogOrders.filter((o) => o.status === 'pending');
  const pendingBulk = bulkOrders.filter((o) => ['draft', 'quote_sent'].includes(String(o.status || '')));
  const paymentDue = [
    ...catalogOrders.filter((o) => o.status === 'accepted' && o.payment_status !== 'paid'),
    ...bulkOrders.filter((o) => o.status === 'confirmed' && o.payment_status !== 'paid'),
  ];
  const activeShipments = shipments.filter((s) => activeShipmentStatuses(s.status));
  const liveProducts = products.filter((p) => p.status === 'active' && p.approval_status === 'approved');
  const lowStock = liveProducts.filter((p) => Math.max(0, Number(p.available_quantity || 0) - Number(p.reserved_quantity || 0)) <= Number(p.min_stock || 0));
  const missingHsn = liveProducts.filter((p) => !p.hsn_code?.trim());
  const capturedSales = catalogOrders.filter((o) => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.amount_paid || o.total_amount || 0), 0)
    + bulkOrders.filter((o) => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.amount_paid || o.net_total || 0), 0);

  const recent = useMemo(() => {
    const catalog = catalogOrders.map((o) => ({
      id: `FT-CAT-${o.id.slice(0, 8).toUpperCase()}`,
      product: o.seller_products?.name || 'Catalogue product',
      status: o.status,
      paymentStatus: o.payment_status,
      amount: Number(o.total_amount || 0),
      createdAt: o.created_at,
      kind: 'Catalogue',
    }));
    const bulk = bulkOrders.map((o) => ({
      id: `FT-BULK-${o.id.slice(0, 8).toUpperCase()}`,
      product: o.bulk_order_items?.[0]?.product_name || 'Bulk fabric order',
      status: String(o.status || 'draft'),
      paymentStatus: String(o.payment_status || 'unpaid'),
      amount: Number(o.net_total || 0),
      createdAt: String(o.created_at || ''),
      kind: 'Bulk',
    }));
    return [...catalog, ...bulk]
      .filter((o) => o.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [bulkOrders, catalogOrders]);

  const storeName = profile?.business_name || profile?.full_name || 'Your store';
  const busy = loading || bulkLoading;
  const verificationComplete = ['verified', 'approved', 'active'].includes(String(profile?.verification_status || '').toLowerCase());

  const setupSteps = [
    { label: 'Business verification', detail: verificationComplete ? 'Verified and ready to sell' : 'Complete business and GST verification', complete: verificationComplete, tab: 'profile' as SellerTab },
    { label: 'Publish your first product', detail: liveProducts.length ? `${liveProducts.length} live product${liveProducts.length === 1 ? '' : 's'}` : 'Add a product buyers can order', complete: liveProducts.length > 0, tab: liveProducts.length ? 'inventory' as SellerTab : 'upload' as SellerTab },
    { label: 'Complete HSN codes', detail: missingHsn.length ? `${missingHsn.length} product${missingHsn.length === 1 ? '' : 's'} need HSN` : 'All products have tax codes', complete: liveProducts.length > 0 && missingHsn.length === 0, tab: 'inventory' as SellerTab },
    { label: 'Pickup and shipping profile', detail: profile?.city && profile?.state ? `${profile.city}, ${profile.state}` : 'Add pickup location before dispatch', complete: Boolean(profile?.city && profile?.state), tab: 'courier' as SellerTab },
  ];
  const setupComplete = setupSteps.filter((s) => s.complete).length;
  const setupPct = Math.round((setupComplete / setupSteps.length) * 100);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-600 text-muted-foreground">Seller dashboard</p>
          <h1 className="mt-1 text-2xl font-700 text-foreground">{storeName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything that needs attention, in priority order.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="flex items-center gap-2 rounded-lg border border-[#e1e3e5] bg-white px-3 py-2 text-xs font-600 text-foreground shadow-sm hover:bg-gray-50"
          >
            <Icon name="ShoppingBagIcon" size={14} />
            Orders
          </button>
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="flex items-center gap-2 rounded-lg bg-[#008060] px-3 py-2 text-xs font-700 text-white shadow-sm hover:bg-[#006e52]"
          >
            <Icon name="PlusIcon" size={14} />
            Add product
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e1e3e5] bg-white shadow-sm hover:bg-gray-50"
            aria-label="Refresh"
          >
            <Icon name="ArrowPathIcon" size={15} className={loading ? 'animate-spin text-muted-foreground' : 'text-muted-foreground'} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Orders pending', value: pendingCatalog.length + pendingBulk.length, icon: 'ClockIcon', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', tab: 'orders' as SellerTab },
          { label: 'Payment awaited', value: paymentDue.length, icon: 'CreditCardIcon', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', tab: 'orders' as SellerTab },
          { label: 'Live products', value: liveProducts.length, icon: 'ArchiveBoxIcon', color: 'text-[#008060]', bg: 'bg-[#008060]/10', border: 'border-[#008060]/20', tab: 'inventory' as SellerTab },
          { label: 'Captured sales', value: formatMoney(capturedSales), icon: 'BanknotesIcon', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', tab: 'earnings' as SellerTab },
        ].map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => onNavigate(stat.tab)}
            className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${stat.border}`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg}`}>
              <Icon name={stat.icon} size={18} className={stat.color} />
            </span>
            <p className={`mt-3 text-xl font-700 ${stat.color}`}>
              {busy ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-gray-100" /> : stat.value}
            </p>
            <p className="mt-1 text-xs font-600 text-muted-foreground">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Today's tasks */}
      <div className="rounded-xl border border-[#e1e3e5] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e1e3e5] px-5 py-4">
          <div>
            <h2 className="text-sm font-700 text-foreground">Today's tasks</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Items that could block sales, payment or fulfilment</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-50"
            aria-label="Refresh"
          >
            <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin text-muted-foreground' : 'text-muted-foreground'} />
          </button>
        </div>
        <div className="grid gap-px bg-[#f6f6f7] md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Orders waiting for decision', count: pendingCatalog.length + pendingBulk.length, icon: 'ClockIcon', tab: 'orders' as SellerTab },
            { label: 'Buyers waiting to pay', count: paymentDue.length, icon: 'CreditCardIcon', tab: 'orders' as SellerTab },
            { label: 'Products at minimum stock', count: lowStock.length, icon: 'ExclamationTriangleIcon', tab: 'inventory' as SellerTab },
            { label: 'Live products missing HSN', count: missingHsn.length, icon: 'DocumentTextIcon', tab: 'inventory' as SellerTab },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.tab)}
              className="flex items-center gap-3 bg-white p-4 text-left transition hover:bg-[#f6f6f7]"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.count > 0 ? 'bg-amber-50 text-amber-600' : 'bg-[#008060]/10 text-[#008060]'}`}>
                <Icon name={item.icon} size={17} />
              </span>
              <span className="min-w-0">
                <span className={`block text-xl font-700 ${item.count > 0 ? 'text-amber-600' : 'text-[#008060]'}`}>
                  {busy ? '—' : item.count}
                </span>
                <span className="block text-xs leading-5 text-muted-foreground">{item.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent orders + Setup guide */}
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        {/* Recent orders */}
        <div className="rounded-xl border border-[#e1e3e5] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e1e3e5] px-5 py-4">
            <div>
              <h2 className="text-sm font-700 text-foreground">Recent orders</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Catalogue and bulk orders in one queue</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="text-xs font-600 text-[#008060] hover:underline"
            >
              View all
            </button>
          </div>
          {busy ? (
            <div className="py-12 text-center">
              <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#008060] border-t-transparent" />
            </div>
          ) : recent.length ? (
            <div className="divide-y divide-[#f6f6f7]">
              {recent.map((order) => (
                <button
                  key={`${order.kind}:${order.id}`}
                  type="button"
                  onClick={() => onNavigate('orders')}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-[#f6f6f7]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f6f6f7]">
                    <Icon name="ShoppingBagIcon" size={16} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-600 text-foreground">{order.id}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-700 uppercase text-gray-600">
                        {order.kind}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-700 capitalize ${statusBadge(order.status)}`}>
                        {order.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-600 text-foreground">{order.product}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-700 text-foreground">{formatMoney(order.amount)}</p>
                  <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <Icon name="ShoppingBagIcon" size={32} className="mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm font-600 text-foreground">No buyer orders yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Orders appear here as soon as buyers submit them.</p>
            </div>
          )}
        </div>

        {/* Setup guide */}
        <div className="rounded-xl border border-[#e1e3e5] bg-white shadow-sm">
          <div className="border-b border-[#e1e3e5] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-700 text-foreground">Store setup</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{setupComplete} of {setupSteps.length} essentials complete</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-700 ${setupPct === 100 ? 'bg-[#008060]/10 text-[#008060]' : 'bg-amber-50 text-amber-700'}`}>
                {setupPct}%
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f6f6f7]">
              <div
                className="h-full rounded-full bg-[#008060] transition-all duration-500"
                style={{ width: `${setupPct}%` }}
              />
            </div>
          </div>
          <div className="divide-y divide-[#f6f6f7]">
            {setupSteps.map((step) => (
              <button
                key={step.label}
                type="button"
                onClick={() => onNavigate(step.tab)}
                className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-[#f6f6f7]"
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${step.complete ? 'bg-[#008060] text-white' : 'border-2 border-[#e1e3e5]'}`}>
                  {step.complete && <Icon name="CheckIcon" size={11} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-600 ${step.complete ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{step.detail}</span>
                </span>
                {!step.complete && <Icon name="ChevronRightIcon" size={14} className="mt-0.5 text-muted-foreground" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory + Shipping */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[#e1e3e5] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-700 text-foreground">Inventory health</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{products.length} total product records</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-600 text-[#008060] hover:underline"
            >
              Manage
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[#008060]/10 p-3">
              <p className="text-xl font-700 text-[#008060]">{liveProducts.length}</p>
              <p className="text-[10px] font-600 text-muted-foreground">Live</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-xl font-700 text-amber-600">{products.filter((p) => p.status === 'draft').length}</p>
              <p className="text-[10px] font-600 text-muted-foreground">Draft</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-xl font-700 text-red-600">{lowStock.length}</p>
              <p className="text-[10px] font-600 text-muted-foreground">Low stock</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#e1e3e5] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-700 text-foreground">Shipping</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Current shipment ledger</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('courier')}
              className="text-xs font-600 text-[#008060] hover:underline"
            >
              Open shipping
            </button>
          </div>
          {activeShipments.length ? (
            <div className="mt-4 rounded-xl bg-blue-50 p-4">
              <p className="text-2xl font-700 text-blue-600">{activeShipments.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                shipment{activeShipments.length === 1 ? '' : 's'} currently active
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Latest update {new Date(activeShipments[0].updated_at).toLocaleString('en-IN')}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-[#e1e3e5] p-6 text-center">
              <Icon name="TruckIcon" size={26} className="mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm font-600 text-foreground">No active shipments</p>
              <p className="mt-1 text-xs text-muted-foreground">Shipments appear after orders are dispatched.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
