'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import InWebsiteChat from '@/app/components/InWebsiteChat';

// Aggregate rating data — in production this comes from seller_reviews table
const SELLER_RATING = 4.8;
const SELLER_REVIEW_COUNT = 127;

export default function SellerCard() {
  const [showChat, setShowChat] = useState(false);

  return (
    <>
      <div className="bg-card rounded-2xl border border-border p-5">
        <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-3">Sold By</p>

        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
            <AppImage
              src="https://img.rocket.new/generatedImages/rocket_gen_img_14df8d316-1784314860425.png"
              alt="Surat Textile Mills office building exterior, modern commercial building"
              width={48}
              height={48}
              className="object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-800 text-foreground">Surat Textile Mills Pvt Ltd</p>
              <span className="badge-verified">Verified</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Surat, Gujarat · Manufacturer</p>
            {/* Aggregate Rating */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) =>
                <Icon
                  key={s}
                  name="StarIcon"
                  size={11}
                  className={s <= Math.floor(SELLER_RATING) ? 'text-amber-400' : 'text-amber-200'}
                  variant="solid" />
                )}
              </div>
              <span className="text-xs font-800 text-foreground">{SELLER_RATING}</span>
              <span className="text-xs text-muted-foreground">({SELLER_REVIEW_COUNT} reviews)</span>
            </div>
          </div>
        </div>

        {/* Seller Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
          { label: 'Response', value: '< 2 hrs', icon: 'ClockIcon' },
          { label: 'Acceptance', value: '94%', icon: 'CheckCircleIcon' },
          { label: 'Rating', value: `${SELLER_RATING} ★`, icon: 'StarIcon' }].
          map((stat) =>
          <div key={stat.label} className="bg-muted rounded-xl p-2 text-center">
              <Icon name={stat.icon as 'ClockIcon'} size={14} className="text-primary mx-auto mb-1" />
              <p className="text-xs font-800 text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          )}
        </div>

        {/* GST Info */}
        <div className="flex items-center gap-2 mb-4 p-2.5 bg-muted rounded-xl">
          <Icon name="DocumentTextIcon" size={14} className="text-primary shrink-0" />
          <div>
            <p className="text-xs font-700 text-foreground">GSTIN: 24AAAPL****Z1</p>
            <p className="text-xs text-muted-foreground">GST Verified · PAN Verified</p>
          </div>
        </div>

        {/* Chat with Seller */}
        <button
          onClick={() => setShowChat(true)}
          className="btn-primary w-full py-2.5 text-xs rounded-xl flex items-center justify-center gap-2 mb-2">
          
          <Icon name="ChatBubbleLeftRightIcon" size={14} />
          Chat with Seller
        </button>

        <div className="flex items-center gap-1.5 justify-center mb-3">
          <Icon name="ShieldCheckIcon" size={11} className="text-success" />
          <p className="text-xs text-muted-foreground">No phone/email sharing · In-website only</p>
        </div>

        <Link
          href="/marketplace"
          className="btn-secondary w-full py-2.5 text-xs rounded-xl flex items-center justify-center gap-2">
          <Icon name="BuildingStorefrontIcon" size={14} />
          View Seller Store
        </Link>
      </div>

      {/* In-Website Chat */}
      {showChat &&
      <InWebsiteChat
        contextId="product-detail-surat-textile"
        contextTitle="Pure Dyeable Soft Nett Fabric"
        otherPartyName="Surat Textile Mills"
        otherPartyAvatar="https://img.rocket.new/generatedImages/rocket_gen_img_14df8d316-1784314860425.png"
        currentUserRole="buyer"
        onClose={() => setShowChat(false)} />

      }
    </>);

}