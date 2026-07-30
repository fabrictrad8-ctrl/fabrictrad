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
import Icon from '@/components/ui/AppIcon';

export default function ProductDetailPage() {
  return (
    <BuyerOnlyGuard>
      <main className="ft-storefront min-h-screen">
        <Header />
        <div className="pt-16">
          <div className="border-b border-border bg-card/75 backdrop-blur-xl">
            <div className="ft-storefront-content py-3">
              <ProductBreadcrumb />
            </div>
          </div>

          <section className="ft-storefront-content py-5 sm:py-7 lg:py-9">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="ft-route-kicker">Product workspace</p>
                <p className="mt-1 text-sm text-muted-foreground">Review media, colour stock, specifications, seller trust and ordering options together.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="ft-orange-chip"><Icon name="ShieldCheckIcon" size={13} /> Protected order flow</span>
                <span className="ft-orange-chip"><Icon name="TruckIcon" size={13} /> Shipment tracking</span>
              </div>
            </div>

            <div className="ft-product-layout grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)] lg:gap-7">
              <div className="ft-product-main space-y-5">
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

              <aside className="ft-product-aside space-y-4">
                <ProductInfo />
                <SellerCard />
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon name="ChatBubbleLeftRightIcon" size={17} />
                    </div>
                    <div>
                      <p className="text-sm font-800 text-foreground">Need a custom quantity or colour?</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Post a buyer requirement so verified sellers can respond with stock, pricing and dispatch details.</p>
                      <a href="/buyer-requirements" className="mt-3 inline-flex items-center gap-1 text-xs font-800 text-primary">
                        Post requirement <Icon name="ArrowRightIcon" size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <RelatedProducts />
          </section>
        </div>
        <Footer />
      </main>
    </BuyerOnlyGuard>
  );
}
