'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const categories = ['All Fabrics', 'Silk', 'Cotton', 'Net & Netting', 'Georgette', 'Polyester', 'Handloom', 'Velvet', 'Organza', 'Linen', 'Denim', 'Wool'];
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
  const { profile } = useAuth();
  const [query, setQuery] = useState(searchParams.get('search') || '');
  const selectedFabricTypes = useMemo(() => (searchParams.get('fabricType') || '').split(',').map((value) => value.trim()).filter(Boolean), [searchParams]);
  const [searchCategory, setSearchCategory] = useState(selectedFabricTypes[0] || 'All Fabrics');

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
      if (value) params.set('search', value); else params.delete('search');
      if (searchCategory === 'All Fabrics') params.delete('fabricType'); else params.set('fabricType', searchCategory);
    });
  };

  const selectCategory = (category: string) => {
    setSearchCategory(category);
    updateParams((params) => {
      params.delete('category');
      if (category === 'All Fabrics') params.delete('fabricType'); else params.set('fabricType', category);
    });
  };

  const toggleQuickFilter = (key: string, value: string) => updateParams((params) => {
    if (params.get(key) === value) params.delete(key); else params.set(key, value);
  });

  const deliveryLocation = [profile?.city, profile?.state].filter(Boolean).join(', ');
  const buyerMode = profile?.account_kind === 'business' ? 'Business buying' : 'Personal buying';

  return (
    <section className="ft-marketplace-hero" aria-labelledby="marketplace-title">
      <div className="ft-marketplace-hero-inner">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-200">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><Icon name="MapPinIcon" size={13} /> {deliveryLocation ? `Delivering to ${deliveryLocation}` : 'Add delivery location from your profile'}</span>
            <span className="inline-flex items-center gap-1.5"><Icon name="UserCircleIcon" size={13} /> {buyerMode}</span>
          </div>
          <Link href="/buyer-dashboard?tab=orders" className="font-800 text-white hover:underline">Your orders</Link>
        </div>

        <div className="ft-marketplace-heading">
          <div>
            <p className="mb-2 text-[11px] font-850 uppercase tracking-[0.16em] text-orange-200">FabricTrad marketplace</p>
            <h1 id="marketplace-title">Find the right fabric, seller and quantity faster.</h1>
          </div>
          <p>Compare real seller inventory, price per unit, MOQ, variants and dispatch time before you open the product page.</p>
        </div>

        <form className="ft-marketplace-search" onSubmit={handleSearch} role="search" aria-label="Marketplace product search">
          <select value={searchCategory} onChange={(event) => setSearchCategory(event.target.value)} aria-label="Search category" className="mr-3 hidden h-10 max-w-40 border-0 border-r border-slate-200 bg-slate-100 px-2 text-xs font-750 text-slate-700 outline-none sm:block">
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
          <div className="flex min-w-0 items-center gap-2">
            <Icon name="MagnifyingGlassIcon" size={20} className="shrink-0 text-slate-500" />
            <input id="marketplace-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search fabric, colour, work, supplier, HSN or SKU" aria-label="Search marketplace products" autoComplete="off" />
          </div>
          <button type="submit">Search</button>
        </form>

        <div className="ft-marketplace-category-row" aria-label="Fabric categories">
          {categories.map((category) => {
            const active = category === 'All Fabrics' ? selectedFabricTypes.length === 0 : selectedFabricTypes.includes(category);
            return <button key={category} type="button" onClick={() => selectCategory(category)} className={`ft-marketplace-category ${active ? 'is-active' : ''}`} aria-pressed={active}>{category}</button>;
          })}
        </div>

        <div className="ft-marketplace-quick-row" aria-label="Quick filters">
          {quickFilters.map((filter) => {
            const active = searchParams.get(filter.key) === filter.value;
            return <button key={filter.label} type="button" onClick={() => toggleQuickFilter(filter.key, filter.value)} className={`ft-marketplace-quick-filter ${active ? 'is-active' : ''}`} aria-pressed={active}><Icon name={filter.icon} size={15} />{filter.label}</button>;
          })}
        </div>

        <div className="ft-marketplace-utility-links" aria-label="Purchasing tools">
          <Link href="/buyer-requirements" className="ft-marketplace-utility-link"><Icon name="MegaphoneIcon" size={15} /> Post a sourcing requirement</Link>
          <Link href="/company-purchasing" className="ft-marketplace-utility-link"><Icon name="BuildingOfficeIcon" size={15} /> Company purchasing settings</Link>
          <Link href="/buyer-dashboard?tab=orders" className="ft-marketplace-utility-link"><Icon name="ArrowPathIcon" size={15} /> Reorder and track purchases</Link>
          <Link href="/vendors" className="ft-marketplace-utility-link"><Icon name="ShieldCheckIcon" size={15} /> Browse verified vendors</Link>
        </div>
      </div>
    </section>
  );
}
