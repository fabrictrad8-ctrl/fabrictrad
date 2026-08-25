'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { trackFunnelStep } from '@/lib/analytics';
import { productDetailHref, type CatalogProduct, type CatalogVariant } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/lib/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 16;
const sortOptions = [
  { value: 'relevance', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'moq', label: 'Lowest MOQ' },
  { value: 'dispatch', label: 'Fastest dispatch' },
  { value: 'newest', label: 'Newest arrivals' },
];

function splitParam(params: URLSearchParams, key: string) {
  return (params.get(key) || '').split(',').map((value) => value.trim()).filter(Boolean);
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
    const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const image = row.image ? String(row.image) : null;
    return {
      id: String(row.id || `summary-${index}`), key: String(row.id || `summary-${index}`), code: String(row.code || ''),
      colorName: String(row.color || 'Assorted'), colorHex: row.colorHex ? String(row.colorHex) : null,
      designName: String(row.design || 'Standard'), description: String(row.description || ''), price: Number(row.price || 0),
      unit: String(row.unit || 'mtr'), available: Number(row.available || 0), moq: Number(row.moq || 1), image, images: image ? [image] : [],
    };
  });
}

function mapSellerProduct(row: Record<string, unknown>, sellerName: string): CatalogProduct {
  const variants = mapVariantSummary(row.variant_summary);
  const image = String(row.image_url || variants.find((variant) => variant.image)?.image || '/assets/images/no_image.png');
  const extraImages = Array.isArray(row.image_urls) ? row.image_urls.map(String) : [];
  const variantImages = variants.flatMap((variant) => variant.images);
  const prices = variants.map((variant) => variant.price).filter((price) => price > 0);
  const colors = Array.isArray(row.variant_colors) ? row.variant_colors.map(String) : variants.map((variant) => variant.colorName);
  const available = Math.max(0, Number(row.available_quantity || 0) - Number(row.reserved_quantity || 0));

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
    rating: Number(row.rating || 0),
    reviews: Number(row.review_count || 0),
    badge: row.created_at && Date.now() - new Date(String(row.created_at)).getTime() < 30 * 86400000 ? 'new' : null,
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
    saleChannel: row.sale_channel === 'retail' || row.sale_channel === 'both' ? row.sale_channel as 'retail' | 'both' : 'b2b',
    packageFormat: (row.package_format || 'Fabric Only') as CatalogProduct['packageFormat'],
  };
}

