'use client';

import { useMemo } from 'react';
import AiAssistantWidget from '@/components/AiAssistantWidget';
import { useProduct } from '@/lib/hooks/useProduct';

/**
 * Mounts the buyer assistant on the product detail page with the real listing
 * the shopper is looking at.
 *
 * Values come from the same useProduct() hook the rest of this page renders
 * from, so what the assistant is told always matches what is on screen. When
 * the hook falls back to its "unavailable" placeholder (bad id, unapproved or
 * out-of-stock listing) no product facts are passed at all — describing that
 * placeholder as a real listing would put invented specs in front of a buyer.
 */
export default function ProductAiAssistant() {
  const { product, loading } = useProduct();

  const context = useMemo(() => {
    if (loading) return 'Page: product detail. The listing is still loading.';

    if (!product || product.id === 'unavailable') {
      return 'Page: product detail, but this listing could not be loaded (it may be inactive, unapproved, out of stock, or the link is invalid). You have no product details. Suggest returning to the marketplace to pick an available product.';
    }

    const parts: string[] = ['Page: product detail. The buyer is viewing this listing:'];

    parts.push(`Product: ${product.name}.`);
    parts.push(`Sold by: ${product.seller}${product.city ? ` (${product.city})` : ''}.`);

    const price =
      product.priceMax && product.priceMax > product.price
        ? `₹${product.price}–₹${product.priceMax} per ${product.unit}`
        : `₹${product.price} per ${product.unit}`;
    parts.push(`Price: ${price}.`);
    parts.push(`Minimum order quantity: ${product.moq} ${product.unit}.`);
    parts.push(
      product.available > 0
        ? `Stock available: ${product.available} ${product.unit}.`
        : 'Stock: none currently available.'
    );

    const specs: string[] = [];
    if (product.category) specs.push(`category ${product.category}`);
    if (product.gsm) specs.push(`${product.gsm} GSM`);
    if (product.width && product.width !== 'Not specified') specs.push(`width ${product.width}`);
    if (product.work) specs.push(`work/design ${product.work}`);
    if (product.packageFormat) specs.push(`format ${product.packageFormat}`);
    if (specs.length) parts.push(`Specifications: ${specs.join(', ')}.`);

    const variantCount = product.variantCount ?? 0;
    if (variantCount > 0) {
      const colors = (product.colors ?? []).filter(Boolean).slice(0, 12);
      parts.push(
        `This listing has ${variantCount} variant${variantCount === 1 ? '' : 's'}${
          colors.length ? ` (colours: ${colors.join(', ')})` : ''
        }. Price, MOQ and stock shown above are for the currently selected variant.`
      );
    }

    if (product.dispatchDays) parts.push(`Seller's stated dispatch time: ${product.dispatchDays} day(s).`);
    parts.push(product.gst ? 'GST applies to this listing.' : 'No GST rate is set on this listing.');

    parts.push(
      'Use only these figures — never invent or estimate a price, MOQ, stock level, delivery date or seller detail. You cannot add this item to the cart, place the order, or take payment; the buyer does that with the buttons on this page. The final price, GST and quantity limits are recalculated on the server when the order is placed.'
    );

    return parts.join(' ');
  }, [loading, product]);

  return <AiAssistantWidget role="buyer" context={context} />;
}
