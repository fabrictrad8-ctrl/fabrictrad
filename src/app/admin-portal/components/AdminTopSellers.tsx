'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

type SortKey = 'gmv' | 'orders' | 'rating' | 'fulfillmentRate';
type Range = '30d' | '90d' | 'all';

type SellerMetric = {
  id: string;
  sellerRef: string;
  name: string;
  city: string;
  businessType: string;
  verificationStatus: string;
  gstinVerified: boolean;
  joinedAt: string | null;
  orders: number;
  gmv: number;
  commission: number;
  avgOrderValue: number;
  rating: number;
  reviews: number;
  acceptanceRate: number;
  fulfillmentRate: number;
  refundRate: number;
  activeListings: number;
};

type MetricsResponse = {
  generatedAt?: string;
  sellers?: SellerMetric[];
  error?: string;
};

const rangeStart = (range: Range) => {
  if (range === 'all') return '';
  const days = range === '90d' ? 90 : 30;
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
};

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'FT';

const statusLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminTopSellers() {
  const [range, setRange] = useState<Range>('30d');
  const [sortBy, setSortBy] = useState<SortKey>('gmv');
  const [topN, setTopN] = useState(10);
  const [sellers, setSellers] = useState<SellerMetric[]>([]);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    const from = rangeStart(range);
    if (from) params.set('from', from);

    try {
      const response = await fetch(
        `/api/admin/seller-metrics${params.size ? `?${params.toString()}` : ''}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const payload = (await response.json().catch(() => ({}))) as MetricsResponse;
      if (!response.ok) throw new Error(payload.error || 'Live seller performance could not be loaded.');
      setSellers(payload.sellers || []);
      setGeneratedAt(payload.generatedAt || '');
    } catch (caught) {
      setSellers([]);
      setError(caught instanceof Error ? caught.message : 'Live seller performance could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () =>
      [...sellers]
        .sort((a, b) => b[sortBy] - a[sortBy] || b.gmv - a.gmv || a.name.localeCompare(b.name))
        .slice(0, topN),
    [sellers, sortBy, topN]
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-800 text-success">
                Live Supabase data
              </span>
              {generatedAt && (
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-xl font-800 text-foreground">Top seller performance</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked from actual orders, captured revenue, reviews, refunds and approved listings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-700 text-foreground">
              <span className="sr-only">Performance period</span>
              <select value={range} onChange={(event) => setRange(event.target.value as Range)} className="bg-transparent outline-none">
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </label>
            <label className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-700 text-foreground">
              <span className="sr-only">Number of sellers</span>
              <select value={topN} onChange={(event) => setTopN(Number(event.target.value))} className="bg-transparent outline-none">
                {[5, 10, 25, 50].map((count) => <option key={count} value={count}>Top {count}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void load()} disabled={loading} className="ft-icon-button" aria-label="Refresh top sellers">
              <Icon name="ArrowPathIcon" size={17} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          ['gmv', 'Revenue'],
          ['orders', 'Orders'],
          ['rating', 'Rating'],
          ['fulfillmentRate', 'Fulfillment'],
        ] as Array<[SortKey, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortBy(key)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-800 transition ${
              sortBy === key ? 'bg-secondary text-white' : 'border border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-error/20 bg-error/10 px-4 py-4 text-sm text-error">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-800 underline">Retry</button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b border-border bg-muted/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-800 text-muted-foreground">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-800 text-muted-foreground">Seller</th>
                <th className="px-4 py-3 text-right text-xs font-800 text-muted-foreground">GMV</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">Orders</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">Rating</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">Acceptance</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">Fulfillment</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">Refunds</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && Array.from({ length: 5 }).map((_, index) => (
                <tr key={index}><td colSpan={9} className="px-4 py-5"><div className="h-8 animate-pulse rounded-xl bg-muted" /></td></tr>
              ))}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-14 text-center">
                    <Icon name="BuildingStorefrontIcon" size={32} className="mx-auto text-muted-foreground" />
                    <p className="mt-3 font-800 text-foreground">No seller activity in this period</p>
                    <p className="mt-1 text-xs text-muted-foreground">Verified sellers will appear as real orders, payments and reviews are recorded.</p>
                  </td>
                </tr>
              )}
              {!loading && sorted.map((seller, index) => (
                <tr key={seller.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-800 text-primary">{index + 1}</span></td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-xs font-800 text-secondary">{initials(seller.name)}</span>
                      <div className="min-w-0">
                        <p className="max-w-64 truncate font-800 text-foreground">{seller.name}</p>
                        <p className="text-xs text-muted-foreground">{seller.sellerRef} · {seller.city}</p>
                        <p className="text-[11px] text-muted-foreground">{seller.activeListings} approved listings</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-800 text-foreground">{money(seller.gmv)}</td>
                  <td className="px-4 py-4 text-center font-800 text-foreground">{seller.orders}</td>
                  <td className="px-4 py-4 text-center"><span className="font-800 text-foreground">{seller.rating || '—'}</span><span className="block text-[11px] text-muted-foreground">{seller.reviews} reviews</span></td>
                  <td className="px-4 py-4 text-center font-800 text-foreground">{seller.acceptanceRate}%</td>
                  <td className="px-4 py-4 text-center font-800 text-foreground">{seller.fulfillmentRate}%</td>
                  <td className="px-4 py-4 text-center font-800 text-foreground">{seller.refundRate}%</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-800 ${
                      seller.verificationStatus === 'approved' || seller.verificationStatus === 'verified' || seller.verificationStatus === 'active'
                        ? 'border-success/20 bg-success/10 text-success'
                        : seller.verificationStatus === 'inactive' ?'border-error/20 bg-error/10 text-error' :'border-warning/20 bg-warning/10 text-warning'
                    }`}>
                      {statusLabel(seller.verificationStatus)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-end">
        <Link href="/admin-portal?tab=sellers" className="ft-secondary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">
          Review seller accounts <Icon name="ArrowRightIcon" size={14} />
        </Link>
      </div>
    </div>
  );
}
