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
      <main className="min-h-screen bg-background">
        <Header />
        <div className="pt-16">
          <MarketplaceBanner />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex flex-col lg:flex-row gap-6">
              <MarketplaceFilters />
              <div className="flex-1 min-w-0">
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
