'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';

type FilterChip = {
  id: string;
  label: string;
  key: string;
  value?: string;
};

const listFilters = [
  ['fabricType', 'Fabric'],
  ['gsm', 'GSM'],
  ['width', 'Width'],
  ['work', 'Work'],
  ['dispatch', 'Dispatch'],
] as const;

export default function MarketplaceActiveFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const chips = useMemo<FilterChip[]>(() => {
    const items: FilterChip[] = [];
    const search = searchParams.get('search');
    if (search) items.push({ id: `search-${search}`, label: `Search: ${search}`, key: 'search' });

    listFilters.forEach(([key, prefix]) => {
      (searchParams.get(key) || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((value) => items.push({ id: `${key}-${value}`, label: `${prefix}: ${value}`, key, value }));
    });

    if (searchParams.get('verified') === '1') {
      items.push({ id: 'verified', label: 'Verified sellers', key: 'verified' });
    }

    const maxPrice = searchParams.get('maxPrice');
    if (maxPrice) {
      items.push({
        id: `max-price-${maxPrice}`,
        label: `Up to ₹${Number(maxPrice).toLocaleString('en-IN')}/m`,
        key: 'maxPrice',
      });
    }

    const maxMoq = searchParams.get('maxMoq');
    if (maxMoq) {
      items.push({ id: `max-moq-${maxMoq}`, label: `MOQ up to ${maxMoq} m`, key: 'maxMoq' });
    }

    return items;
  }, [searchParams]);

  if (!chips.length) return null;

  const replaceParams = (params: URLSearchParams) => {
    params.delete('page');
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  };

  const removeChip = (chip: FilterChip) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!chip.value) {
      params.delete(chip.key);
      replaceParams(params);
      return;
    }

    const values = (params.get(chip.key) || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => value !== chip.value);

    if (values.length) params.set(chip.key, values.join(','));
    else params.delete(chip.key);
    replaceParams(params);
  };

  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    ['search', 'category', 'fabricType', 'gsm', 'width', 'work', 'dispatch', 'verified', 'maxPrice', 'maxMoq', 'page']
      .forEach((key) => params.delete(key));
    replaceParams(params);
  };

  return (
    <section className="ft-marketplace-active-filters" aria-label="Active marketplace filters">
      <div className="ft-marketplace-filter-label">
        <Icon name="AdjustmentsHorizontalIcon" size={15} />
        Active filters
      </div>
      <div className="ft-marketplace-filter-list">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => removeChip(chip)}
            className="ft-marketplace-filter-chip"
            aria-label={`Remove ${chip.label}`}
          >
            <span>{chip.label}</span>
            <Icon name="XMarkIcon" size={13} />
          </button>
        ))}
      </div>
      <button type="button" onClick={clearAll} className="ft-marketplace-clear-filters">
        Clear all
      </button>
    </section>
  );
}
