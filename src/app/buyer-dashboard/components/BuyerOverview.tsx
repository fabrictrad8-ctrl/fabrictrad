'use client';

import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import {
  firstOrderItem,
  formatMoney,
  formatOrderDate,
  useBuyerBulkOrders,
} from '@/lib/hooks/useAccountOrders';

type DashTab = 'overview' | 'orders' | 'tracking' | 'wishlist' | 'account';

interface Props {
  onNavigate: (tab: DashTab) => void;
}

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
  const { orders: accountOrders, loading } = useBuyerBulkOrders();
  const buyerName = profile?.full_name || user?.email?.split('@')[0] || 'Buyer';
  const monthOrders = accountOrders.filter((order) => thisMonth(order.created_at));
  const shippedOrders = accountOrders.filter((order) => order.status === 'shipped');
  const paymentDue = accountOrders.filter((order) => order.status === 'confirmed');
  const pendingSeller = accountOrders.filter((order) =>
    ['draft', 'quote_sent'].includes(order.status || 'draft')
  );
  const monthPaidOrders = monthOrders.filter((order) =>
    ['paid', 'shipped', 'delivered'].includes(order.status || '')
  );
  const recentOrders = accountOrders.slice(0, 4).map((order) => {
    const item = firstOrderItem(order);
    return {
      id: `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`,
      product: item?.product_name || 'Bulk fabric order',
      seller: order.seller_id ? `Seller ${order.seller_id.slice(0, 6).toUpperCase()}` : 'Seller pending',
      qty: item?.quantity_mtrs ? `${Number(item.quantity_mtrs).toLocaleString('en-IN')} mtrs` : 'Quantity pending',
      amount: formatMoney(order.net_total),
      status: order.status || 'draft',
      statusLabel: (order.status || 'draft').replace(/_/g, ' '),
      date: formatOrderDate(order.created_at),
    };
  });
  const statCards = [
    {
      label: 'Awaiting seller',
      value: String(pendingSeller.length),
      icon: 'ClockIcon',
      color: 'text-warning',
      bg: 'bg-warning/10 border-warning/20',
      tab: 'orders' as DashTab,
    },
    {
      label: 'Payment due',
      value: String(paymentDue.length),
      icon: 'CreditCardIcon',
      color: 'text-primary',
      bg: 'bg-primary/10 border-primary/20',
      tab: 'orders' as DashTab,
    },
    {
      label: 'Active shipments',
      value: String(shippedOrders.length),
      icon: 'TruckIcon',
      color: 'text-purple-700',
      bg: 'bg-purple-500/10 border-purple-500/20',
      tab: 'tracking' as DashTab,
    },
    {
      label: 'Paid this month',
      value: formatMoney(
        monthPaidOrders.reduce((sum, order) => sum + Number(order.net_total || 0), 0)
      ),
      icon: 'CurrencyRupeeIcon',
      color: 'text-success',
      bg: 'bg-success/10 border-success/20',
      tab: 'orders' as DashTab,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-800 text-foreground">{greeting()}, {buyerName}</h1>
        <p className="text-sm text-muted-foreground">
          Live purchasing, payment and delivery status for this account
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => (
          <button key={card.label} type="button" onClick={() => onNavigate(card.tab)} className={`stat-card border text-left transition hover:-translate-y-0.5 hover:shadow-md ${card.bg}`}>
            <Icon name={card.icon as 'ClockIcon'} size={20} className={card.color} />
            <p className={`mt-3 text-2xl font-800 ${card.color}`}>{loading ? '—' : card.value}</p>
            <p className="mt-1 text-xs font-700 leading-tight text-muted-foreground">{card.label}</p>
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-800 text-foreground">Recent orders</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{monthOrders.length} created this month</p>
          </div>
          <button onClick={() => onNavigate('orders')} className="text-xs font-800 text-primary hover:underline">View all</button>
        </div>
        {recentOrders.length > 0 ? (
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <button key={order.id} type="button" onClick={() => onNavigate('orders')} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="mono-id">{order.id}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-600 order-status-${order.status}`}>{order.statusLabel}</span>
                  </div>
                  <p className="truncate text-sm font-700 text-foreground">{order.product}</p>
                  <p className="text-xs text-muted-foreground">{order.seller} · {order.qty} · {order.date}</p>
                </div>
                <p className="shrink-0 text-sm font-800 text-foreground">{order.amount}</p>
                <Icon name="ChevronRightIcon" size={15} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <Icon name="ShoppingBagIcon" size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-700 text-foreground">No orders for this account yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Approved product orders will appear here after submission.</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-800 text-foreground">Shipments in transit</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Only orders marked shipped are shown</p>
          </div>
          <button onClick={() => onNavigate('tracking')} className="text-xs font-800 text-primary hover:underline">Track all</button>
        </div>
        {shippedOrders[0] ? (
          <button type="button" onClick={() => onNavigate('tracking')} className="flex w-full items-center gap-3 p-5 text-left hover:bg-muted/30">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-700"><Icon name="TruckIcon" size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-800 text-foreground">{firstOrderItem(shippedOrders[0])?.product_name || 'Bulk fabric order'}</span>
              <span className="block text-xs text-muted-foreground">FT-BULK-{shippedOrders[0].id.slice(0, 8).toUpperCase()} · shipped</span>
            </span>
            <Icon name="ChevronRightIcon" size={15} className="text-muted-foreground" />
          </button>
        ) : (
          <div className="p-8 text-center">
            <Icon name="TruckIcon" size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-700 text-foreground">No active shipments</p>
            <p className="mt-1 text-xs text-muted-foreground">Tracking appears after a paid order is dispatched.</p>
          </div>
        )}
      </div>
    </div>
  );
}
