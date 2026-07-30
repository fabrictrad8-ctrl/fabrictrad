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
            <span className="ft-badge">One account, flexible capabilities</span>
            <h1 className="mt-5 text-balance text-4xl font-800 tracking-[-0.04em] text-foreground sm:text-5xl">
              How will you use FabricTrad first?
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              Start with buying or selling. A verified account can later unlock both capabilities without creating a second login.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Link href="/buyer-registration" className="ft-feature-card group flex min-h-[340px] flex-col p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon name="ShoppingBagIcon" size={24} />
                </div>
                <span className="ft-badge ft-badge--success">Retail or business</span>
              </div>
              <h2 className="mt-7 text-2xl font-800 tracking-tight text-foreground">Buy fabrics</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Browse verified catalogues, order a single piece or bulk quantity, compare colours and follow delivery.
              </p>
              <div className="mt-6 space-y-3">
                {['PAN or secure offline identity verification', 'Wishlist, orders and shipment tracking', 'Post sourcing requirements to sellers'].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Icon name="CheckCircleIcon" size={17} className="mt-0.5 shrink-0 text-success" />
                    {item}
                  </div>
                ))}
              </div>
              <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-800 text-primary">
                Continue as buyer
                <Icon name="ArrowRightIcon" size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>

            <Link href="/seller-registration" className="ft-feature-card group flex min-h-[340px] flex-col p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                  <Icon name="BuildingStorefrontIcon" size={24} />
                </div>
                <span className="ft-badge">GST business</span>
              </div>
              <h2 className="mt-7 text-2xl font-800 tracking-tight text-foreground">Sell fabrics</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Publish colour-level catalogues, receive buyer requests, manage orders, shipping, invoices and payouts.
              </p>
              <div className="mt-6 space-y-3">
                {['GSTIN and business verification', 'AI-assisted catalogue and media upload', 'Order, fulfilment and earnings workspace'].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Icon name="CheckCircleIcon" size={17} className="mt-0.5 shrink-0 text-success" />
                    {item}
                  </div>
                ))}
              </div>
              <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-800 text-secondary">
                Continue as seller
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
