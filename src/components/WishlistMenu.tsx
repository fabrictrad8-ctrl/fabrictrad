'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { productDetailHref } from '@/lib/catalog';
import { useWishlist } from '@/lib/hooks/useWishlist';

export default function WishlistMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { items, loading, remove } = useWishlist();

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
        aria-label={`Wishlist with ${items.length} item${items.length === 1 ? '' : 's'}`}
        aria-expanded={open}
      >
        <Icon name="HeartIcon" size={18} variant={items.length ? 'solid' : 'outline'} />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-800 text-white">
            {items.length > 99 ? '99+' : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-800 text-foreground">Your Wishlist</p>
              <p className="text-xs text-muted-foreground">Saved products for this account</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label="Close wishlist"
            >
              <Icon name="XMarkIcon" size={17} />
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Icon name="HeartIcon" size={30} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-800 text-foreground">Nothing saved yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use the heart button on marketplace products to save them here.
                </p>
              </div>
            ) : (
              items.slice(0, 5).map((product) => (
                <div key={product.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/60">
                  <Link
                    href={productDetailHref(product)}
                    onClick={() => setOpen(false)}
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted"
                  >
                    <AppImage
                      src={product.image}
                      alt={product.alt}
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                    />
                  </Link>
                  <Link
                    href={productDetailHref(product)}
                    onClick={() => setOpen(false)}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-xs font-800 text-foreground">{product.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{product.seller}</p>
                    <p className="mt-1 text-xs font-800 text-primary">
                      ₹{product.price.toLocaleString('en-IN')}/{product.unit}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      await remove(product.id);
                      toast.success('Removed from wishlist');
                    }}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-error/10 hover:text-error"
                    aria-label={`Remove ${product.name} from wishlist`}
                  >
                    <Icon name="TrashIcon" size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border p-3">
            <Link
              href="/buyer-dashboard?tab=wishlist"
              onClick={() => setOpen(false)}
              className="btn-primary block w-full rounded-xl py-2.5 text-center text-xs"
            >
              View Full Wishlist
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
