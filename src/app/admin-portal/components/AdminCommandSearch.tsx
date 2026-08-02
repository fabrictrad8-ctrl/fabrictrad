'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';

type SearchResult = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
};

const navigationResults: SearchResult[] = [
  { id: 'nav-home', kind: 'Navigation', title: 'Home', subtitle: 'Live commerce overview and tasks', href: '/admin-portal', icon: 'HomeIcon' },
  { id: 'nav-orders', kind: 'Navigation', title: 'Orders', subtitle: 'Search, filter and manage every order', href: '/admin-portal?tab=orders', icon: 'ShoppingBagIcon' },
  { id: 'nav-products', kind: 'Navigation', title: 'Products', subtitle: 'Review listings, inventory and GTIN status', href: '/admin-portal?tab=listings', icon: 'TagIcon' },
  { id: 'nav-customers', kind: 'Navigation', title: 'Customers', subtitle: 'Buyer, seller and business accounts', href: '/admin-portal?tab=customers', icon: 'UsersIcon' },
  { id: 'nav-sellers', kind: 'Navigation', title: 'Seller verification', subtitle: 'GST, documents, bank and publishing access', href: '/admin-portal?tab=sellers', icon: 'BuildingStorefrontIcon' },
  { id: 'nav-payments', kind: 'Navigation', title: 'Payments', subtitle: 'Razorpay captures, failures and refunds', href: '/admin-portal?tab=payments', icon: 'CreditCardIcon' },
  { id: 'nav-reconciliation', kind: 'Navigation', title: 'Reconciliation', subtitle: 'Commission and settlements', href: '/admin-portal?tab=reconciliation', icon: 'ArrowsRightLeftIcon' },
  { id: 'nav-analytics', kind: 'Navigation', title: 'Analytics', subtitle: 'Seller and fulfillment performance', href: '/admin-portal?tab=seller-metrics', icon: 'PresentationChartLineIcon' },
  { id: 'nav-discounts', kind: 'Navigation', title: 'Discounts', subtitle: 'Campaigns and promotion controls', href: '/admin-portal?tab=discounts', icon: 'ReceiptPercentIcon' },
  { id: 'nav-settings', kind: 'Navigation', title: 'Settings', subtitle: 'Platform policy and operational settings', href: '/admin-portal?tab=settings', icon: 'CogIcon' },
];

export default function AdminCommandSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const localResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return navigationResults.slice(0, 7);
    return navigationResults.filter((item) =>
      `${item.title} ${item.subtitle} ${item.kind}`.toLowerCase().includes(normalized)
    );
  }, [query]);

  const results = useMemo(
    () => [...localResults, ...remoteResults.filter((remote) => !localResults.some((local) => local.id === remote.id))].slice(0, 20),
    [localResults, remoteResults]
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const normalized = query.trim();
    if (!open || normalized.length < 2) {
      setRemoteResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(normalized)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          results?: SearchResult[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || 'Search failed.');
        setRemoteResults(payload.results || []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setRemoteResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const choose = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    router.push(result.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden min-h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-muted/60 px-3 text-left text-sm text-muted-foreground transition hover:border-primary/30 hover:bg-card md:flex md:max-w-xl"
        aria-label="Search FabricTrad admin"
      >
        <Icon name="MagnifyingGlassIcon" size={17} />
        <span className="truncate">Search orders, products, customers, sellers and settings</span>
        <kbd className="ml-auto rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-800 text-muted-foreground">Ctrl K</kbd>
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ft-icon-button md:hidden"
        aria-label="Search FabricTrad admin"
      >
        <Icon name="MagnifyingGlassIcon" size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 px-3 pt-[8vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Search FabricTrad admin">
          <button type="button" className="absolute inset-0" onClick={() => setOpen(false)} aria-label="Close search" />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Icon name="MagnifyingGlassIcon" size={20} className="text-muted-foreground" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveIndex((index) => Math.min(results.length - 1, index + 1));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(0, index - 1));
                  } else if (event.key === 'Enter' && results[activeIndex]) {
                    event.preventDefault();
                    choose(results[activeIndex]);
                  }
                }}
                placeholder="Search by order number, name, email, phone, GSTIN, SKU or setting"
                className="min-w-0 flex-1 bg-transparent py-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
              {loading && <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground">Esc</button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Icon name="MagnifyingGlassIcon" size={28} className="mx-auto text-muted-foreground" />
                  <p className="mt-3 text-sm font-800 text-foreground">No matching records</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try an order reference, customer email, GSTIN, SKU or navigation page.</p>
                </div>
              ) : (
                results.map((result, index) => (
                  <button
                    key={result.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(result)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${index === activeIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
                      <Icon name={result.icon as 'HomeIcon'} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-800 text-foreground">{result.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>
                    </span>
                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-800 uppercase tracking-wider text-muted-foreground">{result.kind}</span>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-2.5 text-[11px] text-muted-foreground">
              <span>↑↓ navigate</span><span>Enter open</span><span>Esc close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
