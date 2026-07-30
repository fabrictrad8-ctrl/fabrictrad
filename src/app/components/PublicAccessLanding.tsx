'use client';

import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const capabilities = [
  {
    icon: 'ShieldCheckIcon',
    title: 'Verified commerce',
    copy: 'Business verification, account controls and protected buyer–seller workflows keep every transaction accountable.',
  },
  {
    icon: 'SparklesIcon',
    title: 'AI catalogue studio',
    copy: 'Turn product details, photos and short reels into organised fabric listings with colour-level stock and pricing.',
  },
  {
    icon: 'ClipboardDocumentListIcon',
    title: 'Orders in one place',
    copy: 'Request, accept, pay, invoice, fulfil and track orders without losing context across calls and messages.',
  },
  {
    icon: 'SwatchIcon',
    title: 'Visual fabric tools',
    copy: 'Compare colours and preview fabric choices with buyer-facing visualisation tools inside the marketplace.',
  },
];

const workflow = [
  ['01', 'Create one account', 'Start as a buyer, a seller, or both. Your account capabilities grow with your business.'],
  ['02', 'Complete verification', 'Add the required identity or GST business details for the actions you need.'],
  ['03', 'Trade from one workspace', 'Source fabrics, publish catalogues, manage orders and follow fulfilment in one system.'],
];

const previewRows = [
  ['New order request', '18 colour variants', 'Awaiting review', 'warning'],
  ['Silk catalogue', '₹1.84L potential value', 'Published', 'success'],
  ['Shipment FT-2841', 'Mumbai → Bengaluru', 'In transit', 'info'],
];

