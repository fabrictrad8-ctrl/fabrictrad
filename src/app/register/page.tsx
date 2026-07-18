'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <section className="px-4 pb-16 pt-28 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-800 uppercase tracking-widest text-primary">
              Create Account
            </p>
            <h1 className="mt-3 text-hero-lg text-foreground">
              Choose how you want to use FabricTrad
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Buyer accounts are for sourcing and purchasing. Seller accounts require GSTIN, store
              details, bank details, and system verification before selling.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Link
              href="/buyer-registration"
              className="group rounded-2xl border border-border bg-card p-6 card-shadow transition-all hover:-translate-y-1 hover:card-shadow-hover"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon name="ShoppingBagIcon" size={24} />
              </div>
              <h2 className="text-xl font-800 text-foreground">Create Buyer Account</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Source textiles, save products, place orders, track payments, and manage delivery.
              </p>
              <div className="mt-5 space-y-2">
                {[
                  'Name, email and phone',
                  'Delivery address',
                  'Buyer dashboard and order history',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                    <Icon name="CheckCircleIcon" size={16} className="text-success" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-800 text-primary">
                Continue as Buyer
                <Icon
                  name="ArrowRightIcon"
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </div>
            </Link>

            <Link
              href="/seller-registration"
              className="group rounded-2xl border border-secondary/20 bg-secondary p-6 text-white card-shadow transition-all hover:-translate-y-1 hover:card-shadow-hover"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                <Icon name="BuildingStorefrontIcon" size={24} />
              </div>
              <h2 className="text-xl font-800">Create Seller Account</h2>
              <p className="mt-2 text-sm leading-6 text-white/75">
                List products, receive B2B orders, manage fulfilment, and receive verified payouts.
              </p>
              <div className="mt-5 space-y-2">
                {[
                  'GSTIN and store/business name required',
                  'Bank and document verification',
                  'System verification before seller activation',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-white">
                    <Icon name="CheckCircleIcon" size={16} className="text-accent" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-800 text-accent">
                Continue as Seller
                <Icon
                  name="ArrowRightIcon"
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </div>
            </Link>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-800 text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
