'use client';

import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const capabilities = [
  {
    icon: 'ShieldCheckIcon',
    title: 'Verified textile trade',
    copy: 'Buyer and seller accounts are separated, with GST and business verification for sellers.',
  },
  {
    icon: 'SwatchIcon',
    title: 'Smarter fabric sourcing',
    copy: 'Registered buyers can compare bulk textile listings, requirements, quotations and suppliers.',
  },
  {
    icon: 'TruckIcon',
    title: 'Orders to delivery',
    copy: 'Payments, documents, fulfilment and shipment updates remain connected to the correct account.',
  },
  {
    icon: 'SparklesIcon',
    title: 'Visual sourcing tools',
    copy: 'Authenticated users can use private colour-draping and workflow tools inside their workspace.',
  },
];

export default function PublicAccessLanding() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="FabricTrad home">
            <AppLogo size={36} />
            <span className="text-lg font-800 tracking-tight text-secondary">FabricTrad</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-800 text-foreground transition hover:bg-muted">Sign in</Link>
            <Link href="/register" className="btn-primary rounded-xl px-4 py-2.5 text-sm">Create account</Link>
          </div>
        </div>
      </header>

      <section className="relative px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:pb-28">
        <div className="hero-grid absolute inset-0" aria-hidden="true" />
        <div className="landing-orb absolute -left-40 top-12 h-[34rem] w-[34rem] rounded-full bg-primary/18" aria-hidden="true" />
        <div className="landing-orb absolute -right-44 top-4 h-[36rem] w-[36rem] rounded-full bg-secondary/16" aria-hidden="true" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-3xl animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-4 py-2 text-xs font-800 uppercase tracking-[0.16em] text-success"><span className="h-2 w-2 rounded-full bg-success" /> India&apos;s account-based B2B textile network</div>
            <h1 className="mt-7 text-balance text-5xl font-800 leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">Textile sourcing, trade and fulfilment in one trusted system.</h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">FabricTrad connects business buyers with verified textile manufacturers and wholesalers. Registered users receive a private workspace designed for their role, account and orders.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/login" className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-sm">Sign in to FabricTrad <Icon name="ArrowRightIcon" size={17} /></Link>
              <Link href="/buyer-registration" className="btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-sm"><Icon name="ShoppingBagIcon" size={17} /> Create buyer account</Link>
              <Link href="/seller-registration" className="btn-navy inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-sm"><Icon name="BuildingStorefrontIcon" size={17} /> Create seller account</Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-muted-foreground">Marketplace listings, visual tools, dashboards, orders, requirements and seller information are available only after authentication.</p>
          </div>

          <div className="relative mx-auto w-full max-w-[580px] animate-slide-in-right">
            <div className="glass-card rounded-[2rem] border border-border p-5 shadow-2xl sm:p-7">
              <div className="flex items-center justify-between border-b border-border pb-5">
                <div><p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">Role-based access</p><h2 className="mt-2 text-2xl font-800">Two private business workspaces</h2></div>
                <Icon name="LockClosedIcon" size={28} className="text-success" />
              </div>
              <div className="mt-5 space-y-3">
                {[
                  ['ShoppingBagIcon', 'Buyer workspace', 'Sourcing, requirements, orders and shipment tracking'],
                  ['BuildingStorefrontIcon', 'Seller workspace', 'Listings, inventory, fulfilment, documents and payouts'],
                ].map(([icon, title, copy]) => (
                  <div key={title} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name={icon as 'ShoppingBagIcon'} size={20} /></div>
                    <div><p className="text-sm font-800">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">What FabricTrad does</p><h2 className="mt-3 text-3xl font-800 tracking-tight sm:text-4xl">A private operating layer for textile commerce</h2><p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">Public visitors can understand the service here. Product data and operational tools remain inside authenticated, role-specific accounts.</p></div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{capabilities.map((item) => <article key={item.title} className="rounded-2xl border border-border bg-background p-5 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name={item.icon as 'ShieldCheckIcon'} size={21} /></div><h3 className="mt-4 text-base font-800">{item.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p></article>)}</div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-border bg-secondary px-6 py-10 text-center text-white shadow-2xl sm:px-10">
          <Icon name="UserGroupIcon" size={30} className="mx-auto text-gold" />
          <h2 className="mt-4 text-3xl font-800">Choose the account that matches your business.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">Buyers and sellers receive separate registration, verification and workspaces. Existing users can sign in with a code sent to their registered email.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/login" className="rounded-xl bg-white px-6 py-3.5 text-sm font-800 text-secondary">Sign in</Link><Link href="/buyer-registration" className="rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-800 text-white">Register as buyer</Link><Link href="/seller-registration" className="rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-800 text-white">Register as seller</Link></div>
        </div>
      </section>
    </main>
  );
}
