'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

type SeriesPoint = {
  date: string;
  orders: number;
  gmv: number;
  commission: number;
  newBuyers: number;
  newSellers: number;
};

type TopSeller = { sellerId: string; name: string; orders: number; gmv: number; commission: number };
type CategoryRow = { category: string; listings: number; activeListings: number };
type PaymentMethodRow = { method: string; count: number; amount: number };

type AnalyticsResponse = {
  generatedAt?: string;
  days?: number;
  series?: SeriesPoint[];
  topSellers?: TopSeller[];
  categoryMix?: CategoryRow[];
  paymentMethodMix?: PaymentMethodRow[];
  error?: string;
};

const RANGE_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
] as const;

const PIE_COLORS = ['var(--primary)', 'var(--secondary)', 'var(--success)', 'var(--warning)', 'var(--error)', 'var(--muted-foreground)'];

const formatINR = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
};

const shortDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

const chartTooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 };
const axisTick = { fontSize: 10, fill: 'var(--muted-foreground)' };

export default function AdminAnalyticsCharts() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/analytics?days=${range}`, { cache: 'no-store', credentials: 'same-origin' });
      const payload = (await response.json().catch(() => ({}))) as AnalyticsResponse;
      if (!response.ok) throw new Error(payload.error || 'Live analytics could not be loaded.');
      setData(payload);
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : 'Live analytics could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const series = useMemo(
    () => (data?.series || []).map((point) => ({ ...point, label: shortDate(point.date) })),
    [data]
  );
  const topSellers = data?.topSellers || [];
  const categoryMix = data?.categoryMix || [];
  const paymentMethodMix = data?.paymentMethodMix || [];

  const totals = useMemo(
    () =>
      series.reduce(
        (acc, point) => ({
          orders: acc.orders + point.orders,
          gmv: acc.gmv + point.gmv,
          commission: acc.commission + point.commission,
          newBuyers: acc.newBuyers + point.newBuyers,
          newSellers: acc.newSellers + point.newSellers,
        }),
        { orders: 0, gmv: 0, commission: 0, newBuyers: 0, newSellers: 0 }
      ),
    [series]
  );

  const exportSeries = () => series.map((point) => ({
    Date: point.date,
    Orders: point.orders,
    'GMV (₹)': point.gmv,
    'Commission (₹)': point.commission,
    'New buyers': point.newBuyers,
    'New sellers': point.newSellers,
  }));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-800 text-success">Live marketplace analytics</span>
              {data?.generatedAt && (
                <span className="text-xs text-muted-foreground">Updated {new Date(data.generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              )}
            </div>
            <h1 className="mt-3 text-xl font-800 text-foreground">Marketplace performance</h1>
            <p className="mt-1 text-sm text-muted-foreground">Calculated directly from FabricTrad orders, payments, sellers and listings. No sample data is shown here.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-muted p-1">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDays(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-800 transition ${days === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => void load(days)} disabled={loading} className="ft-icon-button" aria-label="Refresh analytics">
              <Icon name="ArrowPathIcon" size={17} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => exportToCSV(exportSeries(), 'fabrictrad_admin_analytics')}
              disabled={!series.length}
              className="ft-secondary-action inline-flex items-center gap-2 px-3 py-2 text-xs disabled:opacity-50"
            >
              <Icon name="ArrowDownTrayIcon" size={14} /> Export
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-error/20 bg-error/10 px-4 py-4 text-sm text-error">
          <span>{error}</span><button type="button" onClick={() => void load(days)} className="font-800 underline">Retry</button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Orders', loading ? '—' : totals.orders.toLocaleString('en-IN'), 'ShoppingBagIcon', 'text-primary bg-primary/10'],
          ['GMV', loading ? '—' : formatINR(totals.gmv), 'CurrencyRupeeIcon', 'text-success bg-success/10'],
          ['Commission', loading ? '—' : formatINR(totals.commission), 'ReceiptPercentIcon', 'text-secondary bg-secondary/10'],
          ['New buyers', loading ? '—' : totals.newBuyers.toLocaleString('en-IN'), 'UserPlusIcon', 'text-blue-700 bg-blue-500/10'],
          ['New sellers', loading ? '—' : totals.newSellers.toLocaleString('en-IN'), 'BuildingStorefrontIcon', 'text-purple-700 bg-purple-500/10'],
        ].map(([label, value, icon, tone]) => (
          <article key={String(label)} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon name={String(icon)} size={18} /></span>
              <div className="min-w-0"><p className="text-xs font-700 text-muted-foreground">{label}</p><p className="truncate text-lg font-800 text-foreground">{value}</p></div>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-800 text-foreground">Orders & captured GMV</h2>
            <p className="mt-1 text-xs text-muted-foreground">Bars are order volume (left axis); the line is captured GMV (right axis).</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={series} margin={{ left: 4, right: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={formatINR} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value: number, name: string) => (name === 'GMV' ? [formatINR(value), 'Captured GMV'] : [value, 'Orders'])}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="orders" name="Orders" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={10} />
            <Line yAxisId="right" type="monotone" dataKey="gmv" name="GMV" stroke="var(--success)" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        {!loading && totals.orders === 0 && (
          <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
            <p className="text-sm font-800">No marketplace orders in this period</p>
            <p className="mt-1 text-xs text-muted-foreground">This chart populates automatically as real buyers and sellers transact.</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-sm font-800 text-foreground">New accounts</h2>
          <p className="mt-1 text-xs text-muted-foreground">Buyer and seller signups per day.</p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={series} margin={{ left: 4, right: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="newBuyers" name="Buyers" stackId="signups" fill="var(--primary)" radius={[0, 0, 0, 0]} barSize={10} />
            <Bar dataKey="newSellers" name="Sellers" stackId="signups" fill="var(--secondary)" radius={[4, 4, 0, 0]} barSize={10} />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-800 text-foreground">Top sellers by GMV</h2>
            <p className="mt-1 text-xs text-muted-foreground">Captured payments in the selected period.</p>
          </div>
          {!loading && topSellers.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No captured seller GMV in this period yet.</div>
          )}
          {topSellers.length > 0 && (
            <ResponsiveContainer width="100%" height={Math.max(180, topSellers.length * 42)}>
              <ComposedChart data={topSellers} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickFormatter={formatINR} tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: 'var(--foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [formatINR(value), 'GMV']} />
                <Bar dataKey="gmv" fill="var(--success)" radius={[0, 6, 6, 0]} barSize={18} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-800 text-foreground">Catalogue mix by category</h2>
            <p className="mt-1 text-xs text-muted-foreground">Active vs total listings per category.</p>
          </div>
          {!loading && categoryMix.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No listings recorded yet.</div>
          )}
          {categoryMix.length > 0 && (
            <ResponsiveContainer width="100%" height={Math.max(180, categoryMix.length * 38)}>
              <ComposedChart data={categoryMix} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 11, fill: 'var(--foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="listings" name="Total listings" fill="var(--muted-foreground)" radius={[0, 6, 6, 0]} barSize={14} />
                <Bar dataKey="activeListings" name="Active & approved" fill="var(--primary)" radius={[0, 6, 6, 0]} barSize={14} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-800 text-foreground">Payment method mix</h2>
          <p className="mt-1 text-xs text-muted-foreground">Captured payments in the selected period, by method.</p>
        </div>
        {!loading && paymentMethodMix.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No captured payments in this period yet.</div>
        )}
        {paymentMethodMix.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-[220px_1fr] sm:items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={paymentMethodMix} dataKey="amount" nameKey="method" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {paymentMethodMix.map((entry, index) => <Cell key={entry.method} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => formatINR(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {paymentMethodMix.map((row, index) => (
                <div key={row.method} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 capitalize">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="text-sm font-700 text-foreground">{row.method}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-800 text-foreground">{formatINR(row.amount)}</p>
                    <p className="text-xs text-muted-foreground">{row.count} payment{row.count === 1 ? '' : 's'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
