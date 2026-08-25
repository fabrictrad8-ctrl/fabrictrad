'use client';

import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useProduct } from '@/lib/hooks/useProduct';
import { useCart } from '@/lib/hooks/useCart';
import { trackFunnelStep } from '@/lib/analytics';

export default function ProductCartAction() {
  const { product, loading } = useProduct();
  const { add } = useCart();

  if (loading) return <div className="h-11 animate-pulse rounded-xl bg-muted" />;

  const selectedVariant =
    product?.variants?.find((variant) => variant?.id === product?.selectedVariantId) ||
    product?.variants?.find((variant) => variant?.available > 0) ||
    null;
  const available = Number(selectedVariant?.available ?? product?.available ?? 0);
  const minimum = Number(selectedVariant?.moq ?? product?.moq ?? 1);

  const addToCart = () => {
    const item = add(product, selectedVariant, minimum);
    trackFunnelStep('add_to_cart', {
      product_id: product?.id,
      variant_id: selectedVariant?.id || null,
    });
    toast?.success(
      `${product?.name}${item?.variantLabel ? ` · ${item?.variantLabel}` : ''} added to cart.`
    );
  };

  return (
    <div className="rounded-xl border border-[#f0c14b]/70 bg-[#fffbea] p-3">
      <button
        type="button"
        onClick={addToCart}
        disabled={available <= 0}
        className="ft-amazon-primary flex min-h-11 w-full items-center justify-center gap-2 px-5 text-sm font-850 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="ShoppingCartIcon" size={17} />
        {available > 0 ? 'Add to cart' : 'Currently unavailable'}
      </button>
      <p className="mt-2 text-center text-[10px] leading-4 text-muted-foreground">
        Cart keeps this product for review. Buyer-specific MOQ, price, GST and stock are rechecked before the order request is submitted.
      </p>
    </div>
  );
}
