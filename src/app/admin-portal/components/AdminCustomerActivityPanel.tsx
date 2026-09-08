'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { pillClassForStatus, pillLabel } from '@/lib/statusPill';

type ActivityEvent = {
  id: string;
  type: string;
  title: string;
  detail: string;
  amount: number | null;
  status: string | null;
  at: string;
};

type ActivityResponse = {
  profile: { full_name: string | null; email: string | null; business_name: string | null; role: string | null; created_at: string | null };
  sellerProfile: { display_name: string | null; is_early_bird: boolean; verification_status: string } | null;
  summary: {
    buyerOrders: number;
    buyerSpend: number;
    sellerOrders: number;
    sellerRevenue: number;
    disputes: number;
    wishlistItems: number;
    listedProducts: number;
  };
  events: ActivityEvent[];
  error?: string;
};

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const EVENT_ICONS: Record<string, string> = {
  catalog_order: 'ShoppingBagIcon',
  bulk_order: 'ArchiveBoxIcon',
  dispute: 'FlagIcon',
  wishlist: 'HeartIcon',
  seller_product: 'TagIcon',
  seller_application: 'BuildingStorefrontIcon',
};

export default function AdminCustomerActivityPanel({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    fetch(`/api/admin/customers/${customerId}/activity`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as ActivityResponse;
        if (!mounted) return;
        if (!response.ok) throw new Error(payload.error || 'Account activity could not be loaded.');
        setData(payload);
      })
      .catch((caught) => {
        if (mounted) setError(caught instanceof Error ? caught.message : 'Account activity could not be loaded.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [customerId]);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close account activity" />
      <aside className="relative flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-800 uppercase tracking-wider text-primary">Account activity</p>
            <h2 className="truncate text-lg font-800 text-foreground">{data?.profile.full_name || data?.profile.business_name || 'Account'}</h2>
          </div>
          <button type="button" onClick={onClose} className="ft-icon-button" aria-label="Close"><Icon name="XMarkIcon" size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <div className="space-y-3" aria-hidden="true">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>}
          {error && <div role="alert" className="rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">{error}</div>}

          {data && !loading && (
            <>
              <div className="mb-5 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p>{data.profile.email || 'No email'}</p>
                <p className="mt-0.5">Joined {data.profile.created_at ? new Date(data.profile.created_at).toLocaleDateString('en-IN') : '—'}</p>
                {data.sellerProfile && (
                  <p className="mt-1.5 flex items-center gap-1.5">
                    <span className={pillClassForStatus(data.sellerProfile.verification_status)}>{pillLabel(data.sellerProfile.verification_status)}</span>
                    {data.sellerProfile.is_early_bird && <span className="ft-badge ft-badge--warning">Founding seller</span>}
                  </p>
                )}
              </div>

              <div className="mb-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-border p-3"><p className="text-[10px] uppercase text-muted-foreground">Buyer orders</p><p className="mt-1 text-lg font-800 text-foreground">{data.summary.buyerOrders}</p></div>
                <div className="rounded-xl border border-border p-3"><p className="text-[10px] uppercase text-muted-foreground">Total spend</p><p className="mt-1 text-lg font-800 text-foreground">{money(data.summary.buyerSpend)}</p></div>
                {data.sellerProfile && (
                  <>
                    <div className="rounded-xl border border-border p-3"><p className="text-[10px] uppercase text-muted-foreground">Seller orders</p><p className="mt-1 text-lg font-800 text-foreground">{data.summary.sellerOrders}</p></div>
                    <div className="rounded-xl border border-border p-3"><p className="text-[10px] uppercase text-muted-foreground">Seller revenue</p><p className="mt-1 text-lg font-800 text-foreground">{money(data.summary.sellerRevenue)}</p></div>
                    <div className="rounded-xl border border-border p-3"><p className="text-[10px] uppercase text-muted-foreground">Listed products</p><p className="mt-1 text-lg font-800 text-foreground">{data.summary.listedProducts}</p></div>
                  </>
                )}
                <div className="rounded-xl border border-border p-3"><p className="text-[10px] uppercase text-muted-foreground">Disputes</p><p className={`mt-1 text-lg font-800 ${data.summary.disputes ? 'text-error' : 'text-foreground'}`}>{data.summary.disputes}</p></div>
                <div className="rounded-xl border border-border p-3"><p className="text-[10px] uppercase text-muted-foreground">Wishlist</p><p className="mt-1 text-lg font-800 text-foreground">{data.summary.wishlistItems}</p></div>
              </div>

              <p className="mb-3 text-xs font-800 uppercase tracking-wider text-muted-foreground">Recent activity</p>
              {data.events.length === 0 && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No activity recorded for this account yet.</div>}
              <div className="space-y-2.5">
                {data.events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon name={EVENT_ICONS[event.type] || 'ClockIcon'} size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-800 text-foreground">{event.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{new Date(event.at).toLocaleString('en-IN')}</p>
                    </div>
                    {event.amount !== null && event.amount > 0 && <span className="shrink-0 text-sm font-800 text-foreground">{money(event.amount)}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
