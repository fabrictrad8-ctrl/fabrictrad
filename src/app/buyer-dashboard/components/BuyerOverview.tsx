'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';

type DashTab = 'overview' | 'orders' | 'tracking' | 'wishlist' | 'account';

interface Props {
  onNavigate: (tab: DashTab) => void;
}

const statCards = [
  { label: 'Pending Confirmations', value: '3', icon: 'ClockIcon', color: 'text-warning', bg: 'bg-amber-50 border-amber-200' },
  { label: 'Active Shipments', value: '2', icon: 'TruckIcon', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  { label: 'Orders This Month', value: '8', icon: 'ShoppingBagIcon', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
  { label: 'Total Spent (MTD)', value: '₹4.2L', icon: 'CurrencyRupeeIcon', color: 'text-success', bg: 'bg-green-50 border-green-200' },
];

const recentOrders = [
  {
    id: 'FT-ORD-004521',
    product: 'Pure Dyeable Soft Nett Fabric',
    seller: 'Surat Textile Mills',
    qty: '200 mtrs',
    amount: '₹1,68,000',
    status: 'confirmed',
    statusLabel: 'Seller Confirmed',
    date: '16 Jul 2026',
  },
  {
    id: 'FT-ORD-004489',
    product: 'Georgette Embroidered Fabric',
    seller: 'Jaipur Crafts Emporium',
    qty: '50 mtrs',
    amount: '₹62,500',
    status: 'shipped',
    statusLabel: 'In Transit',
    date: '14 Jul 2026',
  },
  {
    id: 'FT-ORD-004401',
    product: 'Cotton Cambric Fabric',
    seller: 'Bhiwandi Weave House',
    qty: '300 mtrs',
    amount: '₹55,500',
    status: 'pending',
    statusLabel: 'Awaiting Seller',
    date: '13 Jul 2026',
  },
];

export default function BuyerOverview({ onNavigate }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-800 text-foreground">Good morning, Rajesh 👋</h1>
        <p className="text-sm text-muted-foreground">Here's your procurement summary for today</p>
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
          <button onClick={() => onNavigate('orders')} className="text-xs text-primary font-600 hover:underline">View All</button>
        </div>
        <div className="divide-y divide-border">
          {recentOrders.map((order) => (
            <div key={order.id} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="mono-id">{order.id}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 order-status-${order.status}`}>
                    {order.statusLabel}
                  </span>
                </div>
                <p className="text-sm font-600 text-foreground truncate">{order.product}</p>
                <p className="text-xs text-muted-foreground">{order.seller} · {order.qty} · {order.date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-800 text-foreground">{order.amount}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Shipment Preview */}
      <div className="bg-card rounded-2xl border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-800 text-foreground text-sm">Active Shipment</h2>
          <button onClick={() => onNavigate('tracking')} className="text-xs text-primary font-600 hover:underline">Track All</button>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-700 text-foreground">Georgette Embroidered Fabric</p>
              <p className="text-xs text-muted-foreground">AWB: SR24071600421 · Shiprocket</p>
            </div>
            <span className="text-xs bg-purple-100 text-purple-700 font-700 px-2.5 py-1 rounded-full">In Transit</span>
          </div>

          {/* Mini tracking steps */}
          <div className="flex items-center gap-0">
            {['Confirmed', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'].map((step, i) => {
              const done = i < 3;
              const active = i === 2;
              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      done && !active ? 'tracking-step-done' : active ? 'tracking-step-active' : 'tracking-step-pending'
                    }`}>
                      {done && !active ? <Icon name="CheckIcon" size={12} /> : <span className="text-xs font-700">{i + 1}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:block text-center leading-tight" style={{ fontSize: '0.6rem', maxWidth: '56px' }}>{step}</span>
                  </div>
                  {i < 4 && <div className={`flex-1 h-0.5 mx-1 ${i < 2 ? 'bg-success' : 'bg-border'}`} />}
                </React.Fragment>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            <span className="font-700 text-foreground">EDD: 19 Jul 2026</span> · Last updated: Mumbai Hub, 14 Jul 2026 at 09:30 AM
          </p>
        </div>
      </div>
    </div>
  );
}