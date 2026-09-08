'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type BestsellerRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  compareAtPrice: number | null;
  unit: string;
  image: string | null;
  sellerId: string;
  unitsSold: number;
  orderCount: number;
};

const RANK_STYLES = [
  'bg-gradient-to-br from-amber-400 to-amber-600 text-white',
  'bg-gradient-to-br from-slate-300 to-slate-500 text-white',
  'bg-gradient-to-br from-orange-300 to-orange-500 text-white',
];

export default function BestsellerShowcase() {
  const [items, setItems] = useState<BestsellerRow[] | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('top_selling_products', { p_limit: 10, p_days: 90 });
      if (!mounted) return;
      setItems(error ? [] : (data as BestsellerRow[]) || []);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (items === null || items.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-error/10 text-error"><Icon name="FireIcon" size={17} /></span>
        <div>
          <h2 className="text-sm font-850 text-foreground">Best sellers this quarter</h2>
          <p className="text-[11px] text-muted-foreground">Ranked by real units sold across the marketplace — no sample data.</p>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={`/product-detail?id=${encodeURIComponent(`seller-${item.id}`)}`}
            className="ft-marketplace-product-card group relative w-40 shrink-0 overflow-hidden sm:w-44"
          >
            <div className="relative aspect-square overflow-hidden bg-muted">
              {item.image ? (
                <AppImage src={item.image} alt={item.name} fill sizes="176px" className="object-cover transition duration-300 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><Icon name="PhotoIcon" size={28} className="text-muted-foreground/40" /></div>
              )}
              <span className={`absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-850 ${RANK_STYLES[index] || 'bg-foreground/80 text-background'}`}>
                #{index + 1}
              </span>
            </div>
            <div className="p-2.5">
              <h3 className="line-clamp-2 text-xs font-800 leading-tight text-foreground group-hover:text-primary">{item.name}</h3>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-sm font-800 text-primary">₹{item.price.toLocaleString('en-IN')}<span className="text-[10px] font-500 text-muted-foreground">/{item.unit}</span></span>
                {!!item.compareAtPrice && item.compareAtPrice > item.price && <span className="text-[10px] text-muted-foreground line-through">₹{item.compareAtPrice.toLocaleString('en-IN')}</span>}
              </div>
              <p className="mt-1 text-[10px] font-700 text-success">{item.unitsSold} sold</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
