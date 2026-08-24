import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MarketplaceFilters from '@/app/marketplace/components/MarketplaceFilters';
import MarketplaceGrid from '@/app/marketplace/components/MarketplaceGrid';
import MarketplaceBanner from '@/app/marketplace/components/MarketplaceBanner';
import MarketplaceActiveFilters from '@/app/marketplace/components/MarketplaceActiveFilters';
import MarketplaceQueryBridge from '@/app/marketplace/components/MarketplaceQueryBridge';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';

export default function MarketplacePage() {
  return (
    <BuyerOnlyGuard>
      <main className="ft-storefront ft-marketplace-shell min-h-screen">
        <MarketplaceQueryBridge />
        <Header />
        <div className="pt-16">
          <MarketplaceBanner />
          <div className="ft-storefront-content py-4 sm:py-5">
            <MarketplaceActiveFilters />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
              <MarketplaceFilters />
              <div className="min-w-0 flex-1"><MarketplaceGrid /></div>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </BuyerOnlyGuard>
  );
}
