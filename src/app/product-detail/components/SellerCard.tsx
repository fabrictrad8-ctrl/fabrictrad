'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import InWebsiteChat from '@/app/components/InWebsiteChat';
import { useProduct } from '@/lib/hooks/useProduct';

export default function SellerCard() {
  const [showChat, setShowChat] = useState(false);
  const { product } = useProduct();
  const ratingLabel = product.reviews ? product.rating.toFixed(1) : 'New';

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-xs font-700 uppercase tracking-wider text-muted-foreground">Sold By</p>
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-sm font-800 text-secondary">
            {product.seller.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-800 text-foreground">{product.seller}</p>
              {product.verified && <span className="badge-verified">Verified</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{product.city}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              {product.reviews > 0 ? (
                <>
                  <div className="flex items-center gap-0.5">{[1, 2, 3, 4, 5].map((star) => <Icon key={star} name="StarIcon" size={11} className={star <= Math.round(product.rating) ? 'text-amber-400' : 'text-amber-200'} variant="solid" />)}</div>
                  <span className="text-xs font-800 text-foreground">{ratingLabel}</span>
                  <span className="text-xs text-muted-foreground">({product.reviews} reviews)</span>
                </>
              ) : (
                <span className="text-xs font-700 text-secondary">New seller listing</span>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Dispatch', value: `${product.dispatchDays}d`, icon: 'ClockIcon' },
            { label: 'Stock', value: product.available.toLocaleString('en-IN'), icon: 'ArchiveBoxIcon' },
            { label: 'Rating', value: ratingLabel, icon: 'StarIcon' },
          ].map((stat) => <div key={stat.label} className="rounded-xl bg-muted p-2 text-center"><Icon name={stat.icon} size={14} className="mx-auto mb-1 text-primary" /><p className="text-xs font-800 text-foreground">{stat.value}</p><p className="text-xs text-muted-foreground">{stat.label}</p></div>)}
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl bg-muted p-2.5">
          <Icon name="DocumentTextIcon" size={14} className="shrink-0 text-primary" />
          <div><p className="text-xs font-700 text-foreground">GST-ready marketplace listing</p><p className="text-xs text-muted-foreground">Seller identity is protected until an order is confirmed.</p></div>
        </div>

        <button type="button" onClick={() => setShowChat(true)} className="btn-primary mb-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs"><Icon name="ChatBubbleLeftRightIcon" size={14} />Chat with Seller</button>
        <div className="mb-3 flex items-center justify-center gap-1.5"><Icon name="ShieldCheckIcon" size={11} className="text-success" /><p className="text-xs text-muted-foreground">Secure in-website messaging</p></div>
        <Link href={`/marketplace?search=${encodeURIComponent(product.seller)}`} className="btn-secondary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs"><Icon name="BuildingStorefrontIcon" size={14} />View Seller Products</Link>
      </div>

      {showChat && (
        <InWebsiteChat
          contextId={`product-${product.id}`}
          contextTitle={product.name}
          otherPartyName={product.seller}
          otherPartyAvatar={product.images?.[0] || ''}
          currentUserRole="buyer"
          onClose={() => setShowChat(false)}
        />
      )}
    </>
  );
}
