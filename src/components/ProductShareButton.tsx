'use client';

import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useProduct } from '@/lib/hooks/useProduct';

type ProductShareButtonProps = {
  productId: string;
  productName: string;
  variantId?: string | null;
  compact?: boolean;
  className?: string;
};

export function productSharePath(productId: string, variantId?: string | null) {
  const params = new URLSearchParams({ id: `seller-${productId}` });
  if (variantId) params.set('variant', variantId);
  return `/product-detail?${params.toString()}`;
}

async function copyLink(url: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  const input = document.createElement('textarea');
  input.value = url;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Copy failed');
}

export default function ProductShareButton({
  productId,
  productName,
  variantId,
  compact = false,
  className = '',
}: ProductShareButtonProps) {
  const share = async () => {
    const url = `${window.location.origin}${productSharePath(productId, variantId)}`;
    const shareData = {
      title: productName,
      text: `View ${productName} on FabricTrad`,
      url,
    };

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(shareData);
        return;
      }
      await copyLink(url);
      toast.success('Product sharing URL copied.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      try {
        await copyLink(url);
        toast.success('Product sharing URL copied.');
      } catch {
        toast.error('Could not copy the product link.');
      }
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void share()}
        className={`ft-icon-button !min-h-9 !min-w-9 ${className}`}
        aria-label={`Share ${productName}`}
        title="Share product"
      >
        <Icon name="ShareIcon" size={15} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={`ft-secondary-action inline-flex items-center gap-2 px-3 py-2 text-xs ${className}`}
    >
      <Icon name="ShareIcon" size={15} /> Share product
    </button>
  );
}

export function CurrentProductShareButton({ className = '' }: { className?: string }) {
  const { product, loading } = useProduct();
  if (loading || !product.rawProductId || product.rawProductId === 'unavailable') return null;

  return (
    <ProductShareButton
      productId={product.rawProductId}
      productName={product.name || 'FabricTrad product'}
      variantId={product.selectedVariantId}
      className={className}
    />
  );
}
