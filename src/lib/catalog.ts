export type CatalogMedia = {
  id: string;
  type: 'image' | 'video';
  viewType: 'front' | 'back' | 'detail' | 'reel' | 'other';
  url: string;
  alt: string;
  durationSeconds?: number | null;
};

export type CatalogVariant = {
  id: string;
  key: string;
  code: string;
  colorName: string;
  colorHex: string | null;
  designName: string;
  description: string;
  price: number;
  unit: string;
  available: number;
  moq: number;
  image: string | null;
  images: string[];
  media?: CatalogMedia[];
};

export type CatalogProduct = {
  id: string;
  source: 'catalog' | 'seller';
  sellerId?: string | null;
  rawProductId?: string | null;
  name: string;
  seller: string;
  city: string;
  category: string;
  price: number;
  priceMax?: number;
  compareAtPrice?: number | null;
  unit: string;
  moq: number;
  available: number;
  gsm: number;
  width: string;
  work: string;
  rating: number;
  reviews: number;
  badge: 'bestseller' | 'new' | 'premium' | null;
  verified: boolean;
  image: string;
  images: string[];
  media?: CatalogMedia[];
  alt: string;
  dispatchDays: number;
  gst: boolean;
  description?: string;
  sku?: string | null;
  variantCount?: number;
  colors?: string[];
  variants?: CatalogVariant[];
  selectedVariantId?: string | null;
  searchTerms?: string;
  saleChannel?: 'b2b' | 'retail' | 'both';
  packageFormat?:
    | 'Fabric Only'
    | 'Full Set'
    | 'Top'
    | 'Bottom'
    | 'Top & Bottom'
    | 'Additional Accessory'
    | 'Other';
};

/**
 * Product data is intentionally not stored in this module.
 * Live marketplace products come only from Supabase seller_products and related tables.
 */
export function productDetailHref(product: Pick<CatalogProduct, 'id' | 'source'>) {
  return `/product-detail?id=${encodeURIComponent(product.id)}`;
}

/**
 * Maps the denormalized `variant_summary` jsonb column on a `seller_products`
 * row into display-ready variants, without any extra queries. This is the
 * lightweight mapping used for list/grid views (marketplace grid, related
 * products) as opposed to the full per-variant fetch used on the product
 * detail page (see useProduct.ts).
 */
export function mapSellerProductVariantSummary(value: unknown): CatalogVariant[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const image = row.image ? String(row.image) : null;
    return {
      id: String(row.id || `summary-${index}`),
      key: String(row.id || `summary-${index}`),
      code: String(row.code || ''),
      colorName: String(row.color || 'Assorted'),
      colorHex: row.colorHex ? String(row.colorHex) : null,
      designName: String(row.design || 'Standard'),
      description: String(row.description || ''),
      price: Number(row.price || 0),
      unit: String(row.unit || 'mtr'),
      available: Number(row.available || 0),
      moq: Number(row.moq || 1),
      image,
      images: image ? [image] : [],
    };
  });
}

/**
 * Maps a single `seller_products` row (select('*')) plus its resolved seller
 * display name into a display-ready CatalogProduct, using the denormalized
 * variant_summary/variant_colors/variant_count columns rather than separate
 * variant/media queries. Reused by the marketplace grid and the related
 * products hook so there is one card-mapping shape across list views.
 */
export function mapSellerProductSummary(
  row: Record<string, unknown>,
  sellerName: string
): CatalogProduct {
  const variants = mapSellerProductVariantSummary(row.variant_summary);
  const image = String(
    row.image_url || variants.find((variant) => variant.image)?.image || '/assets/images/no_image.png'
  );
  const extraImages = Array.isArray(row.image_urls) ? row.image_urls.map(String) : [];
  const variantImages = variants.flatMap((variant) => variant.images);
  const prices = variants.map((variant) => variant.price).filter((price) => price > 0);
  const colors = Array.isArray(row.variant_colors)
    ? row.variant_colors.map(String)
    : variants.map((variant) => variant.colorName);
  const available = Math.max(
    0,
    Number(row.available_quantity || 0) - Number(row.reserved_quantity || 0)
  );

  return {
    id: `seller-${String(row.id)}`,
    rawProductId: String(row.id),
    source: 'seller',
    sellerId: String(row.seller_id),
    name: String(row.name || 'Untitled fabric'),
    seller: sellerName,
    city: [row.origin_city, row.origin_state].filter(Boolean).join(', ') || 'India',
    category: String(row.category || 'Other'),
    price: prices.length ? Math.min(...prices) : Number(row.price_per_unit || 0),
    priceMax: prices.length ? Math.max(...prices) : Number(row.price_per_unit || 0),
    unit: String(row.unit || 'mtr'),
    moq: variants.length ? Math.min(...variants.map((variant) => variant.moq)) : Number(row.moq || 1),
    available,
    gsm: Number(row.gsm || 0),
    width: row.width_inches ? `${Number(row.width_inches)} inches` : 'Width not specified',
    work: String(row.work_type || 'Plain'),
    rating: 0,
    reviews: 0,
    badge:
      row.created_at && Date.now() - new Date(String(row.created_at)).getTime() < 30 * 86400000
        ? 'new'
        : null,
    verified: true,
    image,
    images: [...new Set([image, ...variantImages, ...extraImages].filter(Boolean))],
    alt: `${String(row.name || 'Fabric')} supplied by ${sellerName}`,
    dispatchDays: Number(row.dispatch_days || 3),
    gst: Number(row.gst_rate || 0) > 0,
    description: String(row.description || ''),
    sku: row.sku ? String(row.sku) : null,
    variantCount: Number(row.variant_count || variants.length),
    colors,
    variants,
    searchTerms: String(row.search_terms || ''),
    saleChannel:
      row.sale_channel === 'retail' || row.sale_channel === 'both'
        ? (row.sale_channel as 'retail' | 'both')
        : 'b2b',
    packageFormat: (row.package_format || 'Fabric Only') as CatalogProduct['packageFormat'],
  };
}
