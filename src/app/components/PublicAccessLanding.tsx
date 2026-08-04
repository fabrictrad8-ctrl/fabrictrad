'use client';

import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const accountPaths = [
  {
    icon: 'ShoppingBagIcon',
    title: 'Buy fabrics',
    copy: 'Create an account to browse verified sellers, compare fabric options and manage your purchases.',
    href: '/buyer-registration',
    action: 'Create buyer account',
  },
  {
    icon: 'BuildingStorefrontIcon',
    title: 'Sell fabrics',
    copy: 'Register your business, complete verification and manage catalogues, orders and fulfilment securely.',
    href: '/seller-registration',
    action: 'Create seller account',
  },
];

const trustItems = [
  {
    icon: 'ShieldCheckIcon',
    title: 'Account-protected marketplace',
    copy: 'Products, seller details, prices, orders and business dashboards are only available after sign-in.',
  },
  {
    icon: 'IdentificationIcon',
    title: 'Role-aware onboarding',
    copy: 'Individual buyers and verified businesses follow the right onboarding path for their needs.',
  },
  {
    icon: 'LockClosedIcon',
    title: 'Private business activity',
    copy: 'Account data, payment status, invoices and fulfilment records remain inside authenticated workspaces.',
  },
];

export default function PublicAccessLanding() {
  return (
    <main id="main-content" className="ft-marketing min-h-screen overflow-hidden text-foreground">
      <header className="ft-topbar fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="FabricTrad home">
            <AppLogo size={36} />
            <span className="truncate text-lg font-800 tracking-tight text-foreground">FabricTrad</span>
          </Link>

          <nav className="ml-8 hidden items-center gap-1 lg:flex" aria-label="Public navigation">
            <a href="#about" className="rounded-lg px-3 py-2 text-sm font-650 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              About
            </a>
            <a href="#join" className="rounded-lg px-3 py-2 text-sm font-650 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Join FabricTrad
            </a>
            <a href="#trust" className="rounded-lg px-3 py-2 text-sm font-650 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Trust & safety
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="ft-secondary-action inline-flex items-center justify-center px-4 py-2 text-sm">
              Sign in
            </Link>
            <Link href="/register" className="ft-primary-action inline-flex items-center justify-center gap-2 px-4 py-2 text-sm">
              Create account <Icon name="ArrowRightIcon" size={16} />
            </Link>
          </div>
        </div>
      </header>

      <section id="about" className="relative flex min-h-[78vh] items-center px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-8 lg:pb-28">
        <div className="ft-marketing-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="landing-orb pointer-events-none absolute -left-48 top-0 h-[34rem] w-[34rem] rounded-full bg-primary/15" aria-hidden="true" />
        <div className="landing-orb pointer-events-none absolute -right-48 top-10 h-[36rem] w-[36rem] rounded-full bg-secondary/12" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-5xl text-center">
          <div className="ft-badge ft-badge--success mx-auto w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            India&apos;s textile trade platform
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-balance text-[clamp(2.65rem,7vw,5.65rem)] font-800 leading-[0.98] tracking-[-0.055em] text-foreground">
            Buy and sell fabrics through one secure account.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            FabricTrad connects textile buyers and verified sellers. Sign in to enter the marketplace, view products, access pricing and manage your business activity.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/login" className="ft-primary-action inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm">
              Sign in to marketplace <Icon name="ArrowRightIcon" size={17} />
            </Link>
            <Link href="/register" className="ft-secondary-action inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm">
              Create a free account
            </Link>
          </div>

          <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Icon name="LockClosedIcon" size={16} className="text-success" /> Marketplace hidden before sign-in
            </span>
            <span className="inline-flex items-center gap-2">
              <Icon name="CheckBadgeIcon" size={16} className="text-success" /> One account can buy and sell
            </span>
            <span className="inline-flex items-center gap-2">
              <Icon name="DevicePhoneMobileIcon" size={16} className="text-success" /> Works across devices
            </span>
          </div>
        </div>
      </section>

      <section id="join" className="border-y border-border bg-card/75 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">Choose how to begin</p>
            <h2 className="mt-3 text-balance text-3xl font-800 tracking-[-0.035em] sm:text-4xl">Your marketplace opens after account creation.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              No products, seller information, prices, dashboards or transaction data are shown publicly.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {accountPaths.map((item) => (
              <article key={item.title} className="ft-feature-card flex flex-col p-6 sm:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon name={item.icon as 'ShoppingBagIcon'} size={23} />
                </div>
                <h3 className="mt-6 text-xl font-800">{item.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">{item.copy}</p>
                <Link href={item.href} className="ft-secondary-action mt-7 inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm">
                  {item.action} <Icon name="ArrowRightIcon" size={16} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-4 md:grid-cols-3">
            {trustItems.map((item) => (
              <article key={item.title} className="ft-section p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                  <Icon name={item.icon as 'ShieldCheckIcon'} size={21} />
                </div>
                <h3 className="mt-5 text-base font-800">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-[24px] border border-border bg-secondary p-6 text-white shadow-2xl sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-750 text-white/85">
                  <Icon name="ShieldCheckIcon" size={15} /> Private by default
                </div>
                <h2 className="mt-5 text-3xl font-800 tracking-[-0.035em]">Ready to enter FabricTrad?</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                  Sign in to access the marketplace, or create an account to begin buying or selling.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-800 text-secondary transition hover:bg-white/90">
                  Sign in
                </Link>
                <Link href="/register" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-800 text-white transition hover:bg-white/15">
                  Create account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AppLogo size={28} />
            <span className="font-800 text-foreground">FabricTrad</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer navigation">
            <Link href="/help" className="hover:text-foreground">Help</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
