'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  firstOrderItem,
  formatMoney,
  formatOrderDate,
  useSellerBulkOrders,
} from '@/lib/hooks/useAccountOrders';

type SellerOverviewTab =
  | 'orders'
  | 'inventory'
  | 'upload'
  | 'earnings'
  | 'fulfillment'
  | 'analytics'
  | 'profile';

interface Props {
  onNavigate: (tab: SellerOverviewTab) => void;
}

type CatalogOrderRow = {
  id: string;
  status: string | null;
  quantity: number | null;
  unit: string | null;
  total_amount: number | null;
  created_at: string | null;
  payment_due_at: string | null;
  seller_products?: { name?: string | null; sku?: string | null } | null;
};

type ProductRow = {
  id: string;
  name: string | null;
  status: string | null;
  approval_status: string | null;
  available_quantity: number | null;
  reserved_quantity: number | null;
  moq: number | null;
};

type PaymentRow = {
  id: string;
  amount: number | null;
  status: string | null;
  seller_payable: number | null;
  razorpay_transfer_id: string | null;
  captured_at: string | null;
};

type ShipmentRow = {
  id: string;
  status: string | null;
};

type LiveSellerData = {
  catalogOrders: CatalogOrderRow[];
  products: ProductRow[];
  payments: PaymentRow[];
  shipments: ShipmentRow[];
};

const emptyLiveData: LiveSellerData = {
  catalogOrders: [],
  products: [],
  payments: [],
  shipments: [],
};

