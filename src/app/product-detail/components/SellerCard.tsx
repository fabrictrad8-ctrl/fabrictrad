import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

export default function SellerCard() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-3">Sold By</p>

      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
          <AppImage
            src="https://img.rocket.new/generatedImages/rocket_gen_img_129d1989a-1784317809699.png"
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
        </div>
      </div>

      {/* Seller Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
        { label: 'Response', value: '< 2 hrs', icon: 'ClockIcon' },
        { label: 'Acceptance', value: '94%', icon: 'CheckCircleIcon' },
        { label: 'Rating', value: '4.9 ★', icon: 'StarIcon' }].
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

      <Link
        href="/marketplace"
        className="btn-secondary w-full py-2.5 text-xs rounded-xl flex items-center justify-center gap-2">
        
        <Icon name="BuildingStorefrontIcon" size={14} />
        View Seller Store
      </Link>
    </div>);

}