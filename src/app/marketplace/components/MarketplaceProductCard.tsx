'use client';

import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { productDetailHref, type CatalogProduct } from '@/lib/catalog';

/**
 * A marketplace listing is a shared CatalogProduct (mapped by
 * `mapSellerProductSummary`) plus the two extra facts the browse grid resolves
 * itself from real columns/views:
 *
 *  - `createdAtMs`  -> `seller_products.created_at`, so "Newest arrivals" can
 *                      sort on the real timestamp instead of a derived badge.
 *  - `sellerRating` -> the `seller_rating_aggregates` view (per SELLER, not per
 *                      product). It is `null` whenever that seller has no real
 *                      review rows, and in that case nothing is rendered.
 *
 * `CatalogProduct.rating` / `.reviews` are hardcoded 0 in src/lib/catalog.ts
 * with no backing source, so this component never reads them.
 */
export type MarketplaceListing = CatalogProduct & {
  createdAtMs: number | null;
  sellerRating: { average: number; count: number } | null;
};

const STAR_SIZE = 12;

function SellerStars({ average }: { average: number }) {
  const clamped = Math.max(0, Math.min(5, average));
  const stars = [0, 1, 2, 3, 4];
  return (
    <span className="ftm-stars" aria-hidden="true" style={{ position: 'relative', display: 'inline-block', height: STAR_SIZE }}>
      <span style={{ display: 'flex', width: STAR_SIZE * 5 }}>
        {stars.map((index) => (
          <Icon key={index} name="StarIcon" variant="solid" size={STAR_SIZE} style={{ flex: '0 0 auto', color: 'var(--ftm-line)' }} />
        ))}
      </span>
      <span
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          top: 0,
          width: `${(clamped / 5) * 100}%`,
          overflow: 'hidden',
        }}
      >
        <span style={{ display: 'flex', width: STAR_SIZE * 5 }}>
          {stars.map((index) => (
            <Icon key={index} name="StarIcon" variant="solid" size={STAR_SIZE} style={{ flex: '0 0 auto' }} />
          ))}
        </span>
      </span>
    </span>
  );
}

type Props = {
  product: MarketplaceListing;
  view: 'grid' | 'list';
  sponsored: boolean;
  wishlisted: boolean;
  /** Quantity already in the cart for this product, or null if it is not in the cart. */
  cartQuantity: number | null;
  onToggleWishlist: () => void;
  onAddToCart: () => void;
  onOpen: () => void;
};

