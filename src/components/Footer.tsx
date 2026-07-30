import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const footerGroups = [
  {
    label: 'Shop',
    links: [
      { label: 'Marketplace', href: '/marketplace' },
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
    label: 'Support',
    links: [
      { label: 'Help centre', href: '/help' },
      { label: 'Account settings', href: '/profile' },
      { label: 'Privacy policy', href: '/privacy' },
      { label: 'Terms of use', href: '/terms' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card/75 backdrop-blur-xl">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <AppLogo size={36} />
              <span className="text-lg font-800 tracking-tight text-foreground">FabricTrad</span>
            </Link>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              An orange-first textile commerce platform for verified sourcing, colour-level catalogues, orders, payments and fulfilment.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a href="mailto:fabrictrad8@gmail.com" className="ft-icon-button" aria-label="Email FabricTrad support">
                <Icon name="EnvelopeIcon" size={17} />
              </a>
              <Link href="/help" className="ft-icon-button" aria-label="Open help centre">
                <Icon name="QuestionMarkCircleIcon" size={17} />
              </Link>
              <Link href="/privacy" className="ft-icon-button" aria-label="Read privacy policy">
                <Icon name="ShieldCheckIcon" size={17} />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
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

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">© 2026 FabricTrad. All rights reserved.</p>
            <p className="mt-1 text-xs text-muted-foreground">Support: fabrictrad8@gmail.com</p>
          </div>
          <div className="max-w-xl text-left sm:text-right">
            <p className="text-xs leading-5 text-muted-foreground">
              FabricTrad provides marketplace technology. Sellers remain responsible for product accuracy, GST, packing, fulfilment and applicable legal obligations.
            </p>
            <p className="mt-1 text-xs font-700 text-warning">
              Payment, cancellation, return and exchange eligibility is shown in the applicable order and product flow.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
