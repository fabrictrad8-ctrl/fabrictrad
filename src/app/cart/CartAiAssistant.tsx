'use client';

import { useMemo } from 'react';
import AiAssistantWidget from '@/components/AiAssistantWidget';
import { useCart } from '@/lib/hooks/useCart';

/**
 * Mounts the buyer assistant on the cart page with the buyer's actual line
 * items.
 *
 * Reads the same useCart() hook the page renders from — the hook is backed by
 * localStorage and re-syncs on its own change event, so this instance stays in
 * step with the list the buyer is editing (quantity changes, removals, clear).
 */
const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

export default function CartAiAssistant() {
  const { items, lineCount, estimatedTotal } = useCart();

  const context = useMemo(() => {
    if (lineCount === 0) {
      return 'Page: buyer shopping cart. The cart is currently empty. Help the buyer work out what to search for on the marketplace.';
    }

    const sellers = [...new Set(items.map((item) => item.seller).filter(Boolean))];

    const lines = items.map((item) => {
      const bits = [
        `"${item.name}"`,
        item.variantLabel ? `variant ${item.variantLabel}` : null,
        `sold by ${item.seller}`,
        `${item.quantity} ${item.unit} at ${money(item.price)}/${item.unit}`,
        `line subtotal ${money(item.price * item.quantity)}`,
        `minimum ${item.minimum} ${item.unit}`,
      ].filter(Boolean);
      return `- ${bits.join(', ')}`;
    });

    return [
      `Page: buyer shopping cart with ${lineCount} line item${lineCount === 1 ? '' : 's'}.`,
      lines.join(' '),
      `Estimated subtotal: ${money(estimatedTotal)}.`,
      sellers.length > 1
        ? `These items come from ${sellers.length} different sellers, so the buyer checks out one seller at a time — each order stays attached to its own seller, with that seller's own pricing and shipping.`
        : 'All items are from a single seller.',
      'This subtotal is a shopping estimate only: account pricing, GST, MOQ and live stock are rechecked on the product page and recalculated on the server before payment. Never quote a final payable amount, delivery date or shipping cost. You cannot edit this cart, place the order or take payment — the buyer does that with the quantity fields and the "Proceed to buy" button on this page.',
    ].join(' ');
  }, [estimatedTotal, items, lineCount]);

  return <AiAssistantWidget role="buyer" context={context} />;
}
