'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';

export default function RegisterPage() {
  return (
    <main className="ft-storefront min-h-screen">
      <Header />
      <section className="px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="ft-orange-chip">One account · buying and selling</span>
            <h1 className="mt-5 text-balance text-4xl font-800 tracking-[-0.04em] text-foreground sm:text-5xl">
              Choose how you want to start on FabricTrad.
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              Start with personal or business buying, or begin GST seller verification. The same verified login can later use both workspaces without another registration.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Link href="/buyer-registration" className="ft-feature-card group flex min-h-[340px] flex-col p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon name="ShoppingBagIcon" size={24} />
                </div>
                <span className="ft-orange-chip">Personal or business</span>
              </div>
              <h2 className="mt-7 text-2xl font-800 tracking-tight text-foreground">Start buying</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Buy a personal quantity for tailoring, weddings or household use, or create a retail-store purchasing profile for wholesale sourcing.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  'No PAN, Aadhaar, GST certificate or business proof for “Buy for me”',
                  'Business KYC only when registering a retail store or business buyer',
                  'Wishlist, seller-confirmed orders, secure payment and shipment tracking',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Icon name="CheckCircleIcon" size={17} className="mt-0.5 shrink-0 text-primary" />
                    {item}
                  </div>
                ))}
              </div>
              <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-800 text-primary">
                Create buyer access
                <Icon name="ArrowRightIcon" size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>

            <Link href="/seller-registration" className="ft-feature-card group flex min-h-[340px] flex-col border-primary/20 bg-primary/[0.035] p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/20">
                  <Icon name="BuildingStorefrontIcon" size={24} />
                </div>
                <span className="ft-orange-chip">GST business</span>
              </div>
              <h2 className="mt-7 text-2xl font-800 tracking-tight text-foreground">Start selling</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Publish colour-level catalogues, receive buyer requests, manage orders, shipping, invoices and payouts—and keep buying access too.
              </p>
              <div className="mt-6 space-y-3">
                {['GSTIN and business verification', 'AI-assisted catalogue and media upload', 'Order, fulfilment and earnings workspace'].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Icon name="CheckCircleIcon" size={17} className="mt-0.5 shrink-0 text-primary" />
                    {item}
                  </div>
                ))}
              </div>
              <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-800 text-primary">
                Activate seller access
                <Icon name="ArrowRightIcon" size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already registered?{' '}
            <Link href="/login" className="font-800 text-primary hover:underline">
              Sign in to your account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
