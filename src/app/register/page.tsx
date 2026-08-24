'use client';

import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const options = [
  {
    href: '/buyer-registration?type=end_user',
    icon: 'UserIcon' as const,
    badge: 'Fastest setup',
    title: 'Buy for myself',
    description: 'For tailoring, weddings, events, household use or smaller personal orders.',
    points: ['No business documents required', 'Order from personal-buyer enabled listings', 'Add delivery details only when needed'],
    accent: 'orange',
    action: 'Create personal buyer access',
  },
  {
    href: '/buyer-registration?type=retail_store',
    icon: 'ShoppingBagIcon' as const,
    badge: 'Business buyer',
    title: 'Buy for my shop',
    description: 'For retailers and businesses sourcing fabrics for resale, projects or repeat purchasing.',
    points: ['Wholesale purchasing workspace', 'GST details only when applicable', 'Saved orders, invoices and sourcing tools'],
    accent: 'cyan',
    action: 'Create retail-store access',
  },
  {
    href: '/seller-registration',
    icon: 'BuildingStorefrontIcon' as const,
    badge: 'Verified seller',
    title: 'Sell on FabricTrad',
    description: 'For textile businesses listing products, receiving orders and managing fulfilment.',
    points: ['Same account can still buy', 'Seller verification and GSTIN workflow', 'Catalogue, orders, payouts and shipping'],
    accent: 'blue',
    action: 'Activate seller workspace',
  },
];

const accentClass: Record<string, string> = {
  orange: 'text-orange-300 bg-orange-300/10 border-orange-300/20',
  cyan: 'text-cyan-300 bg-cyan-300/10 border-cyan-300/20',
  blue: 'text-blue-300 bg-blue-300/10 border-blue-300/20',
};

export default function RegisterPage() {
  return (
    <main className="ft-future-landing min-h-screen">
      <header className="ft-future-topbar">
        <div className="ft-future-nav">
          <Link href="/" className="ft-future-brand">
            <AppLogo size={34} />
            <span>FabricTrad</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="ft-secondary-action inline-flex min-h-10 items-center px-4 text-sm font-800">Sign in</Link>
          </div>
        </div>
      </header>

      <section className="relative z-[2] mx-auto w-[min(1320px,calc(100%-32px))] px-4 pb-20 pt-32 sm:px-6 lg:px-8 lg:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          <div className="ft-future-kicker mx-auto">Choose your starting workspace</div>
          <h1 className="mt-6 text-balance text-5xl font-850 leading-[.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">One account. Start with what you need today.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">Personal buyers can start without business paperwork. Shops and sellers complete only the additional verification needed for business workflows. You can unlock another workspace later without registering a second account.</p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {options.map((option) => (
            <Link key={option.href} href={option.href} className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/10 backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.075] sm:p-7">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-400/10 blur-3xl transition group-hover:bg-orange-400/20" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${accentClass[option.accent]}`}>
                    <Icon name={option.icon} size={23} />
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-850 uppercase tracking-[0.12em] ${accentClass[option.accent]}`}>{option.badge}</span>
                </div>
                <h2 className="mt-7 text-2xl font-850 tracking-tight text-white">{option.title}</h2>
                <p className="mt-3 min-h-[70px] text-sm leading-6 text-slate-400">{option.description}</p>
                <div className="mt-6 space-y-3">
                  {option.points.map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-sm text-slate-200">
                      <Icon name="CheckCircleIcon" size={17} className="mt-0.5 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <span className="mt-8 inline-flex items-center gap-2 text-sm font-850 text-orange-300">
                  {option.action}
                  <Icon name="ArrowRightIcon" size={15} className="transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mx-auto mt-7 flex max-w-3xl flex-col items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-center backdrop-blur-xl sm:flex-row sm:text-left">
          <p className="text-sm text-slate-400">Already have any FabricTrad account? Do not register again. Sign in and use the workspaces approved for that account.</p>
          <Link href="/login" className="shrink-0 text-sm font-850 text-orange-300 hover:text-orange-200">Sign in instead</Link>
        </div>
      </section>
    </main>
  );
}
