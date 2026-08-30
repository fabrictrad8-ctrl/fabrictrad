import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductGallery from '@/app/product-detail/components/ProductGallery';
import DirectBuyPanel from '@/app/product-detail/components/DirectBuyPanel';
import ProductCartAction from '@/app/product-detail/components/ProductCartAction';
import ProductOrderStatusCard from '@/app/product-detail/components/ProductOrderStatusCard';
import ProductSpecs from '@/app/product-detail/components/ProductSpecs';
import SellerCard from '@/app/product-detail/components/SellerCard';
import RelatedProducts from '@/app/product-detail/components/RelatedProducts';
import ModernFabricDrapeViewer from '@/app/product-detail/components/ModernFabricDrapeViewer';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';
import ProductBreadcrumb from '@/app/product-detail/components/ProductBreadcrumb';
import { CurrentProductShareButton } from '@/components/ProductShareButton';
import Icon from '@/components/ui/AppIcon';
import styles from './virtual-drape-responsive.module.css';

export default function ProductDetailPage() {
  return (
    <BuyerOnlyGuard>
      <main className="ft-storefront min-h-screen">
        <Header />
        <div className="pt-16">
          <div className="border-b border-border bg-white/90 backdrop-blur-xl dark:bg-card/90">
            <div className="ft-storefront-content py-3"><ProductBreadcrumb /></div>
          </div>

          <section className="ft-storefront-content py-4 sm:py-6 lg:py-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Icon name="ShieldCheckIcon" size={13} className="text-success" /> Marketplace-verified listing</span>
                <span>·</span><span>Live inventory</span><span>·</span><span>Server-calculated checkout</span>
              </div>
              <CurrentProductShareButton />
            </div>

            <div className="ft-product-top-grid">
              <div className="min-w-0"><ProductGallery /></div>
              <div className="min-w-0 space-y-4">
                <DirectBuyPanel />
                <ProductCartAction />
                <div className="ft-product-content-card p-4">
                  <h2 className="text-sm font-850 text-foreground">Buying with confidence</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {[
                      ['ArchiveBoxIcon', 'Atomic inventory', 'Stock is locked and checked on the server before the order is created, preventing overselling.'],
                      ['ReceiptPercentIcon', 'Automatic invoice', 'Captured payment generates the seller tax invoice and emails the buyer automatically.'],
                      ['TruckIcon', 'Trackable fulfilment', 'Shiprocket or seller courier tracking stays attached to the same FabricTrad order.'],
                      ['ChatBubbleLeftRightIcon', 'Order-linked support', 'Buyer and seller can communicate inside FabricTrad and every issue remains tied to the order.'],
                    ].map(([icon, title, copy]) => (
                      <div key={title} className="flex gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name={icon as 'ShieldCheckIcon'} size={15} /></span><div><p className="text-xs font-850 text-foreground">{title}</p><p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{copy}</p></div></div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="ft-product-buy-rail space-y-4">
                <ProductOrderStatusCard />
                <SellerCard />
                <div className="ft-product-content-card p-4">
                  <p className="text-xs font-850 uppercase tracking-wider text-muted-foreground">Need something different?</p>
                  <p className="mt-2 text-sm font-800 text-foreground">Post a custom sourcing requirement</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Specify quantity, colour, GSM, width, budget and deadline so eligible sellers can respond.</p>
                  <a href="/buyer-requirements" className="mt-3 inline-flex items-center gap-1 text-xs font-850 text-primary">Post requirement <Icon name="ArrowRightIcon" size={13} /></a>
                </div>
              </aside>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
              <div className="min-w-0 space-y-5">
                <ProductSpecs />
                <section id="drape-on" className={`${styles.drapeSection} scroll-mt-24`}><ModernFabricDrapeViewer /></section>
              </div>
              <aside className="min-w-0 space-y-5">
                <div className="ft-product-content-card p-4">
                  <p className="text-xs font-850 uppercase tracking-wider text-muted-foreground">How checkout works</p>
                  <ol className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
                    <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-850 text-primary">1</span><span>Choose the live variant and quantity.</span></li>
                    <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-850 text-primary">2</span><span>FabricTrad atomically checks and reserves seller stock. If the quantity is unavailable, checkout stops before payment.</span></li>
                    <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-850 text-primary">3</span><span>Razorpay opens immediately. After capture, invoice, dispatch and tracking remain attached to the order.</span></li>
                  </ol>
                  <a href="/buyer-dashboard?tab=orders" className="mt-4 inline-flex items-center gap-1 text-xs font-850 text-primary">Open your orders <Icon name="ArrowRightIcon" size={13} /></a>
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