export default function PublicAccessLanding() {
  return (
    <main className="ft-marketing min-h-screen overflow-hidden text-foreground">
      <header className="ft-topbar fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="FabricTrad home">
            <AppLogo size={36} />
            <span className="truncate text-lg font-800 tracking-tight text-foreground">FabricTrad</span>
          </Link>

          <nav className="ml-8 hidden items-center gap-1 lg:flex" aria-label="Public navigation">
            <a href="#platform" className="rounded-lg px-3 py-2 text-sm font-650 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Platform
            </a>
            <a href="#workflow" className="rounded-lg px-3 py-2 text-sm font-650 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              How it works
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
              Start trading <Icon name="ArrowRightIcon" size={16} />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-8 lg:pb-28">
        <div className="ft-marketing-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="landing-orb pointer-events-none absolute -left-48 top-0 h-[34rem] w-[34rem] rounded-full bg-primary/15" aria-hidden="true" />
        <div className="landing-orb pointer-events-none absolute -right-48 top-10 h-[36rem] w-[36rem] rounded-full bg-secondary/12" aria-hidden="true" />

        <div className="relative mx-auto grid max-w-[1440px] items-center gap-14 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="max-w-3xl animate-fade-in-up">
            <div className="ft-badge ft-badge--success">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Built for India&apos;s textile trade
            </div>

            <h1 className="mt-6 text-balance text-[clamp(2.65rem,7vw,5.65rem)] font-800 leading-[0.96] tracking-[-0.055em] text-foreground">
              Run textile commerce from one calm workspace.
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              FabricTrad brings sourcing, catalogues, colour variants, order decisions, payments and fulfilment together—without the clutter of disconnected tools.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/register" className="ft-primary-action inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm">
                Create your account <Icon name="ArrowRightIcon" size={17} />
              </Link>
              <Link href="/buyer-registration" className="ft-secondary-action inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm">
                <Icon name="ShoppingBagIcon" size={17} /> Buy fabrics
              </Link>
              <Link href="/seller-registration" className="ft-secondary-action inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm">
                <Icon name="BuildingStorefrontIcon" size={17} /> Start selling
              </Link>
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 text-sm sm:grid-cols-3">
              {[
                ['One account', 'Buy and sell'],
                ['Every device', 'Phone to desktop'],
                ['Protected data', 'Account-scoped access'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start gap-2 rounded-xl border border-border/80 bg-card/65 p-3 backdrop-blur-sm">
                  <Icon name="CheckBadgeIcon" size={17} className="mt-0.5 shrink-0 text-success" />
                  <div>
                    <p className="text-xs font-700 text-foreground">{label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[680px] animate-slide-in-right">
            <div className="ft-hero-panel overflow-hidden p-3 sm:p-5">
              <div className="rounded-[18px] border border-border bg-background/85 shadow-sm">
                <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
                  <div className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-error/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                  </div>
                  <div className="ft-search ml-2 min-w-0 flex-1 px-3 text-xs text-muted-foreground">
                    <Icon name="MagnifyingGlassIcon" size={14} />
                    Search products, orders and customers
                  </div>
                  <div className="ft-icon-button h-9 min-h-9 w-9 min-w-9 shadow-none">
                    <Icon name="BellIcon" size={16} />
                  </div>
                </div>

                <div className="grid min-h-[430px] sm:grid-cols-[176px_1fr]">
                  <aside className="hidden border-r border-border bg-card/75 p-3 sm:block">
                    <div className="mb-4 flex items-center gap-2 px-2 py-1">
                      <AppLogo size={26} />
                      <span className="text-xs font-800">FabricTrad</span>
                    </div>
                    {[
                      ['HomeIcon', 'Overview', true],
                      ['ArchiveBoxIcon', 'Catalogues', false],
                      ['ShoppingBagIcon', 'Orders', false],
                      ['TruckIcon', 'Fulfilment', false],
                      ['ChartBarIcon', 'Analytics', false],
                    ].map(([icon, label, active]) => (
                      <div key={String(label)} className={`ft-sidebar-item mb-1 flex items-center gap-2 px-3 py-2 text-xs ${active ? 'is-active' : ''}`}>
                        <Icon name={icon as 'HomeIcon'} size={15} />
                        {label}
                      </div>
                    ))}
                  </aside>

                  <div className="min-w-0 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-700 text-muted-foreground">Seller overview</p>
                        <h2 className="mt-1 text-xl font-800 tracking-tight">Good morning, Aarna Textiles</h2>
                      </div>
                      <button type="button" className="ft-primary-action inline-flex items-center justify-center gap-2 px-3 py-2 text-xs">
                        <Icon name="SparklesIcon" size={14} /> Add product
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {[
                        ['Orders', '24'],
                        ['Revenue', '₹4.8L'],
                        ['Products', '136'],
                        ['Shipments', '11'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                          <p className="text-[10px] font-700 uppercase tracking-wider text-muted-foreground">{label}</p>
                          <p className="mt-2 text-lg font-800 tracking-tight">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                      <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <p className="text-xs font-800">Today&apos;s activity</p>
                        <span className="text-[11px] font-700 text-primary">View all</span>
                      </div>
                      <div>
                        {previewRows.map(([title, copy, status, tone], index) => (
                          <div key={title} className={`grid gap-2 px-4 py-3 sm:grid-cols-[1.1fr_1fr_auto] sm:items-center ${index < previewRows.length - 1 ? 'border-b border-border' : ''}`}>
                            <p className="text-xs font-750 text-foreground">{title}</p>
                            <p className="text-[11px] text-muted-foreground">{copy}</p>
                            <span className={`ft-badge text-[10px] ${tone === 'success' ? 'ft-badge--success' : tone === 'warning' ? 'ft-badge--warning' : ''}`}>{status}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon name="SparklesIcon" size={17} />
                        </div>
                        <div>
                          <p className="text-xs font-800">AI catalogue assistant</p>
                          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Upload photos or a short reel and create structured colour variants faster.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="border-y border-border bg-card/75 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div>
              <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">One commerce system</p>
              <h2 className="mt-3 text-balance text-3xl font-800 tracking-[-0.035em] sm:text-4xl">Everything important stays visible and actionable.</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base lg:justify-self-end">
              The interface is organised around familiar commerce tasks: products, orders, customers, payments, shipping and analytics. Each area uses the same controls, spacing and status language across buyer, seller and admin workspaces.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item) => (
              <article key={item.title} className="ft-feature-card p-5 sm:p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon name={item.icon as 'ShieldCheckIcon'} size={21} />
                </div>
                <h3 className="mt-5 text-base font-800">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">Simple by design</p>
            <h2 className="mt-3 text-3xl font-800 tracking-[-0.035em] sm:text-4xl">Start once. Expand when you need to.</h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {workflow.map(([number, title, copy]) => (
              <article key={number} className="ft-section p-6">
                <span className="text-xs font-800 text-primary">{number}</span>
                <h3 className="mt-5 text-lg font-800">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-5 rounded-[24px] border border-border bg-secondary p-6 text-white shadow-2xl sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-750 text-white/85">
              <Icon name="ShieldCheckIcon" size={15} /> Account-scoped access
            </div>
            <h2 className="mt-5 text-3xl font-800 tracking-[-0.035em]">Ready for real buyers, sellers and transactions.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              FabricTrad keeps catalogue, order, payment and fulfilment actions tied to authenticated accounts, with dedicated controls for buyers, sellers and administrators.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-800 text-secondary transition hover:bg-white/90">
              Create account <Icon name="ArrowRightIcon" size={16} />
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-800 text-white transition hover:bg-white/15">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card/80 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <AppLogo size={28} />
            <span className="font-800 text-foreground">FabricTrad</span>
            <span>Textile commerce, organised.</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-650">
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <Link href="/buyer-registration" className="hover:text-foreground">Buyer registration</Link>
            <Link href="/seller-registration" className="hover:text-foreground">Seller registration</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
