import React from 'react';
import Icon from '@/components/ui/AppIcon';

const trustBadges = [
  { icon: 'ShieldCheckIcon', label: 'GST Verified Sellers', color: 'text-success' },
  { icon: 'LockClosedIcon', label: 'Secure Razorpay Payments', color: 'text-blue-600' },
  { icon: 'TruckIcon', label: 'Shiprocket Logistics', color: 'text-purple-600' },
  { icon: 'DocumentTextIcon', label: 'Legal T&C Compliant', color: 'text-primary' },
  { icon: 'CpuChipIcon', label: 'AI-Powered Automation', color: 'text-amber-600' },
  { icon: 'BuildingStorefrontIcon', label: 'Multi-Vendor Marketplace', color: 'text-secondary' },
];

export default function TrustSection() {
  return (
    <section className="py-12 md:py-16 bg-muted/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-700 text-primary uppercase tracking-widest mb-2">
            Trusted by Businesses
          </p>
          <h2 className="text-section-title text-foreground">
            Why Textile Businesses Choose FabricTrad
          </h2>
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
          {trustBadges.map((badge) => (
            <div
              key={badge.label}
              className="bg-card rounded-xl p-4 border border-border text-center card-shadow"
            >
              <Icon
                name={badge.icon as 'ShieldCheckIcon'}
                size={24}
                className={`${badge.color} mx-auto mb-2`}
              />
              <p className="text-xs font-600 text-foreground leading-tight">{badge.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            [
              'Private by default',
              'Buyer orders, seller payouts, and admin ledgers are scoped by account permissions.',
            ],
            [
              'Online payments only',
              'Razorpay payment status is tracked across buyer, seller, and admin views.',
            ],
            [
              'Verified marketplace',
              'Seller verification, GST records, and fulfilment controls are separated from public browsing.',
            ],
          ].map(([title, copy]) => (
            <div key={title} className="bg-card rounded-2xl p-6 border border-border card-shadow">
              <Icon name="CheckBadgeIcon" size={22} className="mb-4 text-success" />
              <p className="text-sm font-800 text-foreground">{title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
