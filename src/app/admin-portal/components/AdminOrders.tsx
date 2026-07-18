'use client';
import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';
import { createClient } from '@/lib/supabase/client';

type AdminOrderRow = {
  id: string;
  buyer: string;
  seller: string;
  product: string;
  qty: string;
  amount: string;
  commission: string;
  status: string;
  payment: string;
  shipment: string;
  date: string;
  city: string;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: 'order-status-pending',
    confirmed: 'order-status-confirmed',
    shipped: 'order-status-shipped',
    delivered: 'order-status-delivered',
    cancelled: 'order-status-cancelled',
  };
  return map[status] || 'order-status-pending';
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadOrders() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('orders')
        .select('id,order_ref,buyer_id,seller_id,status,total_amount,created_at,shipping_address')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!mounted) return;
      setOrders(
        (data || []).map((order) => {
          const amount = Number(order.total_amount || 0);
          return {
            id: order.order_ref || `FT-ORD-${String(order.id).slice(0, 8).toUpperCase()}`,
            buyer: order.buyer_id ? `Buyer ${String(order.buyer_id).slice(0, 8)}` : 'Buyer',
            seller: order.seller_id ? `Seller ${String(order.seller_id).slice(0, 8)}` : 'Seller',
            product: 'Order items',
            qty: 'See order details',
            amount: `₹${amount.toLocaleString('en-IN')}`,
            commission: `₹${Math.round(amount * 0.1).toLocaleString('en-IN')}`,
            status: order.status || 'pending',
            payment: 'See payments tab',
            shipment: 'See fulfillment tab',
            date: order.created_at?.slice(0, 10) || '',
            city:
              typeof order.shipping_address === 'object' &&
              order.shipping_address &&
              'city' in order.shipping_address
                ? String(order.shipping_address.city || '')
                : '',
          };
        })
      );
      setLoading(false);
    }

    loadOrders();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.buyer.toLowerCase().includes(search.toLowerCase()) ||
      o.seller.toLowerCase().includes(search.toLowerCase());
    const d = new Date(o.date);
    const matchFrom = dateFrom ? d >= new Date(dateFrom) : true;
    const matchTo = dateTo ? d <= new Date(dateTo) : true;
    return matchSearch && matchFrom && matchTo;
  });

  const getExportData = () =>
    filtered.map((o) => ({
      'Order ID': o.id,
      Buyer: o.buyer,
      Seller: o.seller,
      Product: o.product,
      Qty: o.qty,
      Amount: o.amount,
      Commission: o.commission,
      Status: o.status,
      Payment: o.payment,
      Shipment: o.shipment,
      Date: o.date,
      City: o.city,
    }));

  const handleExportCSV = () => {
    exportToCSV(getExportData(), `orders_${dateFrom || 'all'}_to_${dateTo || 'all'}`);
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    exportToExcel(getExportData(), `orders_${dateFrom || 'all'}_to_${dateTo || 'all'}`);
    setShowExportMenu(false);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-800 text-foreground">Order Management</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range */}
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2">
            <Icon name="CalendarIcon" size={14} className="text-muted-foreground" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-xs text-foreground outline-none w-28"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-xs text-foreground outline-none w-28"
            />
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 flex-1 sm:flex-none sm:w-52">
            <Icon name="MagnifyingGlassIcon" size={16} className="text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders..."
              className="bg-transparent text-sm text-foreground outline-none flex-1 min-w-0 placeholder:text-muted-foreground"
            />
          </div>
          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 btn-secondary px-3 py-2 text-xs rounded-xl"
            >
              <Icon name="ArrowDownTrayIcon" size={14} />
              Export
              <Icon name="ChevronDownIcon" size={12} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-10 min-w-[140px]">
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-600 text-foreground hover:bg-muted transition-colors rounded-t-xl"
                >
                  <Icon name="DocumentTextIcon" size={14} className="text-success" />
                  Export CSV
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-600 text-foreground hover:bg-muted transition-colors rounded-b-xl border-t border-border"
                >
                  <Icon name="TableCellsIcon" size={14} className="text-primary" />
                  Export Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Result count */}
      <p className="text-xs text-muted-foreground mb-3">
        {loading ? 'Loading orders...' : `Showing ${filtered.length} of ${orders.length} orders`}
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            className="ml-2 text-primary hover:underline"
          >
            Clear filter
          </button>
        )}
      </p>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground">
                  Order ID
                </th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground hidden sm:table-cell">
                  Buyer / Seller
                </th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground hidden md:table-cell">
                  Product
                </th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground">
                  Amount
                </th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground hidden lg:table-cell">
                  Commission
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Status
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Actions
                </th>
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
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 ${statusBadge(order.status)}`}
                    >
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {loading ? 'Loading order records...' : 'No live orders found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
