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
import ModernFabricDrapeViewer from '@/app/product-detail/components/ModernFabricDrapeViewer';
import BuyerFeedbackWidget from '@/app/product-detail/components/BuyerFeedbackWidget';
import BulkOrderCart from '@/app/product-detail/components/BulkOrderCart';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';
import ProductBreadcrumb from '@/app/product-detail/components/ProductBreadcrumb';

export default function ProductDetailPage() {
  return (
    <BuyerOnlyGuard>
      <main className="min-h-screen bg-background">
        <Header />
        <div className="pt-16">
          <ProductBreadcrumb />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <ProductGallery />
                <section id="drape-on" className="scroll-mt-24">
                  <ModernFabricDrapeViewer />
                </section>
                <ProductSpecs />
                <SellerRatings />
                <BuyerFeedbackWidget />
                <ComparisonWidget />
                <BulkOrderCart />
              </div>

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
    </BuyerOnlyGuard>
  );
}
