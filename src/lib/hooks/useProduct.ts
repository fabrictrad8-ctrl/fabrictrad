'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  CatalogMedia,
  CatalogProduct,
  CatalogVariant,
} from '@/lib/catalog';
import { createClient } from '@/lib/supabase/client';

const NO_IMAGE = '/assets/images/no_image.png';

const EMPTY_PRODUCT: CatalogProduct = {
  id: 'unavailable',
  rawProductId: null,
  source: 'seller',
  sellerId: null,
  name: 'Product unavailable',
  seller: 'FabricTrad marketplace',
  city: 'India',
  category: 'Other',
  price: 0,
  priceMax: 0,
  unit: 'metre',
  moq: 1,
  available: 0,
  gsm: 0,
  width: 'Not available',
  work: 'Not available',
  rating: 0,
  reviews: 0,
  badge: null,
  verified: false,
  image: NO_IMAGE,
  images: [],
  media: [],
  alt: 'Product unavailable',
  dispatchDays: 0,
  gst: false,
  description:
    'This product is no longer active, has not been approved, or the link is invalid. Return to the marketplace to select an available product.',
  sku: null,
  variantCount: 0,
  colors: [],
  variants: [],
  selectedVariantId: null,
  searchTerms: '',
  saleChannel: 'b2b',
  packageFormat: 'Fabric Only',
};

function displayUnit(row: Record<string, unknown>) {
  const label = String(row.unit_label || '').trim();
  if (label) return label;
  const unit = String(row.unit || 'mtr');
  if (unit === 'mtr') return 'metre';
  if (unit === 'piece') return 'piece';
  return unit;
}

function mapMedia(row: Record<string, unknown>): CatalogMedia {
  return {
    id: String(row.id),
    type: row.media_type === 'video' ? 'video' : 'image',
    viewType:
      row.view_type === 'front' ||
      row.view_type === 'back' ||
      row.view_type === 'detail' ||
      row.view_type === 'reel'
        ? row.view_type
        : 'other',
    url: String(row.public_url || ''),
    alt: String(row.alt_text || 'Product media'),
    durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : null,
  };
}

function mapVariant(row: Record<string, unknown>, media: CatalogMedia[]): CatalogVariant {
  const image = row.image_url ? String(row.image_url) : null;
  const extraImages = Array.isArray(row.image_urls) ? row.image_urls.map(String) : [];
  const mediaImages = media.filter((item) => item.type === 'image').map((item) => item.url);
  const images = [image, ...extraImages, ...mediaImages].filter(Boolean) as string[];
  return {
    id: String(row.id),
    key: String(row.variant_key || row.id),
    code: String(row.variant_code || ''),
    colorName: String(row.color_name || 'Assorted'),
    colorHex: row.color_hex ? String(row.color_hex) : null,
    designName: String(row.design_name || 'Standard'),
    description: String(row.description || ''),
    price: Number(row.price_per_unit || 0),
    unit: displayUnit(row),
    available: Math.max(
      0,
      Number(row.available_quantity || 0) - Number(row.reserved_quantity || 0)
    ),
    moq: Number(row.moq || 1),
    image: mediaImages[0] || image,
    images: [...new Set(images)],
    media,
  };
}

function imageMedia(images: string[], productName: string): CatalogMedia[] {
  return [...new Set(images.filter(Boolean))].map((url, index) => ({
    id: `legacy-image-${index}`,
    type: 'image',
    viewType: index === 0 ? 'front' : 'detail',
    url,
    alt: `${productName} image ${index + 1}`,
  }));
}

