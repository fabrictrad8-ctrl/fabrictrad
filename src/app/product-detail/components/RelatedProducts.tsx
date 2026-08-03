'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useProduct } from '@/lib/hooks/useProduct';
import { createClient } from '@/lib/supabase/client';

type RelatedProduct = {
  id: string;
  name: string;
  price: number;
  unit: string;
  moq: number;
  image: string;
  seller: string;
  available: number;
};

export default function RelatedProducts() {
  const { product } = useProduct();
  const [related, setRelated] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const currentId = product.rawProductId;
    if (!currentId || product.id === 'unavailable') {
      setRelated([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      let query = supabase
        .from('seller_products')
        .select('id,seller_id,name,price_per_unit,unit,moq,image_url,available_quantity,reserved_quantity')
        .eq('status', 'active')
        .eq('approval_status', 'approved')
        .gt('available_quantity', 0)
        .neq('id', currentId)
        .order('updated_at', { ascending: false })
        .limit(4);
      if (product.category && product.category !== 'Other') {
        query = query.eq('category', product.category);
      }
      const { data: products } = await query;
      if (!mounted) return;

      const sellerIds = [...new Set((products || []).map((row) => row.seller_id).filter(Boolean))];
      const sellerNames = new Map<string, string>();
      if (sellerIds.length) {
        const { data: sellers } = await supabase
          .from('seller_directory')
          .select('id,display_name,legal_business_name')
          .in('id', sellerIds);
        (sellers || []).forEach((seller) => {
          sellerNames.set(
            seller.id,
            seller.display_name || seller.legal_business_name || 'Verified seller'
          );
        });
      }

      setRelated(
        (products || []).map((row) => ({
          id: `seller-${row.id}`,
          name: row.name || 'Fabric product',
          price: Number(row.price_per_unit || 0),
          unit: row.unit || 'mtr',
          moq: Number(row.moq || 1),
          image:
            row.image_url ||
            'https://images.unsplash.com/photo-1558618666-fcd25c85cd64',
          seller: sellerNames.get(row.seller_id) || 'Verified seller',
          available: Math.max(
            0,
            Number(row.available_quantity || 0) - Number(row.reserved_quantity || 0)
          ),
        }))
      );
      setLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [product.category, product.id, product.rawProductId]);

  if (!loading && related.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-800 uppercase tracking-wider text-primary">Live marketplace</p>
          <h2 className="mt-1 text-section-title text-foreground">Similar approved products</h2>
        </div>
        <Link href={`/marketplace?category=${encodeURIComponent(product.category)}`} className="text-sm font-700 text-primary hover:underline">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="aspect-square animate-pulse bg-muted" />
                <div className="space-y-2 p-3"><div className="h-4 animate-pulse rounded bg-muted" /><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /></div>
              </div>
            ))
          : related.map((item) => (
              <Link key={item.id} href={`/product-detail?id=${encodeURIComponent(item.id)}`} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <AppImage src={item.image} alt={item.name} fill sizes="(max-width:640px) 50vw, 25vw" className="object-cover transition duration-300 group-hover:scale-105" />
                  <span className="absolute left-2 top-2 rounded-full bg-success px-2 py-1 text-[10px] font-800 text-white">{item.available.toLocaleString('en-IN')} available</span>
                </div>
                <div className="p-3">
                  <p className="truncate text-[11px] font-700 text-muted-foreground"><Icon name="ShieldCheckIcon" size={12} className="mr-1 inline text-success" />{item.seller}</p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-800 text-foreground group-hover:text-primary">{item.name}</h3>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className="text-sm font-800 text-primary">₹{item.price.toLocaleString('en-IN')}<span className="text-xs font-500 text-muted-foreground">/{item.unit}</span></span>
                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-800 text-muted-foreground">MOQ {item.moq}</span>
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
