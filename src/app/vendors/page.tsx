'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type LiveVendor = {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string;
  categories: string[];
  rating: number;
  reviews: number;
  products: number;
  verified: boolean;
  gstinVerified: boolean;
  image: string | null;
  dispatchDays: number | null;
};

type SortMode = 'recommended' | 'rating' | 'products';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<LiveVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All');
  const [state, setState] = useState('All');
  const [sort, setSort] = useState<SortMode>('recommended');

  const loadVendors = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data: products, error: productError } = await supabase
      .from('seller_products')
      .select('seller_id,category,image_url,origin_city,origin_state,dispatch_days')
      .eq('status', 'active')
      .eq('approval_status', 'approved')
      .gt('available_quantity', 0);

    if (productError) {
      setVendors([]);
      setError('The live supplier directory could not be loaded.');
      setLoading(false);
      return;
    }

    const sellerIds = [...new Set((products || []).map((row) => row.seller_id).filter(Boolean))];
    if (!sellerIds.length) {
      setVendors([]);
      setLoading(false);
      return;
    }

    const [profileResult, ratingResult] = await Promise.all([
      supabase
        .from('seller_profiles')
        .select('id,display_name,legal_business_name,business_type,gstin_status,gstin_verified,verification_status,is_active')
        .in('id', sellerIds)
        .eq('is_active', true)
        .eq('verification_status', 'verified'),
      supabase
        .from('seller_rating_aggregates')
        .select('seller_id,review_count,avg_rating')
        .in('seller_id', sellerIds),
    ]);

    const profiles = profileResult.data;
    const profileError = profileResult.error;
    const ratings = ratingResult.data;

    if (profileError) {
      setVendors([]);
      setError('Verified supplier profiles could not be loaded.');
      setLoading(false);
      return;
    }

    const ratingBySeller = new Map(
      (ratings || []).map((row) => [
        row.seller_id,
        { rating: Number(row.avg_rating || 0), reviews: Number(row.review_count || 0) },
      ])
    );

    const live = (profiles || []).map((profile) => {
      const sellerProducts = (products || []).filter((row) => row.seller_id === profile.id);
      const categories = [...new Set(sellerProducts.map((row) => String(row.category || 'Other')).filter(Boolean))];
      const dispatchValues = sellerProducts
        .map((row) => Number(row.dispatch_days || 0))
        .filter((value) => value > 0);
      const rating = ratingBySeller.get(profile.id) || { rating: 0, reviews: 0 };
      const locationProduct = sellerProducts.find((row) => row.origin_city || row.origin_state);
      return {
        id: profile.id,
        name: profile.display_name || profile.legal_business_name || 'Verified FabricTrad Seller',
        city: locationProduct?.origin_city || '',
        state: locationProduct?.origin_state || '',
        type: profile.business_type || 'Seller',
        categories,
        rating: rating.rating,
        reviews: rating.reviews,
        products: sellerProducts.length,
        verified: profile.verification_status === 'verified',
        gstinVerified: profile.gstin_status === 'active' || profile.gstin_verified === true,
        image: sellerProducts.find((row) => row.image_url)?.image_url || null,
        dispatchDays: dispatchValues.length ? Math.min(...dispatchValues) : null,
      } satisfies LiveVendor;
    });

    setVendors(live);
    setLoading(false);
  };

  useEffect(() => {
    void loadVendors();
  }, []);

  const vendorTypes = ['All', ...Array.from(new Set(vendors.map((vendor) => vendor.type)))];
  const vendorStates = ['All', ...Array.from(new Set(vendors.map((vendor) => vendor.state).filter(Boolean)))];

  const visibleVendors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return vendors
      .filter((vendor) => {
        const matchesQuery =
          !normalized ||
          `${vendor.name} ${vendor.city} ${vendor.state} ${vendor.type} ${vendor.categories.join(' ')}`
            .toLowerCase()
            .includes(normalized);
        return matchesQuery && (type === 'All' || vendor.type === type) && (state === 'All' || vendor.state === state);
      })
      .sort((a, b) => {
        if (sort === 'rating') return b.rating - a.rating || b.reviews - a.reviews;
        if (sort === 'products') return b.products - a.products;
        return Number(b.gstinVerified) - Number(a.gstinVerified) || b.products - a.products || b.rating - a.rating;
      });
  }, [query, sort, state, type, vendors]);

  const clearFilters = () => {
    setQuery('');
    setType('All');
    setState('All');
    setSort('recommended');
  };

  return (
    <BuyerOnlyGuard>
      <main className="ft-storefront min-h-screen">
        <Header />
        <div className="pt-16">
          <section className="ft-route-hero px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="relative z-10 mx-auto max-w-[1440px]">
              <div className="max-w-3xl">
                <p className="ft-route-kicker">Live supplier directory</p>
                <h1 className="ft-route-title mt-3">Find verified sellers with approved products available now.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Every supplier shown here comes from the real FabricTrad seller profile and live marketplace inventory. No sample vendors are mixed into this directory.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/marketplace" className="ft-primary-action inline-flex items-center gap-2 px-5 py-3 text-sm">
                  Browse products <Icon name="ArrowRightIcon" size={16} />
                </Link>
                <Link href="/buyer-requirements" className="ft-secondary-action inline-flex items-center gap-2 px-5 py-3 text-sm">
                  <Icon name="MegaphoneIcon" size={16} /> Request supplier quotes
                </Link>
              </div>
            </div>
          </section>

          <section className="ft-storefront-content py-7 sm:py-9">
            <div className="ft-filter-bar mb-6">
              <div className="ft-search min-w-[240px] flex-[2_1_320px]">
                <Icon name="MagnifyingGlassIcon" size={18} className="ml-3 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search live supplier, city or category"
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                />
              </div>
              <select value={type} onChange={(event) => setType(event.target.value)} className="ft-filter-control min-w-[150px] px-3 text-sm" aria-label="Vendor type">
                {vendorTypes.map((item) => <option key={item}>{item === 'All' ? 'All supplier types' : item}</option>)}
              </select>
              <select value={state} onChange={(event) => setState(event.target.value)} className="ft-filter-control min-w-[160px] px-3 text-sm" aria-label="Vendor state">
                {vendorStates.map((item) => <option key={item}>{item === 'All' ? 'All states' : item}</option>)}
              </select>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="ft-filter-control min-w-[150px] px-3 text-sm" aria-label="Sort vendors">
                <option value="recommended">Recommended</option>
                <option value="rating">Highest rated</option>
                <option value="products">Most live products</option>
              </select>
              <span className="ft-orange-chip">{loading ? 'Loading…' : `${visibleVendors.length} live suppliers`}</span>
            </div>

            {error && (
              <div role="alert" className="mb-5 flex items-center justify-between rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
                <span>{error}</span>
                <button type="button" onClick={() => void loadVendors()} className="font-800 underline">Retry</button>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl border border-border bg-muted" />)}
              </div>
            ) : visibleVendors.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleVendors.map((vendor) => (
                  <Link key={vendor.id} href={`/marketplace?search=${encodeURIComponent(vendor.name)}`} className="ft-resource-card group p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="ft-resource-image relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                        {vendor.image ? (
                          <AppImage src={vendor.image} alt={`${vendor.name} product`} fill sizes="64px" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xl font-800 text-muted-foreground">{vendor.name.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {vendor.verified && (
                            <span className="ft-badge ft-badge--success">
                              <Icon name="CheckBadgeIcon" size={13} /> Verified seller
                            </span>
                          )}
                          {vendor.gstinVerified && <span className="ft-orange-chip">GSTIN verified</span>}
                        </div>
                        <h2 className="mt-2 text-base font-800 leading-snug text-foreground group-hover:text-primary">{vendor.name}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[vendor.city, vendor.state].filter(Boolean).join(', ') || 'India'} · {vendor.type}
                        </p>
                      </div>
                      <Icon name="ArrowUpRightIcon" size={18} className="shrink-0 text-muted-foreground group-hover:text-primary" />
                    </div>

                    {!!vendor.categories.length && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {vendor.categories.map((category) => (
                          <span key={category} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-650 text-muted-foreground">{category}</span>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/40 p-3 text-center">
                      <div>
                        <p className="text-sm font-800 text-foreground">{vendor.reviews ? `★ ${vendor.rating.toFixed(1)}` : 'New'}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{vendor.reviews} reviews</p>
                      </div>
                      <div className="border-x border-border">
                        <p className="text-sm font-800 text-foreground">{vendor.products}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Live products</p>
                      </div>
                      <div>
                        <p className="text-sm font-800 text-foreground">{vendor.dispatchDays ? `${vendor.dispatchDays}d` : '—'}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Fastest dispatch</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs">
                      <span className="font-750 text-success">Live verified profile</span>
                      <span className="font-800 text-primary">View live products →</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ft-card ft-empty-state">
                <div>
                  <Icon name="BuildingStorefrontIcon" size={36} className="mx-auto text-primary" />
                  <h2 className="mt-4 text-lg font-800">{vendors.length ? 'No suppliers match these filters' : 'No verified suppliers with live inventory yet'}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Only real verified sellers with approved in-stock products appear here.</p>
                  {vendors.length > 0 && <button type="button" onClick={clearFilters} className="ft-primary-action mt-5 px-5 py-2.5 text-sm">Clear filters</button>}
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