export default function MarketplaceProductCard({
  product,
  view,
  sponsored,
  wishlisted,
  cartQuantity,
  onToggleWishlist,
  onAddToCart,
  onOpen,
}: Props) {
  const href = productDetailHref(product);
  const isRow = view === 'list';
  const sizes = isRow ? '(max-width: 640px) 132px, 196px' : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw';
  const secondaryImage = product.images && product.images.length > 1 ? product.images[1] : null;

  // Only a genuine compare-at price (DB constraint: compare_at_price > price_per_unit)
  // produces a strikethrough and a "% off". No compare-at column value => no badge.
  const compareAt = product.compareAtPrice && product.compareAtPrice > product.price ? product.compareAtPrice : null;
  const percentOff = compareAt ? Math.round(((compareAt - product.price) / compareAt) * 100) : 0;

  // Preserved from the previous grid: real available_quantity only.
  const isLowStock = product.available > 0 && product.available <= 5;
  const outOfStock = product.available <= 0;

  const swatches = (product.variants || []).filter((variant) => variant.colorHex).slice(0, 5);
  const extraVariants = Math.max(0, (product.variantCount || 0) - swatches.length);
  const subline = [product.category, product.work && product.work !== 'Plain' ? product.work : null, product.gsm ? `${product.gsm} GSM` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className={`ftm-card${isRow ? ' is-row' : ''}`}>
      <div className="ftm-card-media">
        <Link href={href} onClick={onOpen} className="ftm-media-link" aria-label={product.name}>
          <span className="ftm-img ftm-img-base">
            <AppImage src={product.image} alt={product.alt} fill sizes={sizes} className="object-cover" />
          </span>
          {secondaryImage && (
            <span className="ftm-img ftm-img-hover">
              <AppImage src={secondaryImage} alt={product.alt} fill sizes={sizes} className="object-cover" />
            </span>
          )}
        </Link>

        <div className="ftm-flags">
          {percentOff > 0 && <span className="ftm-flag ftm-flag-deal">{percentOff}% off</span>}
          {product.badge === 'new' && <span className="ftm-flag ftm-flag-new">New</span>}
          {isLowStock && <span className="ftm-flag ftm-flag-low">Only {product.available} left</span>}
        </div>

        <button
          type="button"
          onClick={onToggleWishlist}
          className={`ftm-wish${wishlisted ? ' is-on' : ''}`}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={wishlisted}
        >
          <Icon name="HeartIcon" size={15} variant={wishlisted ? 'solid' : 'outline'} />
        </button>
      </div>

      <div className="ftm-card-body">
        {/* Paid-placement disclosure. Required whenever sponsored_placements
            boosts this product -- never render it for an unpaid listing. */}
        {sponsored && <p className="ftm-sponsored">Sponsored</p>}

        <Link href={href} onClick={onOpen} className="ftm-title">
          {product.name}
        </Link>

        {subline && <p className="ftm-subline">{subline}</p>}

        {product.sellerRating && (
          <p className="ftm-rating">
            <SellerStars average={product.sellerRating.average} />
            <span>
              {product.sellerRating.average.toFixed(1)} seller rating ({product.sellerRating.count.toLocaleString('en-IN')})
            </span>
          </p>
        )}

        <div className="ftm-price-row">
          <span className="ftm-price">
            ₹{product.price.toLocaleString('en-IN')}
            <span className="ftm-price-unit">/{product.unit}</span>
          </span>
          {compareAt && <span className="ftm-price-was">₹{compareAt.toLocaleString('en-IN')}</span>}
          {percentOff > 0 && <em className="ftm-price-off">Save {percentOff}%</em>}
        </div>

        {!!product.priceMax && product.priceMax > product.price && (
          <p className="ftm-price-range">up to ₹{product.priceMax.toLocaleString('en-IN')}/{product.unit} by variant</p>
        )}

        <p className="ftm-facts">
          <span>
            MOQ <b>{product.moq} {product.unit}</b>
          </span>
          <span>
            Dispatch <b>{product.dispatchDays} day{product.dispatchDays === 1 ? '' : 's'}</b>
          </span>
          {product.gst && <span>GST invoice</span>}
        </p>

        {isLowStock && <p className="ftm-low">Only {product.available} {product.unit} left</p>}

        <p className="ftm-seller">
          <Icon name="ShieldCheckIcon" size={12} style={{ flex: '0 0 auto', color: 'var(--ftm-success)' }} />
          <span>{product.seller}</span>
        </p>

        {!!swatches.length && (
          <div className="ftm-swatches" aria-hidden="true">
            {swatches.map((variant) => (
              <span
                key={variant.id}
                title={`${variant.colorName} · ${variant.available} available`}
                className="ftm-swatch"
                style={{ backgroundColor: variant.colorHex || undefined }}
              />
            ))}
            {extraVariants > 0 && <span className="ftm-swatch-more">+{extraVariants}</span>}
          </div>
        )}

        <div className="ftm-actions">
          {cartQuantity !== null && !outOfStock ? (
            <Link href="/cart" className="ftm-buy" aria-label={`Go to cart — ${product.name} is in your cart`}>
              <Icon name="CheckIcon" size={14} style={{ flex: '0 0 auto' }} />
              Go to cart
            </Link>
          ) : (
            <button type="button" onClick={onAddToCart} disabled={outOfStock} className="ftm-buy">
              <Icon name="ShoppingCartIcon" size={14} style={{ flex: '0 0 auto' }} />
              {outOfStock ? 'Unavailable' : 'Add to cart'}
            </button>
          )}
          <Link href={href} onClick={onOpen} className="ftm-detail" aria-label={`View details for ${product.name}`}>
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}
