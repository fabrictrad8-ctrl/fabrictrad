'use client';

import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const capabilityCards = [
  {
    icon: 'MagnifyingGlassIcon',
    title: 'Search-first buying',
    copy: 'Compare verified sellers, stock, MOQ, price, variants and dispatch details from one marketplace.',
    accent: 'orange',
  },
  {
    icon: 'BuildingStorefrontIcon',
    title: 'Merchant command centre',
    copy: 'Run products, inventory, orders, payments, invoices, shipping and analytics without leaving FabricTrad.',
    accent: 'teal',
  },
  {
    icon: 'SparklesIcon',
    title: 'AI textile workflows',
    copy: 'Use AI-assisted catalogue tools and the seller-textile Virtual Drape experience where they add real value.',
    accent: 'violet',
  },
];

const trustItems = [
  ['ShieldCheckIcon', 'Verified network', 'Seller verification and role-aware account access.'],
  ['CreditCardIcon', 'Protected payments', 'Seller acceptance followed by server-verified Razorpay payment.'],
  ['TruckIcon', 'Connected fulfilment', 'Paid-order shipping and tracking stay attached to the same order.'],
] as const;

export default function PublicAccessLanding() {
  return (
    <main id="main-content" className="ft-future-landing min-h-screen overflow-hidden text-slate-900">
      <header className="ft-future-topbar">
        <div className="ft-future-nav">
          <Link href="/" className="ft-future-brand" aria-label="FabricTrad home">
            <AppLogo size={34} />
            <span>FabricTrad</span>
          </Link>

          <nav className="ft-future-navlinks" aria-label="Public navigation">
            <a href="#platform">Platform</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#trust">Trust & safety</a>
            <Link href="/how-to-use" className="flex items-center gap-1.5">
              <Icon name="AcademicCapIcon" size={14} />
              How to use
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="ft-secondary-action inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-800">
              Sign in
            </Link>
            <Link href="/register" className="ft-primary-action inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-800">
              Join FabricTrad <Icon name="ArrowRightIcon" size={15} />
            </Link>
          </div>
        </div>
      </header>

      <section id="platform" className="ft-future-hero">
        <div className="relative z-10">
          <div className="ft-future-kicker">
            <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />
            India&apos;s textile commerce operating layer
          </div>

          <h1>
            Textile trade,<br />
            <em>rebuilt for now.</em>
          </h1>

          <p className="ft-future-hero-copy">
            FabricTrad connects verified textile buyers and sellers around the same real commerce records. Search and source faster, manage catalogue and inventory, collect protected payments, generate documents and move paid orders into fulfilment without duplicate accounts or disconnected tools.
          </p>

          <div className="ft-future-hero-actions">
            <Link href="/login" className="ft-primary-action rounded-xl">
              Enter FabricTrad <Icon name="ArrowRightIcon" size={17} />
            </Link>
            <Link href="/register" className="ft-secondary-action rounded-xl">
              Create a free account
            </Link>
          </div>

          <div className="ft-future-trustline">
            <span><Icon name="ShieldCheckIcon" size={15} className="text-emerald-600" /> Verified seller access</span>
            <span><Icon name="CreditCardIcon" size={15} className="text-orange-600" /> Protected payment flow</span>
            <span><Icon name="DevicePhoneMobileIcon" size={15} className="text-teal-600" /> Phone, tablet and desktop</span>
          </div>
        </div>

        <div className="ft-future-orbit" aria-hidden="true">
          <div className="ft-future-core">
            <div className="ft-future-core-inner" />
          </div>
          <div className="ft-future-float-card c1">
            <strong><span className="dot" />Buyer marketplace</strong>
            <p>Search, compare, request, pay and track.</p>
          </div>
          <div className="ft-future-float-card c2">
            <strong><span className="dot" />Seller operations</strong>
            <p>Products, orders, money and fulfilment.</p>
          </div>
          <div className="ft-future-float-card c3">
            <strong><span className="dot" />AI Virtual Drape</strong>
            <p>Preview the seller textile on your photo or an AI model.</p>
          </div>
        </div>
      </section>

      <section id="capabilities" className="relative z-[2] mx-auto w-[min(1420px,calc(100%-32px))] px-4 pb-8 sm:px-0">
        <div className="rounded-[30px] border border-slate-200 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-850 uppercase tracking-[0.16em] text-orange-700">One platform, two focused workspaces</p>
              <h2 className="mt-3 text-3xl font-850 tracking-[-0.04em] text-slate-900 sm:text-5xl">Simple at the surface. Serious underneath.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">Buyers should feel like they are shopping, not operating an ERP. Sellers should feel like they are running a modern store, not navigating a buyer website.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-xs font-850 uppercase tracking-wider text-orange-700">Buyer</p>
                <p className="mt-2 text-sm font-800 text-slate-900">Marketplace-first</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Discovery, orders, payment and tracking.</p>
              </div>
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
                <p className="text-xs font-850 uppercase tracking-wider text-teal-700">Seller</p>
                <p className="mt-2 text-sm font-800 text-slate-900">Operations-first</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Catalogue, fulfilment, earnings and analytics.</p>
              </div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-xs font-850 uppercase tracking-wider text-violet-700">Admin</p>
                <p className="mt-2 text-sm font-800 text-slate-900">Control-first</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Verification, risk, transactions and operations.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ft-future-bento">
        <article className="ft-future-panel large">
          <div>
            <div className="ft-future-panel-icon"><Icon name="ArrowsRightLeftIcon" size={22} /></div>
            <p className="mt-6 text-xs font-850 uppercase tracking-[0.16em] text-orange-700">A connected order lifecycle</p>
            <h2 className="mt-3 max-w-xl text-4xl leading-tight text-slate-900">From product discovery to paid fulfilment without losing context.</h2>
            <p className="mt-4 max-w-xl text-sm text-slate-600">Every important step remains attached to the real order: seller acceptance, Razorpay capture, invoice generation, shipment creation, tracking and support.</p>
          </div>
          <div className="ft-future-steps">
            <div className="ft-future-step"><b>01</b><span>Discover a live product or post a sourcing requirement.</span></div>
            <div className="ft-future-step"><b>02</b><span>Seller confirms the order and stock before payment opens.</span></div>
            <div className="ft-future-step"><b>03</b><span>Verified payment unlocks invoicing, earnings and fulfilment.</span></div>
          </div>
        </article>

        {capabilityCards.map((item) => (
          <article key={item.title} className="ft-future-panel">
            <div className="ft-future-panel-icon"><Icon name={item.icon as 'SparklesIcon'} size={21} /></div>
            <h3 className="mt-5 text-xl text-slate-900">{item.title}</h3>
            <p className="mt-3 text-sm text-slate-600">{item.copy}</p>
          </article>
        ))}

        <article className="ft-future-panel">
          <div className="ft-future-panel-icon"><Icon name="LockClosedIcon" size={21} /></div>
          <h3 className="mt-5 text-xl text-slate-900">Private before sign-in</h3>
          <p className="mt-3 text-sm text-slate-600">The public landing page does not expose live marketplace prices, seller data, dashboards or transaction records.</p>
        </article>
      </section>

      <section id="trust" className="relative z-[2] mx-auto w-[min(1420px,calc(100%-32px))] px-4 pb-24 sm:px-0">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-850 uppercase tracking-[0.16em] text-orange-700">Built for trust at scale</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-850 tracking-[-0.035em] text-slate-900 sm:text-4xl">Clear commerce beats visual noise.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">FabricTrad prioritises readable contrast, obvious next actions, role-specific navigation and responsive layouts while keeping advanced functionality available when it is useful.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[590px]">
              {trustItems.map(([icon, title, copy]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <Icon name={icon} size={19} className="text-orange-600" />
                  <p className="mt-3 text-sm font-800 text-slate-900">{title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="ft-future-footer">
        <div className="mx-auto flex max-w-[1420px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <AppLogo size={28} />
            <span className="font-850 text-slate-900">FabricTrad</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600" aria-label="Footer navigation">
            <Link href="/help" className="hover:text-slate-950">Help</Link>
            <Link href="/privacy" className="hover:text-slate-950">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-950">Terms</Link>
            <Link href="/login" className="font-800 text-orange-700 hover:text-orange-900">Sign in</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
