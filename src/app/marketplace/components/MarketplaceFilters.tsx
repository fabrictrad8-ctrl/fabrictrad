'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const filterGroups = [
  { label: 'Fabric Type', key: 'fabricType', options: ['Silk', 'Cotton', 'Polyester', 'Net & Netting', 'Georgette', 'Organza', 'Velvet', 'Handloom', 'Linen', 'Denim', 'Wool', 'Banarasi Silk', 'Chanderi', 'Chiffon', 'Rayon', 'Viscose'] },
  { label: 'GSM Range', key: 'gsm', options: ['< 80 GSM', '80-120 GSM', '120-200 GSM', '200-300 GSM', '300+ GSM'] },
  { label: 'Width', key: 'width', options: ['36 inches', '44 inches', '54 inches', '58 inches', '60 inches', '72 inches'] },
  { label: 'Work Type', key: 'work', options: ['Plain', 'Embroidered', 'Zari Work', 'Block Print', 'Digital Print', 'Handloom', 'Sequence', 'Printed', 'Woven', 'Dyed'] },
  { label: 'Dispatch Time', key: 'dispatch', options: ['Same Day', '1-2 Days', '3-5 Days', '5-7 Days'] },
] as const;

const PRICE_BANDS = [
  { label: 'Under ₹200', max: 200 },
  { label: '₹200–₹500', max: 500 },
  { label: '₹500–₹1,000', max: 1000 },
  { label: '₹1,000–₹2,500', max: 2500 },
  { label: '₹2,500+', max: 10000 },
];

const SELLER_RATINGS = [
  { label: '4.5★ & above', value: '4.5' },
  { label: '4.0★ & above', value: '4.0' },
  { label: '3.5★ & above', value: '3.5' },
  { label: 'Any rating', value: '' },
];

const SAVED_SEARCHES_KEY = 'fabrictrad:saved-searches';

interface SavedSearch {
  id: string;
  name: string;
  params: string;
  created_at: string;
}

