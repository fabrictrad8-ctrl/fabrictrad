'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type LiveCategory = {
  name: string;
  count: number;
  image: string | null;
};

type SortMode = 'popular' | 'alphabetical' | 'largest';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<LiveCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('popular');

  const loadCategories = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data, error: productError } = await supabase
      .from('seller_products')
      .select('id,category,image_url,updated_at')
      .eq('status', 'active')
      .eq('approval_status', 'approved')
      .gt('available_quantity', 0)
      .order('updated_at', { ascending: false });

    if (productError) {
      setCategories([]);
      setError('Live categories could not be loaded.');
      setLoading(false);
      return;
    }

    const grouped = new Map<string, LiveCategory>();
    (data || []).forEach((product) => {
      const name = String(product.category || 'Other').trim() || 'Other';
      const current = grouped.get(name);
      if (current) {
        current.count += 1;
        if (!current.image && product.image_url) current.image = product.image_url;
      } else {
        grouped.set(name, {
          name,
          count: 1,
          image: product.image_url || null,
        });
      }
    });

    setCategories([...grouped.values()]);
    setLoading(false);
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const visibleCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = categories.filter(
      (category) => !normalized || category.name.toLowerCase().includes(normalized)
    );
    return [...filtered].sort((a, b) => {
      if (sort === 'alphabetical') return a.name.localeCompare(b.name);
      return b.count - a.count || a.name.localeCompare(b.name);
    });
  }, [categories, query, sort]);

  const totalProducts = categories.reduce((total, category) => total + category.count, 0);

  return (
    <BuyerOnlyGuard>
      <main className="ft-storefront min-h-screen">
        <Header />
        <div className="pt-16">
          <section className="ft-route-hero px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="relative z-10 mx-auto max-w-[1440px]">
              <div className="max-w-3xl">
                <p className="ft-route-kicker">Live fabric catalogue</p>
                <h1 className="ft-route-title mt-3">Browse categories that sellers actually have live now.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {loading
                    ? 'Loading approved marketplace inventory…'
                    : `${totalProducts.toLocaleString('en-IN')} approved live ${totalProducts === 1 ? 'listing' : 'listings'} across ${categories.length} ${categories.length === 1 ? 'category' : 'categories'}.`}
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/marketplace" className="ft-primary-action inline-flex items-center gap-2 px-5 py-3 text-sm">
                  Browse all products <Icon name="ArrowRightIcon" size={16} />
                </Link>
                <Link href="/buyer-requirements" className="ft-secondary-action inline-flex items-center gap-2 px-5 py-3 text-sm">
                  <Icon name="MegaphoneIcon" size={16} /> Post a requirement
                </Link>
              </div>
            </div>
          </section>

          <section className="ft-storefront-content py-7 sm:py-9">
            <div className="ft-filter-bar mb-6">
              <div className="ft-search min-w-[220px] flex-1">
                <Icon name="MagnifyingGlassIcon" size={18} className="ml-3 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search live categories"
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="mr-2 rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Clear search">
                    <Icon name="XMarkIcon" size={16} />
                  </button>
                )}
              </div>
              <label className="flex min-w-[190px] items-center gap-2 text-xs font-750 text-muted-foreground">
                Sort
                <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="ft-filter-control flex-1 px-3 text-sm">
                  <option value="popular">Most live products</option>
                  <option value="largest">Most products</option>
                  <option value="alphabetical">A–Z</option>
                </select>
              </label>
              <span className="ft-orange-chip">{visibleCategories.length} live categories</span>
            </div>

            {error && (
              <div role="alert" className="mb-5 flex items-center justify-between rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                <span>{error}</span>
                <button type="button" onClick={() => void loadCategories()} className="font-800 underline">Retry</button>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-64 animate-pulse rounded-2xl border border-border bg-muted" />
                ))}
              </div>
            ) : visibleCategories.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleCategories.map((category) => (
                  <Link
                    key={category.name}
                    href={`/marketplace?category=${encodeURIComponent(category.name)}`}
                    className="ft-resource-card group overflow-hidden"
                  >
                    <div className="ft-resource-image relative aspect-[16/10] overflow-hidden bg-muted">
                      {category.image ? (
                        <AppImage
                          src={category.image}
                          alt={`${category.name} live product`}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-4xl font-800 text-muted-foreground/40">
                          {category.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                      <span className="absolute right-3 top-3 rounded-full border border-white/30 bg-black/30 px-2.5 py-1 text-xs font-750 text-white backdrop-blur-md">
                        {category.count} live {category.count === 1 ? 'product' : 'products'}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-base font-800 text-foreground group-hover:text-primary">{category.name}</h2>
                        <Icon name="ArrowUpRightIcon" size={17} className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Derived directly from approved seller inventory currently available on FabricTrad.
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ft-card ft-empty-state">
                <div>
                  <Icon name="Squares2X2Icon" size={34} className="mx-auto text-primary" />
                  <h2 className="mt-4 text-lg font-800">{categories.length ? `No categories match “${query}”` : 'No live categories yet'}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {categories.length ? 'Try a broader category name.' : 'Categories appear automatically when approved seller products are live and in stock.'}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
        <Footer />
      </main>
    </BuyerOnlyGuard>
  );
}
