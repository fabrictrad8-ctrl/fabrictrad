import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const wishlistItems: {
  id: string;
  name: string;
  seller: string;
  price: number;
  moq: number;
  unit: string;
  image: string;
  alt: string;
  inStock: boolean;
}[] = [];

export default function BuyerWishlist() {
  return (
    <div>
      <h1 className="text-xl font-800 text-foreground mb-6">Wishlist</h1>
      {wishlistItems.length === 0 && (
        <div className="bg-card rounded-2xl border border-border px-5 py-12 text-center">
          <Icon name="HeartIcon" size={34} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-800 text-foreground">No wishlist items for this account</p>
          <p className="text-xs text-muted-foreground mt-1">
            Products saved by this buyer will appear here and will not be shared with other users.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wishlistItems?.map((item) => (
          <div
            key={item?.id}
            className="bg-card rounded-2xl border border-border overflow-hidden product-card"
          >
            <div className="relative aspect-square bg-muted">
              <AppImage
                src={item?.image}
                alt={item?.alt}
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover"
              />
              {!item?.inStock && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-white text-foreground text-xs font-700 px-3 py-1.5 rounded-full">
                    Out of Stock
                  </span>
                </div>
              )}
              <button className="absolute top-2 right-2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
                <Icon name="HeartIcon" size={16} className="text-error" variant="solid" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{item?.seller}</p>
              <h3 className="text-sm font-700 text-foreground mb-2">{item?.name}</h3>
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-800 text-primary">
                  ₹{item?.price?.toLocaleString('en-IN')}
                  <span className="text-xs text-muted-foreground font-400">/{item?.unit}</span>
                </span>
                <span className="badge-moq">MOQ:{item?.moq}</span>
              </div>
              <Link
                href="/product-detail"
                className={`w-full py-2 text-xs rounded-xl block text-center font-600 transition-all ${item?.inStock ? 'btn-primary' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
              >
                {item?.inStock ? 'Request Order' : 'Notify When Available'}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