function mapSellerProduct(
  row: Record<string, unknown>,
  sellerName: string,
  variants: CatalogVariant[],
  parentMedia: CatalogMedia[],
  selectedVariantId: string | null
): CatalogProduct {
  const selectedVariant =
    variants.find((variant) => variant.id === selectedVariantId) || variants[0] || null;
  const parentImage = String(row.image_url || NO_IMAGE);
  const parentImages = Array.isArray(row.image_urls) ? row.image_urls.map(String) : [];
  const variantImages = variants.flatMap((variant) => variant.images);
  const selectedMedia = selectedVariant?.media || [];
  const combinedMedia = [
    ...selectedMedia,
    ...parentMedia,
    ...variants.flatMap((variant) => variant.media || []),
  ];
  const uniqueMedia = [
    ...new Map(combinedMedia.map((item) => [item.url, item])).values(),
  ].filter((item) => item.url);
  const fallbackImages = [
    ...(selectedVariant?.images || []),
    ...variantImages,
    parentImage,
    ...parentImages,
  ].filter(Boolean);
  const media = uniqueMedia.length
    ? uniqueMedia
    : imageMedia(fallbackImages, String(row.name || 'Fabric'));
  const imageUrls = media.filter((item) => item.type === 'image').map((item) => item.url);
  const displayImage = imageUrls[0] || selectedVariant?.image || parentImage;
  const prices = variants.map((variant) => variant.price).filter((price) => price > 0);
  const available = variants.length
    ? variants.reduce((sum, variant) => sum + variant.available, 0)
    : Math.max(
        0,
        Number(row.available_quantity || 0) - Number(row.reserved_quantity || 0)
      );
  const parentUnit = displayUnit(row);
  const productType = String(row.product_type || row.package_format || 'Fabric Only');
  const fabricName = String(row.fabric_name || '').trim();
  const quality = String(row.quality || '').trim();
  const extraDescription = [fabricName && `Fabric: ${fabricName}`, quality && `Quality: ${quality}`]
    .filter(Boolean)
    .join(' · ');

  return {
    id: `seller-${String(row.id)}`,
    rawProductId: String(row.id),
    source: 'seller',
    sellerId: String(row.seller_id),
    name: String(row.name || 'Untitled fabric'),
    seller: sellerName,
    city: [row.origin_city, row.origin_state].filter(Boolean).join(', ') || 'India',
    category: String(row.category || fabricName || productType || 'Other'),
    price:
      selectedVariant?.price ||
      (prices.length ? Math.min(...prices) : Number(row.price_per_unit || 0)),
    priceMax: prices.length ? Math.max(...prices) : Number(row.price_per_unit || 0),
    unit: selectedVariant?.unit || parentUnit,
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
    images: [...new Set(imageUrls.length ? imageUrls : [displayImage])],
    media,
    alt: `${String(row.name || 'Fabric')} supplied by ${sellerName}`,
    dispatchDays: Number(row.dispatch_days || 3),
    gst: Number(row.gst_rate || 0) > 0,
    description:
      selectedVariant?.description ||
      [String(row.description || ''), extraDescription].filter(Boolean).join('\n'),
    sku: selectedVariant?.code || (row.sku ? String(row.sku) : null),
    variantCount: variants.length || Number(row.variant_count || 0),
    colors: variants.map((variant) => variant.colorName),
    variants,
    selectedVariantId: selectedVariant?.id || null,
    searchTerms: [row.search_terms, row.fabric_name, row.quality, row.product_type]
      .filter(Boolean)
      .join(' '),
    saleChannel:
      row.sale_channel === 'retail' || row.sale_channel === 'both'
        ? row.sale_channel
        : 'b2b',
    packageFormat: productType as CatalogProduct['packageFormat'],
  };
}

export function useProduct() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('id') || '';
  const selectedVariantId = searchParams.get('variant');
  const [product, setProduct] = useState<CatalogProduct>(EMPTY_PRODUCT);
  const [loading, setLoading] = useState(Boolean(requestedId));

  useEffect(() => {
    let mounted = true;
    if (!requestedId.startsWith('seller-')) {
      setProduct(EMPTY_PRODUCT);
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
        .eq('approval_status', 'approved')
        .gt('available_quantity', 0)
        .maybeSingle();
      if (!mounted) return;
      if (error || !row) {
        setProduct(EMPTY_PRODUCT);
        setLoading(false);
        return;
      }

      const [{ data: seller }, { data: variantRows }, { data: mediaRows }] =
        await Promise.all([
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
          supabase
            .from('seller_product_media')
            .select(
              'id,variant_id,media_type,view_type,public_url,alt_text,duration_seconds,sort_order'
            )
            .eq('product_id', id)
            .order('sort_order', { ascending: true }),
        ]);
      if (!mounted) return;

      const media = (mediaRows || []).map((entry) => ({
        row: entry as Record<string, unknown>,
        item: mapMedia(entry as Record<string, unknown>),
      }));
      const variants = (variantRows || []).map((variant) => {
        const variantId = String(variant.id);
        return mapVariant(
          variant as Record<string, unknown>,
          media
            .filter(({ row: mediaRow }) => String(mediaRow.variant_id || '') === variantId)
            .map(({ item }) => item)
        );
      });
      const parentMedia = media
        .filter(({ row: mediaRow }) => !mediaRow.variant_id)
        .map(({ item }) => item);

      setProduct(
        mapSellerProduct(
          row,
          seller?.display_name || seller?.legal_business_name || 'Verified FabricTrad Seller',
          variants,
          parentMedia,
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
