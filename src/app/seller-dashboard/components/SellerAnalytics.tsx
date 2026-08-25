'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, RadialBarChart, RadialBar, PieChart, Pie, Cell } from 'recharts';
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
  updated_at?: string;
};

type DailyRow = {
  key: string;
  date: string;
  orders: number;
  gmv: number;
};

const paidStatuses = new Set(['paid', 'fulfilled', 'shipped', 'delivered']);
const acceptedStatuses = new Set(['accepted', 'paid', 'fulfilled', 'confirmed', 'shipped', 'delivered']);
const cancelledStatuses = new Set(['rejected', 'cancelled']);
const fulfilledStatuses = new Set(['fulfilled', 'shipped', 'delivered']);

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

const SENTIMENT_COLORS = { positive: '#10b981', neutral: '#f59e0b', negative: '#ef4444' };

// Simulated sentiment analysis from order statuses (in production, this would come from actual reviews)
function deriveSentimentFromOrders(orders: { status: string; amount: number }[]) {
  const total = orders.length;
  if (total === 0) return { positive: 0, neutral: 0, negative: 0, score: 0 };
  const fulfilled = orders.filter((o) => fulfilledStatuses.has(o.status)).length;
  const cancelled = orders.filter((o) => cancelledStatuses.has(o.status)).length;
  const pending = total - fulfilled - cancelled;
  const positiveRate = total > 0 ? fulfilled / total : 0;
  const negativeRate = total > 0 ? cancelled / total : 0;
  return {
    positive: Math.round(positiveRate * 100),
    neutral: Math.round((pending / total) * 100),
    negative: Math.round(negativeRate * 100),
    score: Math.round(positiveRate * 5 * 10) / 10,
  };
}

type AnalyticsTab = 'sales' | 'reputation';