const normalized = (value: unknown) => String(value || '').toLowerCase();
const startOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export default function SellerOverview({ onNavigate }: Props) {
  const { user, profile, isDemoAccount } = useAuth();
  const { orders: bulkOrders, loading: bulkLoading } = useSellerBulkOrders();
  const [live, setLive] = useState<LiveSellerData>(emptyLiveData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLiveData = useCallback(async () => {
    if (isDemoAccount || !user?.id) {
      setLive(emptyLiveData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data: seller, error: sellerError } = await supabase
      .from('seller_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (sellerError || !seller?.id) {
      setLive(emptyLiveData);
      setError(
        sellerError?.message ||
          'The seller business profile is not available. Complete seller onboarding before publishing products.'
      );
      setLoading(false);
      return;
    }

    const [ordersResult, productsResult, paymentsResult, shipmentsResult] = await Promise.all([
      supabase
        .from('catalog_order_requests')
        .select('id,status,quantity,unit,total_amount,created_at,payment_due_at,seller_products(name,sku)')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('seller_products')
        .select('id,name,status,approval_status,available_quantity,reserved_quantity,moq')
        .eq('seller_id', seller.id)
        .order('updated_at', { ascending: false })
        .limit(1000),
      supabase
        .from('catalog_order_payments')
        .select('id,amount,status,seller_payable,razorpay_transfer_id,captured_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('shipments')
        .select('id,status')
        .eq('seller_id', seller.id)
        .order('updated_at', { ascending: false })
        .limit(500),
    ]);

    const queryError = [
      ordersResult.error,
      productsResult.error,
      paymentsResult.error,
      shipmentsResult.error,
    ].find(Boolean);

    if (queryError) {
      setError(queryError.message || 'Seller commerce data could not be loaded.');
    }

    setLive({
      catalogOrders: (ordersResult.data || []) as unknown as CatalogOrderRow[],
      products: (productsResult.data || []) as ProductRow[],
      payments: (paymentsResult.data || []) as PaymentRow[],
      shipments: (shipmentsResult.data || []) as ShipmentRow[],
    });
    setLoading(false);
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    void loadLiveData();
  }, [loadLiveData]);

  const sellerName = profile?.business_name || profile?.full_name || 'Your seller account';
  const sellerRef = profile?.id
    ? `FT-SLR-${profile.id.slice(0, 6).toUpperCase()}`
    : 'FT-SLR';

  const calculations = useMemo(() => {
    const pendingCatalogOrders = live.catalogOrders.filter((order) =>
      ['pending'].includes(normalized(order.status))
    );
    const acceptedCatalogOrders = live.catalogOrders.filter((order) =>
      ['accepted'].includes(normalized(order.status))
    );
    const fulfillmentCatalogOrders = live.catalogOrders.filter((order) =>
      ['paid'].includes(normalized(order.status))
    );
    const activeShipments = live.shipments.filter(
      (shipment) =>
        !['delivered', 'cancelled', 'failed', 'rto_delivered'].includes(normalized(shipment.status))
    );
    const activeProducts = live.products.filter(
      (product) =>
        normalized(product.status) === 'active' && normalized(product.approval_status) === 'approved'
    );
    const lowStockProducts = live.products.filter((product) => {
      const available = Math.max(
        0,
        Number(product.available_quantity || 0) - Number(product.reserved_quantity || 0)
      );
      return available <= Math.max(10, Number(product.moq || 0));
    });
    const monthStart = startOfMonth();
    const capturedPayments = live.payments.filter((payment) =>
      ['captured', 'paid', 'authorized'].includes(normalized(payment.status))
    );
    const catalogSalesMonth = capturedPayments
      .filter((payment) => {
        if (!payment.captured_at) return false;
        return new Date(payment.captured_at).getTime() >= monthStart;
      })
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const bulkSalesMonth = bulkOrders
      .filter(
        (order) =>
          ['paid', 'shipped', 'delivered'].includes(normalized(order.status)) &&
          Boolean(order.updated_at) &&
          new Date(String(order.updated_at)).getTime() >= monthStart
      )
      .reduce((sum, order) => sum + Number(order.net_total || 0), 0);
    const pendingSettlement = capturedPayments
      .filter((payment) => !payment.razorpay_transfer_id)
      .reduce((sum, payment) => sum + Number(payment.seller_payable || 0), 0);

    const totalDecided = live.catalogOrders.filter((order) =>
      ['accepted', 'rejected', 'paid', 'fulfilled'].includes(normalized(order.status))
    ).length;
    const accepted = live.catalogOrders.filter((order) =>
      ['accepted', 'paid', 'fulfilled'].includes(normalized(order.status))
    ).length;

    return {
      pendingRequests:
        pendingCatalogOrders.length +
        bulkOrders.filter((order) => normalized(order.status) === 'quote_sent').length,
      paymentDue:
        acceptedCatalogOrders.length +
        bulkOrders.filter((order) => normalized(order.status) === 'confirmed').length,
      toFulfill:
        fulfillmentCatalogOrders.length +
        bulkOrders.filter((order) => normalized(order.status) === 'paid').length,
      activeShipments: activeShipments.length,
      activeProducts: activeProducts.length,
      lowStockProducts,
      salesThisMonth: catalogSalesMonth + bulkSalesMonth,
      pendingSettlement,
      acceptanceRate: totalDecided ? Math.round((accepted / totalDecided) * 100) : null,
      pendingCatalogOrders,
    };
  }, [bulkOrders, live]);

  const urgentOrders = useMemo(() => {
    const catalogRows = calculations.pendingCatalogOrders.slice(0, 4).map((order) => ({
      id: `FT-CAT-${order.id.slice(0, 8).toUpperCase()}`,
      product: order.seller_products?.name || 'Catalogue product',
      detail: `${Number(order.quantity || 0).toLocaleString('en-IN')} ${order.unit || 'units'}`,
      amount: formatMoney(order.total_amount),
      date: order.created_at ? new Date(order.created_at).toLocaleString('en-IN') : 'Recently',
      source: 'Catalogue order',
    }));
    const bulkRows = bulkOrders
      .filter((order) => normalized(order.status) === 'quote_sent')
      .slice(0, 4)
      .map((order) => {
        const item = firstOrderItem(order);
        return {
          id: `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`,
          product: item?.product_name || 'Bulk fabric order',
          detail: item?.quantity_mtrs
            ? `${Number(item.quantity_mtrs).toLocaleString('en-IN')} metres`
            : 'Quantity pending',
          amount: formatMoney(order.net_total),
          date: formatOrderDate(order.created_at),
          source: 'Bulk order',
        };
      });
    return [...catalogRows, ...bulkRows].slice(0, 6);
  }, [bulkOrders, calculations.pendingCatalogOrders]);

  const statCards = [
    {
      label: 'New order requests',
      value: String(calculations.pendingRequests),
      icon: 'InboxIcon',
      tone: 'text-primary bg-primary/10 border-primary/20',
      tab: 'orders' as SellerOverviewTab,
    },
    {
      label: 'Buyer payment due',
      value: String(calculations.paymentDue),
      icon: 'CreditCardIcon',
      tone: 'text-warning bg-warning/10 border-warning/20',
      tab: 'orders' as SellerOverviewTab,
    },
    {
      label: 'Orders to fulfill',
      value: String(calculations.toFulfill),
      icon: 'ArchiveBoxIcon',
      tone: 'text-secondary bg-secondary/10 border-secondary/20',
      tab: 'orders' as SellerOverviewTab,
    },
    {
      label: 'Active shipments',
      value: String(calculations.activeShipments),
      icon: 'TruckIcon',
      tone: 'text-purple-700 bg-purple-500/10 border-purple-500/20',
      tab: 'fulfillment' as SellerOverviewTab,
    },
    {
      label: 'Sales this month',
      value: formatMoney(calculations.salesThisMonth),
      icon: 'CurrencyRupeeIcon',
      tone: 'text-success bg-success/10 border-success/20',
      tab: 'analytics' as SellerOverviewTab,
    },
    {
      label: 'Pending settlement',
      value: formatMoney(calculations.pendingSettlement),
      icon: 'BanknotesIcon',
      tone: 'text-secondary bg-secondary/10 border-secondary/20',
      tab: 'earnings' as SellerOverviewTab,
    },
    {
      label: 'Active products',
      value: String(calculations.activeProducts),
      icon: 'TagIcon',
      tone: 'text-blue-700 bg-blue-500/10 border-blue-500/20',
      tab: 'inventory' as SellerOverviewTab,
    },
    {
      label: 'Acceptance rate',
      value:
        calculations.acceptanceRate == null
          ? '—'
          : `${calculations.acceptanceRate}%`,
      icon: 'CheckCircleIcon',
      tone: 'text-success bg-success/10 border-success/20',
      tab: 'analytics' as SellerOverviewTab,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-800 text-success">Live seller data</span>
              <span className="text-xs text-muted-foreground">{sellerRef}</span>
            </div>
            <h1 className="mt-3 text-3xl font-800 tracking-tight text-foreground">{sellerName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review orders, publish approved products, keep colour-level inventory accurate, dispatch paid orders and monitor settlements from one workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate('upload')} className="ft-primary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">
              <Icon name="PlusIcon" size={15} /> Add product
            </button>
            <button type="button" onClick={() => void loadLiveData()} disabled={loading} className="ft-icon-button" aria-label="Refresh seller home">
              <Icon name="ArrowPathIcon" size={17} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
          <span>{error}</span>
          <button type="button" onClick={() => void loadLiveData()} className="font-800 underline">Retry</button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => {
          const [textTone, backgroundTone, borderTone] = card.tone.split(' ');
          return (
            <button key={card.label} type="button" onClick={() => onNavigate(card.tab)} className={`rounded-2xl border ${borderTone} ${backgroundTone} p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md`}>
              <Icon name={card.icon as 'InboxIcon'} size={20} className={textTone} />
              <p className={`mt-3 text-2xl font-800 ${textTone}`}>{loading || bulkLoading ? '—' : card.value}</p>
              <p className="mt-1 text-xs font-700 text-muted-foreground">{card.label}</p>
            </button>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-xs font-800 uppercase tracking-wider text-primary">Action centre</p>
              <h2 className="mt-1 text-lg font-800 text-foreground">Order requests awaiting a decision</h2>
            </div>
            <button type="button" onClick={() => onNavigate('orders')} className="text-xs font-800 text-primary hover:underline">Open orders</button>
          </div>
          {urgentOrders.length ? (
            <div className="divide-y divide-border">
              {urgentOrders.map((order) => (
                <button key={order.id} type="button" onClick={() => onNavigate('orders')} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/30">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning"><Icon name="ClockIcon" size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-800 text-foreground">{order.product}</span>
                    <span className="block truncate text-xs text-muted-foreground">{order.id} · {order.detail} · {order.source}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">Received {order.date}</span>
                  </span>
                  <span className="shrink-0 text-sm font-800 text-foreground">{order.amount}</span>
                  <Icon name="ChevronRightIcon" size={15} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <Icon name="InboxIcon" size={32} className="mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-800 text-foreground">No seller decisions waiting</p>
              <p className="mt-1 text-xs text-muted-foreground">New catalogue and bulk order requests will appear here.</p>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-800 uppercase tracking-wider text-secondary">Inventory</p>
              <h2 className="mt-1 text-lg font-800 text-foreground">Low-stock attention</h2>
            </div>
            <button type="button" onClick={() => onNavigate('inventory')} className="text-xs font-800 text-primary hover:underline">Manage products</button>
          </div>
          {calculations.lowStockProducts.length ? (
            <div className="mt-5 space-y-3">
              {calculations.lowStockProducts.slice(0, 6).map((product) => {
                const available = Math.max(
                  0,
                  Number(product.available_quantity || 0) - Number(product.reserved_quantity || 0)
                );
                return (
                  <button key={product.id} type="button" onClick={() => onNavigate('inventory')} className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 text-left hover:border-primary/30">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${available <= 0 ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'}`}><Icon name="ArchiveBoxIcon" size={17} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-800 text-foreground">{product.name || 'Untitled product'}</span><span className="block text-xs text-muted-foreground">MOQ {Number(product.moq || 0).toLocaleString('en-IN')}</span></span>
                    <span className={`text-xs font-800 ${available <= 0 ? 'text-error' : 'text-warning'}`}>{available.toLocaleString('en-IN')} available</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-border py-10 text-center">
              <Icon name="ArchiveBoxIcon" size={30} className="mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-800 text-foreground">No low-stock products</p>
              <p className="mt-1 text-xs text-muted-foreground">Alerts are calculated from live available stock and MOQ.</p>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
