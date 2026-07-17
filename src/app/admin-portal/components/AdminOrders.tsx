'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

const orders = [
  {
    id: 'FT-ORD-005892', buyer: 'Mehta Garments', seller: 'Surat Textile Mills',
    product: 'Pure Dyeable Soft Nett', qty: '300 mtrs', amount: '₹2,52,000',
    commission: '₹12,600', status: 'confirmed', payment: 'paid', shipment: 'awaiting',
    date: '17 Jul 2026', city: 'Mumbai',
  },
  {
    id: 'FT-ORD-005855', buyer: 'Sharma Brothers', seller: 'Jaipur Crafts',
    product: 'Georgette Embroidered', qty: '75 mtrs', amount: '₹93,750',
    commission: '₹4,688', status: 'shipped', payment: 'paid', shipment: 'in_transit',
    date: '16 Jul 2026', city: 'Delhi',
  },
  {
    id: 'FT-ORD-005801', buyer: 'Patel Textiles', seller: 'Mumbai Fabric Zone',
    product: 'Polyester Crepe', qty: '500 mtrs', amount: '₹1,60,000',
    commission: '₹8,000', status: 'pending', payment: 'pending', shipment: 'none',
    date: '15 Jul 2026', city: 'Ahmedabad',
  },
  {
    id: 'FT-ORD-005720', buyer: 'Kapoor Exports', seller: 'Varanasi Silk Traders',
    product: 'Banarasi Silk Brocade', qty: '20 mtrs', amount: '₹64,000',
    commission: '₹3,200', status: 'delivered', payment: 'settled', shipment: 'delivered',
    date: '10 Jul 2026', city: 'Surat',
  },
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: 'order-status-pending', confirmed: 'order-status-confirmed',
    shipped: 'order-status-shipped', delivered: 'order-status-delivered',
    cancelled: 'order-status-cancelled',
  };
  return map[status] || 'order-status-pending';
};

export default function AdminOrders() {
  const [search, setSearch] = useState('');

  const filtered = orders.filter((o) =>
    o.id.toLowerCase().includes(search.toLowerCase()) ||
    o.buyer.toLowerCase().includes(search.toLowerCase()) ||
    o.seller.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-800 text-foreground">Order Management</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 flex-1 sm:flex-none sm:w-64">
            <Icon name="MagnifyingGlassIcon" size={16} className="text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders..."
              className="bg-transparent text-sm text-foreground outline-none flex-1 min-w-0 placeholder:text-muted-foreground"
            />
          </div>
          <button className="flex items-center gap-1.5 btn-secondary px-3 py-2 text-xs rounded-xl">
            <Icon name="ArrowDownTrayIcon" size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground">Order ID</th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground hidden sm:table-cell">Buyer / Seller</th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground hidden md:table-cell">Product</th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground hidden lg:table-cell">Commission</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="mono-id">{order.id}</p>
                    <p className="text-xs text-muted-foreground">{order.date}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs font-700 text-foreground">{order.buyer}</p>
                    <p className="text-xs text-muted-foreground">↑ {order.seller}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-xs font-600 text-foreground">{order.product}</p>
                    <p className="text-xs text-muted-foreground">{order.qty}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-800 text-foreground">{order.amount}</p>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <p className="text-sm font-700 text-primary">{order.commission}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 ${statusBadge(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button className="bg-muted border border-border text-xs px-2 py-1 rounded-lg font-600 text-foreground hover:border-primary transition-colors">
                        View
                      </button>
                      <button className="bg-muted border border-border p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                        <Icon name="EllipsisVerticalIcon" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}