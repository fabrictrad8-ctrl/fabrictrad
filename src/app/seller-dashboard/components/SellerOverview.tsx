'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { firstOrderItem, formatMoney, useSellerBulkOrders } from '@/lib/hooks/useAccountOrders';

type SellerTab = 'overview' | 'orders' | 'inventory' | 'analytics' | 'upload' | 'profile';

interface Props {
  onNavigate: (tab: SellerTab) => void;
}

const lowStockItems: { name: string; current: number; minimum: number; unit: string }[] = [];

export default function SellerOverview({ onNavigate }: Props) {
  const { profile } = useAuth();
  const { orders: accountOrders } = useSellerBulkOrders();
  const sellerProfile = profile as (typeof profile & { business_name?: string }) | null;
  const sellerName = sellerProfile?.business_name || profile?.full_name || 'Your seller account';
  const sellerRef = profile?.id ? `FT-SLR-${profile.id.slice(0, 6).toUpperCase()}` : 'FT-SLR';
  const urgentOrders = accountOrders
    .filter((order) => order.status === 'quote_sent')
    .slice(0, 3)
    .map((order) => {
      const item = firstOrderItem(order);
      return {
        id: `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`,
        buyer: order.buyer_company || order.buyer_name || 'Buyer account',
        product: item?.product_name || 'Bulk fabric order',
        qty: item?.quantity_mtrs ? `${item.quantity_mtrs} mtrs` : 'Quantity pending',
        amount: formatMoney(order.net_total),
        expiresIn: 'Awaiting response',
        stock: 0,
        reserved: item?.quantity_mtrs || 0,
      };
    });
  const statCards = [
    {
      label: 'New Order Requests',
      value: String(accountOrders.filter((order) => order.status === 'quote_sent').length),
      icon: 'InboxIcon',
      color: 'text-primary',
      bg: 'bg-primary/10 border-primary/20',
    },
    {
      label: 'Requests Expiring',
      value: String(accountOrders.filter((order) => order.status === 'paid').length),
      icon: 'ClockIcon',
      color: 'text-error',
      bg: 'bg-error/10 border-error/20',
    },
    {
      label: 'Orders to Pack',
      value: String(accountOrders.filter((order) => order.status === 'shipped').length),
      icon: 'ArchiveBoxIcon',
      color: 'text-warning',
      bg: 'bg-amber-50 border-amber-200',
    },
    {
      label: 'In Transit',
      value: '0',
      icon: 'TruckIcon',
      color: 'text-purple-600',
      bg: 'bg-purple-50 border-purple-200',
    },
    {
      label: 'Sales This Month',
      value: formatMoney(
        accountOrders.reduce((sum, order) => sum + Number(order.net_total || 0), 0)
      ),
      icon: 'CurrencyRupeeIcon',
      color: 'text-success',
      bg: 'bg-green-50 border-green-200',
    },
    {
      label: 'Pending Settlement',
      value: '₹0',
      icon: 'BanknotesIcon',
      color: 'text-secondary',
      bg: 'bg-secondary/10 border-secondary/20',
    },
    {
      label: 'Acceptance Rate',
      value: '—',
      icon: 'CheckCircleIcon',
      color: 'text-success',
      bg: 'bg-green-50 border-green-200',
    },
    {
      label: 'Avg Response Time',
      value: '—',
      icon: 'BoltIcon',
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-800 text-foreground">Seller Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {sellerName} · {sellerRef}
        </p>
      </div>

      {/* Urgent Alert */}
      {urgentOrders.length > 0 && (
        <div className="mb-5 p-4 bg-error/10 border border-error/25 rounded-2xl flex items-start gap-3">
          <Icon name="ExclamationTriangleIcon" size={20} className="text-error shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-700 text-error">2 order requests expiring soon!</p>
            <p className="text-xs text-muted-foreground">
              Respond before the timer expires to avoid rejection and performance impact.
            </p>
          </div>
          <button
            onClick={() => onNavigate('orders')}
            className="ml-auto btn-primary px-3 py-1.5 text-xs rounded-xl shrink-0"
          >
            Respond Now
          </button>
        </div>
      )}

      {/* Stat Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className={`stat-card border ${card.bg} relative`}>
            <Icon name={card.icon as 'InboxIcon'} size={20} className={`${card.color} mb-2`} />
            <p className={`text-2xl font-800 ${card.color} mb-0.5`}>{card.value}</p>
            <p className="text-xs text-muted-foreground font-500 leading-tight">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Urgent Order Queue */}
      <div className="bg-card rounded-2xl border border-border mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-800 text-foreground text-sm flex items-center gap-2">
            <Icon name="ClockIcon" size={16} className="text-error" />
            Urgent Order Requests
          </h2>
          <button
            onClick={() => onNavigate('orders')}
            className="text-xs text-primary font-600 hover:underline"
          >
            View All
          </button>
        </div>
        {urgentOrders.length > 0 ? (
          <div className="divide-y divide-border">
            {urgentOrders.map((order) => (
              <div key={order.id} className="px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="mono-id">{order.id}</span>
                      <span className="flex items-center gap-1 text-xs font-700 text-error">
                        <Icon name="ClockIcon" size={12} />
                        Expires in {order.expiresIn}
                      </span>
                    </div>
                    <p className="text-sm font-700 text-foreground">{order.buyer}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.product} · {order.qty}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Stock: {order.stock.toLocaleString('en-IN')} mtrs</span>
                      <span>Reserved: {order.reserved} mtrs</span>
                      <span>
                        Available: {(order.stock - order.reserved).toLocaleString('en-IN')} mtrs
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                    <p className="text-base font-800 text-foreground">{order.amount}</p>
                    <div className="flex gap-2">
                      <button className="bg-success/10 border border-success/30 text-success text-xs font-700 px-3 py-1.5 rounded-xl hover:bg-success hover:text-white transition-all">
                        ✓ Accept
                      </button>
                      <button className="bg-muted border border-border text-muted-foreground text-xs font-700 px-3 py-1.5 rounded-xl hover:border-primary transition-all">
                        Counter
                      </button>
                      <button className="bg-error/10 border border-error/20 text-error text-xs font-700 px-3 py-1.5 rounded-xl hover:bg-error hover:text-white transition-all">
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <Icon name="InboxIcon" size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-800 text-foreground">No order requests for this seller</p>
            <p className="text-xs text-muted-foreground mt-1">
              Buyer requests will appear here only when they are assigned to this account.
            </p>
          </div>
        )}
      </div>

      {/* Low Stock Alert */}
      <div className="bg-card rounded-2xl border border-error/30 mb-6">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Icon name="ExclamationTriangleIcon" size={16} className="text-error" />
          <h2 className="font-800 text-foreground text-sm">Low Stock Alerts</h2>
          <span className="bg-error text-white text-xs font-700 px-1.5 py-0.5 rounded-full ml-auto">
            {lowStockItems.length} products
          </span>
        </div>
        {lowStockItems.length > 0 ? (
          <div className="divide-y divide-border">
            {lowStockItems.map((item) => (
              <div key={item.name} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-700 text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Current: {item.current} {item.unit} · Minimum: {item.minimum} {item.unit}
                  </p>
                </div>
                <div className="text-right">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-error rounded-full"
                      style={{ width: `${Math.min((item.current / item.minimum) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-error font-700">
                    {Math.round((item.current / item.minimum) * 100)}% of min
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <Icon name="ArchiveBoxIcon" size={30} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-800 text-foreground">No low-stock alerts</p>
            <p className="text-xs text-muted-foreground mt-1">
              Inventory alerts will be calculated only from this seller's catalog.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
