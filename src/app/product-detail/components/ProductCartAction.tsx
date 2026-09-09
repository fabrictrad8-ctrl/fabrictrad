'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useProduct } from '@/lib/hooks/useProduct';
import { useCart } from '@/lib/hooks/useCart';
import { trackFunnelStep } from '@/lib/analytics';

export default function ProductCartAction() {
  const { product, loading } = useProduct();
  const { add, items } = useCart();
  const searchParams = useSearchParams();

  if (loading) return <div className="h-11 animate-pulse rounded-xl bg-muted" />;

  const selectedVariant =
    product.variants?.find((variant) => variant.id === product.selectedVariantId) ||
    product.variants?.find((variant) => variant.available > 0) ||
    null;
  const available = Number(selectedVariant?.available ?? product.available ?? 0);
  const minimum = Number(selectedVariant?.moq ?? product.moq ?? 1);

  // The quantity picker lives in ProductInfoV2 and publishes its choice to the
  // URL, so the buyer's actual selection is what gets added — not the minimum.
  const requestedFromUrl = Number(searchParams.get('qty'));
  const requested = Number.isFinite(requestedFromUrl) && requestedFromUrl >= minimum
    ? requestedFromUrl
    : minimum;

  // Cart lines are keyed by product + variant, so this reflects exactly the
  // selection on screen. Picking a different product or variant shows
  // "Add to cart" again, as it should.
  const inCart = items.find(
    (item) => item.productId === product.id && (item.variantId || null) === (selectedVariant?.id || null)
  );
  const quantityMatches = inCart ? Math.abs(inCart.quantity - requested) < 0.001 : false;

  const addToCart = () => {
    const item = add(product, selectedVariant, requested);
    trackFunnelStep('add_to_cart', {
      product_id: product.id,
      variant_id: selectedVariant?.id || null,
    });
    toast.success(
      `${item.quantity.toLocaleString('en-IN')} ${item.unit} of ${product.name}${item.variantLabel ? ` · ${item.variantLabel}` : ''} ${inCart ? 'updated in' : 'added to'} your cart.`
    );
  };

  if (available <= 0) {
    return (
      <div className="ft-product-content-card ft-product-sticky-cta p-3">
        <button
          type="button"
          disabled
          className="ft-amazon-primary flex min-h-11 w-full items-center justify-center gap-2 px-5 text-sm font-850 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="ShoppingCartIcon" size={17} />
          Currently unavailable
        </button>
      </div>
    );
  }

  return (
    <div className="ft-product-content-card ft-product-sticky-cta p-3">
      {inCart && quantityMatches ? (
        <Link
          href="/cart"
          className="ft-amazon-primary flex min-h-11 w-full items-center justify-center gap-2 px-5 text-sm font-850"
        >
          <Icon name="CheckIcon" size={17} />
          Go to cart
        </Link>
      ) : (
        <button
          type="button"
          onClick={addToCart}
          className="ft-amazon-primary flex min-h-11 w-full items-center justify-center gap-2 px-5 text-sm font-850"
        >
          <Icon name="ShoppingCartIcon" size={17} />
          {inCart ? `Update cart to ${requested.toLocaleString('en-IN')}` : 'Add to cart'}
        </button>
      )}

      {inCart && (
        <p className="mt-2 text-center text-[11px] font-700 text-success">
          {quantityMatches
            ? `${inCart.quantity.toLocaleString('en-IN')} ${inCart.unit} in your cart`
            : `Cart currently holds ${inCart.quantity.toLocaleString('en-IN')} ${inCart.unit}`}
        </p>
      )}

      <p className="ft-product-sticky-cta-note mt-2 text-center text-[10px] leading-4 text-muted-foreground">
        Adding to cart does not reserve stock. Your MOQ, price, GST and live stock are rechecked when you place the order.
      </p>
    </div>
  );
}
