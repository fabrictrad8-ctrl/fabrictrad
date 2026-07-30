import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MarketplaceFilters from '@/app/marketplace/components/MarketplaceFilters';
import MarketplaceGrid from '@/app/marketplace/components/MarketplaceGrid';
import MarketplaceBanner from '@/app/marketplace/components/MarketplaceBanner';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';

export default function MarketplacePage() {
  return (
    <BuyerOnlyGuard>
      <main className="ft-storefront min-h-screen">
        <Header />
        <div className="pt-16">
          <MarketplaceBanner />
          <div className="ft-storefront-content py-6 sm:py-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
              <MarketplaceFilters />
              <div className="min-w-0 flex-1">
                <MarketplaceGrid />
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </BuyerOnlyGuard>
  );
}
