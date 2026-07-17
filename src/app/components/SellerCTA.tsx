import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

const sellerBenefits = [
  'WhatsApp catalog upload — AI does the rest',
  'Reach buyers across 340+ Indian cities',
  'Automated Shiprocket shipping integration',
  'Transparent settlement & commission tracking',
  'GST invoice generation on every order',
  'Real-time inventory & order management',
];

export default function SellerCTA() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="gradient-navy rounded-3xl p-8 md:p-12 overflow-hidden relative">
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-5">
                <Icon name="BuildingStorefrontIcon" size={14} className="text-gold" />
                <span className="text-xs font-600 text-white">For Textile Sellers & Manufacturers</span>
              </div>

              <h2 className="text-hero-lg text-white mb-4">
                Sell on FabricTrad.<br />
                <span className="text-gold">Reach India's B2B Buyers.</span>
              </h2>
              <p className="text-white/70 text-sm mb-6 max-w-md leading-relaxed">
                Join 12,400+ verified sellers. Upload your catalog via WhatsApp, get GST-compliant orders, and receive automated settlements — all on autopilot.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/seller-registration" className="btn-primary px-6 py-3 text-sm rounded-xl text-center">
                  Register as Seller
                </Link>
                <Link href="/seller-dashboard" className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3 rounded-xl text-sm font-600 transition-colors text-center">
                  View Seller Portal
                </Link>
              </div>
            </div>

            {/* Right */}
            <div className="space-y-3">
              {sellerBenefits?.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                    <Icon name="CheckIcon" size={12} className="text-success" />
                  </div>
                  <span className="text-white/85 text-sm font-500">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}