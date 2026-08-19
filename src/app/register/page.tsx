'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';

const options = [
  {
    href: '/buyer-registration?type=end_user',
    icon: 'UserIcon' as const,
    badge: 'Fastest · no documents',
    title: 'Buy for myself',
    description: 'For tailoring, weddings, events, household use or smaller personal orders.',
    points: ['Name, email, mobile and password only', 'No PAN, Aadhaar or GST documents', 'Add delivery address when you order'],
    action: 'Create personal buyer account',
  },
  {
    href: '/buyer-registration?type=retail_store',
    icon: 'ShoppingBagIcon' as const,
    badge: 'Business buyer',
    title: 'Buy for my shop',
    description: 'For retailers and businesses sourcing fabrics for resale or repeat purchasing.',
    points: ['Wholesale and business buying profile', 'GSTIN only when GST registered', 'Business KYC kept private'],
    action: 'Create retail-store account',
  },
  {
    href: '/seller-registration',
    icon: 'BuildingStorefrontIcon' as const,
    badge: 'Seller verification',
    title: 'Sell on FabricTrad',
    description: 'For textile businesses listing products, receiving orders and getting payouts.',
    points: ['Same account can still buy', 'GSTIN and seller verification', 'Catalogue, orders and earnings tools'],
    action: 'Activate seller access',
  },
];

export default function RegisterPage() {
  return (
    <main className="ft-storefront min-h-screen">
      <Header />
      <section className="px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="ft-orange-chip">One account · choose the quickest path for you</span>
            <h1 className="mt-5 text-balance text-4xl font-800 tracking-[-0.04em] text-foreground sm:text-5xl">
              Start without unnecessary paperwork.
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              Personal buyers can create an account immediately. Business documents are requested only when you actually need business-buyer or seller access.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {options.map((option, index) => (
              <Link
                key={option.href}
                href={option.href}
                className={`ft-feature-card group flex min-h-[360px] flex-col p-6 sm:p-7 ${
                  index === 0 ? 'border-success/25 bg-success/[0.025]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${index === 0 ? 'bg-success text-white' : 'bg-primary/10 text-primary'}`}>
                    <Icon name={option.icon} size={24} />
                  </div>
                  <span className={index === 0 ? 'rounded-full bg-success/10 px-3 py-1 text-xs font-800 text-success' : 'ft-orange-chip'}>
                    {option.badge}
                  </span>
                </div>
                <h2 className="mt-7 text-2xl font-800 tracking-tight text-foreground">{option.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{option.description}</p>
                <div className="mt-6 space-y-3">
                  {option.points.map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                      <Icon name="CheckCircleIcon" size={17} className="mt-0.5 shrink-0 text-success" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-800 text-primary">
                  {option.action}
                  <Icon name="ArrowRightIcon" size={16} className="transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-center sm:flex-row sm:text-left">
            <p className="text-sm text-muted-foreground">
              Already have any FabricTrad account? Do not register again. The same login can gain buyer and seller access.
            </p>
            <Link href="/login" className="shrink-0 font-800 text-primary hover:underline">
              Sign in instead
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