export default function SellerAnalytics() {
  const { user } = useAuth();
  const { orders: bulkOrders, loading: bulkLoading } = useSellerBulkOrders();
  const [catalogOrders, setCatalogOrders] = useState<CatalogOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('sales');
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
      .select('id,status,total_amount,created_at,updated_at')
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
      updatedAt: order.updated_at || order.created_at,
      kind: 'Catalogue' as const,
    }));
    const bulk = bulkOrders.map((order) => ({
      id: order.id,
      status: String(order.status || ''),
      amount: Number(order.net_total || 0),
      createdAt: String(order.created_at || order.updated_at || ''),
      updatedAt: String(order.updated_at || order.created_at || ''),
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

  // Reputation metrics
  const reputationMetrics = useMemo(() => {
    const total = filteredOrders.length;
    const fulfilled = filteredOrders.filter((o) => fulfilledStatuses.has(o.status)).length;
    const cancelled = filteredOrders.filter((o) => cancelledStatuses.has(o.status)).length;
    const accepted = filteredOrders.filter((o) => acceptedStatuses.has(o.status)).length;

    // Fulfillment rate
    const fulfillmentRate = total > 0 ? Math.round((fulfilled / total) * 100) : 0;

    // Cancellation rate
    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

    // Average response time (simulated from created_at → updated_at delta for decided orders)
    const decidedOrders = filteredOrders.filter((o) =>
      acceptedStatuses.has(o.status) || cancelledStatuses.has(o.status)
    );
    let avgResponseHours = 0;
    if (decidedOrders.length > 0) {
      const totalHours = decidedOrders.reduce((sum, o) => {
        const created = new Date(o.createdAt).getTime();
        const updated = new Date(o.updatedAt).getTime();
        const diffHours = Math.max(0, (updated - created) / 3600000);
        return sum + Math.min(diffHours, 72); // cap at 72h for outliers
      }, 0);
      avgResponseHours = Math.round(totalHours / decidedOrders.length);
    }

    // Sentiment from order outcomes
    const sentiment = deriveSentimentFromOrders(filteredOrders);

    // Reputation score (weighted)
    const reputationScore = total > 0
      ? Math.round(((fulfillmentRate * 0.4) + ((100 - cancellationRate) * 0.3) + (sentiment.positive * 0.3)) / 10) / 10
      : 0;

    return {
      fulfillmentRate,
      cancellationRate,
      avgResponseHours,
      sentiment,
      reputationScore,
      total,
      fulfilled,
      cancelled,
      accepted,
    };
  }, [filteredOrders]);

  // Sentiment trend (last 6 months)
  const sentimentTrend = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months.map((monthKey) => {
      const monthOrders = allOrders.filter((o) => o.createdAt.startsWith(monthKey));
      const s = deriveSentimentFromOrders(monthOrders);
      const label = new Date(`${monthKey}-01`).toLocaleDateString('en-IN', { month: 'short' });
      return { month: label, positive: s.positive, neutral: s.neutral, negative: s.negative, score: s.score };
    });
  }, [allOrders]);

  const totalOrders = filteredOrders.length;
  const paidOrders = filteredOrders.filter((order) => paidStatuses.has(order.status));
  const totalGMV = paidOrders.reduce((sum, order) => sum + order.amount, 0);
  const avgOrderValue = paidOrders.length ? totalGMV / paidOrders.length : 0;
  const decided = filteredOrders.filter((order) => acceptedStatuses.has(order.status) || cancelledStatuses.has(order.status));
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

  const sentimentPieData = [
    { name: 'Positive', value: reputationMetrics.sentiment.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: reputationMetrics.sentiment.neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: reputationMetrics.sentiment.negative, color: SENTIMENT_COLORS.negative },
  ].filter((d) => d.value > 0);

  const reputationRadialData = [{ name: 'Score', value: reputationMetrics.reputationScore * 20, fill: '#008060' }];

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

      {/* Tab switcher */}
      <div className="mb-6 flex rounded-xl border border-border bg-muted p-1 w-fit">
        <button type="button" onClick={() => setActiveTab('sales')} className={`rounded-lg px-5 py-2 text-xs font-700 transition ${activeTab === 'sales' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
          Sales
        </button>
        <button type="button" onClick={() => setActiveTab('reputation')} className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-700 transition ${activeTab === 'reputation' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
          <Icon name="StarIcon" size={12} /> Reputation
        </button>
      </div>

      {error && <div className="mb-5 rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>}

      {activeTab === 'sales' && (
        <>
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
        </>
      )}

      {activeTab === 'reputation' && (
        <div className="space-y-5">
          {/* Reputation Score + KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Reputation Score */}
            <div className="col-span-full sm:col-span-1 rounded-2xl border border-border bg-card p-5 flex flex-col items-center justify-center">
              <p className="mb-2 text-xs font-700 text-muted-foreground">Reputation Score</p>
              <ResponsiveContainer width={120} height={120}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={reputationRadialData} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'var(--muted)' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <p className="mt-1 text-3xl font-800 text-foreground">{busy ? '—' : reputationMetrics.reputationScore.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">out of 5.0</p>
            </div>

            {/* KPI cards */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                  <Icon name="CheckCircleIcon" size={16} className="text-success" />
                </div>
                <p className="text-xs font-700 text-muted-foreground">Fulfillment Rate</p>
              </div>
              <p className="text-3xl font-800 text-success">{busy ? '—' : `${reputationMetrics.fulfillmentRate}%`}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${reputationMetrics.fulfillmentRate}%` }} />
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">{reputationMetrics.fulfilled} of {reputationMetrics.total} orders fulfilled</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Icon name="ClockIcon" size={16} className="text-primary" />
                </div>
                <p className="text-xs font-700 text-muted-foreground">Avg Response Time</p>
              </div>
              <p className="text-3xl font-800 text-primary">
                {busy ? '—' : reputationMetrics.avgResponseHours === 0 ? 'N/A' : reputationMetrics.avgResponseHours < 24 ? `${reputationMetrics.avgResponseHours}h` : `${Math.round(reputationMetrics.avgResponseHours / 24)}d`}
              </p>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {reputationMetrics.avgResponseHours <= 12 ? '✅ Excellent response time' : reputationMetrics.avgResponseHours <= 24 ? '🟡 Good — aim for under 12h' : '🔴 Slow — respond faster to boost score'}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-error/10">
                  <Icon name="XCircleIcon" size={16} className="text-error" />
                </div>
                <p className="text-xs font-700 text-muted-foreground">Cancellation Rate</p>
              </div>
              <p className={`text-3xl font-800 ${reputationMetrics.cancellationRate <= 5 ? 'text-success' : reputationMetrics.cancellationRate <= 15 ? 'text-warning' : 'text-error'}`}>
                {busy ? '—' : `${reputationMetrics.cancellationRate}%`}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full transition-all ${reputationMetrics.cancellationRate <= 5 ? 'bg-success' : reputationMetrics.cancellationRate <= 15 ? 'bg-warning' : 'bg-error'}`} style={{ width: `${Math.min(reputationMetrics.cancellationRate, 100)}%` }} />
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">{reputationMetrics.cancelled} cancelled of {reputationMetrics.total} orders</p>
            </div>
          </div>

          {/* Sentiment Analysis */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-1 text-sm font-800 text-foreground">Customer Feedback Sentiment</h2>
              <p className="mb-4 text-xs text-muted-foreground">Derived from order outcomes — fulfilled orders indicate positive buyer experience</p>
              {reputationMetrics.total === 0 ? (
                <div className="flex h-40 items-center justify-center">
                  <p className="text-sm text-muted-foreground">No orders to analyse yet</p>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={sentimentPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                        {sentimentPieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value}%`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 flex-1">
                    {[
                      { label: 'Positive', value: reputationMetrics.sentiment.positive, color: SENTIMENT_COLORS.positive, icon: '😊' },
                      { label: 'Neutral', value: reputationMetrics.sentiment.neutral, color: SENTIMENT_COLORS.neutral, icon: '😐' },
                      { label: 'Negative', value: reputationMetrics.sentiment.negative, color: SENTIMENT_COLORS.negative, icon: '😞' },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-3">
                        <span className="text-base">{s.icon}</span>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-700 text-foreground">{s.label}</span>
                            <span className="text-xs font-700" style={{ color: s.color }}>{s.value}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full transition-all" style={{ width: `${s.value}%`, backgroundColor: s.color }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Sentiment Trend */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-1 text-sm font-800 text-foreground">Sentiment Trend (6 months)</h2>
              <p className="mb-4 text-xs text-muted-foreground">Monthly positive sentiment score based on order fulfillment</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={sentimentTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Positive']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
                  <Line type="monotone" dataKey="positive" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </section>
          </div>

          {/* Reputation Tips */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-800 text-foreground">Improve Your Reputation Score</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { tip: 'Respond to orders within 12 hours', icon: 'ClockIcon', color: 'text-primary', bg: 'bg-primary/5' },
                { tip: 'Dispatch within 2 business days of confirmation', icon: 'TruckIcon', color: 'text-success', bg: 'bg-success/5' },
                { tip: 'Keep cancellation rate below 5%', icon: 'XCircleIcon', color: 'text-error', bg: 'bg-error/5' },
                { tip: 'Add 5+ product photos for better buyer confidence', icon: 'PhotoIcon', color: 'text-warning', bg: 'bg-warning/5' },
              ].map((item) => (
                <div key={item.tip} className={`flex items-start gap-3 rounded-xl p-3 ${item.bg}`}>
                  <Icon name={item.icon as 'ClockIcon'} size={16} className={`mt-0.5 shrink-0 ${item.color}`} />
                  <p className="text-xs text-foreground">{item.tip}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
