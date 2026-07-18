'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

const filterGroups = [
  {
    label: 'Fabric Type',
    key: 'fabricType',
    options: [
      'Silk',
      'Cotton',
      'Polyester',
      'Net',
      'Georgette',
      'Organza',
      'Velvet',
      'Khadi',
      'Linen',
    ],
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
    options: [
      'Plain',
      'Embroidered',
      'Zari Work',
      'Block Print',
      'Digital Print',
      'Handloom',
      'Sequence',
    ],
  },
  {
    label: 'Seller Type',
    key: 'sellerType',
    options: ['Manufacturer', 'Wholesaler', 'Distributor', 'Exporter'],
  },
  {
    label: 'Dispatch Time',
    key: 'dispatch',
    options: ['Same Day', '1-2 Days', '3-5 Days', '5-7 Days'],
  },
];

export default function MarketplaceFilters() {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<string[]>(['fabricType', 'work']);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 5000]);
  const [moqMax, setMoqMax] = useState(500);

  const toggleOption = (key: string, val: string) => {
    setSelected((prev) => {
      const cur = prev[key] || [];
      return {
        ...prev,
        [key]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val],
      };
    });
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  const totalActive = Object.values(selected).flat().length;

  const filterContent = (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="FunnelIcon" size={16} className="text-foreground" />
          <span className="font-700 text-sm text-foreground">Filters</span>
          {totalActive > 0 && (
            <span className="bg-primary text-white text-xs font-700 px-1.5 py-0.5 rounded-full">
              {totalActive}
            </span>
          )}
        </div>
        {totalActive > 0 && (
          <button
            onClick={() => setSelected({})}
            className="text-xs text-primary font-600 hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Verified Only */}
      <div className="flex items-center justify-between py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="ShieldCheckIcon" size={14} className="text-success" />
          <span className="text-sm font-600 text-foreground">GST Verified Sellers Only</span>
        </div>
        <div className="w-10 h-5 bg-success rounded-full relative cursor-pointer">
          <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
        </div>
      </div>

      {/* Price Range */}
      <div>
        <p className="text-sm font-700 text-foreground mb-3">Price per Metre</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>₹{priceRange[0]}</span>
          <span>₹{priceRange[1].toLocaleString('en-IN')}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10000}
          value={priceRange[1]}
          onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
          className="w-full accent-primary"
        />
      </div>

      {/* MOQ */}
      <div>
        <p className="text-sm font-700 text-foreground mb-3">Max MOQ (metres)</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>1</span>
          <span>{moqMax}</span>
        </div>
        <input
          type="range"
          min={1}
          max={1000}
          value={moqMax}
          onChange={(e) => setMoqMax(parseInt(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* Filter Groups */}
      {filterGroups.map((group) => (
        <div key={group.key} className="border-t border-border pt-4">
          <button
            onClick={() => toggleExpand(group.key)}
            className="w-full flex items-center justify-between mb-2"
          >
            <span className="text-sm font-700 text-foreground">{group.label}</span>
            <Icon
              name={expanded.includes(group.key) ? 'ChevronUpIcon' : 'ChevronDownIcon'}
              size={16}
              className="text-muted-foreground"
            />
          </button>

          {expanded.includes(group.key) && (
            <div className="space-y-1.5">
              {group.options.map((opt) => {
                const isSelected = (selected[group.key] || []).includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleOption(group.key, opt)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-600'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-primary border-primary' : 'border-border'
                      }`}
                    >
                      {isSelected && <Icon name="CheckIcon" size={10} className="text-white" />}
                    </div>
                    {opt}
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
      {/* Mobile Filter Toggle */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 btn-secondary px-4 py-2 text-sm rounded-xl"
        >
          <Icon name="FunnelIcon" size={16} />
          Filters {totalActive > 0 && `(${totalActive})`}
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-background p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-700 text-foreground">Filters</span>
              <button onClick={() => setMobileOpen(false)}>
                <Icon name="XMarkIcon" size={20} className="text-foreground" />
              </button>
            </div>
            {filterContent}
            <button
              onClick={() => setMobileOpen(false)}
              className="btn-primary w-full py-3 text-sm rounded-xl mt-6"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-60 shrink-0">
        <div className="bg-card rounded-2xl border border-border p-5 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin">
          {filterContent}
        </div>
      </div>
    </>
  );
}
