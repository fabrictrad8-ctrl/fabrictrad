'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import BottomSheet from '@/components/BottomSheet';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Static ranges are derived buckets over real numeric columns (gsm,
 * dispatch_days, moq, price_per_unit) and are applied by MarketplaceGrid.
 * The value lists that are NOT ranges - fabric type, work type and width - are
 * loaded from the live catalogue below, so the rail never offers a facet that
 * cannot match a single product.
 */
const GSM_OPTIONS = ['< 80 GSM', '80-120 GSM', '120-200 GSM', '200-300 GSM', '300+ GSM'];
const DISPATCH_OPTIONS = ['Same Day', '1-2 Days', '3-5 Days', '5-7 Days'];
const PRICE_BANDS = [
  { label: 'Under ₹500', min: '', max: '500' },
  { label: '₹500 – ₹1,000', min: '500', max: '1000' },
  { label: '₹1,000 – ₹2,500', min: '1000', max: '2500' },
  { label: '₹2,500 – ₹5,000', min: '2500', max: '5000' },
  { label: 'Over ₹5,000', min: '5000', max: '' },
];
const MOQ_OPTIONS = [
  { label: 'Up to 10', value: '10' },
  { label: 'Up to 50', value: '50' },
  { label: 'Up to 100', value: '100' },
  { label: 'Up to 500', value: '500' },
];

const MULTI_KEYS = ['fabricType', 'gsm', 'width', 'work', 'dispatch'] as const;
const ALL_KEYS = [...MULTI_KEYS, 'minPrice', 'maxPrice', 'maxMoq', 'deals'] as const;

type Facets = { fabricTypes: string[]; works: string[]; widths: string[] };

function valuesFor(params: URLSearchParams, key: string) {
  return (params.get(key) || '').split(',').map((value) => value.trim()).filter(Boolean);
}

