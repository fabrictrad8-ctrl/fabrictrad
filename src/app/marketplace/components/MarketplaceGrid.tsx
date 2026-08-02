'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { trackFunnelStep } from '@/lib/analytics';
import { productDetailHref, type CatalogProduct, type CatalogVariant } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/client';
import { useWishlist } from '@/lib/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 12;

const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'moq', label: 'Lowest MOQ' },
  { value: 'dispatch', label: 'Fastest dispatch' },
  { value: 'newest', label: 'Newest first' },
];

function splitParam(params: URLSearchParams, key: string) {
  return (params.get(key) || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function matchesGsm(value: number, selected: string[]) {
  if (!selected.length) return true;
  return selected.some((range) => {
    if (range === '< 80 GSM') return value < 80;
    if (range === '80-120 GSM') return value >= 80 && value <= 120;
    if (range === '120-200 GSM') return value >= 120 && value <= 200;
    if (range === '200-300 GSM') return value >= 200 && value <= 300;
    return value >= 300;
  });
}

function matchesDispatch(value: number, selected: string[]) {
  if (!selected.length) return true;
  return selected.some((range) => {
    if (range === 'Same Day') return value <= 1;
    if (range === '1-2 Days') return value <= 2;
    if (range === '3-5 Days') return value >= 3 && value <= 5;
    return value >= 5 && value <= 7;
  });
}

function mapVariantSummary(value: unknown): CatalogVariant[] {
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

function mapSellerProduct(row: Record<string, unknown>, sellerName: string): CatalogProduct {
  const variants = mapVariantSummary(row.variant_summary);
  const image = String(
    row.image_url ||
      variants.find((variant) => variant.image)?.image ||
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'
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
    moq: variants.length
      ? Math.min(...variants.map((variant) => variant.moq))
      : Number(row.moq || 1),
    available,
    gsm: Number(row.gsm || 0),
    width: row.width_inches ? `${Number(row.width_inches)} inches` : 'Not specified',
    work: String(row.work_type || 'Plain'),
    rating: Number(row.rating || 0),
    reviews: Number(row.review_count || 0),
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

export default function MarketplaceGrid() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { has, toggle } = useWishlist();

  useEffect(() => {
    trackFunnelStep('marketplace_view', { page: 'marketplace' });
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    let query = supabase
      .from('seller_products')
      .select('*')
      .eq('status', 'active')
      .eq('approval_status', 'approved')
      .gt('available_quantity', 0)
      .order('updated_at', { ascending: false });

    if (profile?.account_kind === 'individual') {
      query = query.eq('end_user_enabled', true);
    }

    const { data: rows, error: productError } = await query;
    if (productError) {
      setProducts([]);
      setError('The marketplace catalogue could not be loaded.');
      setLoading(false);
      return;
    }

    const sellerIds = [...new Set((rows || []).map((row) => row.seller_id).filter(Boolean))];
    const names = new Map<string, string>();
    if (sellerIds.length) {
      const { data: sellers } = await supabase
        .from('seller_directory')
        .select('id,display_name,legal_business_name')
        .in('id', sellerIds);
      (sellers || []).forEach((seller) => {
        names.set(
          seller.id,
          seller.display_name || seller.legal_business_name || 'Verified FabricTrad Seller'
        );
      });
    }

    setProducts(
      (rows || []).map((row) =>
        mapSellerProduct(
          row as Record<string, unknown>,
          names.get(row.seller_id) || 'Verified FabricTrad Seller'
        )
      )
    );
    setLoading(false);
  };

  useEffect(() => {
    void loadProducts();
  }, [profile?.account_kind]);

  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const sort = params.get('sort') || 'relevance';
  const requestedPage = Math.max(1, Number(params.get('page') || 1));

  const filteredProducts = useMemo(() => {
    const search = (params.get('search') || '').trim().toLowerCase();
    const category = params.get('category');
    const fabricTypes = splitParam(params, 'fabricType');
    const gsm = splitParam(params, 'gsm');
    const widths = splitParam(params, 'width');
    const works = splitParam(params, 'work');
    const dispatch = splitParam(params, 'dispatch');
    const maxPrice = Number(params.get('maxPrice') || 5000);
    const maxMoq = Number(params.get('maxMoq') || 500);

    const filtered = products.filter((product) => {
      const variantSearch = product.variants
        ?.flatMap((variant) => [variant.colorName, variant.designName, variant.description])
        .join(' ');
      const searchable = [
        product.name,
        product.seller,
        product.city,
        product.category,
        product.work,
        product.gsm,
        product.width,
        product.sku,
        product.description,
        product.searchTerms,
        product.colors?.join(' '),
        variantSearch,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (search && !searchable.includes(search)) return false;
      if (category && product.category !== category) return false;
      if (fabricTypes.length && !fabricTypes.includes(product.category)) return false;
      if (product.price > maxPrice || product.moq > maxMoq) return false;
      if (!matchesGsm(product.gsm, gsm)) return false;
      if (widths.length && !widths.includes(product.width)) return false;
      if (works.length && !works.some((work) => searchable.includes(work.toLowerCase()))) return false;
      if (!matchesDispatch(product.dispatchDays, dispatch)) return false;
      return true;
    });

    switch (sort) {
      case 'price-asc':
        return filtered.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return filtered.sort((a, b) => b.price - a.price);
      case 'moq':
        return filtered.sort((a, b) => a.moq - b.moq);
      case 'dispatch':
        return filtered.sort((a, b) => a.dispatchDays - b.dispatchDays);
      case 'newest':
        return filtered.sort((a, b) => Number(b.badge === 'new') - Number(a.badge === 'new'));
      default:
        return filtered.sort((a, b) => b.available - a.available || a.price - b.price);
    }
  }, [params, products, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const visibleProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  return (
    <section id="marketplace-search" className="scroll-mt-24">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-800 text-foreground">
            {loading ? 'Loading approved products…' : `${filteredProducts.length} approved products`}
          </p>
          <p className="text-xs text-muted-foreground">
            Live inventory from verified FabricTrad sellers. Demo products are not shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadProducts()}
            disabled={loading}
            className="ft-icon-button"
            aria-label="Refresh marketplace"
          >
            <Icon name="ArrowPathIcon" size={17} className={loading ? 'animate-spin' : ''} />
          </button>
          <label className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-700 text-foreground">
            <span className="sr-only">Sort products</span>
            <select
              value={sort}
              onChange={(event) => updateParam('sort', event.target.value)}
              className="bg-transparent outline-none"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="hidden overflow-hidden rounded-xl border border-border sm:flex">
            <button type="button" onClick={() => setView('grid')} className={`px-3 py-2 ${view === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} aria-label="Grid view"><Icon name="Squares2X2Icon" size={17} /></button>
            <button type="button" onClick={() => setView('list')} className={`px-3 py-2 ${view === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} aria-label="List view"><Icon name="Bars3BottomLeftIcon" size={17} /></button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-error/20 bg-error/10 px-4 py-4 text-sm text-error">
          <span>{error}</span>
          <button type="button" onClick={() => void loadProducts()} className="font-800 underline">Retry</button>
        </div>
      )}

      {!loading && !error && visibleProducts.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-16 text-center">
          <Icon name="MagnifyingGlassIcon" size={36} className="mx-auto text-muted-foreground" />
          <h2 className="mt-4 text-xl font-800 text-foreground">
            {products.length ? 'No products match these filters' : 'No approved products are live yet'}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {products.length
              ? 'Clear filters or search for a broader fabric type, seller, colour, GSM or SKU.'
              : 'Seller products appear here only after inventory is available and FabricTrad approves the listing.'}
          </p>
          {products.length > 0 && (
            <button type="button" onClick={() => router.replace('/marketplace')} className="ft-primary-action mt-5 px-4 py-2.5 text-sm">Clear all filters</button>
          )}
        </div>
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="aspect-square animate-pulse bg-muted" />
              <div className="space-y-3 p-4"><div className="h-4 w-3/4 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /><div className="h-9 animate-pulse rounded-xl bg-muted" /></div>
            </div>
          ))}
        </div>
      )}

      {!loading && visibleProducts.length > 0 && (
        <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-4'}>
          {visibleProducts.map((product) => {
            const saved = has(product.id);
            const visibleColors = product.variants?.slice(0, 6) || [];
            return (
              <article key={product.id} className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${view === 'list' ? 'flex min-h-52' : ''}`}>
                <Link href={productDetailHref(product)} onClick={() => trackFunnelStep('product_view', { product_id: product.id })} className={`relative block overflow-hidden bg-muted ${view === 'list' ? 'w-44 shrink-0 sm:w-60' : 'aspect-square'}`}>
                  <AppImage src={product.image} alt={product.alt} fill sizes={view === 'list' ? '240px' : '(max-width: 640px) 100vw, 33vw'} className="object-cover transition duration-300 hover:scale-105" />
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    <span className="rounded-full bg-success px-2 py-1 text-[10px] font-800 text-white">Live stock</span>
                    {product.variantCount ? <span className="rounded-full bg-black/70 px-2 py-1 text-[10px] font-800 text-white">{product.variantCount} variants</span> : null}
                  </div>
                </Link>

                <div className="flex min-w-0 flex-1 flex-col p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon name="ShieldCheckIcon" size={13} className="text-success" /><span className="truncate">{product.seller}</span></div>
                      <Link href={productDetailHref(product)} className="mt-1 block line-clamp-2 text-base font-800 text-foreground hover:text-primary">{product.name}</Link>
                      <p className="mt-1 text-xs text-muted-foreground">{product.city} · {product.gsm || '—'} GSM · {product.width}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const added = await toggle(product);
                          toast.success(added ? 'Saved to wishlist' : 'Removed from wishlist');
                        } catch (wishlistError) {
                          toast.error(wishlistError instanceof Error ? wishlistError.message : 'Wishlist could not be updated.');
                        }
                      }}
                      className={`ft-icon-button ${saved ? '!border-error/20 !bg-error/10 !text-error' : ''}`}
                      aria-label={`${saved ? 'Remove' : 'Save'} ${product.name}`}
                    >
                      <Icon name="HeartIcon" size={17} variant={saved ? 'solid' : 'outline'} />
                    </button>
                  </div>

                  {!!visibleColors.length && (
                    <div className="mt-3 flex items-center gap-1.5">
                      {visibleColors.map((variant) => (
                        <span key={variant.id} title={`${variant.colorName} · ${variant.available} available`} className="h-5 w-5 rounded-full border border-border shadow-sm" style={{ backgroundColor: variant.colorHex || '#d1d5db' }} />
                      ))}
                      {(product.variantCount || 0) > visibleColors.length && <span className="text-[10px] font-800 text-muted-foreground">+{(product.variantCount || 0) - visibleColors.length}</span>}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-xs">
                    <div><p className="text-muted-foreground">From</p><p className="mt-0.5 text-base font-800 text-foreground">₹{product.price.toLocaleString('en-IN')}/{product.unit}</p></div>
                    <div className="text-right"><p className="text-muted-foreground">MOQ</p><p className="mt-0.5 font-800 text-foreground">{product.moq} {product.unit}</p></div>
                    <div><p className="text-muted-foreground">Available</p><p className="mt-0.5 font-800 text-success">{product.available.toLocaleString('en-IN')} {product.unit}</p></div>
                    <div className="text-right"><p className="text-muted-foreground">Dispatch</p><p className="mt-0.5 font-800 text-foreground">{product.dispatchDays} days</p></div>
                  </div>

                  <Link href={productDetailHref(product)} className="ft-primary-action mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm">
                    View product and order <Icon name="ArrowRightIcon" size={15} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && filteredProducts.length > PAGE_SIZE && (
        <nav className="mt-7 flex items-center justify-center gap-2" aria-label="Marketplace pagination">
          <button type="button" disabled={page <= 1} onClick={() => updateParam('page', String(page - 1))} className="ft-secondary-action px-3 py-2 text-xs disabled:opacity-40">Previous</button>
          <span className="px-3 text-xs font-800 text-muted-foreground">Page {page} of {pageCount}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => updateParam('page', String(page + 1))} className="ft-secondary-action px-3 py-2 text-xs disabled:opacity-40">Next</button>
        </nav>
      )}
    </section>
  );
}
