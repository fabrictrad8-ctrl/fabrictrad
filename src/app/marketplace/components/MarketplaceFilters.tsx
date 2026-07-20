'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';

const filterGroups = [
  {
    label: 'Fabric Type',
    key: 'fabricType',
    options: ['Silk', 'Cotton', 'Polyester', 'Net & Netting', 'Georgette', 'Organza', 'Velvet', 'Handloom', 'Linen', 'Denim', 'Wool'],
  },
  {
    label: 'GSM Range',
    key: 'gsm',
    options: ['< 80 GSM', '80-120 GSM', '120-200 GSM', '200-300 GSM', '300+ GSM'],
  },
  {
    label: 'Width',
    key: 'width',
    options: ['36 inches', '44 inches', '54 inches', '58 inches', '60 inches', '72 inches'],
  },
  {
    label: 'Work Type',
    key: 'work',
    options: ['Plain', 'Embroidered', 'Zari Work', 'Block Print', 'Digital Print', 'Handloom', 'Sequence'],
  },
  {
    label: 'Dispatch Time',
    key: 'dispatch',
    options: ['Same Day', '1-2 Days', '3-5 Days', '5-7 Days'],
  },
] as const;

function valuesFor(params: URLSearchParams, key: string) {
  return (params.get(key) || '').split(',').map((value) => value.trim()).filter(Boolean);
}

export default function MarketplaceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<string[]>(['fabricType', 'work']);
  const [mobileOpen, setMobileOpen] = useState(false);

  const selected = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    return Object.fromEntries(filterGroups.map((group) => [group.key, valuesFor(params, group.key)]));
  }, [searchParams]);

  const priceMax = Number(searchParams.get('maxPrice') || 5000);
  const moqMax = Number(searchParams.get('maxMoq') || 500);
  const verifiedOnly = searchParams.get('verified') === '1';
  const totalActive =
    Object.values(selected).flat().length +
    Number(verifiedOnly) +
    Number(priceMax !== 5000) +
    Number(moqMax !== 500);

  const updateParams = (update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    params.delete('page');
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  };

  const toggleOption = (key: string, value: string) => {
    updateParams((params) => {
      const current = valuesFor(params, key);
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      if (next.length) params.set(key, next.join(','));
      else params.delete(key);
    });
  };

  const clearAll = () => {
    updateParams((params) => {
      ['fabricType', 'gsm', 'width', 'work', 'dispatch', 'verified', 'maxPrice', 'maxMoq'].forEach((key) => params.delete(key));
    });
  };

  const filterContent = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="FunnelIcon" size={16} className="text-foreground" />
          <span className="text-sm font-700 text-foreground">Filters</span>
          {totalActive > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-700 text-white">{totalActive}</span>
          )}
        </div>
        {totalActive > 0 && (
          <button type="button" onClick={clearAll} className="text-xs font-600 text-primary hover:underline">
            Clear All
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => updateParams((params) => verifiedOnly ? params.delete('verified') : params.set('verified', '1'))}
        className="flex w-full items-center justify-between border-b border-border py-2 text-left"
        aria-pressed={verifiedOnly}
      >
        <span className="flex items-center gap-2">
          <Icon name="ShieldCheckIcon" size={14} className="text-success" />
          <span className="text-sm font-600 text-foreground">GST Verified Sellers Only</span>
        </span>
        <span className={`relative h-6 w-11 rounded-full transition-colors ${verifiedOnly ? 'bg-success' : 'bg-muted-foreground/30'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${verifiedOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
      </button>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-700 text-foreground">Maximum price per metre</p>
          <output className="text-xs font-700 text-primary">₹{priceMax.toLocaleString('en-IN')}</output>
        </div>
        <input
          aria-label="Maximum price per metre"
          type="range"
          min={100}
          max={10000}
          step={100}
          value={priceMax}
          onChange={(event) => updateParams((params) => {
            const value = Number(event.target.value);
            if (value === 5000) params.delete('maxPrice');
            else params.set('maxPrice', String(value));
          })}
          className="w-full accent-primary"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-700 text-foreground">Maximum MOQ</p>
          <output className="text-xs font-700 text-primary">{moqMax} mtrs</output>
        </div>
        <input
          aria-label="Maximum minimum order quantity"
          type="range"
          min={1}
          max={1000}
          step={5}
          value={moqMax}
          onChange={(event) => updateParams((params) => {
            const value = Number(event.target.value);
            if (value === 500) params.delete('maxMoq');
            else params.set('maxMoq', String(value));
          })}
          className="w-full accent-primary"
        />
      </div>

      {filterGroups.map((group) => (
        <div key={group.key} className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setExpanded((current) => current.includes(group.key) ? current.filter((key) => key !== group.key) : [...current, group.key])}
            className="mb-2 flex w-full items-center justify-between"
            aria-expanded={expanded.includes(group.key)}
          >
            <span className="text-sm font-700 text-foreground">{group.label}</span>
            <Icon name={expanded.includes(group.key) ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-muted-foreground" />
          </button>

          {expanded.includes(group.key) && (
            <div className="space-y-1.5">
              {group.options.map((option) => {
                const active = (selected[group.key] || []).includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleOption(group.key, option)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all ${active ? 'bg-primary/10 font-600 text-primary' : 'text-foreground hover:bg-muted'}`}
                    aria-pressed={active}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${active ? 'border-primary bg-primary' : 'border-border'}`}>
                      {active && <Icon name="CheckIcon" size={10} className="text-white" />}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="mb-4 lg:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} className="btn-secondary flex items-center gap-2 rounded-xl px-4 py-2 text-sm">
          <Icon name="FunnelIcon" size={16} />
          Filters {totalActive > 0 && `(${totalActive})`}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute bottom-0 left-0 top-0 w-[min(320px,90vw)] overflow-y-auto bg-background p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-700 text-foreground">Refine products</span>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 hover:bg-muted" aria-label="Close filters">
                <Icon name="XMarkIcon" size={20} className="text-foreground" />
              </button>
            </div>
            {filterContent}
            <button type="button" onClick={() => setMobileOpen(false)} className="btn-primary mt-6 w-full rounded-xl py-3 text-sm">
              Show Results
            </button>
          </div>
        </div>
      )}

      <aside className="hidden w-60 shrink-0 lg:block" aria-label="Marketplace filters">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5 scrollbar-thin">
          {filterContent}
        </div>
      </aside>
    </>
  );
}
