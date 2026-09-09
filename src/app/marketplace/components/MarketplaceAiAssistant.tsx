'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import AiAssistantWidget from '@/components/AiAssistantWidget';

/**
 * Mounts the buyer assistant on the marketplace browse page and tells it what
 * the shopper is actually looking at.
 *
 * Every filter on this page lives in the URL (MarketplaceGrid reads the same
 * search params to filter and sort its results), so the query string is the
 * single source of truth for "what is on screen" — no duplicated state and no
 * guessing. Only params that are genuinely set are described; an unfiltered
 * marketplace is reported as unfiltered rather than padded with defaults.
 */

// Mirrors the multi-value filter keys MarketplaceGrid reads via splitParam().
const LIST_FILTERS: ReadonlyArray<readonly [string, string]> = [
  ['fabricType', 'Fabric type'],
  ['gsm', 'GSM'],
  ['width', 'Width'],
  ['work', 'Work'],
  ['dispatch', 'Dispatch'],
] as const;

// Mirrors the sortOptions list rendered by MarketplaceGrid's sort <select>.
const SORT_LABELS: Record<string, string> = {
  relevance: 'Featured',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  newest: 'Newest arrivals',
  moq: 'Lowest MOQ',
  dispatch: 'Fastest dispatch',
};

export default function MarketplaceAiAssistant() {
  const searchParams = useSearchParams();

  const context = useMemo(() => {
    const parts: string[] = ['Page: marketplace product browse/search.'];

    const search = (searchParams.get('search') || '').trim();
    if (search) parts.push(`Search query: "${search}".`);

    const filters: string[] = [];
    LIST_FILTERS.forEach(([key, label]) => {
      const values = (searchParams.get(key) || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (values.length) filters.push(`${label}: ${values.join(', ')}`);
    });

    const category = (searchParams.get('category') || '').trim();
    if (category) filters.push(`Category: ${category}`);

    const minPrice = Number(searchParams.get('minPrice'));
    if (Number.isFinite(minPrice) && minPrice > 0) filters.push(`Minimum price: ₹${minPrice}`);

    const maxPrice = Number(searchParams.get('maxPrice'));
    if (Number.isFinite(maxPrice) && maxPrice > 0) filters.push(`Maximum price: ₹${maxPrice}`);

    const maxMoq = Number(searchParams.get('maxMoq'));
    if (Number.isFinite(maxMoq) && maxMoq > 0) filters.push(`Maximum MOQ: ${maxMoq}`);

    if (searchParams.get('deals') === '1') filters.push('Discounted listings only');
    if (searchParams.get('verified') === '1') filters.push('Verified sellers only');

    parts.push(filters.length ? `Active filters — ${filters.join('; ')}.` : 'No filters are applied.');

    const sort = searchParams.get('sort') || 'relevance';
    if (SORT_LABELS[sort]) parts.push(`Sorted by: ${SORT_LABELS[sort]}.`);

    parts.push(
      'You cannot see the result list or any live prices, stock or seller names. Help the buyer refine what they are searching for and explain how the filters (fabric type, GSM, width, work, dispatch, price, MOQ) narrow results. To check an actual product, tell them to open its product page.'
    );

    return parts.join(' ');
  }, [searchParams]);

  return <AiAssistantWidget role="buyer" context={context} />;
}
