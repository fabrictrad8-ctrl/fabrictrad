'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { trackFunnelStep } from '@/lib/analytics';
import { mapSellerProductSummary, type CatalogProduct } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/lib/hooks/useCart';
import { useWishlist } from '@/lib/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';
import MarketplaceProductCard, { type MarketplaceListing } from './MarketplaceProductCard';

const PAGE_SIZE = 24;

const sortOptions = [
  { value: 'relevance', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest arrivals' },
  { value: 'moq', label: 'Lowest MOQ' },
  { value: 'dispatch', label: 'Fastest dispatch' },
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

export default function MarketplaceGrid() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { add, items: cartItems } = useCart();
  const { has: hasWishlisted, toggle: toggleWishlist } = useWishlist();
  const [products, setProducts] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sponsoredIds, setSponsoredIds] = useState<Set<string>>(new Set());

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
      setSponsoredIds(new Set());
      setError('The marketplace catalogue could not be loaded.');
      setLoading(false);
      return;
    }

    const sellerIds = [...new Set((rows || []).map((row) => row.seller_id).filter(Boolean))];
    const names = new Map<string, string>();
    // Real per-SELLER ratings from the seller_rating_aggregates view (built on
    // seller_reviews). There is no per-product rating source in this schema, so
    // a seller with no review rows simply gets no rating rendered.
    const ratings = new Map<string, { average: number; count: number }>();
    if (sellerIds.length) {
      const [{ data: sellers }, { data: ratingRows }] = await Promise.all([
        supabase.from('seller_directory').select('id,display_name,legal_business_name').in('id', sellerIds),
        supabase.from('seller_rating_aggregates').select('seller_id,avg_rating,review_count').in('seller_id', sellerIds),
      ]);
      (sellers || []).forEach((seller) => names.set(seller.id, seller.display_name || seller.legal_business_name || 'Verified FabricTrad Seller'));
      (ratingRows || []).forEach((row) => {
        const count = Number(row.review_count || 0);
        const average = Number(row.avg_rating || 0);
        if (count > 0 && average > 0) ratings.set(String(row.seller_id), { average, count });
      });
    }

    const productIds = [...new Set((rows || []).map((row) => row.id).filter(Boolean))];
    const sponsored = new Set<string>();
    if (productIds.length) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: placements } = await supabase
        .from('sponsored_placements')
        .select('product_id')
        .in('product_id', productIds)
        .eq('status', 'active')
        .lte('start_date', today)
        .gte('end_date', today);
      (placements || []).forEach((placement) => sponsored.add(String(placement.product_id)));
    }
    setSponsoredIds(sponsored);

    setProducts(
      (rows || []).map((row) => {
        const base = mapSellerProductSummary(row as Record<string, unknown>, names.get(row.seller_id) || 'Verified FabricTrad Seller');
        // seller_products.compare_at_price is nullable and DB-constrained to be
        // greater than price_per_unit, so it is the only legitimate source for a
        // strikethrough / "% off". mapSellerProductSummary does not carry it, so
        // it is attached here from the same row rather than re-deriving anything.
        const compareAtPrice = row.compare_at_price != null ? Number(row.compare_at_price) : null;
        const createdAt = row.created_at ? new Date(String(row.created_at)).getTime() : NaN;
        return {
          ...base,
          compareAtPrice: compareAtPrice && compareAtPrice > base.price ? compareAtPrice : null,
          createdAtMs: Number.isFinite(createdAt) ? createdAt : null,
          sellerRating: ratings.get(String(row.seller_id)) || null,
        } satisfies MarketplaceListing;
      })
    );
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
    const minPriceRaw = Number(params.get('minPrice'));
    const maxPriceRaw = Number(params.get('maxPrice'));
    const minPrice = Number.isFinite(minPriceRaw) && minPriceRaw > 0 ? minPriceRaw : 0;
    const maxPrice = Number.isFinite(maxPriceRaw) && maxPriceRaw > 0 ? maxPriceRaw : Infinity;
    const maxMoqRaw = Number(params.get('maxMoq'));
    const maxMoq = Number.isFinite(maxMoqRaw) && maxMoqRaw > 0 ? maxMoqRaw : Infinity;
    const dealsOnly = params.get('deals') === '1';

    const filtered = products.filter((product) => {
      const variantSearch = product.variants?.flatMap((variant) => [variant.colorName, variant.designName, variant.description]).join(' ');
      const searchable = [product.name, product.seller, product.city, product.category, product.work, product.gsm, product.width, product.sku, product.description, product.searchTerms, product.colors?.join(' '), variantSearch].filter(Boolean).join(' ').toLowerCase();
      if (search && !searchable.includes(search)) return false;
      if (category && product.category !== category) return false;
      if (fabricTypes.length && !fabricTypes.includes(product.category)) return false;
      if (product.price < minPrice || product.price > maxPrice) return false;
      if (product.moq > maxMoq) return false;
      if (dealsOnly && !(product.compareAtPrice && product.compareAtPrice > product.price)) return false;
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
      case 'newest': return filtered.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
      default: return filtered.sort((a, b) => b.available - a.available || a.price - b.price);
    }
  }, [params, products, sort]);

  const isSponsored = useCallback(
    (product: CatalogProduct) => !!product.rawProductId && sponsoredIds.has(product.rawProductId),
    [sponsoredIds]
  );

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const visibleProducts = useMemo(() => {
    const pageSlice = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    if (!sponsoredIds.size) return pageSlice;
    // Boost sponsored items to the front of this page only, preserving the
    // relative order within each group (no product is dropped or hidden).
    const boosted = pageSlice.filter((product) => isSponsored(product));
    const rest = pageSlice.filter((product) => !isSponsored(product));
    return boosted.length ? [...boosted, ...rest] : pageSlice;
  }, [filteredProducts, page, sponsoredIds, isSponsored]);

  const updateParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
  };

  const goToPage = (nextPage: number) => {
    updateParam('page', String(nextPage));
    document.getElementById('marketplace-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Any variant of a product counts as "in cart" here, because the grid card
  // adds the product's default variant rather than offering a variant picker.
  const cartQuantityFor = (productId: string) => {
    const lines = cartItems.filter((item) => item.productId === productId);
    if (!lines.length) return null;
    return lines.reduce((sum, line) => sum + line.quantity, 0);
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
      <div className="ftm-toolbar">
        <div className="min-w-0">
          <p className="ftm-toolbar-count">
            {loading ? 'Loading products…' : `${filteredProducts.length.toLocaleString('en-IN')} result${filteredProducts.length === 1 ? '' : 's'}`}
          </p>
          <p className="ftm-toolbar-note">Approved, in-stock products from verified sellers.</p>
        </div>
        <div className="ftm-toolbar-actions">
          <button type="button" onClick={() => void loadProducts()} disabled={loading} className="ftm-iconbtn" aria-label="Refresh marketplace">
            <Icon name="ArrowPathIcon" size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <label className="ftm-sort">
            <span className="text-[11px] font-650 opacity-70">Sort</span>
            <select value={sort} onChange={(event) => updateParam('sort', event.target.value)} aria-label="Sort results">
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="ftm-viewtoggle">
            <button type="button" onClick={() => setView('grid')} className={view === 'grid' ? 'is-active' : ''} aria-label="Grid view" aria-pressed={view === 'grid'}>
              <Icon name="Squares2X2Icon" size={16} />
            </button>
            <button type="button" onClick={() => setView('list')} className={view === 'list' ? 'is-active' : ''} aria-label="List view" aria-pressed={view === 'list'}>
              <Icon name="Bars3BottomLeftIcon" size={16} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="ftm-error">
          <span>{error}</span>
          <button type="button" onClick={() => void loadProducts()} className="ftm-retry">Retry</button>
        </div>
      )}

      {loading && (
        <div className="ftm-grid" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="ftm-skel-card">
              <div className="ftm-skel-media" />
              <div className="ftm-skel-lines">
                <div className="ftm-skel-line" />
                <div className="ftm-skel-line is-short" />
                <div className="ftm-skel-line is-tall" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && visibleProducts.length === 0 && (
        <div className="ftm-empty">
          <Icon name="MagnifyingGlassIcon" size={34} style={{ margin: '0 auto', color: 'var(--ftm-ink-faint)' }} />
          <h2>{products.length ? 'No products match these filters' : 'No approved products are live yet'}</h2>
          <p>
            {products.length
              ? 'Try fewer filters or search for a broader fabric type, seller, colour, GSM or SKU.'
              : 'Products appear after a verified seller has approved stock available.'}
          </p>
          {products.length > 0 && (
            <button type="button" onClick={() => router.replace('/marketplace')} className="ftm-buy mt-5 inline-flex px-5">
              Clear filters
            </button>
          )}
        </div>
      )}

      {!loading && visibleProducts.length > 0 && (
        <div className={view === 'grid' ? 'ftm-grid' : 'ftm-list'}>
          {visibleProducts.map((product) => (
            <MarketplaceProductCard
              key={product.id}
              product={product}
              view={view}
              sponsored={isSponsored(product)}
              wishlisted={hasWishlisted(product.id)}
              cartQuantity={cartQuantityFor(product.id)}
              onToggleWishlist={() => void toggleWishlist(product)}
              onAddToCart={() => addProductToCart(product)}
              onOpen={() => trackFunnelStep('product_view', { product_id: product.id })}
            />
          ))}
        </div>
      )}

      {!loading && filteredProducts.length > PAGE_SIZE && (
        <nav className="ftm-pager" aria-label="Marketplace pagination">
          <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
          <span className="ftm-pager-status">Page {page} of {pageCount}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => goToPage(page + 1)}>Next</button>
        </nav>
      )}
    </section>
  );
}
