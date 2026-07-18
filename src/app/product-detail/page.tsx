import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductGallery from '@/app/product-detail/components/ProductGallery';
import ProductInfo from '@/app/product-detail/components/ProductInfo';
import ProductSpecs from '@/app/product-detail/components/ProductSpecs';
import SellerCard from '@/app/product-detail/components/SellerCard';
import RelatedProducts from '@/app/product-detail/components/RelatedProducts';
import SellerRatings from '@/app/product-detail/components/SellerRatings';
import ComparisonWidget from '@/app/product-detail/components/ComparisonWidget';
import FabricDrapeViewer from '@/app/product-detail/components/FabricDrapeViewer';
import BuyerFeedbackWidget from '@/app/product-detail/components/BuyerFeedbackWidget';
import BulkOrderCart from '@/app/product-detail/components/BulkOrderCart';

export default function ProductDetailPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-2 text-sm text-muted-foreground">
          <a href="/marketplace" className="hover:text-primary transition-colors">Marketplace</a>
          <span>/</span>
          <a href="/categories" className="hover:text-primary transition-colors">Net &amp; Embroidered</a>
          <span>/</span>
          <span className="text-foreground font-500">Pure Dyeable Soft Nett Fabric</span>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Gallery + Specs */}
            <div className="lg:col-span-2 space-y-6">
              <ProductGallery />
              {/* Virtual Drape-on Feature */}
              <FabricDrapeViewer />
              <ProductSpecs />
              <SellerRatings />
              {/* Aggregate Buyer Feedback Widget */}
              <BuyerFeedbackWidget />
              <ComparisonWidget />
              {/* Bulk Order Cart */}
              <BulkOrderCart />
            </div>

            {/* Right: Info + Order + Seller */}
            <div className="space-y-4">
              <ProductInfo />
              <SellerCard />
            </div>
          </div>

          <RelatedProducts />
        </div>
      </div>
      <Footer />
    </main>
  );
}