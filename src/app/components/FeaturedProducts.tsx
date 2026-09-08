'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type FeaturedProduct = {
  id: string;
  name: string;
  seller: string;
  city: string;
  state: string;
  price: number;
  unit: string;
  moq: number;
  available: number;
  image: string | null;
  dispatchDays: number;
};

export default function FeaturedProducts() {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const supabase = createClient();
      const { data: rows } = await supabase
        .from('seller_products')
        .select('id,seller_id,name,price_per_unit,unit,moq,available_quantity,reserved_quantity,image_url,origin_city,origin_state,dispatch_days')
        .eq('status', 'active')
        .eq('approval_status', 'approved')
        .gt('available_quantity', 0)
        .order('updated_at', { ascending: false })
        .limit(8);
      if (!mounted) return;

      const sellerIds = [...new Set((rows || []).map((row) => row.seller_id).filter(Boolean))];
      const sellerNames = new Map<string, string>();
      if (sellerIds.length) {
        const { data: sellers } = await supabase
          .from('seller_directory')
          .select('id,display_name,legal_business_name')
          .in('id', sellerIds);
        (sellers || []).forEach((seller) => {
          sellerNames.set(
            seller.id,
            seller.display_name || seller.legal_business_name || 'Verified FabricTrad Seller'
          );
        });
      }

      setProducts(
        (rows || []).map((row) => ({
          id: `seller-${row.id}`,
          name: row.name || 'Live marketplace product',
          seller: sellerNames.get(row.seller_id) || 'Verified FabricTrad Seller',
          city: row.origin_city || '',
          state: row.origin_state || '',
          price: Number(row.price_per_unit || 0),
          unit: row.unit || 'mtr',
          moq: Number(row.moq || 1),
          available: Math.max(
            0,
            Number(row.available_quantity || 0) - Number(row.reserved_quantity || 0)
          ),
          image: row.image_url || null,
          dispatchDays: Number(row.dispatch_days || 0),
        }))
      );
      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-800 uppercase tracking-[0.14em] text-primary">Live marketplace</p>
            <h2 className="mt-1 text-2xl font-800 tracking-tight text-foreground">Recently approved products</h2>
            <p className="mt-1 text-sm text-muted-foreground">Only real in-stock seller listings are shown here.</p>
          </div>
          <Link href="/marketplace" className="text-sm font-800 text-primary hover:underline">View marketplace</Link>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-2xl border border-border bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <Link key={product.id} href={`/product-detail?id=${encodeURIComponent(product.id)}`} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {product.image ? (
                    <AppImage src={product.image} alt={product.name} fill sizes="(max-width:640px) 100vw,25vw" className="object-cover transition duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Icon name="PhotoIcon" size={36} className="text-muted-foreground/40" />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-success px-2 py-1 text-[10px] font-800 text-white">Live stock</span>
                </div>
                <div className="p-4">
                  <p className="truncate text-xs font-700 text-muted-foreground"><Icon name="ShieldCheckIcon" size={12} className="mr-1 inline text-success" />{product.seller}</p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-800 text-foreground group-hover:text-primary">{product.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{[product.city, product.state].filter(Boolean).join(', ') || 'India'}</p>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className="text-base font-800 text-primary">₹{product.price.toLocaleString('en-IN')}<span className="text-xs font-500 text-muted-foreground">/{product.unit}</span></span>
                    <span className="text-[10px] font-700 text-muted-foreground">MOQ {product.moq}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-success">{product.available.toLocaleString('en-IN')} {product.unit} available{product.dispatchDays ? ` · ${product.dispatchDays}d dispatch` : ''}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
