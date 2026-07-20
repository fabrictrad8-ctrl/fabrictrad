'use client';

import Link from 'next/link';
import toast from 'react-hot-toast';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { productDetailHref } from '@/lib/catalog';
import { useWishlist } from '@/lib/hooks/useWishlist';

export default function BuyerWishlist() {
  const { items, loading, remove } = useWishlist();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-800 text-foreground">Wishlist</h1>
          <p className="mt-1 text-xs text-muted-foreground">Products saved by this buyer account.</p>
        </div>
        {items.length > 0 && (
          <Link href="/marketplace" className="btn-secondary rounded-xl px-4 py-2 text-xs">
            Continue Browsing
          </Link>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center">
          <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center">
          <Icon name="HeartIcon" size={34} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-800 text-foreground">Your wishlist is empty</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            Save products from the marketplace using the heart button. They will appear in the header popup and here.
          </p>
          <Link href="/marketplace" className="btn-primary mt-4 inline-flex rounded-xl px-4 py-2 text-xs">
            Explore Marketplace
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const inStock = item.available >= item.moq;
          return (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card product-card">
              <div className="relative aspect-square bg-muted">
                <Link href={productDetailHref(item)}>
                  <AppImage src={item.image} alt={item.alt} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                </Link>
                {!inStock && <div className="absolute inset-0 flex items-center justify-center bg-black/45"><span className="rounded-full bg-white px-3 py-1.5 text-xs font-700 text-foreground">Below MOQ stock</span></div>}
                <button
                  type="button"
                  onClick={async () => {
                    await remove(item.id);
                    toast.success('Removed from wishlist');
                  }}
                  className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-error shadow-sm hover:bg-white"
                  aria-label={`Remove ${item.name} from wishlist`}
                >
                  <Icon name="HeartIcon" size={17} variant="solid" />
                </button>
              </div>
              <div className="p-4">
                <p className="mb-1 truncate text-xs text-muted-foreground">{item.seller}</p>
                <h3 className="mb-2 line-clamp-2 text-sm font-700 text-foreground">{item.name}</h3>
                <div className="mb-3 flex items-end justify-between gap-2">
                  <span className="text-base font-800 text-primary">₹{item.price.toLocaleString('en-IN')}<span className="text-xs font-400 text-muted-foreground">/{item.unit}</span></span>
                  <span className="badge-moq">MOQ {item.moq}</span>
                </div>
                <Link href={productDetailHref(item)} className={`block w-full rounded-xl py-2 text-center text-xs font-700 ${inStock ? 'btn-primary' : 'btn-secondary'}`}>
                  {inStock ? 'View & Request' : 'View Availability'}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
