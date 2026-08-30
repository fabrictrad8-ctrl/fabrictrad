'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import InWebsiteChat from '@/app/components/InWebsiteChat';
import { createClient } from '@/lib/supabase/client';
import { useProduct } from '@/lib/hooks/useProduct';

export default function SellerCard() {
  const [showChat, setShowChat] = useState(false);
  const [verified, setVerified] = useState(false);
  const { product } = useProduct();

  useEffect(() => {
    let mounted = true;
    if (!product.sellerId) { setVerified(false); return; }
    const supabase = createClient();
    void supabase.rpc('seller_has_verified_tag', { p_seller_id: product.sellerId }).then(({ data, error }) => {
      if (mounted) setVerified(!error && data === true);
    });
    return () => { mounted = false; };
  }, [product.sellerId]);

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-xs font-700 uppercase tracking-wider text-muted-foreground">Sold By</p>
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-sm font-800 text-secondary">{product.seller.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5"><p className="text-sm font-800 text-foreground">{product.seller}</p>{verified && <span className="badge-verified inline-flex items-center gap-1"><Icon name="CheckBadgeIcon" size={12} /> Verified Seller</span>}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{product.city}</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-muted p-2 text-center"><Icon name="ClockIcon" size={14} className="mx-auto mb-1 text-primary" /><p className="text-xs font-800 text-foreground">{product.dispatchDays}d</p><p className="text-xs text-muted-foreground">Dispatch</p></div>
          <div className="rounded-xl bg-muted p-2 text-center"><Icon name="ArchiveBoxIcon" size={14} className="mx-auto mb-1 text-primary" /><p className="text-xs font-800 text-foreground">{product.available.toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">Stock</p></div>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl bg-muted p-2.5"><Icon name={verified ? 'CheckBadgeIcon' : 'BuildingStorefrontIcon'} size={14} className="shrink-0 text-primary" /><div><p className="text-xs font-700 text-foreground">{verified ? 'FabricTrad Verified Seller' : 'Approved marketplace seller'}</p><p className="text-xs text-muted-foreground">Verified is a separate active seller membership; marketplace approval alone does not grant the badge.</p></div></div>

        <button type="button" onClick={() => setShowChat(true)} className="btn-primary mb-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs"><Icon name="ChatBubbleLeftRightIcon" size={14} />Chat with Seller</button>
        <div className="mb-3 flex items-center justify-center gap-1.5"><Icon name="ShieldCheckIcon" size={11} className="text-success" /><p className="text-xs text-muted-foreground">Secure in-website messaging</p></div>
        <Link href={`/marketplace?search=${encodeURIComponent(product.seller)}`} className="btn-secondary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs"><Icon name="BuildingStorefrontIcon" size={14} />View Seller Products</Link>
      </div>

      {showChat && <InWebsiteChat contextId={`product-${product.id}`} contextTitle={product.name} otherPartyName={product.seller} otherPartyAvatar={product.images?.[0] || ''} currentUserRole="buyer" onClose={() => setShowChat(false)} />}
    </>
  );
}
