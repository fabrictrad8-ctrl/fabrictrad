'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

type StoreIdentity = {
  storeName: string;
  storeHandle: string;
  storeBio: string;
  storeBannerUrl: string;
  fallbackName: string;
  isVerified: boolean;
  isEarlyBird: boolean;
  earlyBirdRank: number | null;
  publicUrl: string | null;
};

const slugPreview = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export default function SellerStoreIdentity() {
  const [data, setData] = useState<StoreIdentity | null>(null);
  const [storeName, setStoreName] = useState('');
  const [storeHandle, setStoreHandle] = useState('');
  const [storeBio, setStoreBio] = useState('');
  const [storeBannerUrl, setStoreBannerUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/seller/store', { cache: 'no-store', credentials: 'same-origin' });
      const payload = (await response.json().catch(() => ({}))) as StoreIdentity & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Store details could not be loaded.');
      setData(payload);
      setStoreName(payload.storeName || payload.fallbackName || '');
      setStoreHandle(payload.storeHandle || '');
      setStoreBio(payload.storeBio || '');
      setStoreBannerUrl(payload.storeBannerUrl || '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Store details could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/seller/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ storeName, storeHandle: slugPreview(storeHandle), storeBio, storeBannerUrl }),
      });
      const payload = (await response.json().catch(() => ({}))) as StoreIdentity & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Store details could not be saved.');
      setData(payload);
      setStoreHandle(payload.storeHandle || '');
      setSuccess('Store details saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Store details could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="ft-glass-card p-5 sm:p-6">
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </section>
    );
  }

  return (
    <section className="ft-glass-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-850 uppercase tracking-wider text-primary">Public storefront</p>
          <h2 className="ft-admin-page-title mt-2 text-xl">Name your store and claim its public link</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Buyers see this name, bio and banner on your public storefront and across the marketplace. Your legal business details stay separate and private.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data?.isVerified && (
            <span className="ft-badge ft-badge--success"><Icon name="CheckBadgeIcon" size={13} /> Verified seller</span>
          )}
          {data?.isEarlyBird && (
            <span className="ft-badge ft-badge--warning"><Icon name="SparklesIcon" size={13} /> Founding seller #{data.earlyBirdRank}</span>
          )}
        </div>
      </div>

      {!data?.isVerified && (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          The founding-seller badge is awarded automatically to the first 100 sellers who complete verification. Finish GST, PAN and bank verification to become eligible.
        </div>
      )}

      {error && <div role="alert" className="mt-5 rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}
      {success && <div role="status" className="mt-5 rounded-2xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">{success}</div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Store name</span>
            <input
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              maxLength={80}
              placeholder="e.g. Bhanu Textiles"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-700 text-foreground outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Store handle</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 focus-within:border-primary">
              <span className="shrink-0 text-sm text-muted-foreground">fabrictrad.com/store/</span>
              <input
                value={storeHandle}
                onChange={(event) => setStoreHandle(slugPreview(event.target.value))}
                maxLength={40}
                placeholder="bhanu-textiles"
                className="min-w-0 flex-1 bg-transparent text-sm font-700 text-foreground outline-none"
              />
            </div>
            <span className="mt-1.5 block text-xs text-muted-foreground">Lowercase letters, numbers and hyphens only. Leave blank to keep your storefront unlisted.</span>
          </label>

          <label className="block">
            <span className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Store bio</span>
            <textarea
              value={storeBio}
              onChange={(event) => setStoreBio(event.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Tell buyers what makes your fabrics or workmanship different."
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            />
            <span className="mt-1 block text-right text-[11px] text-muted-foreground">{storeBio.length}/280</span>
          </label>

          <label className="block">
            <span className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Banner image URL</span>
            <input
              value={storeBannerUrl}
              onChange={(event) => setStoreBannerUrl(event.target.value)}
              maxLength={600}
              placeholder="https://..."
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" onClick={() => void save()} disabled={saving || !storeName.trim()} className="ft-primary-action px-5 py-2.5 text-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Save store details'}
            </button>
            {data?.publicUrl && (
              <Link href={data.publicUrl} target="_blank" className="ft-secondary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">
                View public storefront <Icon name="ArrowUpRightIcon" size={14} />
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-[11px] font-800 uppercase tracking-wider text-muted-foreground">Preview</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
            <div className="h-20 bg-gradient-to-br from-primary/20 to-secondary/20" style={storeBannerUrl ? { backgroundImage: `url(${storeBannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
            <div className="p-3">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-800 text-foreground">{storeName || data?.fallbackName || 'Your store name'}</p>
                {data?.isVerified && <Icon name="CheckBadgeIcon" size={14} className="shrink-0 text-primary" />}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{storeBio || 'Your store bio appears here.'}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
