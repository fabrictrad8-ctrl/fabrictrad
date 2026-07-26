'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CATALOG_PRODUCTS,
  getCatalogProduct,
  type CatalogProduct,
  type CatalogVariant,
} from '@/lib/catalog';
import { createClient } from '@/lib/supabase/client';

function mapVariant(row: Record<string, unknown>): CatalogVariant {
  const image = row.image_url ? String(row.image_url) : null;
  const extraImages = Array.isArray(row.image_urls) ? row.image_urls.map(String) : [];
  return {
    id: String(row.id),
    key: String(row.variant_key || row.id),
    code: String(row.variant_code || ''),
    colorName: String(row.color_name || 'Assorted'),
    colorHex: row.color_hex ? String(row.color_hex) : null,
    designName: String(row.design_name || 'Standard'),
    description: String(row.description || ''),
    price: Number(row.price_per_unit || 0),
    unit: String(row.unit || 'mtr'),
    available: Math.max(0, Number(row.available_quantity || 0) - Number(row.reserved_quantity || 0)),
    moq: Number(row.moq || 1),
    image,
    images: [image, ...extraImages.filter((value) => value !== image)].filter(Boolean) as string[],
  };
}

function mapSellerProduct(
  row: Record<string, unknown>,
  sellerName: string,
  variants: CatalogVariant[],
  selectedVariantId: string | null
): CatalogProduct {
  const selectedVariant =
    variants.find((variant) => variant.id === selectedVariantId) || variants[0] || null;
  const parentImage = String(
    row.image_url || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'
  );
  const parentImages = Array.isArray(row.image_urls) ? row.image_urls.map(String) : [];
  const variantImages = variants.flatMap((variant) => variant.images);
  const displayImage = selectedVariant?.image || parentImage;
  const displayImages = [
    ...(selectedVariant?.images || []),
    ...variantImages,
    parentImage,
    ...parentImages,
  ].filter(Boolean);
  const uniqueImages = [...new Set(displayImages)];
  const prices = variants.map((variant) => variant.price).filter((price) => price > 0);
  const available = variants.length
    ? variants.reduce((sum, variant) => sum + variant.available, 0)
    : Number(row.available_quantity || 0);

  return {
    id: `seller-${String(row.id)}`,
    source: 'seller',
    sellerId: String(row.seller_id),
    name: String(row.name || 'Untitled fabric'),
    seller: sellerName,
    city: [row.origin_city, row.origin_state].filter(Boolean).join(', ') || 'India',
    category: String(row.category || 'Other'),
    price: selectedVariant?.price || (prices.length ? Math.min(...prices) : Number(row.price_per_unit || 0)),
    priceMax: prices.length ? Math.max(...prices) : Number(row.price_per_unit || 0),
    unit: selectedVariant?.unit || String(row.unit || 'mtr'),
    moq: selectedVariant?.moq || Number(row.moq || 1),
    available: selectedVariant ? selectedVariant.available : available,
    gsm: Number(row.gsm || 0),
    width: row.width_inches ? `${Number(row.width_inches)} inches` : 'Not specified',
    work: selectedVariant?.designName || String(row.work_type || 'Plain'),
    rating: 0,
    reviews: 0,
    badge: 'new',
    verified: true,
    image: displayImage,
    images: uniqueImages.length ? uniqueImages : [displayImage],
    alt: `${String(row.name || 'Fabric')} supplied by ${sellerName}`,
    dispatchDays: Number(row.dispatch_days || 3),
    gst: true,
    description: selectedVariant?.description || String(row.description || ''),
    sku: selectedVariant?.code || (row.sku ? String(row.sku) : null),
    variantCount: variants.length || Number(row.variant_count || 0),
    colors: variants.map((variant) => variant.colorName),
    variants,
    selectedVariantId: selectedVariant?.id || null,
    searchTerms: String(row.search_terms || ''),
  };
}

export function useProduct() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('id') || CATALOG_PRODUCTS[0].id;
  const selectedVariantId = searchParams.get('variant');
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

      const [{ data: seller }, { data: variantRows }] = await Promise.all([
        supabase
          .from('seller_directory')
          .select('display_name,legal_business_name')
          .eq('id', row.seller_id)
          .maybeSingle(),
        supabase
          .from('seller_product_variants')
          .select('*')
          .eq('product_id', id)
          .eq('status', 'active')
          .eq('approval_status', 'approved')
          .order('color_name', { ascending: true }),
      ]);
      if (!mounted) return;
      const variants = (variantRows || []).map((variant) => mapVariant(variant));
      setProduct(
        mapSellerProduct(
          row,
          seller?.display_name || seller?.legal_business_name || 'Verified FabricTrad Seller',
          variants,
          selectedVariantId
        )
      );
      setLoading(false);
    }

    void loadSellerProduct();
    return () => {
      mounted = false;
    };
  }, [requestedId, selectedVariantId]);

  return { product, loading };
}
