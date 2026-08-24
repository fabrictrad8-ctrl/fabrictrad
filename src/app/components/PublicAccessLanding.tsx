'use client';

import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const trustItems = [
  {
    icon: 'ShieldCheckIcon',
    title: 'Verified commerce network',
    copy: 'Buyer, seller and administrator workspaces stay account-scoped and role-aware.',
  },
  {
    icon: 'BoltIcon',
    title: 'One account, faster movement',
    copy: 'Buy, sell, pay, fulfil and track without creating duplicate identities for every workflow.',
  },
  {
    icon: 'LockClosedIcon',
    title: 'Private marketplace by default',
    copy: 'Products, prices, seller details and transaction data remain behind authenticated access.',
  },
];

export default function PublicAccessLanding() {
  return (
    <main id="main-content" className="ft-future-landing">
      <header className="ft-future-topbar">
        <div className="ft-future-nav">
          <Link href="/" className="ft-future-brand" aria-label="FabricTrad home">
            <AppLogo size={34} />
            <span>FabricTrad</span>
          </Link>

          <nav className="ft-future-navlinks" aria-label="Public navigation">
            <a href="#platform">Platform</a>
            <a href="#how-it-works">How it works</a>
            <a href="#trust">Trust & safety</a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="ft-secondary-action inline-flex min-h-10 items-center justify-center px-4 text-sm font-800">
              Sign in
            </Link>
            <Link href="/register" className="ft-primary-action inline-flex min-h-10 items-center justify-center gap-2 px-4 text-sm font-800">
              Join FabricTrad <Icon name="ArrowRightIcon" size={15} />
            </Link>
          </div>
        </div>
      </header>

      <section id="platform" className="ft-future-hero">
        <div>
          <div className="ft-future-kicker">
            <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />
            India&apos;s textile commerce operating layer
          </div>

          <h1>
            Textile trade,<br />
            <em>rebuilt for now.</em>
          </h1>

          <p className="ft-future-hero-copy">
            FabricTrad brings sourcing, selling, approvals, payments, order tracking and business operations into one secure account. Buyers get a fast search-first marketplace. Sellers get a modern operating workspace built around real inventory and real orders.
          </p>

          <div className="ft-future-hero-actions">
            <Link href="/login" className="ft-primary-action">
              Enter FabricTrad <Icon name="ArrowRightIcon" size={17} />
            </Link>
            <Link href="/register" className="ft-secondary-action">
              Create an account
            </Link>
          </div>

          <div className="ft-future-trustline">
            <span><Icon name="ShieldCheckIcon" size={15} className="text-emerald-400" /> Verified seller access</span>
            <span><Icon name="CreditCardIcon" size={15} className="text-orange-300" /> Secure payment workflow</span>
            <span><Icon name="DevicePhoneMobileIcon" size={15} className="text-cyan-300" /> Desktop + mobile</span>
          </div>
        </div>

        <div className="ft-future-orbit" aria-hidden="true">
          <div className="ft-future-core">
            <div className="ft-future-core-inner" />
          </div>

          <div className="ft-future-float-card c1">
            <strong><span className="dot" />Buyer workspace</strong>
            <p>Search, compare, order, pay and track from one place.</p>
          </div>
          <div className="ft-future-float-card c2">
            <strong><span className="dot" />Seller command centre</strong>
            <p>Products, orders, inventory, payouts and fulfilment.</p>
          </div>
          <div className="ft-future-float-card c3">
            <strong><span className="dot" />Role-aware access</strong>
            <p>One identity can unlock the workspaces it is approved to use.</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="ft-future-bento">
        <article className="ft-future-panel large">
          <div>
            <div className="ft-future-panel-icon"><Icon name="SparklesIcon" size={22} /></div>
            <p className="mt-6 text-xs font-850 uppercase tracking-[0.16em] text-orange-300">A simpler commerce flow</p>
            <h2 className="mt-3 max-w-xl text-4xl leading-tight">From sourcing intent to fulfilled order without fragmented tools.</h2>
            <p className="mt-4 max-w-xl text-sm">FabricTrad keeps the buyer and seller sides connected around the same live commerce records instead of forcing users through disconnected pages or duplicate accounts.</p>
          </div>
          <div className="ft-future-steps">
            <div className="ft-future-step"><b>01</b><span>Create one account and complete only the verification relevant to your role.</span></div>
            <div className="ft-future-step"><b>02</b><span>Enter the buyer marketplace or seller workspace you are approved to use.</span></div>
            <div className="ft-future-step"><b>03</b><span>Keep orders, payments, invoices, fulfilment and history tied to the same account.</span></div>
          </div>
        </article>

        <article className="ft-future-panel">
          <div className="ft-future-panel-icon"><Icon name="MagnifyingGlassIcon" size={21} /></div>
          <h3 className="mt-5 text-xl">Search-first buying</h3>
          <p className="mt-3 text-sm">Find fabrics by seller, colour, GSM, work type, SKU, price, MOQ and dispatch details after sign-in.</p>
          <Link href="/buyer-registration" className="mt-6 inline-flex items-center gap-2 text-sm font-800 text-orange-300 hover:text-orange-200">
            Create buyer access <Icon name="ArrowRightIcon" size={14} />
          </Link>
        </article>

        <article className="ft-future-panel">
          <div className="ft-future-panel-icon"><Icon name="BuildingStorefrontIcon" size={21} /></div>
          <h3 className="mt-5 text-xl">Merchant control centre</h3>
          <p className="mt-3 text-sm">Manage catalogue, inventory, buyer orders, pricing, payouts, shipping and analytics from a merchant-style workspace.</p>
          <Link href="/seller-registration" className="mt-6 inline-flex items-center gap-2 text-sm font-800 text-cyan-300 hover:text-cyan-200">
            Activate selling <Icon name="ArrowRightIcon" size={14} />
          </Link>
        </article>

        <article id="trust" className="ft-future-panel">
          <div className="ft-future-panel-icon"><Icon name="LockClosedIcon" size={21} /></div>
          <h3 className="mt-5 text-xl">Nothing sensitive on the public page</h3>
          <p className="mt-3 text-sm">Public visitors do not see marketplace inventory, seller information, prices, account dashboards or transaction records.</p>
        </article>

        <article className="ft-future-panel">
          <div className="ft-future-panel-icon"><Icon name="ArrowsRightLeftIcon" size={21} /></div>
          <h3 className="mt-5 text-xl">Buy and sell with one identity</h3>
          <p className="mt-3 text-sm">Approved accounts can switch workspaces instead of maintaining separate phone numbers and duplicate profiles.</p>
        </article>
      </section>

      <section className="relative z-[2] mx-auto w-[min(1420px,calc(100%-32px))] px-4 pb-24 sm:px-0">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-xl sm:p-9">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-850 uppercase tracking-[0.16em] text-orange-300">Built for trust at scale</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-850 tracking-[-0.035em] text-white sm:text-4xl">A serious commerce product should feel clear before it feels clever.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">The interface prioritises clear navigation, visible next actions, strong contrast, responsive layouts and role-specific workflows while keeping advanced features available when they are actually useful.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              {trustItems.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <Icon name={item.icon as 'ShieldCheckIcon'} size={19} className="text-orange-300" />
                  <p className="mt-3 text-sm font-800 text-white">{item.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{item.copy}</p>
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
            <span className="font-850 text-white">FabricTrad</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Footer navigation">
            <Link href="/help" className="hover:text-white">Help</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/login" className="font-800 text-orange-300 hover:text-orange-200">Sign in</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