export default function MarketplaceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [expanded, setExpanded] = useState<string[]>(['price', 'fabricType', 'work']);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [facets, setFacets] = useState<Facets>({ fabricTypes: [], works: [], widths: [] });

  const accountKind = profile?.account_kind;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      let query = supabase
        .from('seller_products')
        .select('category,work_type,width_inches')
        .eq('status', 'active')
        .eq('approval_status', 'approved')
        .gt('available_quantity', 0);
      if (accountKind === 'individual') query = query.eq('end_user_enabled', true).in('sale_channel', ['retail', 'both']);
      const { data } = await query;
      if (cancelled || !data) return;
      const fabricTypes = new Set<string>();
      const works = new Set<string>();
      const widths = new Set<string>();
      data.forEach((row) => {
        if (row.category) fabricTypes.add(String(row.category));
        if (row.work_type) works.add(String(row.work_type));
        if (row.width_inches) widths.add(`${Number(row.width_inches)} inches`);
      });
      setFacets({
        fabricTypes: [...fabricTypes].sort((a, b) => a.localeCompare(b)),
        works: [...works].sort((a, b) => a.localeCompare(b)),
        widths: [...widths].sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b)),
      });
    };
    void load();
    return () => { cancelled = true; };
  }, [accountKind]);

  const selected = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    return Object.fromEntries(MULTI_KEYS.map((key) => [key, valuesFor(params, key)])) as Record<string, string[]>;
  }, [searchParams]);

  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const maxMoq = searchParams.get('maxMoq') || '';
  const dealsOnly = searchParams.get('deals') === '1';

  const [draftMin, setDraftMin] = useState(minPrice);
  const [draftMax, setDraftMax] = useState(maxPrice);
  useEffect(() => { setDraftMin(minPrice); setDraftMax(maxPrice); }, [minPrice, maxPrice]);

  const totalActive =
    Object.values(selected).flat().length +
    Number(!!minPrice) + Number(!!maxPrice) + Number(!!maxMoq) + Number(dealsOnly);

  const updateParams = useCallback((update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    params.delete('page');
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const toggleOption = (key: string, value: string) => updateParams((params) => {
    const current = valuesFor(params, key);
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    if (next.length) params.set(key, next.join(',')); else params.delete(key);
  });

  const setSingle = (key: string, value: string) => updateParams((params) => {
    if (value) params.set(key, value); else params.delete(key);
  });

  const applyBand = (band: (typeof PRICE_BANDS)[number]) => updateParams((params) => {
    const active = (params.get('minPrice') || '') === band.min && (params.get('maxPrice') || '') === band.max;
    if (active || (!band.min && !band.max)) {
      params.delete('minPrice');
      params.delete('maxPrice');
      return;
    }
    if (band.min) params.set('minPrice', band.min); else params.delete('minPrice');
    if (band.max) params.set('maxPrice', band.max); else params.delete('maxPrice');
  });

  const applyCustomPrice = () => updateParams((params) => {
    const min = Number(draftMin);
    const max = Number(draftMax);
    if (Number.isFinite(min) && min > 0) params.set('minPrice', String(Math.round(min))); else params.delete('minPrice');
    if (Number.isFinite(max) && max > 0) params.set('maxPrice', String(Math.round(max))); else params.delete('maxPrice');
  });

  const clearAll = () => updateParams((params) => ALL_KEYS.forEach((key) => params.delete(key)));

  const group = (
    key: string,
    label: string,
    body: React.ReactNode,
    options?: { alwaysOpen?: boolean }
  ) => {
    const open = options?.alwaysOpen || expanded.includes(key);
    return (
      <div className="ftm-filter-group" key={key}>
        <button
          type="button"
          className="ftm-filter-legend"
          onClick={() => setExpanded((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])}
          aria-expanded={open}
        >
          {label}
          <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={15} />
        </button>
        {open && <div className="ftm-filter-body">{body}</div>}
      </div>
    );
  };

  const checkboxList = (key: string, options: string[]) => (
    <>
      {options.map((option) => {
        const active = (selected[key] || []).includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggleOption(key, option)}
            className={`ftm-filter-option${active ? ' is-active' : ''}`}
            aria-pressed={active}
          >
            <span className="ftm-filter-box">{active && <Icon name="CheckIcon" size={10} />}</span>
            {option}
          </button>
        );
      })}
    </>
  );

  const filterContent = (
    <div className="ftm-sheet">
      <div className="ftm-filter-head">
        <span className="ftm-filter-title">
          <Icon name="FunnelIcon" size={15} />
          Refine results
          {totalActive > 0 && <span className="ftm-filter-count">{totalActive}</span>}
        </span>
        {totalActive > 0 && <button type="button" onClick={clearAll} className="ftm-filter-clear">Clear all</button>}
      </div>

      <div className="ftm-filter-group">
        <button
          type="button"
          className="ftm-switch-row"
          onClick={() => setSingle('deals', dealsOnly ? '' : '1')}
          aria-pressed={dealsOnly}
        >
          <span>Discounted only</span>
          <span className={`ftm-switch${dealsOnly ? ' is-on' : ''}`}><span className="ftm-switch-knob" /></span>
        </button>
      </div>

      {group('price', 'Price per unit', (
        <>
          <div className="ftm-price-presets">
            {PRICE_BANDS.map((band) => {
              const active = minPrice === band.min && maxPrice === band.max;
              return (
                <button
                  key={band.label}
                  type="button"
                  onClick={() => applyBand(band)}
                  className={`ftm-filter-option${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                >
                  <span className="ftm-filter-box">{active && <Icon name="CheckIcon" size={10} />}</span>
                  {band.label}
                </button>
              );
            })}
          </div>
          <div className="ftm-price-fields">
            <input
              className="ftm-price-input"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Min ₹"
              aria-label="Minimum price per unit"
              value={draftMin}
              onChange={(event) => setDraftMin(event.target.value)}
            />
            <input
              className="ftm-price-input"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Max ₹"
              aria-label="Maximum price per unit"
              value={draftMax}
              onChange={(event) => setDraftMax(event.target.value)}
            />
            <button type="button" className="ftm-price-go" onClick={applyCustomPrice}>Go</button>
          </div>
        </>
      ), { alwaysOpen: true })}

      {!!facets.fabricTypes.length && group('fabricType', 'Fabric type', checkboxList('fabricType', facets.fabricTypes))}
      {!!facets.works.length && group('work', 'Work type', checkboxList('work', facets.works))}

      {group('moq', 'Minimum order quantity', (
        <>
          {MOQ_OPTIONS.map((option) => {
            const active = maxMoq === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSingle('maxMoq', active ? '' : option.value)}
                className={`ftm-filter-option${active ? ' is-active' : ''}`}
                aria-pressed={active}
              >
                <span className="ftm-filter-box">{active && <Icon name="CheckIcon" size={10} />}</span>
                {option.label}
              </button>
            );
          })}
        </>
      ))}

      {group('gsm', 'GSM range', checkboxList('gsm', GSM_OPTIONS))}
      {!!facets.widths.length && group('width', 'Width', checkboxList('width', facets.widths))}
      {group('dispatch', 'Dispatch time', checkboxList('dispatch', DISPATCH_OPTIONS))}
    </div>
  );

  return (
    <>
      <aside className="ftm-rail" aria-label="Marketplace filters">{filterContent}</aside>

      <button type="button" onClick={() => setMobileOpen(true)} className="ftm-filter-trigger" data-ftm-mobile-filter>
        <Icon name="FunnelIcon" size={15} />
        Filters{totalActive > 0 ? ` (${totalActive})` : ''}
      </button>

      <BottomSheet
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="Refine products"
        footer={<button type="button" onClick={() => setMobileOpen(false)} className="btn-primary w-full rounded-lg py-3 text-sm">Show results</button>}
      >
        {filterContent}
      </BottomSheet>
    </>
  );
}
