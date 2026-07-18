'use client';
import React from 'react';
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

export default function BuyerOverview({ onNavigate }: Props) {
  const { user, profile } = useAuth();
  const { orders: accountOrders } = useBuyerBulkOrders();
  const buyerName = profile?.full_name || user?.email?.split('@')[0] || 'Buyer';
  const activeOrders = accountOrders.filter((order) =>
    ['quote_sent', 'confirmed', 'paid', 'shipped'].includes(order.status || '')
  );
  const recentOrders = accountOrders.slice(0, 3).map((order) => {
    const item = firstOrderItem(order);
    return {
      id: `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`,
      product: item?.product_name || 'Bulk fabric order',
      seller: order.seller_id ? `Seller ${order.seller_id.slice(0, 6).toUpperCase()}` : 'Seller',
      qty: item?.quantity_mtrs ? `${item.quantity_mtrs} mtrs` : 'Quantity pending',
      amount: formatMoney(order.net_total),
      status: order.status || 'draft',
      statusLabel: (order.status || 'draft').replace(/_/g, ' '),
      date: formatOrderDate(order.created_at),
    };
  });
  const statCards = [
    {
      label: 'Pending Confirmations',
      value: String(accountOrders.filter((order) => order.status === 'quote_sent').length),
      icon: 'ClockIcon',
      color: 'text-warning',
      bg: 'bg-amber-50 border-amber-200',
    },
    {
      label: 'Active Shipments',
      value: String(accountOrders.filter((order) => order.status === 'shipped').length),
      icon: 'TruckIcon',
      color: 'text-purple-600',
      bg: 'bg-purple-50 border-purple-200',
    },
    {
      label: 'Orders This Month',
      value: String(accountOrders.length),
      icon: 'ShoppingBagIcon',
      color: 'text-primary',
      bg: 'bg-primary/10 border-primary/20',
    },
    {
      label: 'Total Spent (MTD)',
      value: formatMoney(
        accountOrders.reduce((sum, order) => sum + Number(order.net_total || 0), 0)
      ),
      icon: 'CurrencyRupeeIcon',
      color: 'text-success',
      bg: 'bg-green-50 border-green-200',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-800 text-foreground">Good morning, {buyerName}</h1>
        <p className="text-sm text-muted-foreground">
          Here is your account-only procurement summary for today
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className={`stat-card border ${card.bg}`}>
            <div className="flex items-start justify-between mb-2">
              <Icon name={card.icon as 'ClockIcon'} size={20} className={card.color} />
            </div>
            <p className={`text-2xl font-800 ${card.color} mb-0.5`}>{card.value}</p>
            <p className="text-xs text-muted-foreground font-500 leading-tight">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-card rounded-2xl border border-border mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-800 text-foreground text-sm">Recent Orders</h2>
          <button
            onClick={() => onNavigate('orders')}
            className="text-xs text-primary font-600 hover:underline"
          >
            View All
          </button>
        </div>
        {recentOrders.length > 0 ? (
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <div key={order.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="mono-id">{order.id}</p>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 order-status-${order.status}`}
                    >
                      {order.statusLabel}
                    </span>
                  </div>
                  <p className="text-sm font-600 text-foreground truncate">{order.product}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.seller} · {order.qty} · {order.date}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-800 text-foreground">{order.amount}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <Icon name="ShoppingBagIcon" size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-700 text-foreground">No orders for this account yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Orders will appear here only after this buyer account places them.
            </p>
          </div>
        )}
      </div>

      {/* Active Shipment Preview */}
      <div className="bg-card rounded-2xl border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-800 text-foreground text-sm">Active Shipment</h2>
          <button
            onClick={() => onNavigate('tracking')}
            className="text-xs text-primary font-600 hover:underline"
          >
            Track All
          </button>
        </div>
        {activeOrders[0] ? (
          <div className="p-5">
            <div>
              <p className="text-sm font-700 text-foreground">
                {firstOrderItem(activeOrders[0])?.product_name || 'Bulk fabric order'}
              </p>
              <p className="text-xs text-muted-foreground">
                Status: {(activeOrders[0].status || 'pending').replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Icon name="TruckIcon" size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-700 text-foreground">No active shipments</p>
            <p className="text-xs text-muted-foreground mt-1">
              Shipment tracking will show here only for this account's orders.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
