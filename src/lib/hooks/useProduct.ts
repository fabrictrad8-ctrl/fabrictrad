'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CATALOG_PRODUCTS, getCatalogProduct, type CatalogProduct } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/client';

function mapSellerProduct(row: Record<string, unknown>, sellerName: string): CatalogProduct {
  const image = String(row.image_url || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64');
  const extraImages = Array.isArray(row.image_urls) ? row.image_urls.map(String) : [];
  return {
    id: `seller-${String(row.id)}`,
    source: 'seller',
    sellerId: String(row.seller_id),
    name: String(row.name || 'Untitled fabric'),
    seller: sellerName,
    city: [row.origin_city, row.origin_state].filter(Boolean).join(', ') || 'India',
    category: String(row.category || 'Other'),
    price: Number(row.price_per_unit || 0),
    unit: String(row.unit || 'mtr'),
    moq: Number(row.moq || 1),
    available: Number(row.available_quantity || 0),
    gsm: Number(row.gsm || 0),
    width: row.width_inches ? `${Number(row.width_inches)} inches` : 'Not specified',
    work: String(row.work_type || 'Plain'),
    rating: 0,
    reviews: 0,
    badge: 'new',
    verified: true,
    image,
    images: [image, ...extraImages.filter((value) => value !== image)],
    alt: `${String(row.name || 'Fabric')} supplied by ${sellerName}`,
    dispatchDays: Number(row.dispatch_days || 3),
    gst: true,
    description: String(row.description || ''),
    sku: row.sku ? String(row.sku) : null,
  };
}

export function useProduct() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('id') || CATALOG_PRODUCTS[0].id;
  const initial = useMemo(() => getCatalogProduct(requestedId), [requestedId]);
  const [product, setProduct] = useState<CatalogProduct>(initial);
  const [loading, setLoading] = useState(requestedId.startsWith('seller-'));

  useEffect(() => {
    let mounted = true;
    if (!requestedId.startsWith('seller-')) {
      setProduct(getCatalogProduct(requestedId));
      setLoading(false);
      return;
    }

    async function loadSellerProduct() {
      setLoading(true);
      const supabase = createClient();
      const id = requestedId.replace(/^seller-/, '');
      const { data: row, error } = await supabase
        .from('seller_products')
        .select('*')
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle();
      if (!mounted) return;
      if (error || !row) {
        setProduct(CATALOG_PRODUCTS[0]);
        setLoading(false);
        return;
      }
      const { data: seller } = await supabase
        .from('seller_directory')
        .select('display_name,legal_business_name')
        .eq('id', row.seller_id)
        .maybeSingle();
      if (!mounted) return;
      setProduct(mapSellerProduct(row, seller?.display_name || seller?.legal_business_name || 'Verified FabricTrad Seller'));
      setLoading(false);
    }

    loadSellerProduct();
    return () => {
      mounted = false;
    };
  }, [requestedId]);

  return { product, loading };
}
