'use client';

import React, { useMemo, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const vendors = [
  { id: 'v1', name: 'Surat Textile Mills Pvt Ltd', city: 'Surat', state: 'Gujarat', type: 'Manufacturer', categories: ['Net Fabric', 'Embroidered', 'Georgette'], rating: 4.8, reviews: 124, products: 48, verified: true, gstin: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_14bfaf88b-1784378867391.png', badge: 'Top seller', dispatch: '2–4 days' },
  { id: 'v2', name: 'Bhiwandi Weave House', city: 'Bhiwandi', state: 'Maharashtra', type: 'Wholesaler', categories: ['Cotton', 'Cambric', 'Linen'], rating: 4.6, reviews: 89, products: 32, verified: true, gstin: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_140561897-1774719752264.png', badge: null, dispatch: '3–5 days' },
  { id: 'v3', name: 'Jaipur Crafts Emporium', city: 'Jaipur', state: 'Rajasthan', type: 'Manufacturer', categories: ['Georgette', 'Embroidered', 'Block Print'], rating: 4.9, reviews: 67, products: 56, verified: true, gstin: true, image: 'https://images.unsplash.com/photo-1605324681498-5fa02cf261ea?w=900&auto=format&fit=crop', badge: 'Best rated', dispatch: '4–6 days' },
  { id: 'v4', name: 'Varanasi Silk Traders', city: 'Varanasi', state: 'Uttar Pradesh', type: 'Trader', categories: ['Banarasi Silk', 'Brocade', 'Zari'], rating: 5.0, reviews: 43, products: 24, verified: true, gstin: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_125302a3b-1772157972644.png', badge: 'Premium', dispatch: '3–5 days' },
  { id: 'v5', name: 'Kutch Khadi Gramodyog', city: 'Bhuj', state: 'Gujarat', type: 'Manufacturer', categories: ['Khadi', 'Handloom', 'Natural Fibre'], rating: 4.7, reviews: 56, products: 18, verified: true, gstin: true, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_145f6658f-1766611006562.png', badge: null, dispatch: '5–7 days' },
  { id: 'v6', name: 'Ahmedabad Denim Works', city: 'Ahmedabad', state: 'Gujarat', type: 'Manufacturer', categories: ['Denim', 'Stretch Fabric', 'Twill'], rating: 4.5, reviews: 78, products: 22, verified: true, gstin: false, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1b71e654a-1767339934944.png', badge: null, dispatch: '3–5 days' },
];

type SortMode = 'recommended' | 'rating' | 'products';

export default function VendorsPage() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All');
  const [state, setState] = useState('All');
  const [sort, setSort] = useState<SortMode>('recommended');

  const vendorTypes = ['All', ...Array.from(new Set(vendors.map((vendor) => vendor.type)))];
  const vendorStates = ['All', ...Array.from(new Set(vendors.map((vendor) => vendor.state)))];

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
        if (sort === 'rating') return b.rating - a.rating;
        if (sort === 'products') return b.products - a.products;
        return Number(Boolean(b.badge)) - Number(Boolean(a.badge)) || b.rating - a.rating;
      });
  }, [query, sort, state, type]);

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
                <p className="ft-route-kicker">Supplier directory</p>
                <h1 className="ft-route-title mt-3">Find verified textile partners, compare capability and source with confidence.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Search manufacturers, wholesalers and traders by location, category, catalogue depth, rating and dispatch readiness.
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
                  placeholder="Search supplier, city or fabric"
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
                <option value="products">Most products</option>
              </select>
              <span className="ft-orange-chip">{visibleVendors.length} suppliers</span>
            </div>

            {visibleVendors.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleVendors.map((vendor) => (
                  <Link key={vendor.id} href={`/marketplace?seller=${vendor.id}`} className="ft-resource-card group p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="ft-resource-image relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                        <AppImage src={vendor.image} alt={`${vendor.name} supplier`} fill sizes="64px" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {vendor.badge && <span className="ft-orange-chip">{vendor.badge}</span>}
                          {vendor.verified && (
                            <span className="ft-badge ft-badge--success">
                              <Icon name="CheckBadgeIcon" size={13} /> Verified
                            </span>
                          )}
                        </div>
                        <h2 className="mt-2 text-base font-800 leading-snug text-foreground group-hover:text-primary">{vendor.name}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">{vendor.city}, {vendor.state} · {vendor.type}</p>
                      </div>
                      <Icon name="ArrowUpRightIcon" size={18} className="shrink-0 text-muted-foreground group-hover:text-primary" />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {vendor.categories.map((category) => (
                        <span key={category} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-650 text-muted-foreground">{category}</span>
                      ))}
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/40 p-3 text-center">
                      <div>
                        <p className="text-sm font-800 text-foreground">★ {vendor.rating.toFixed(1)}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{vendor.reviews} reviews</p>
                      </div>
                      <div className="border-x border-border">
                        <p className="text-sm font-800 text-foreground">{vendor.products}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Products</p>
                      </div>
                      <div>
                        <p className="text-sm font-800 text-foreground">{vendor.dispatch}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Dispatch</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs">
                      <span className={vendor.gstin ? 'font-750 text-success' : 'font-650 text-warning'}>
                        {vendor.gstin ? 'GST details verified' : 'Business verification active'}
                      </span>
                      <span className="font-800 text-primary">View catalogue →</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ft-card ft-empty-state">
                <div>
                  <Icon name="BuildingStorefrontIcon" size={36} className="mx-auto text-primary" />
                  <h2 className="mt-4 text-lg font-800">No suppliers match these filters</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Clear the filters or post a sourcing requirement for sellers to respond.</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={clearFilters} className="ft-primary-action px-5 py-2.5 text-sm">Clear filters</button>
                    <Link href="/buyer-requirements" className="ft-secondary-action inline-flex items-center px-5 py-2.5 text-sm">Post requirement</Link>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="ft-route-kicker">Seller onboarding</p>
                <h2 className="mt-2 text-2xl font-800 tracking-tight text-foreground">Are you a textile manufacturer, wholesaler or trader?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Use the same FabricTrad account to activate selling, complete GST business verification and publish a structured catalogue.</p>
              </div>
              <Link href="/seller-registration" className="ft-primary-action inline-flex items-center justify-center gap-2 px-5 py-3 text-sm">
                Activate seller tools <Icon name="ArrowRightIcon" size={16} />
              </Link>
            </div>
          </section>
        </div>
        <Footer />
      </main>
    </BuyerOnlyGuard>
  );
}
