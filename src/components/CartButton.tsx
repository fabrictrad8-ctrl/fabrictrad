'use client';

import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/lib/hooks/useCart';

export default function CartButton({ mobile = false }: { mobile?: boolean }) {
  const { lineCount } = useCart();

  if (mobile) {
    return (
      <Link href="/cart" className="ft-mobile-menu-link" aria-label={`Cart with ${lineCount} item${lineCount === 1 ? '' : 's'}`}>
        <Icon name="ShoppingCartIcon" size={18} />
        <span>Cart</span>
        {lineCount > 0 && (
          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-850 text-white">
            {lineCount}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link href="/cart" className="ft-cart-button" aria-label={`Cart with ${lineCount} item${lineCount === 1 ? '' : 's'}`}>
      <span className="relative inline-flex">
        <Icon name="ShoppingCartIcon" size={21} />
        {lineCount > 0 && <span className="ft-cart-count">{Math.min(lineCount, 99)}</span>}
      </span>
      <span className="hidden text-xs font-850 lg:inline">Cart</span>
    </Link>
  );
}