function readSavedSearches(userId?: string | null): SavedSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${SAVED_SEARCHES_KEY}:${userId || 'guest'}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeSavedSearches(userId: string | null | undefined, searches: SavedSearch[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${SAVED_SEARCHES_KEY}:${userId || 'guest'}`, JSON.stringify(searches));
}

function valuesFor(params: URLSearchParams, key: string) {
  return (params.get(key) || '').split(',').map((value) => value.trim()).filter(Boolean);
}

export default function MarketplaceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<string[]>(['fabricType', 'gsm']);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    setSavedSearches(readSavedSearches(user?.id));
  }, [user?.id]);

  const selected = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    return Object.fromEntries(filterGroups.map((group) => [group.key, valuesFor(params, group.key)]));
  }, [searchParams]);

  const priceMax = Number(searchParams.get('maxPrice') || 5000);
  const moqMax = Number(searchParams.get('maxMoq') || 500);
  const verifiedOnly = searchParams.get('verified') === '1';
  const minRating = searchParams.get('minRating') || '';
  const priceBand = searchParams.get('priceBand') || '';

  const totalActive = Object.values(selected).flat().length
    + Number(verifiedOnly)
    + Number(priceMax !== 5000)
    + Number(moqMax !== 500)
    + Number(!!minRating)
    + Number(!!priceBand);

  const updateParams = useCallback((update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    params.delete('page');
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  }, [searchParams, pathname, router]);

  const toggleOption = (key: string, value: string) => updateParams((params) => {
    const current = valuesFor(params, key);
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    if (next.length) params.set(key, next.join(',')); else params.delete(key);
  });

  const clearAll = () => updateParams((params) => {
    ['fabricType', 'gsm', 'width', 'work', 'dispatch', 'verified', 'maxPrice', 'maxMoq', 'minRating', 'priceBand'].forEach((key) => params.delete(key));
  });

  const saveCurrentSearch = () => {
    if (!saveSearchName.trim()) return;
    const currentParams = searchParams.toString();
    const newSearch: SavedSearch = {
      id: `ss-${Date.now()}`,
      name: saveSearchName.trim(),
      params: currentParams,
      created_at: new Date().toISOString(),
    };
    const updated = [newSearch, ...savedSearches.slice(0, 9)];
    setSavedSearches(updated);
    writeSavedSearches(user?.id, updated);
    setSaveSearchName('');
    setShowSaveInput(false);
  };

  const applySavedSearch = (search: SavedSearch) => {
    router.replace(`${pathname}${search.params ? `?${search.params}` : ''}`, { scroll: false });
    setMobileOpen(false);
  };

  const deleteSavedSearch = (id: string) => {
    const updated = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(updated);
    writeSavedSearches(user?.id, updated);
  };

  const filterContent = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="FunnelIcon" size={16} className="text-foreground" />
          <span className="text-sm font-850 text-foreground">Refine results</span>
          {totalActive > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-800 text-white">{totalActive}</span>}
        </div>
        {totalActive > 0 && <button type="button" onClick={clearAll} className="text-xs font-750 text-primary hover:underline">Clear all</button>}
      </div>

      {/* Saved searches */}
      {savedSearches.length > 0 && (
        <div className="border-b border-border pb-4">
          <p className="mb-2 text-xs font-800 text-foreground">Saved searches</p>
          <div className="space-y-1">
            {savedSearches.map((s) => (
              <div key={s.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applySavedSearch(s)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-700 text-primary hover:bg-primary/10 transition"
                >
                  <Icon name="BookmarkIcon" size={12} className="shrink-0" />
                  <span className="truncate">{s.name}</span>
                </button>
                <button type="button" onClick={() => deleteSavedSearch(s.id)} className="shrink-0 rounded p-1 text-muted-foreground hover:text-error" aria-label="Delete saved search">
                  <Icon name="XMarkIcon" size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save current search */}
      {totalActive > 0 && (
        <div>
          {showSaveInput ? (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveCurrentSearch()}
                placeholder="Name this search…"
                className="input-base min-w-0 flex-1 px-2.5 py-1.5 text-xs"
                autoFocus
              />
              <button type="button" onClick={saveCurrentSearch} className="ft-primary-action px-2.5 py-1.5 text-xs">Save</button>
              <button type="button" onClick={() => setShowSaveInput(false)} className="ft-secondary-action px-2 py-1.5 text-xs">✕</button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowSaveInput(true)} className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs font-700 text-muted-foreground hover:border-primary hover:text-primary transition">
              <Icon name="BookmarkIcon" size={13} /> Save this search
            </button>
          )}
        </div>
      )}

      {/* Verified sellers toggle */}
      <button type="button" onClick={() => updateParams((params) => verifiedOnly ? params.delete('verified') : params.set('verified', '1'))} className="flex w-full items-center justify-between border-b border-border py-2 text-left" aria-pressed={verifiedOnly}>
        <span className="flex items-center gap-2"><Icon name="ShieldCheckIcon" size={14} className="text-success" /><span className="text-sm font-700 text-foreground">Verified sellers</span></span>
        <span className={`relative h-6 w-11 rounded-full transition-colors ${verifiedOnly ? 'bg-success' : 'bg-muted-foreground/30'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${verifiedOnly ? 'translate-x-5' : 'translate-x-0.5'}`} /></span>
      </button>

      {/* Seller rating filter */}
      <div className="border-b border-border pb-4">
        <p className="mb-2 text-sm font-800 text-foreground">Seller rating</p>
        <div className="space-y-1">
          {SELLER_RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => updateParams((params) => r.value ? params.set('minRating', r.value) : params.delete('minRating'))}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition ${minRating === r.value || (!minRating && !r.value) ? 'bg-primary/10 font-750 text-primary' : 'text-foreground hover:bg-muted'}`}
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${minRating === r.value || (!minRating && !r.value) ? 'border-primary bg-primary' : 'border-border'}`}>
                {(minRating === r.value || (!minRating && !r.value)) && <Icon name="CheckIcon" size={10} className="text-white" />}
              </span>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price band presets */}
      <div className="border-b border-border pb-4">
        <p className="mb-2 text-sm font-800 text-foreground">Price band</p>
        <div className="flex flex-wrap gap-1.5">
          {PRICE_BANDS.map((band) => {
            const active = priceBand === String(band.max);
            return (
              <button
                key={band.max}
                type="button"
                onClick={() => updateParams((params) => {
                  if (active) { params.delete('priceBand'); params.delete('maxPrice'); }
                  else { params.set('priceBand', String(band.max)); params.set('maxPrice', String(band.max)); }
                })}
                className={`rounded-full px-2.5 py-1 text-xs font-750 transition ${active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                {band.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price slider */}
      <div>
        <div className="mb-2 flex items-center justify-between"><p className="text-sm font-750 text-foreground">Price up to</p><output className="text-xs font-800 text-primary">₹{priceMax.toLocaleString('en-IN')}/m</output></div>
        <input aria-label="Maximum price per metre" type="range" min={100} max={10000} step={100} value={priceMax} onChange={(event) => updateParams((params) => { const value = Number(event.target.value); if (value === 5000) params.delete('maxPrice'); else params.set('maxPrice', String(value)); params.delete('priceBand'); })} className="w-full accent-primary" />
      </div>

      {/* MOQ slider */}
      <div>
        <div className="mb-2 flex items-center justify-between"><p className="text-sm font-750 text-foreground">MOQ up to</p><output className="text-xs font-800 text-primary">{moqMax} mtrs</output></div>
        <input aria-label="Maximum minimum order quantity" type="range" min={1} max={1000} step={5} value={moqMax} onChange={(event) => updateParams((params) => { const value = Number(event.target.value); if (value === 500) params.delete('maxMoq'); else params.set('maxMoq', String(value)); })} className="w-full accent-primary" />
      </div>

      {/* Filter groups */}
      {filterGroups.map((group) => (
        <div key={group.key} className="border-t border-border pt-4">
          <button type="button" onClick={() => setExpanded((current) => current.includes(group.key) ? current.filter((key) => key !== group.key) : [...current, group.key])} className="mb-2 flex w-full items-center justify-between" aria-expanded={expanded.includes(group.key)}>
            <span className="text-sm font-800 text-foreground">{group.label}</span>
            <Icon name={expanded.includes(group.key) ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-muted-foreground" />
          </button>
          {expanded.includes(group.key) && (
            <div className="space-y-1">
              {group.options.map((option) => {
                const active = (selected[group.key] || []).includes(option);
                return (
                  <button key={option} type="button" onClick={() => toggleOption(group.key, option)} className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] transition ${active ? 'bg-primary/10 font-750 text-primary' : 'text-foreground hover:bg-muted'}`} aria-pressed={active}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${active ? 'border-primary bg-primary' : 'border-border'}`}>{active && <Icon name="CheckIcon" size={10} className="text-white" />}</span>
                    {option}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile filter trigger */}
      <div className="mb-2 lg:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} className="btn-secondary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-700">
          <Icon name="FunnelIcon" size={16} />
          Filters {totalActive > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs text-white">{totalActive}</span>}
        </button>
      </div>

      {/* Mobile filter drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-0 left-0 top-0 w-[min(360px,94vw)] overflow-y-auto bg-background p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-base font-850 text-foreground">Refine products</span>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 hover:bg-muted" aria-label="Close filters">
                <Icon name="XMarkIcon" size={20} className="text-foreground" />
              </button>
            </div>
            {filterContent}
            <button type="button" onClick={() => setMobileOpen(false)} className="btn-primary mt-6 w-full rounded-lg py-3 text-sm font-700">
              Show results {totalActive > 0 && `(${totalActive} filters)`}
            </button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block" aria-label="Marketplace filters">
        <div className="ft-marketplace-filters-card sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin">
          {filterContent}
        </div>
      </aside>
    </>
  );
}
