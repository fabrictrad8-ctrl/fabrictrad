import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const footerGroups = [
  {
    label: 'Shop',
    links: [
      { label: 'Marketplace', href: '/marketplace' },
      { label: 'Custom order studio', href: '/custom-order' },
      { label: 'Categories', href: '/categories' },
      { label: 'Verified vendors', href: '/vendors' },
      { label: 'Buyer requirements', href: '/buyer-requirements' },
    ],
  },
  {
    label: 'Sell',
    links: [
      { label: 'Activate selling', href: '/seller-registration' },
      { label: 'Seller dashboard', href: '/seller-dashboard' },
      { label: 'Add a product', href: '/seller-dashboard?tab=upload' },
      { label: 'Orders & fulfilment', href: '/seller-dashboard?tab=orders' },
    ],
  },
  {
    label: 'Support & legal',
    links: [
      { label: 'How to use · Buyer', href: '/how-to-use?role=buyer' },
      { label: 'How to use · Seller', href: '/how-to-use?role=seller' },
      { label: 'Help centre', href: '/help' },
      { label: 'Returns & exchanges', href: '/returns-exchanges' },
      { label: 'Buyer Agreement', href: '/buyer-agreement' },
      { label: 'Seller Agreement', href: '/seller-agreement' },
      { label: 'Privacy policy', href: '/privacy' },
      { label: 'Terms of use', href: '/terms' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="ft-site-footer border-t border-border bg-card/90 backdrop-blur-xl">
      <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <div className="flex items-center justify-between gap-4 sm:hidden">
          <Link href="/" className="inline-flex min-w-0 items-center gap-2.5">
            <AppLogo size={31} />
            <span className="truncate text-base font-800 tracking-tight text-foreground">FabricTrad</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <a href="mailto:fabrictrad8@gmail.com" className="ft-icon-button" aria-label="Email FabricTrad support">
              <Icon name="EnvelopeIcon" size={16} />
            </a>
            <Link href="/how-to-use?role=buyer" className="ft-icon-button" aria-label="Open how to use guide">
              <Icon name="PlayIcon" size={16} />
            </Link>
            <Link href="/help" className="ft-icon-button" aria-label="Open help centre">
              <Icon name="QuestionMarkCircleIcon" size={16} />
            </Link>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground sm:hidden">
          Verified textile sourcing, catalogues, prepaid orders, payments and fulfilment.
        </p>

        <div className="mt-5 divide-y divide-border border-y border-border sm:hidden">
          {footerGroups.map((group) => (
            <details key={group.label} className="group py-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm font-800 text-foreground marker:content-none">
                {group.label}
                <Icon name="ChevronDownIcon" size={16} className="text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <nav className="grid grid-cols-2 gap-x-4 gap-y-1 pb-3" aria-label={`${group.label} footer links`}>
                {group.links.map((link) => (
                  <Link key={link.label} href={link.href} className="min-h-10 py-2 text-xs font-600 text-muted-foreground hover:text-primary">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </details>
          ))}
        </div>

        <div className="hidden gap-10 sm:grid lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <AppLogo size={36} />
              <span className="text-lg font-800 tracking-tight text-foreground">FabricTrad</span>
            </Link>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              An orange-first textile commerce platform for verified sourcing, colour-level catalogues, prepaid orders, payments and fulfilment.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a href="mailto:fabrictrad8@gmail.com" className="ft-icon-button" aria-label="Email FabricTrad support">
                <Icon name="EnvelopeIcon" size={17} />
              </a>
              <Link href="/how-to-use?role=buyer" className="ft-icon-button" aria-label="Open how to use guide">
                <Icon name="PlayIcon" size={17} />
              </Link>
              <Link href="/help" className="ft-icon-button" aria-label="Open help centre">
                <Icon name="QuestionMarkCircleIcon" size={17} />
              </Link>
              <Link href="/privacy" className="ft-icon-button" aria-label="Read privacy policy">
                <Icon name="ShieldCheckIcon" size={17} />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8">
            {footerGroups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-800 uppercase tracking-[0.14em] text-primary">{group.label}</p>
                <nav className="mt-4 space-y-3" aria-label={`${group.label} footer links`}>
                  {group.links.map((link) => (
                    <Link key={link.label} href={link.href} className="block text-sm font-600 text-muted-foreground transition hover:text-primary">
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 text-xs text-muted-foreground sm:mt-10 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:border-t sm:border-border sm:pt-6">
          <div>
            <p>© 2026 FabricTrad. All rights reserved.</p>
            <p className="mt-1 hidden sm:block">Support: fabrictrad8@gmail.com</p>
          </div>
          <div className="hidden max-w-xl text-left sm:block sm:text-right">
            <p className="leading-5">
              FabricTrad provides marketplace technology. Sellers remain responsible for product accuracy, seller taxes, packing and seller fulfilment except where FabricTrad expressly undertakes a service itself, subject always to applicable law.
            </p>
            <p className="mt-1 font-700 text-warning">
              Marketplace orders are prepaid. Return, exchange and dispute terms are shown in the applicable product/order flow and do not remove non-waivable legal rights.
            </p>
          </div>
          <p className="leading-5 sm:hidden">
            Marketplace orders are prepaid. See the order and Returns & Exchanges Policy for claim eligibility.
          </p>
        </div>
      </div>
    </footer>
  );
}
