'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

type Alternative = {
  id: number;
  name: string;
  seller: string;
  verified: boolean;
  price: number;
  moq: number;
  rating: number;
  reviews: number;
  dispatch: string;
  acceptance: string;
  image: string;
  alt: string;
  isCurrent: boolean;
};

type CompareField = {
  key: keyof Pick<Alternative, 'price' | 'moq' | 'rating' | 'dispatch' | 'acceptance'>;
  label: string;
  format: (value: string | number) => string;
  best: 'low' | 'high' | null;
};

const alternatives: Alternative[] = [
  {
    id: 1,
    name: 'Pure Dyeable Soft Nett Fabric',
    seller: 'Surat Textile Mills',
    verified: true,
    price: 840,
    moq: 50,
    rating: 4.8,
    reviews: 124,
    dispatch: '2-3 days',
    acceptance: '94%',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_174daee7c-1779170788598.png',
    alt: 'Pure white dyeable soft nett fabric close-up texture',
    isCurrent: true,
  },
  {
    id: 2,
    name: 'Soft Nett Dyeable Fabric',
    seller: 'Bharat Fabrics Co.',
    verified: true,
    price: 820,
    moq: 100,
    rating: 4.6,
    reviews: 87,
    dispatch: '3-5 days',
    acceptance: '89%',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_182d42e83-1784315624078.png',
    alt: 'Off-white soft nett fabric roll on wooden surface',
    isCurrent: false,
  },
  {
    id: 3,
    name: 'Premium Dyeable Net Fabric',
    seller: 'Laxmi Textiles',
    verified: false,
    price: 780,
    moq: 200,
    rating: 4.4,
    reviews: 42,
    dispatch: '4-6 days',
    acceptance: '82%',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_124650fa6-1784378867682.png',
    alt: 'Premium net fabric sample in natural light',
    isCurrent: false,
  },
];

const compareFields: CompareField[] = [
  { key: 'price', label: 'Price/mtr', format: (v) => `₹${v}`, best: 'low' },
  { key: 'moq', label: 'Min. Order', format: (v) => `${v} mtrs`, best: 'low' },
  { key: 'rating', label: 'Rating', format: (v) => `${v} ★`, best: 'high' },
  { key: 'dispatch', label: 'Dispatch', format: (v) => String(v), best: null },
  { key: 'acceptance', label: 'Acceptance', format: (v) => String(v), best: 'high' },
];

const getComparableValue = (value: string | number) => {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export default function ComparisonWidget() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-800 text-foreground flex items-center gap-2">
          <Icon name="ArrowsRightLeftIcon" size={18} className="text-secondary" />
          Compare with Alternatives
        </h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-600 text-primary hover:underline flex items-center gap-1"
        >
          {expanded ? 'Collapse' : 'Expand'}
          <Icon name={expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} />
        </button>
      </div>

      {/* Product Headers */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {alternatives.map((alt) => (
          <div
            key={alt.id}
            className={`rounded-xl border p-3 text-center relative ${alt.isCurrent ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            {alt.isCurrent && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-700 bg-primary text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                Current
              </span>
            )}
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted mx-auto mb-2">
              <AppImage
                src={alt.image}
                alt={alt.alt}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs font-700 text-foreground line-clamp-2 mb-0.5">{alt.name}</p>
            <div className="flex items-center justify-center gap-1">
              <p className="text-xs text-muted-foreground">{alt.seller}</p>
              {alt.verified && <Icon name="CheckBadgeIcon" size={11} className="text-success" />}
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="space-y-2">
        {compareFields.slice(0, expanded ? compareFields.length : 3).map((field) => {
          const values = alternatives.map((a) => a[field.key]);
          const numericVals = values.map(getComparableValue).filter((v): v is number => v !== null);
          const bestVal =
            field.best === 'low'
              ? Math.min(...numericVals)
              : field.best === 'high'
                ? Math.max(...numericVals)
                : null;

          return (
            <div key={field.key} className="grid grid-cols-3 gap-3 items-center">
              {alternatives.map((alt, i) => {
                const val = alt[field.key];
                const isBest = bestVal !== null && getComparableValue(val) === bestVal;
                return (
                  <div
                    key={alt.id}
                    className={`rounded-lg p-2 text-center ${isBest ? 'bg-success/10 border border-success/20' : 'bg-muted'}`}
                  >
                    {i === 0 && (
                      <p className="text-xs text-muted-foreground mb-0.5 hidden sm:block">
                        {field.label}
                      </p>
                    )}
                    <p
                      className={`text-xs font-700 ${isBest ? 'text-success' : 'text-foreground'}`}
                    >
                      {field.format(val)}
                    </p>
                    {isBest && <p className="text-xs text-success font-600">Best</p>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Labels row */}
      <div className="grid grid-cols-3 gap-3 mt-3">
        {alternatives.map((alt) => (
          <div key={alt.id}>
            {!alt.isCurrent && (
              <Link
                href="/product-detail"
                className="btn-secondary w-full py-2 text-xs rounded-xl flex items-center justify-center gap-1"
              >
                <Icon name="EyeIcon" size={12} />
                View
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
