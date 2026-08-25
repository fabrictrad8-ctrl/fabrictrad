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
    | 'Fabric Only' |'Full Set' |'Top' |'Bottom' |'Top & Bottom' |'Additional Accessory' |'Other';
};

/**
 * Product data is intentionally not stored in this module.
 * Live marketplace products come only from Supabase seller_products and related tables.
 */
export function productDetailHref(product: Pick<CatalogProduct, 'id' | 'source'>) {
  return `/product-detail?id=${encodeURIComponent(product.id)}`;
}
