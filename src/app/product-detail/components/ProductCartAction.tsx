'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useProduct } from '@/lib/hooks/useProduct';
import { useCart } from '@/lib/hooks/useCart';
import { trackFunnelStep } from '@/lib/analytics';

export default function ProductCartAction() {
  const { product, loading } = useProduct();
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const selectedVariant = product.variants?.find((variant) => variant.id === product.selectedVariantId) || product.variants?.[0] || null;
  const available = Math.max(0, Number(selectedVariant?.available ?? product.available ?? 0));
  const minimum = Math.max(0.01, Number(selectedVariant?.moq ?? product.moq ?? 1));

  if (loading || product.id === 'unavailable') return null;

  const addToCart = () => {
    if (available <= 0) return toast.error('This item is out of stock.');
    const item = add(product, selectedVariant, Math.min(minimum, available));
    setAdded(true);
    trackFunnelStep('add_to_cart', { product_id: product.id, variant_id: selectedVariant?.id || null });
    toast.success(`${product.name}${item.variantLabel ? ` · ${item.variantLabel}` : ''} added to cart.`);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={addToCart} disabled={available <= 0} className="ft-amazon-primary flex min-h-11 flex-1 items-center justify-center gap-2 px-4 text-sm font-850 disabled:opacity-45">
          <Icon name="ShoppingCartIcon" size={17} /> {added ? 'Added to cart' : 'Add to cart'}
        </button>
        <Link href="/cart" className="ft-amazon-secondary flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-800">
          View cart <Icon name="ArrowRightIcon" size={14} />
        </Link>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        Cart keeps the item for later. Live stock, MOQ, price and GST are rechecked atomically when you press Buy now; no seller approval is required.
      </p>
    </div>
  );
}
