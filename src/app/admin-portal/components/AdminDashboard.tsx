'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

type Range = 'today' | '7d' | '30d';
type Overview = {
  range: string;
  generatedAt: string;
  metrics: {
    orders: number;
    gmv: number;
    commission: number;
    registrations: number;
    sellerApplications: number;
    listings: number;
    failedPayments: number;
    openDisputes: number;
  };
  tasks: {
    pendingSellers: number;
    pendingProducts: number;
    failedPayments: number;
    openDisputes: number;
    shipmentExceptions: number;
    unresolvedErrors: number;
  };
  orderStatus: Record<string, number>;
  inventory: {
    activeProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    at: string;
    href: string;
  }>;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const rangeOptions: Array<{ value: Range; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

const statusLabel = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const statusColor = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('paid') || s.includes('delivered') || s.includes('fulfilled')) return 'bg-[#008060]/10 text-[#008060]';
  if (s.includes('pending') || s.includes('draft')) return 'bg-amber-50 text-amber-700';
  if (s.includes('cancel') || s.includes('fail') || s.includes('reject')) return 'bg-red-50 text-red-600';
  if (s.includes('ship') || s.includes('transit')) return 'bg-blue-50 text-blue-600';
  return 'bg-gray-100 text-gray-600';
};

export default function AdminDashboard() {
  const [range, setRange] = useState<Range>('today');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const load = useCallback(async (selectedRange = range) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/overview?range=${selectedRange}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = (await response.json().catch(() => ({}))) as Overview & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Overview could not be loaded.');
      setOverview(payload);
    } catch (err) {
      setOverview(null);
      setError(err instanceof Error ? err.message : 'Overview could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  const metrics = useMemo(
    () => [
      {
        label: 'Total orders',
        value: String(overview?.metrics.orders || 0),
        icon: 'ShoppingBagIcon',
        color: 'text-[#008060]',
        bg: 'bg-[#008060]/10',
        border: 'border-[#008060]/20',
      },
      {
        label: 'Gross merchandise value',
        value: money(overview?.metrics.gmv || 0),
        icon: 'CurrencyRupeeIcon',
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-100',
      },
      {
        label: 'Platform commission',
        value: money(overview?.metrics.commission || 0),
        icon: 'ReceiptPercentIcon',
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        border: 'border-purple-100',
      },
      {
        label: 'New accounts',
        value: String(overview?.metrics.registrations || 0),
        icon: 'UserPlusIcon',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-100',
      },
      {
        label: 'Seller applications',
        value: String(overview?.metrics.sellerApplications || 0),
        icon: 'BuildingStorefrontIcon',
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-100',
      },
      {
        label: 'New listings',
        value: String(overview?.metrics.listings || 0),
        icon: 'TagIcon',
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        border: 'border-rose-100',
      },
    ],
    [overview]
  );

  const tasks = useMemo(
    () => [
      {
        label: 'Seller applications',
        count: overview?.tasks.pendingSellers || 0,
        href: '/admin-portal?tab=sellers',
        icon: 'ShieldCheckIcon',
        desc: 'Awaiting review',
      },
      {
        label: 'Product listings',
        count: overview?.tasks.pendingProducts || 0,
        href: '/admin-portal?tab=listings',
        icon: 'TagIcon',
        desc: 'Pending approval',
      },
      {
        label: 'Failed payments',
        count: overview?.tasks.failedPayments || 0,
        href: '/admin-portal?tab=payments',
        icon: 'CreditCardIcon',
        desc: 'Need investigation',
      },
      {
        label: 'Open disputes',
        count: overview?.tasks.openDisputes || 0,
        href: '/admin-portal?tab=disputes',
        icon: 'FlagIcon',
        desc: 'Awaiting resolution',
      },
      {
        label: 'Shipment exceptions',
        count: overview?.tasks.shipmentExceptions || 0,
        href: '/admin-portal?tab=fulfillment',
        icon: 'TruckIcon',
        desc: 'Require attention',
      },
      {
        label: 'Platform errors',
        count: overview?.tasks.unresolvedErrors || 0,
        href: '/admin-portal?tab=errors',
        icon: 'ExclamationTriangleIcon',
        desc: 'Unresolved issues',
      },
    ],
    [overview]
  );

  const orderStatusEntries = Object.entries(overview?.orderStatus || {}).sort((a, b) => b[1] - a[1]);
  const orderTotal = orderStatusEntries.reduce((total, [, count]) => total + count, 0);
  const totalTasks = tasks.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-600 text-muted-foreground">Admin portal</p>
          <h1 className="mt-1 text-2xl font-700 text-foreground">
            {greeting || 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live platform data — no demo metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Range selector */}
          <div className="flex items-center rounded-lg border border-[#e1e3e5] bg-white p-1 shadow-sm">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-600 transition-all ${
                  range === opt.value
                    ? 'bg-[#1a1f2e] text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e1e3e5] bg-white shadow-sm hover:bg-gray-50"
            aria-label="Refresh"
          >
            <Icon name="ArrowPathIcon" size={16} className={loading ? 'animate-spin text-muted-foreground' : 'text-muted-foreground'} />
          </button>
          {overview?.generatedAt && (
            <span className="hidden text-xs text-muted-foreground lg:inline">
              Updated {new Date(overview.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-700 underline">Retry</button>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={`rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md ${metric.border}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-600 text-muted-foreground">{metric.label}</p>
                <p className={`mt-2 text-2xl font-700 ${metric.color}`}>
                  {loading ? (
                    <span className="inline-block h-7 w-20 animate-pulse rounded-md bg-gray-100" />
                  ) : (
                    metric.value
                  )}
                </p>
              </div>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${metric.bg}`}>
                <Icon name={metric.icon as 'ShoppingBagIcon'} size={20} className={metric.color} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Action centre + Inventory */}
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Action centre */}
        <div className="rounded-xl border border-[#e1e3e5] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e1e3e5] px-5 py-4">
            <div>
              <h2 className="text-sm font-700 text-foreground">Action centre</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {totalTasks > 0 ? `${totalTasks} items need attention` : 'All clear — nothing pending'}
              </p>
            </div>
            <Link href="/admin-portal?tab=activity" className="text-xs font-600 text-[#008060] hover:underline">
              View activity
            </Link>
          </div>
          <div className="grid gap-px bg-[#f6f6f7] sm:grid-cols-2">
            {tasks.map((task) => (
              <Link
                key={task.label}
                href={task.href}
                className="group flex items-center gap-3 bg-white p-4 transition hover:bg-[#f6f6f7]"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${task.count > 0 ? 'bg-red-50 text-red-600' : 'bg-[#008060]/10 text-[#008060]'}`}>
                  <Icon name={task.icon as 'ShieldCheckIcon'} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-600 text-foreground">{task.label}</span>
                  <span className="block text-xs text-muted-foreground">{task.desc}</span>
                </span>
                <span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-700 ${task.count > 0 ? 'bg-red-100 text-red-700' : 'bg-[#008060]/10 text-[#008060]'}`}>
                  {task.count}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Inventory health */}
        <div className="rounded-xl border border-[#e1e3e5] bg-white shadow-sm">
          <div className="border-b border-[#e1e3e5] px-5 py-4">
            <h2 className="text-sm font-700 text-foreground">Inventory health</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Products ready to sell</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Active', value: overview?.inventory.activeProducts || 0, color: 'text-[#008060]', bg: 'bg-[#008060]/10' },
                { label: 'Low stock', value: overview?.inventory.lowStockProducts || 0, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Out of stock', value: overview?.inventory.outOfStockProducts || 0, color: 'text-red-600', bg: 'bg-red-50' },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl p-4 text-center ${item.bg}`}>
                  <p className={`text-2xl font-700 ${item.color}`}>
                    {loading ? '—' : item.value}
                  </p>
                  <p className="mt-1 text-xs font-600 text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            <Link
              href="/admin-portal?tab=listings"
              className="mt-4 flex items-center gap-2 text-sm font-600 text-[#008060] hover:underline"
            >
              Manage products <Icon name="ArrowRightIcon" size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Order status + Recent activity */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Order status */}
        <div className="rounded-xl border border-[#e1e3e5] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e1e3e5] px-5 py-4">
            <div>
              <h2 className="text-sm font-700 text-foreground">Order status breakdown</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{orderTotal} total orders in period</p>
            </div>
            <Link href="/admin-portal?tab=orders" className="text-xs font-600 text-[#008060] hover:underline">
              View orders
            </Link>
          </div>
          <div className="p-5">
            {!loading && orderStatusEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e1e3e5] p-8 text-center">
                <Icon name="ShoppingBagIcon" size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No orders in this period</p>
              </div>
            ) : (
              <div className="space-y-3">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-100" />
                    ))
                  : orderStatusEntries.map(([status, count]) => {
                      const pct = orderTotal > 0 ? Math.round((count / orderTotal) * 100) : 0;
                      return (
                        <div key={status}>
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-600 ${statusColor(status)}`}>
                              {statusLabel(status)}
                            </span>
                            <span className="font-700 text-foreground">{count} <span className="font-500 text-muted-foreground">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-[#008060] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-[#e1e3e5] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e1e3e5] px-5 py-4">
            <div>
              <h2 className="text-sm font-700 text-foreground">Recent activity</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Latest platform events</p>
            </div>
            <Link href="/admin-portal?tab=activity" className="text-xs font-600 text-[#008060] hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-[#f6f6f7]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-gray-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))
            ) : overview?.recentActivity?.length ? (
              overview.recentActivity.slice(0, 6).map((event) => (
                <Link
                  key={event.id}
                  href={event.href || '/admin-portal?tab=activity'}
                  className="flex items-start gap-3 px-5 py-3 transition hover:bg-[#f6f6f7]"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#008060]/10">
                    <Icon name="BoltIcon" size={13} className="text-[#008060]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-600 text-foreground">{event.title}</span>
                    <span className="block text-xs text-muted-foreground">{event.detail}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(event.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Link>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <Icon name="BoltIcon" size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
