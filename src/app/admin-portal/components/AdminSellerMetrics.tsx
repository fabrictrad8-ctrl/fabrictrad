'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

type SortKey = 'gmv' | 'orders' | 'rating' | 'fulfillmentRate';
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
  summary?: {
    sellers: number;
    activeSellers: number;
    orders: number;
    gmv: number;
    commission: number;
  };
  error?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function AdminSellerMetrics() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('gmv');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [sellers, setSellers] = useState<SellerMetric[]>([]);
  const [summary, setSummary] = useState<MetricsResponse['summary']>();
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError('The start date must be before the end date.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);

    try {
      const response = await fetch(
        `/api/admin/seller-metrics${params.size ? `?${params.toString()}` : ''}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const payload = (await response.json().catch(() => ({}))) as MetricsResponse;
      if (!response.ok) throw new Error(payload.error || 'Live seller metrics could not be loaded.');
      setSellers(payload.sellers || []);
      setSummary(payload.summary);
      setGeneratedAt(payload.generatedAt || '');
    } catch (caught) {
      setSellers([]);
      setSummary(undefined);
      setError(caught instanceof Error ? caught.message : 'Live seller metrics could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => [...sellers].sort((a, b) => b[sortBy] - a[sortBy] || b.gmv - a.gmv || a.name.localeCompare(b.name)),
    [sellers, sortBy]
  );

  const exportRows = () =>
    sorted.map((seller) => ({
      Seller: seller.name,
      'Seller reference': seller.sellerRef,
      City: seller.city,
      'Business type': seller.businessType,
      'Verification status': seller.verificationStatus,
      'GSTIN verified': seller.gstinVerified ? 'Yes' : 'No',
      'Approved listings': seller.activeListings,
      Orders: seller.orders,
      'GMV (INR)': seller.gmv,
      'Platform commission (INR)': seller.commission,
      'Average order value (INR)': seller.avgOrderValue,
      Rating: seller.rating,
      Reviews: seller.reviews,
      'Acceptance rate (%)': seller.acceptanceRate,
      'Fulfillment rate (%)': seller.fulfillmentRate,
      'Refund rate (%)': seller.refundRate,
      'Date range': dateFrom || dateTo ? `${dateFrom || 'Beginning'} to ${dateTo || 'Today'}` : 'All time',
    }));

  const cards = [
    ['Sellers', summary?.sellers || 0, 'BuildingStorefrontIcon'],
    ['Active sellers', summary?.activeSellers || 0, 'ShieldCheckIcon'],
    ['Orders', summary?.orders || 0, 'ShoppingBagIcon'],
    ['GMV', money(summary?.gmv || 0), 'CurrencyRupeeIcon'],
    ['Commission', money(summary?.commission || 0), 'ReceiptPercentIcon'],
  ] as const;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-800 text-success">Live commerce metrics</span>
              {generatedAt && (
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-xl font-800 text-foreground">Seller metrics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Actual seller performance calculated from FabricTrad orders, Razorpay records, reviews and listings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-700 text-foreground">
              <span className="mr-2 text-muted-foreground">From</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="bg-transparent outline-none" />
            </label>
            <label className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-700 text-foreground">
              <span className="mr-2 text-muted-foreground">To</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="bg-transparent outline-none" />
            </label>
            <button type="button" onClick={() => void load()} disabled={loading} className="ft-icon-button" aria-label="Refresh seller metrics">
              <Icon name="ArrowPathIcon" size={17} className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((open) => !open)}
                disabled={!sorted.length}
                className="ft-secondary-action inline-flex items-center gap-2 px-3 py-2 text-xs disabled:opacity-50"
              >
                <Icon name="ArrowDownTrayIcon" size={14} /> Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full z-20 mt-2 min-w-40 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      exportToCSV(exportRows(), 'fabrictrad_live_seller_metrics');
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-700 text-foreground hover:bg-muted"
                  >
                    <Icon name="DocumentTextIcon" size={14} /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportToExcel(exportRows(), 'fabrictrad_live_seller_metrics');
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-left text-xs font-700 text-foreground hover:bg-muted"
                  >
                    <Icon name="TableCellsIcon" size={14} /> Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, icon]) => (
          <article key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name={icon} size={18} /></span>
              <div className="min-w-0"><p className="text-xs font-700 text-muted-foreground">{label}</p><p className="truncate text-lg font-800 text-foreground">{loading ? '—' : value}</p></div>
            </div>
          </article>
        ))}
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          ['gmv', 'By GMV'],
          ['orders', 'By orders'],
          ['rating', 'By rating'],
          ['fulfillmentRate', 'By fulfillment'],
        ] as Array<[SortKey, string]>).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setSortBy(key)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-800 ${sortBy === key ? 'bg-secondary text-white' : 'border border-border bg-card text-muted-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-error/20 bg-error/10 px-4 py-4 text-sm text-error">
          <span>{error}</span><button type="button" onClick={() => void load()} className="font-800 underline">Retry</button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-border bg-muted/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-800 text-muted-foreground">Seller</th>
                <th className="px-4 py-3 text-right text-xs font-800 text-muted-foreground">GMV</th>
                <th className="px-4 py-3 text-right text-xs font-800 text-muted-foreground">Commission</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">Orders</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">AOV</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">Rating</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">Acceptance</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">Fulfillment</th>
                <th className="px-4 py-3 text-center text-xs font-800 text-muted-foreground">Refunds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && Array.from({ length: 5 }).map((_, index) => <tr key={index}><td colSpan={9} className="px-4 py-5"><div className="h-8 animate-pulse rounded-xl bg-muted" /></td></tr>)}
              {!loading && sorted.length === 0 && <tr><td colSpan={9} className="px-6 py-14 text-center text-sm text-muted-foreground">No seller activity exists for the selected period.</td></tr>}
              {!loading && sorted.map((seller) => (
                <tr key={seller.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4"><p className="font-800 text-foreground">{seller.name}</p><p className="text-xs text-muted-foreground">{seller.sellerRef} · {seller.city} · {seller.activeListings} listings</p></td>
                  <td className="px-4 py-4 text-right font-800 text-foreground">{money(seller.gmv)}</td>
                  <td className="px-4 py-4 text-right font-800 text-foreground">{money(seller.commission)}</td>
                  <td className="px-4 py-4 text-center font-800 text-foreground">{seller.orders}</td>
                  <td className="px-4 py-4 text-center font-800 text-foreground">{money(seller.avgOrderValue)}</td>
                  <td className="px-4 py-4 text-center"><span className="font-800 text-foreground">{seller.rating || '—'}</span><span className="block text-[11px] text-muted-foreground">{seller.reviews} reviews</span></td>
                  <td className="px-4 py-4 text-center font-800 text-foreground">{seller.acceptanceRate}%</td>
                  <td className="px-4 py-4 text-center font-800 text-foreground">{seller.fulfillmentRate}%</td>
                  <td className="px-4 py-4 text-center font-800 text-foreground">{seller.refundRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
