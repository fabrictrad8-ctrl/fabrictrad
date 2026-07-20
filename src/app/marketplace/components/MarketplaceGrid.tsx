'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { trackFunnelStep } from '@/lib/analytics';
import { CATALOG_PRODUCTS, productDetailHref, type CatalogProduct } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/client';
import { useWishlist } from '@/lib/hooks/useWishlist';

const PAGE_SIZE = 9;

const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'moq', label: 'Lowest MOQ' },
  { value: 'dispatch', label: 'Fastest Dispatch' },
  { value: 'newest', label: 'Newest First' },
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
    badge: row.created_at && Date.now() - new Date(String(row.created_at)).getTime() < 30 * 86400000 ? 'new' : null,
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

export default function MarketplaceGrid() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [liveProducts, setLiveProducts] = useState<CatalogProduct[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { has, toggle } = useWishlist();

  useEffect(() => {
    trackFunnelStep('marketplace_view', { page: 'marketplace' });
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadProducts() {
      const supabase = createClient();
      const { data: rows, error } = await supabase
        .from('seller_products')
        .select('*')
        .eq('status', 'active')
        .gt('available_quantity', 0)
        .order('updated_at', { ascending: false });

      if (!mounted) return;
      if (error || !rows?.length) {
        setLiveProducts([]);
        setLoadingLive(false);
        return;
      }

      const sellerIds = [...new Set(rows.map((row) => row.seller_id).filter(Boolean))];
      const { data: sellers } = await supabase
        .from('seller_directory')
        .select('id,display_name,legal_business_name')
        .in('id', sellerIds);
      const names = new Map(
        (sellers || []).map((seller) => [
          seller.id,
          seller.display_name || seller.legal_business_name || 'Verified FabricTrad Seller',
        ])
      );
      setLiveProducts(rows.map((row) => mapSellerProduct(row, names.get(row.seller_id) || 'Verified FabricTrad Seller')));
      setLoadingLive(false);
    }
    loadProducts();
    return () => {
      mounted = false;
    };
  }, []);

  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const sort = params.get('sort') || 'relevance';
  const page = Math.max(1, Number(params.get('page') || 1));

  const filteredProducts = useMemo(() => {
    const search = (params.get('search') || '').toLowerCase();
    const category = params.get('category');
    const fabricTypes = splitParam(params, 'fabricType');
    const gsm = splitParam(params, 'gsm');
    const widths = splitParam(params, 'width');
    const works = splitParam(params, 'work');
    const dispatch = splitParam(params, 'dispatch');
    const maxPrice = Number(params.get('maxPrice') || 5000);
    const maxMoq = Number(params.get('maxMoq') || 500);
    const verified = params.get('verified') === '1';

    const products = [...liveProducts, ...CATALOG_PRODUCTS].filter((product) => {
      const searchable = [product.name, product.seller, product.city, product.category, product.work, product.gsm, product.width, product.sku]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (search && !searchable.includes(search)) return false;
      if (category && product.category !== category) return false;
      if (fabricTypes.length && !fabricTypes.includes(product.category)) return false;
      if (verified && !product.verified) return false;
      if (product.price > maxPrice || product.moq > maxMoq) return false;
      if (!matchesGsm(product.gsm, gsm)) return false;
      if (widths.length && !widths.includes(product.width)) return false;
      if (works.length && !works.some((work) => product.work.toLowerCase().includes(work.toLowerCase()))) return false;
      if (!matchesDispatch(product.dispatchDays, dispatch)) return false;
      return true;
    });

    switch (sort) {
      case 'price-asc':
        return products.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return products.sort((a, b) => b.price - a.price);
      case 'rating':
        return products.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
      case 'moq':
        return products.sort((a, b) => a.moq - b.moq);
      case 'dispatch':
        return products.sort((a, b) => a.dispatchDays - b.dispatchDays);
      case 'newest':
        return products.sort((a, b) => Number(b.badge === 'new') - Number(a.badge === 'new'));
      default:
        return products.sort((a, b) => Number(b.source === 'seller') - Number(a.source === 'seller') || b.rating - a.rating);
    }
  }, [liveProducts, params, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleProducts = filteredProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const updateParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  const toggleCompare = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) {
        toast.error('You can compare up to three products.');
        return current;
      }
      return [...current, id];
    });
  };

  const productCard = (product: CatalogProduct) => {
    const saved = has(product.id);
    return (
      <article key={product.id} className={`overflow-hidden rounded-2xl border border-border bg-card product-card ${view === 'list' ? 'flex min-h-48' : ''}`}>
        <div className={`relative bg-muted ${view === 'list' ? 'w-48 shrink-0 sm:w-60' : 'aspect-square'}`}>
          <Link href={productDetailHref(product)} onClick={() => trackFunnelStep('product_view', { product_id: product.id })}>
            <AppImage src={product.image} alt={product.alt} fill sizes={view === 'list' ? '240px' : '(max-width: 640px) 100vw, 33vw'} className="object-cover transition-transform duration-300 hover:scale-105" />
          </Link>
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {product.badge && <span className={product.badge === 'premium' ? 'tag-premium' : product.badge === 'new' ? 'tag-new' : 'tag-bestseller'}>{product.badge === 'premium' ? 'Premium' : product.badge === 'new' ? 'New' : 'Best Seller'}</span>}
            {product.source === 'seller' && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-800 text-white">Live Stock</span>}
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const added = await toggle(product);
                toast.success(added ? 'Saved to wishlist' : 'Removed from wishlist');
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not update wishlist');
              }
            }}
            className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 shadow-sm transition-colors ${saved ? 'border-error text-error' : 'border-white text-muted-foreground hover:text-error'}`}
            aria-label={`${saved ? 'Remove' : 'Add'} ${product.name} ${saved ? 'from' : 'to'} wishlist`}
          >
            <Icon name="HeartIcon" size={17} variant={saved ? 'solid' : 'outline'} />
          </button>
          <label className="absolute bottom-2 left-2 flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-700 text-foreground shadow-sm">
            <input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggleCompare(product.id)} className="rounded border-border text-primary focus:ring-primary" />
            Compare
          </label>
        </div>

        <div className={`p-4 ${view === 'list' ? 'flex min-w-0 flex-1 flex-col justify-between' : ''}`}>
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              {product.verified && <Icon name="ShieldCheckIcon" size={13} className="text-success" title="GST-verified seller" />}
              <p className="truncate text-xs text-muted-foreground">{product.seller}</p>
            </div>
            <Link href={productDetailHref(product)} className="line-clamp-2 text-sm font-800 text-foreground hover:text-primary">
              {product.name}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">{product.city} · {product.gsm || '—'} GSM · {product.width}</p>
            <div className="mt-2 flex items-center gap-1 text-xs">
              <Icon name="StarIcon" size={13} variant="solid" className="text-amber-400" />
              <span className="font-700 text-foreground">{product.reviews ? product.rating.toFixed(1) : 'New'}</span>
              {product.reviews > 0 && <span className="text-muted-foreground">({product.reviews})</span>}
              <span className="ml-auto text-muted-foreground">Dispatch {product.dispatchDays}d</span>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3">
            <div>
              <p className="text-lg font-800 text-primary">₹{product.price.toLocaleString('en-IN')}<span className="text-xs font-500 text-muted-foreground">/{product.unit}</span></p>
              <p className="text-xs text-muted-foreground">MOQ {product.moq} mtrs · {product.available.toLocaleString('en-IN')} available</p>
            </div>
            <Link href={productDetailHref(product)} className="btn-primary shrink-0 rounded-lg px-3 py-2 text-xs">
              View & Request
            </Link>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            {loadingLive ? 'Checking live seller inventory…' : <><span className="font-700 text-foreground">{filteredProducts.length}</span> matching product{filteredProducts.length === 1 ? '' : 's'}</>}
          </p>
          {selected.length > 0 && (
            <p className="mt-1 text-xs font-700 text-primary">{selected.length} selected for comparison</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={sort} onChange={(event) => updateParam('sort', event.target.value === 'relevance' ? undefined : event.target.value)} className="input-base rounded-xl px-3 py-2 pr-8 text-sm" aria-label="Sort products">
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div className="flex overflow-hidden rounded-xl border border-border">
            <button type="button" onClick={() => setView('grid')} className={`p-2 ${view === 'grid' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:text-foreground'}`} aria-label="Grid view" aria-pressed={view === 'grid'}><Icon name="Squares2X2Icon" size={16} /></button>
            <button type="button" onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:text-foreground'}`} aria-label="List view" aria-pressed={view === 'list'}><Icon name="ListBulletIcon" size={16} /></button>
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-16 text-center">
          <Icon name="MagnifyingGlassIcon" size={36} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-800 text-foreground">No fabrics match these filters</p>
          <p className="mt-1 text-xs text-muted-foreground">Try increasing the price or MOQ range, or clear a filter.</p>
          <button type="button" onClick={() => router.replace('/marketplace')} className="btn-primary mt-4 rounded-xl px-4 py-2 text-xs">Clear Filters</button>
        </div>
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-4'}>
          {visibleProducts.map(productCard)}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Marketplace pages">
          <button type="button" onClick={() => updateParam('page', String(Math.max(1, safePage - 1)))} disabled={safePage === 1} className="flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-xs font-700 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><Icon name="ChevronLeftIcon" size={14} /> Prev</button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <button key={pageNumber} type="button" onClick={() => updateParam('page', pageNumber === 1 ? undefined : String(pageNumber))} className={`h-9 w-9 rounded-lg text-sm font-600 ${pageNumber === safePage ? 'bg-primary text-white' : 'border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'}`} aria-current={pageNumber === safePage ? 'page' : undefined}>{pageNumber}</button>
          ))}
          <button type="button" onClick={() => updateParam('page', String(Math.min(pageCount, safePage + 1)))} disabled={safePage === pageCount} className="flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-xs font-700 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page">Next <Icon name="ChevronRightIcon" size={14} /></button>
        </nav>
      )}
    </div>
  );
}