export default function MarketplaceGrid() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { add } = useCart();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => { trackFunnelStep('marketplace_view', { page: 'marketplace' }); }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    let query = supabase.from('seller_products').select('*').eq('status', 'active').eq('approval_status', 'approved').gt('available_quantity', 0).order('updated_at', { ascending: false });
    if (profile?.account_kind === 'individual') query = query.eq('end_user_enabled', true).in('sale_channel', ['retail', 'both']);

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
      const { data: sellers } = await supabase.from('seller_directory').select('id,display_name,legal_business_name').in('id', sellerIds);
      (sellers || []).forEach((seller) => names.set(seller.id, seller.display_name || seller.legal_business_name || 'Verified FabricTrad Seller'));
    }

    setProducts((rows || []).map((row) => mapSellerProduct(row as Record<string, unknown>, names.get(row.seller_id) || 'Verified FabricTrad Seller')));
    setLoading(false);
  }, [profile?.account_kind]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

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
      const variantSearch = product.variants?.flatMap((variant) => [variant.colorName, variant.designName, variant.description]).join(' ');
      const searchable = [product.name, product.seller, product.city, product.category, product.work, product.gsm, product.width, product.sku, product.description, product.searchTerms, product.colors?.join(' '), variantSearch].filter(Boolean).join(' ').toLowerCase();
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
      case 'price-asc': return filtered.sort((a, b) => a.price - b.price);
      case 'price-desc': return filtered.sort((a, b) => b.price - a.price);
      case 'moq': return filtered.sort((a, b) => a.moq - b.moq);
      case 'dispatch': return filtered.sort((a, b) => a.dispatchDays - b.dispatchDays);
      case 'newest': return filtered.sort((a, b) => Number(b.badge === 'new') - Number(a.badge === 'new'));
      default: return filtered.sort((a, b) => b.available - a.available || a.price - b.price);
    }
  }, [params, products, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const visibleProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  const addProductToCart = (product: CatalogProduct) => {
    const defaultVariant = product.variants?.find((variant) => variant.available > 0) || null;
    const quantity = Number(defaultVariant?.moq ?? product.moq ?? 1);
    const item = add(product, defaultVariant, quantity);
    trackFunnelStep('add_to_cart', { product_id: product.id, variant_id: defaultVariant?.id || null });
    toast.success(
      `${product.name}${item.variantLabel ? ` · ${item.variantLabel}` : ''} added to cart.`
    );
  };

  return (
    <section id="marketplace-results" className="scroll-mt-24">
      <div className="ft-marketplace-results-toolbar mb-3 flex flex-col gap-3 border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-850 text-foreground">{loading ? 'Loading products…' : `${filteredProducts.length.toLocaleString('en-IN')} result${filteredProducts.length === 1 ? '' : 's'}`}</p>
          <p className="text-xs text-muted-foreground">Approved, in-stock products from verified sellers.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadProducts()} disabled={loading} className="ft-icon-button" aria-label="Refresh marketplace"><Icon name="ArrowPathIcon" size={17} className={loading ? 'animate-spin' : ''} /></button>
          <label className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-750 text-foreground"><span className="mr-1 text-muted-foreground">Sort:</span><select value={sort} onChange={(event) => updateParam('sort', event.target.value)} className="bg-transparent outline-none">{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <div className="hidden overflow-hidden rounded-lg border border-border sm:flex"><button type="button" onClick={() => setView('grid')} className={`px-3 py-2 ${view === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} aria-label="Grid view"><Icon name="Squares2X2Icon" size={17} /></button><button type="button" onClick={() => setView('list')} className={`px-3 py-2 ${view === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} aria-label="List view"><Icon name="Bars3BottomLeftIcon" size={17} /></button></div>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-error/20 bg-error/10 px-4 py-4 text-sm text-error"><span>{error}</span><button type="button" onClick={() => void loadProducts()} className="font-850 underline">Retry</button></div>}

      {!loading && !error && visibleProducts.length === 0 && <div className="rounded-xl border border-dashed border-border bg-card px-5 py-16 text-center"><Icon name="MagnifyingGlassIcon" size={36} className="mx-auto text-muted-foreground" /><h2 className="mt-4 text-xl font-850 text-foreground">{products.length ? 'No products match these filters' : 'No approved products are live yet'}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{products.length ? 'Try fewer filters or search for a broader fabric type, seller, colour, GSM or SKU.' : 'Products appear after a verified seller has approved stock available.'}</p>{products.length > 0 && <button type="button" onClick={() => router.replace('/marketplace')} className="ft-primary-action mt-5 px-4 py-2.5 text-sm">Clear filters</button>}</div>}

      {loading && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="overflow-hidden rounded-lg border border-border bg-card"><div className="aspect-square animate-pulse bg-muted" /><div className="space-y-3 p-4"><div className="h-4 w-3/4 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /><div className="h-9 animate-pulse rounded-lg bg-muted" /></div></div>)}</div>}

      {!loading && visibleProducts.length > 0 && (
        <div className={view === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4' : 'space-y-3'}>
          {visibleProducts.map((product) => {
            const visibleColors = product.variants?.slice(0, 6) || [];
            const lowAvailability = product.available <= Math.max(product.moq * 3, 10);
            return (
              <article key={product.id} className={`ft-marketplace-product-card overflow-hidden ${view === 'list' ? 'flex min-h-52' : ''}`}>
                <Link href={productDetailHref(product)} onClick={() => trackFunnelStep('product_view', { product_id: product.id })} className={`ft-marketplace-product-image relative block overflow-hidden ${view === 'list' ? 'w-44 shrink-0 sm:w-60' : 'aspect-square'}`}>
                  <AppImage src={product.image} alt={product.alt} fill sizes={view === 'list' ? '240px' : '(max-width: 640px) 50vw, 25vw'} className="object-cover transition duration-300 hover:scale-[1.025]" />
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    {product.badge === 'new' && <span className="rounded bg-[#cc0c39] px-2 py-1 text-[10px] font-850 text-white">New</span>}
                    <span className="rounded bg-success px-2 py-1 text-[10px] font-850 text-white">In stock</span>
                  </div>
                </Link>

                <div className="flex min-w-0 flex-1 flex-col p-3.5">
                  <div className="min-w-0">
                    <Link href={productDetailHref(product)} className="block line-clamp-2 text-[14px] font-750 leading-5 text-foreground hover:text-[#b12704]">{product.name}</Link>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Icon name="ShieldCheckIcon" size={12} className="text-success" /><span className="truncate">{product.seller}</span></div>
                  </div>

                  {product.rating > 0 && <div className="mt-1.5 flex items-center gap-1 text-[11px]"><span className="font-800 text-[#b45309]">{product.rating.toFixed(1)}</span><span className="text-[#f59e0b]">★★★★★</span><span className="text-muted-foreground">({product.reviews})</span></div>}
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{product.city} · {product.gsm || '—'} GSM · {product.width}</p>

                  {!!visibleColors.length && <div className="mt-2 flex items-center gap-1">{visibleColors.map((variant) => <span key={variant.id} title={`${variant.colorName} · ${variant.available} available`} className="h-4 w-4 rounded-full border border-border shadow-sm" style={{ backgroundColor: variant.colorHex || '#d1d5db' }} />)}{(product.variantCount || 0) > visibleColors.length && <span className="text-[10px] font-800 text-muted-foreground">+{(product.variantCount || 0) - visibleColors.length}</span>}</div>}

                  <div className="mt-3">
                    <p className="ft-marketplace-price">₹{product.price.toLocaleString('en-IN')}<span className="ml-1 text-xs font-700 text-muted-foreground">/{product.unit}</span></p>
                    {product.priceMax && product.priceMax > product.price && <p className="text-[10px] text-muted-foreground">up to ₹{product.priceMax.toLocaleString('en-IN')}/{product.unit} by variant</p>}
                  </div>

                  <div className="ft-marketplace-buy-meta mt-3 grid grid-cols-2 gap-x-3 gap-y-2 p-2.5 text-[11px]">
                    <div><span className="text-muted-foreground">MOQ</span><p className="font-800 text-foreground">{product.moq} {product.unit}</p></div>
                    <div><span className="text-muted-foreground">Dispatch</span><p className="font-800 text-foreground">{product.dispatchDays} day{product.dispatchDays === 1 ? '' : 's'}</p></div>
                    <div><span className="text-muted-foreground">Available</span><p className={`font-800 ${lowAvailability ? 'text-warning' : 'text-success'}`}>{product.available.toLocaleString('en-IN')} {product.unit}</p></div>
                    <div><span className="text-muted-foreground">Invoice</span><p className="font-800 text-foreground">{product.gst ? 'GST supported' : 'Seller invoice'}</p></div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded-full bg-muted px-2 py-1 font-750 text-muted-foreground">{product.saleChannel === 'b2b' ? 'Business buyers' : product.saleChannel === 'retail' ? 'Personal buyers' : 'Business + personal'}</span>
                    {(product.variantCount || 0) > 0 && <span className="rounded-full bg-muted px-2 py-1 font-750 text-muted-foreground">{product.variantCount} variants</span>}
                  </div>

                  <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => addProductToCart(product)}
                      disabled={product.available <= 0}
                      className="ft-add-cart-action inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#f0c14b] bg-[#ffd814] px-3 py-2 text-xs font-850 text-[#111827] shadow-sm transition hover:bg-[#f7ca00] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon name="ShoppingCartIcon" size={15} /> Add to cart
                    </button>
                    <Link href={productDetailHref(product)} className="ft-secondary-action inline-flex min-h-10 items-center justify-center px-3 text-xs" aria-label={`View details for ${product.name}`}>
                      Details
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && filteredProducts.length > PAGE_SIZE && <nav className="mt-7 flex items-center justify-center gap-2" aria-label="Marketplace pagination"><button type="button" disabled={page <= 1} onClick={() => updateParam('page', String(page - 1))} className="ft-secondary-action px-3 py-2 text-xs disabled:opacity-40">Previous</button><span className="px-3 text-xs font-850 text-muted-foreground">Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => updateParam('page', String(page + 1))} className="ft-secondary-action px-3 py-2 text-xs disabled:opacity-40">Next</button></nav>}
    </section>
  );
}
