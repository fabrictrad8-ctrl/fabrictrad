'use client';

import { useEffect, useMemo, useState } from 'react';
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
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

const statusLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

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

  const load = async (selectedRange = range) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/overview?range=${selectedRange}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = (await response.json().catch(() => ({}))) as Overview & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The live overview could not be loaded.');
      setOverview(payload);
    } catch (caughtError) {
      setOverview(null);
      setError(caughtError instanceof Error ? caughtError.message : 'The live overview could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(range);
  }, [range]);

  const metrics = useMemo(
    () => [
      { label: 'Orders', value: String(overview?.metrics.orders || 0), detail: 'Orders created in period', icon: 'ShoppingBagIcon', tone: 'text-primary bg-primary/10' },
      { label: 'Gross merchandise value', value: money(overview?.metrics.gmv || 0), detail: 'Captured or authorised payments', icon: 'CurrencyRupeeIcon', tone: 'text-success bg-success/10' },
      { label: 'Platform commission', value: money(overview?.metrics.commission || 0), detail: 'Estimated from configured rate', icon: 'ReceiptPercentIcon', tone: 'text-secondary bg-secondary/10' },
      { label: 'New accounts', value: String(overview?.metrics.registrations || 0), detail: 'Buyer, seller and staff profiles', icon: 'UserPlusIcon', tone: 'text-blue-700 bg-blue-500/10' },
      { label: 'Seller applications', value: String(overview?.metrics.sellerApplications || 0), detail: 'Applications created in period', icon: 'BuildingStorefrontIcon', tone: 'text-purple-700 bg-purple-500/10' },
      { label: 'New listings', value: String(overview?.metrics.listings || 0), detail: 'Products submitted in period', icon: 'TagIcon', tone: 'text-amber-700 bg-amber-500/10' },
    ],
    [overview]
  );

  const tasks = useMemo(
    () => [
      { label: 'Review seller applications', count: overview?.tasks.pendingSellers || 0, href: '/admin-portal?tab=sellers', icon: 'ShieldCheckIcon', urgent: true },
      { label: 'Review product listings', count: overview?.tasks.pendingProducts || 0, href: '/admin-portal?tab=listings', icon: 'TagIcon', urgent: true },
      { label: 'Investigate failed payments', count: overview?.tasks.failedPayments || 0, href: '/admin-portal?tab=payments', icon: 'CreditCardIcon', urgent: true },
      { label: 'Resolve disputes', count: overview?.tasks.openDisputes || 0, href: '/admin-portal?tab=disputes', icon: 'FlagIcon', urgent: true },
      { label: 'Shipment exceptions', count: overview?.tasks.shipmentExceptions || 0, href: '/admin-portal?tab=fulfillment', icon: 'TruckIcon', urgent: true },
      { label: 'Unresolved platform errors', count: overview?.tasks.unresolvedErrors || 0, href: '/admin-portal?tab=errors', icon: 'ExclamationTriangleIcon', urgent: true },
    ],
    [overview]
  );

  const orderStatusEntries = Object.entries(overview?.orderStatus || {}).sort((a, b) => b[1] - a[1]);
  const orderTotal = orderStatusEntries.reduce((total, [, count]) => total + count, 0);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-800 text-success">Live commerce data</span>
              {overview?.generatedAt && (
                <span className="text-xs text-muted-foreground">Updated {new Date(overview.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-800 tracking-tight text-foreground">{greeting || 'Welcome back'}. Here is what needs attention.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Live sales, verification, inventory, payments and fulfillment data from FabricTrad. No demonstration metrics are shown here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={`rounded-xl px-3 py-2 text-xs font-800 transition ${range === option.value ? 'bg-foreground text-background' : 'border border-border bg-card text-muted-foreground hover:text-foreground'}`}
              >
                {option.label}
              </button>
            ))}
            <button type="button" onClick={() => void load()} disabled={loading} className="ft-icon-button" aria-label="Refresh administrator home">
              <Icon name="ArrowPathIcon" size={17} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-2xl border border-error/20 bg-error/10 px-4 py-4 text-sm text-error">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="font-800 underline">Retry</button>
          </div>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${metric.tone}`}>
                <Icon name={metric.icon as 'ShoppingBagIcon'} size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-800 uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                <p className="mt-1 truncate text-2xl font-800 tracking-tight text-foreground">{loading ? '—' : metric.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-800 uppercase tracking-[0.12em] text-primary">Action centre</p>
              <h2 className="mt-1 text-lg font-800 text-foreground">Tasks that can block transactions</h2>
            </div>
            <Link href="/admin-portal?tab=activity" className="text-xs font-800 text-primary hover:underline">Open activity</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {tasks.map((task) => (
              <Link key={task.label} href={task.href} className="group flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4 transition hover:border-primary/30 hover:bg-primary/5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-sm group-hover:text-primary">
                  <Icon name={task.icon as 'ShieldCheckIcon'} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-800 text-foreground">{task.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{task.count ? `${task.count} require action` : 'Nothing waiting'}</span>
                </span>
                <span className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-800 ${task.count ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>{task.count}</span>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <p className="text-xs font-800 uppercase tracking-[0.12em] text-secondary">Inventory health</p>
          <h2 className="mt-1 text-lg font-800 text-foreground">Products ready to sell</h2>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ['Active', overview?.inventory.activeProducts || 0, 'text-success bg-success/10'],
              ['Low stock', overview?.inventory.lowStockProducts || 0, 'text-warning bg-warning/10'],
              ['Out of stock', overview?.inventory.outOfStockProducts || 0, 'text-error bg-error/10'],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                <p className={`text-2xl font-800 ${tone}`.split(' ')[0]}>{loading ? '—' : value}</p>
                <p className="mt-1 text-xs font-700 text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <Link href="/admin-portal?tab=listings" className="mt-5 inline-flex items-center gap-2 text-sm font-800 text-primary hover:underline">
            Manage products <Icon name="ArrowRightIcon" size={14} />
          </Link>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-800 uppercase tracking-[0.12em] text-primary">Orders</p>
              <h2 className="mt-1 text-lg font-800 text-foreground">Status distribution</h2>
            </div>
            <Link href="/admin-portal?tab=orders" className="text-xs font-800 text-primary hover:underline">View orders</Link>
          </div>
          <div className="mt-5 space-y-3">
            {!loading && orderStatusEntries.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No orders have been created in this period.</div>
            )}
            {orderStatusEntries.map(([status, count]) => (
              <div key={status}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-700 text-foreground">{statusLabel(status)}</span>
                  <span className="font-800 text-muted-foreground">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${orderTotal ? Math.max(4, (count / orderTotal) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-800 uppercase tracking-[0.12em] text-secondary">Timeline</p>
              <h2 className="mt-1 text-lg font-800 text-foreground">Recent platform activity</h2>
            </div>
            <Link href="/admin-portal?tab=activity" className="text-xs font-800 text-primary hover:underline">Full feed</Link>
          </div>
          <div className="mt-5 divide-y divide-border">
            {!loading && !overview?.recentActivity.length && (
              <div className="py-8 text-center text-sm text-muted-foreground">New orders, sellers and products will appear here.</div>
            )}
            {(overview?.recentActivity || []).slice(0, 7).map((activity) => (
              <Link key={activity.id} href={activity.href} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icon name={activity.type === 'order' ? 'ShoppingBagIcon' : activity.type === 'seller' ? 'BuildingStorefrontIcon' : 'TagIcon'} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-800 text-foreground">{activity.title}</span>
                  <span className="block truncate text-xs capitalize text-muted-foreground">{activity.detail}</span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{new Date(activity.at).toLocaleDateString('en-IN')}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
