'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useSellerBulkOrders } from '@/lib/hooks/useAccountOrders';

type CatalogOrder = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
};

type DailyRow = {
  key: string;
  date: string;
  orders: number;
  gmv: number;
};

const paidStatuses = new Set(['paid', 'fulfilled', 'shipped', 'delivered']);
const acceptedStatuses = new Set(['accepted', 'paid', 'fulfilled', 'confirmed', 'shipped', 'delivered']);
const rejectedStatuses = new Set(['rejected', 'cancelled']);

const formatINR = (value: number) => {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
};

const dateKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const labelFor = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export default function SellerAnalytics() {
  const { user } = useAuth();
  const { orders: bulkOrders, loading: bulkLoading } = useSellerBulkOrders();
  const [catalogOrders, setCatalogOrders] = useState<CatalogOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartType, setChartType] = useState<'orders' | 'gmv'>('orders');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!user?.id) {
      setCatalogOrders([]);
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
      setCatalogOrders([]);
      setLoading(false);
      return;
    }
    const { data, error: orderError } = await supabase
      .from('catalog_order_requests')
      .select('id,status,total_amount,created_at')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: true })
      .limit(5000);
    if (orderError) {
      setError(orderError.message);
      setCatalogOrders([]);
    } else {
      setCatalogOrders((data || []) as CatalogOrder[]);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const allOrders = useMemo(() => {
    const catalog = catalogOrders.map((order) => ({
      id: order.id,
      status: String(order.status || ''),
      amount: Number(order.total_amount || 0),
      createdAt: order.created_at,
      kind: 'Catalogue' as const,
    }));
    const bulk = bulkOrders.map((order) => ({
      id: order.id,
      status: String(order.status || ''),
      amount: Number(order.net_total || 0),
      createdAt: String(order.created_at || order.updated_at || ''),
      kind: 'Bulk' as const,
    }));
    return [...catalog, ...bulk].filter((order) => order.createdAt && !Number.isNaN(new Date(order.createdAt).getTime()));
  }, [bulkOrders, catalogOrders]);

  const filteredOrders = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return allOrders.filter((order) => {
      const time = new Date(order.createdAt).getTime();
      return time >= from && time <= to;
    });
  }, [allOrders, dateFrom, dateTo]);

  const daily = useMemo<DailyRow[]>(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(Date.now() - 29 * 86400000);
    const to = dateTo ? new Date(`${dateTo}T00:00:00`) : new Date();
    const start = from.getTime() <= to.getTime() ? from : to;
    const end = from.getTime() <= to.getTime() ? to : from;
    const rows = new Map<string, DailyRow>();
    for (let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate()); cursor.getTime() <= end.getTime(); cursor.setDate(cursor.getDate() + 1)) {
      const key = dateKey(cursor);
      rows.set(key, { key, date: labelFor(key), orders: 0, gmv: 0 });
    }
    filteredOrders.forEach((order) => {
      const key = dateKey(order.createdAt);
      const row = rows.get(key);
      if (!row) return;
      row.orders += 1;
      if (paidStatuses.has(order.status)) row.gmv += order.amount;
    });
    return [...rows.values()];
  }, [dateFrom, dateTo, filteredOrders]);

  const totalOrders = filteredOrders.length;
  const paidOrders = filteredOrders.filter((order) => paidStatuses.has(order.status));
  const totalGMV = paidOrders.reduce((sum, order) => sum + order.amount, 0);
  const avgOrderValue = paidOrders.length ? totalGMV / paidOrders.length : 0;
  const decided = filteredOrders.filter((order) => acceptedStatuses.has(order.status) || rejectedStatuses.has(order.status));
  const accepted = decided.filter((order) => acceptedStatuses.has(order.status));
  const acceptanceRate = decided.length ? Math.round((accepted.length / decided.length) * 100) : null;

  const exportRows = filteredOrders.map((order) => ({
    'Order ID': order.id,
    Type: order.kind,
    Date: new Date(order.createdAt).toLocaleString('en-IN'),
    Status: order.status,
    'Order value (₹)': order.amount,
    'Captured GMV (₹)': paidStatuses.has(order.status) ? order.amount : 0,
  }));

  const busy = loading || bulkLoading;

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="ft-route-kicker">Analytics</p>
          <h1 className="mt-1 text-2xl font-800 text-foreground">Sales analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Calculated from this seller&apos;s real catalogue and bulk orders. No sample GMV or order counts are used.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2">
            <Icon name="CalendarIcon" size={14} className="text-muted-foreground" />
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-28 bg-transparent text-xs outline-none" />
            <span className="text-xs text-muted-foreground">–</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-28 bg-transparent text-xs outline-none" />
          </div>
          <div className="relative">
            <button type="button" onClick={() => setShowExportMenu((value) => !value)} disabled={!exportRows.length} className="btn-secondary flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs disabled:opacity-50">
              <Icon name="ArrowDownTrayIcon" size={14} /> Export <Icon name="ChevronDownIcon" size={12} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <button type="button" onClick={() => { exportToCSV(exportRows, 'seller_analytics'); setShowExportMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-700 hover:bg-muted"><Icon name="DocumentTextIcon" size={14} /> Export CSV</button>
                <button type="button" onClick={() => { exportToExcel(exportRows, 'seller_analytics'); setShowExportMenu(false); }} className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-xs font-700 hover:bg-muted"><Icon name="TableCellsIcon" size={14} /> Export Excel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="mb-5 rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total orders', busy ? '—' : totalOrders.toLocaleString('en-IN'), 'ShoppingBagIcon', 'text-primary'],
          ['Captured GMV', busy ? '—' : formatINR(totalGMV), 'CurrencyRupeeIcon', 'text-success'],
          ['Avg paid order', busy ? '—' : formatINR(avgOrderValue), 'ChartBarIcon', 'text-secondary'],
          ['Acceptance rate', busy ? '—' : acceptanceRate === null ? '—' : `${acceptanceRate}%`, 'CheckCircleIcon', 'text-warning'],
        ].map(([label, value, icon, color]) => (
          <div key={String(label)} className="rounded-2xl border border-border bg-card p-4">
            <Icon name={String(icon)} size={20} className={String(color)} />
            <p className={`mt-3 text-2xl font-800 ${color}`}>{value}</p>
            <p className="mt-1 text-xs font-700 text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-800 text-foreground">Order volume & captured sales</h2><p className="mt-1 text-xs text-muted-foreground">GMV includes only paid/fulfilled/shipped/delivered orders.</p></div>
          <div className="flex rounded-xl bg-muted p-1">
            <button type="button" onClick={() => setChartType('orders')} className={`rounded-lg px-3 py-1.5 text-xs font-700 ${chartType === 'orders' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Orders</button>
            <button type="button" onClick={() => setChartType('gmv')} className={`rounded-lg px-3 py-1.5 text-xs font-700 ${chartType === 'gmv' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>GMV</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          {chartType === 'orders' ? (
            <BarChart data={daily} barSize={9}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => [value, 'Orders']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} /><Bar dataKey="orders" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} /><YAxis tickFormatter={formatINR} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => [formatINR(value), 'Captured GMV']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} /><Line type="monotone" dataKey="gmv" stroke="var(--success)" strokeWidth={2.5} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
        {!busy && totalOrders === 0 && <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center"><p className="text-sm font-800">No seller orders in this period</p><p className="mt-1 text-xs text-muted-foreground">Charts will populate automatically when real buyers place orders.</p></div>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-800 text-foreground">Status health</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-primary/5 p-4"><p className="text-xs text-muted-foreground">Accepted / progressing</p><p className="mt-1 text-xl font-800 text-primary">{accepted.length}</p></div>
          <div className="rounded-xl bg-error/5 p-4"><p className="text-xs text-muted-foreground">Rejected / cancelled</p><p className="mt-1 text-xl font-800 text-error">{decided.length - accepted.length}</p></div>
          <div className="rounded-xl bg-success/5 p-4"><p className="text-xs text-muted-foreground">Paid / fulfilled</p><p className="mt-1 text-xl font-800 text-success">{paidOrders.length}</p></div>
        </div>
      </section>
    </div>
  );
}
