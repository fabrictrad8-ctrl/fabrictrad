'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';

const categories = [
  'All Fabrics',
  'Silk',
  'Cotton',
  'Net & Netting',
  'Georgette',
  'Polyester',
  'Handloom',
  'Velvet',
  'Organza',
  'Linen',
  'Denim',
  'Wool',
];

const quickFilters = [
  { label: 'Verified sellers', icon: 'ShieldCheckIcon', key: 'verified', value: '1' },
  { label: 'MOQ up to 50 m', icon: 'ArchiveBoxIcon', key: 'maxMoq', value: '50' },
  { label: 'Dispatch in 1–2 days', icon: 'TruckIcon', key: 'dispatch', value: '1-2 Days' },
  { label: 'Under ₹1,000/m', icon: 'TagIcon', key: 'maxPrice', value: '1000' },
] as const;

export default function MarketplaceBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('search') || '');

  const selectedFabricTypes = useMemo(
    () => (searchParams.get('fabricType') || '').split(',').map((value) => value.trim()).filter(Boolean),
    [searchParams]
  );

  const updateParams = (update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    params.delete('page');
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParams((params) => {
      const value = query.trim();
      if (value) params.set('search', value);
      else params.delete('search');
    });
  };

  const selectCategory = (category: string) => {
    updateParams((params) => {
      params.delete('category');
      if (category === 'All Fabrics') params.delete('fabricType');
      else params.set('fabricType', category);
    });
  };

  const toggleQuickFilter = (key: string, value: string) => {
    updateParams((params) => {
      if (params.get(key) === value) params.delete(key);
      else params.set(key, value);
    });
  };

  return (
    <section className="ft-marketplace-hero" aria-labelledby="marketplace-title">
      <div className="ft-marketplace-hero-inner">
        <div className="ft-marketplace-heading">
          <p className="mb-2 text-[11px] font-800 uppercase tracking-[0.18em] text-orange-200">
            Verified textile commerce
          </p>
          <h1 id="marketplace-title">Source fabrics with clearer pricing, stock and seller information.</h1>
          <p>
            Search live inventory, compare minimum order quantities and dispatch times, and buy using your company purchasing terms.
          </p>
        </div>

        <form className="ft-marketplace-search" onSubmit={handleSearch} role="search" aria-label="Marketplace product search">
          <Icon name="MagnifyingGlassIcon" size={20} className="text-slate-500" />
          <input
            id="marketplace-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search fabric, colour, work type, seller or SKU"
            aria-label="Search marketplace products"
            autoComplete="off"
          />
          <button type="submit">Search marketplace</button>
        </form>

        <div className="ft-marketplace-category-row" aria-label="Fabric categories">
          {categories.map((category) => {
            const active = category === 'All Fabrics'
              ? selectedFabricTypes.length === 0
              : selectedFabricTypes.includes(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => selectCategory(category)}
                className={`ft-marketplace-category ${active ? 'is-active' : ''}`}
                aria-pressed={active}
              >
                {category}
              </button>
            );
          })}
        </div>

        <div className="ft-marketplace-quick-row" aria-label="Quick filters">
          {quickFilters.map((filter) => {
            const active = searchParams.get(filter.key) === filter.value;
            return (
              <button
                key={filter.label}
                type="button"
                onClick={() => toggleQuickFilter(filter.key, filter.value)}
                className={`ft-marketplace-quick-filter ${active ? 'is-active' : ''}`}
                aria-pressed={active}
              >
                <Icon name={filter.icon} size={15} />
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="ft-marketplace-utility-links" aria-label="Purchasing tools">
          <Link href="/buyer-requirements" className="ft-marketplace-utility-link">
            <Icon name="MegaphoneIcon" size={15} />
            Post a sourcing requirement
          </Link>
          <Link href="/company-purchasing" className="ft-marketplace-utility-link">
            <Icon name="BuildingOfficeIcon" size={15} />
            Company purchasing settings
          </Link>
          <Link href="/buyer-dashboard?tab=orders" className="ft-marketplace-utility-link">
            <Icon name="ArrowPathIcon" size={15} />
            Reorder and track purchases
          </Link>
          <Link href="/vendors" className="ft-marketplace-utility-link">
            <Icon name="ShieldCheckIcon" size={15} />
            Browse verified vendors
          </Link>
        </div>
      </div>
    </section>
  );
}
