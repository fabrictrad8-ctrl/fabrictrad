'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ALL_FABRICS = 'All fabrics';

/**
 * Compact Amazon-style search strip + category rail. This replaces the tall
 * marketing hero: the browse page now spends its first viewport on search,
 * categories and products instead of copy.
 *
 * The category rail is built from the live catalogue (distinct
 * seller_products.category over the same active/approved/in-stock predicate the
 * grid uses), so every chip resolves to at least one real product.
 */
export default function MarketplaceBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [query, setQuery] = useState(searchParams.get('search') || '');
  const [categories, setCategories] = useState<string[]>([]);

  const accountKind = profile?.account_kind;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      let request = supabase
        .from('seller_products')
        .select('category')
        .eq('status', 'active')
        .eq('approval_status', 'approved')
        .gt('available_quantity', 0);
      if (accountKind === 'individual') request = request.eq('end_user_enabled', true).in('sale_channel', ['retail', 'both']);
      const { data } = await request;
      if (cancelled || !data) return;
      const unique = [...new Set(data.map((row) => String(row.category || '')).filter(Boolean))];
      setCategories(unique.sort((a, b) => a.localeCompare(b)));
    };
    void load();
    return () => { cancelled = true; };
  }, [accountKind]);

  const selectedFabricTypes = useMemo(
    () => (searchParams.get('fabricType') || '').split(',').map((value) => value.trim()).filter(Boolean),
    [searchParams]
  );
  const [searchScope, setSearchScope] = useState(ALL_FABRICS);

  useEffect(() => { setQuery(searchParams.get('search') || ''); }, [searchParams]);

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
      if (searchScope === ALL_FABRICS) params.delete('fabricType'); else params.set('fabricType', searchScope);
    });
  };

  const selectCategory = (category: string) => {
    setSearchScope(category === ALL_FABRICS ? ALL_FABRICS : category);
    updateParams((params) => {
      params.delete('category');
      if (category === ALL_FABRICS) params.delete('fabricType'); else params.set('fabricType', category);
    });
  };

  const deliveryLocation = [profile?.city, profile?.state].filter(Boolean).join(', ');
  const buyerMode = profile?.account_kind === 'business' ? 'Business buying' : 'Personal buying';

  return (
    <>
      <section className="ftm-searchbar" aria-labelledby="marketplace-title">
        <div className="ftm-searchbar-inner">
          <h1 id="marketplace-title" className="sr-only">FabricTrad marketplace</h1>

          <form className="ftm-search" onSubmit={handleSearch} role="search" aria-label="Marketplace product search">
            <select
              value={searchScope}
              onChange={(event) => setSearchScope(event.target.value)}
              aria-label="Search within category"
              className="ftm-search-scope"
            >
              <option>{ALL_FABRICS}</option>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
            <input
              id="marketplace-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search fabric, colour, work, supplier or SKU"
              aria-label="Search marketplace products"
              autoComplete="off"
              className="ftm-search-field"
            />
            <button type="submit" className="ftm-search-submit" aria-label="Search">
              <Icon name="MagnifyingGlassIcon" size={20} />
            </button>
          </form>

          <div className="ftm-searchbar-meta">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="MapPinIcon" size={13} />
              {deliveryLocation ? `Delivering to ${deliveryLocation}` : 'Add a delivery location in your profile'}
            </span>
            <span className="inline-flex items-center gap-1.5"><Icon name="UserCircleIcon" size={13} />{buyerMode}</span>
            <Link href="/buyer-dashboard?tab=orders">Your orders</Link>
            <Link href="/buyer-requirements">Post a sourcing requirement</Link>
            <Link href="/vendors">Verified vendors</Link>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <nav className="ftm-navrail" aria-label="Fabric categories">
          <div className="ftm-navrail-inner">
            {[ALL_FABRICS, ...categories].map((category) => {
              const active = category === ALL_FABRICS
                ? selectedFabricTypes.length === 0
                : selectedFabricTypes.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => selectCategory(category)}
                  className={`ftm-navrail-item${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
