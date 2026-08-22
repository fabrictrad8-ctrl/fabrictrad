import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductGallery from '@/app/product-detail/components/ProductGallery';
import ProductInfoV2 from '@/app/product-detail/components/ProductInfoV2';
import ProductOrderStatusCard from '@/app/product-detail/components/ProductOrderStatusCard';
import ProductSpecs from '@/app/product-detail/components/ProductSpecs';
import SellerCard from '@/app/product-detail/components/SellerCard';
import RelatedProducts from '@/app/product-detail/components/RelatedProducts';
import SellerRatings from '@/app/product-detail/components/SellerRatings';
import ComparisonWidget from '@/app/product-detail/components/ComparisonWidget';
import ModernFabricDrapeViewer from '@/app/product-detail/components/ModernFabricDrapeViewer';
import BuyerFeedbackWidget from '@/app/product-detail/components/BuyerFeedbackWidget';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';
import ProductBreadcrumb from '@/app/product-detail/components/ProductBreadcrumb';
import { CurrentProductShareButton } from '@/components/ProductShareButton';
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
                <p className="mt-1 text-sm text-muted-foreground">
                  Review live media, colour-level stock, verified identifiers, seller-specific buyer limits and server-calculated tax together.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CurrentProductShareButton />
                <span className="ft-orange-chip"><Icon name="ShieldCheckIcon" size={13} /> Protected order flow</span>
                <span className="ft-orange-chip"><Icon name="ReceiptPercentIcon" size={13} /> Server tax calculation</span>
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
              </div>

              <aside className="ft-product-aside space-y-4">
                <ProductOrderStatusCard />
                <ProductInfoV2 />
                <SellerCard />
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon name="ChatBubbleLeftRightIcon" size={17} />
                    </div>
                    <div>
                      <p className="text-sm font-800 text-foreground">Need a custom quantity or colour?</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Post a buyer requirement so verified sellers can respond with stock, pricing and dispatch details.
                      </p>
                      <a href="/buyer-requirements" className="mt-3 inline-flex items-center gap-1 text-xs font-800 text-primary">
                        Post requirement <Icon name="ArrowRightIcon" size={13} />
                      </a>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">How checkout works</p>
                  <ol className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
                    <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-800 text-primary">1</span><span>Choose the live variant and quantity shown above.</span></li>
                    <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-800 text-primary">2</span><span>The seller confirms stock, final quantity and dispatch readiness.</span></li>
                    <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-800 text-primary">3</span><span>As soon as the seller accepts, the payment button appears on this product page and in your buyer orders. After payment, shipment tracking is attached to the same order.</span></li>
                  </ol>
                  <a href="/buyer-dashboard?tab=orders" className="mt-4 inline-flex items-center gap-1 text-xs font-800 text-primary">
                    Open buyer orders <Icon name="ArrowRightIcon" size={13} />
                  </a>
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
