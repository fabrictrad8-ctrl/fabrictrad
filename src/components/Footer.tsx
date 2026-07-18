import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const footerLinks = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Become a Seller', href: '/seller-dashboard' },
  { label: 'How It Works', href: '/marketplace' },
  { label: 'Privacy Policy', href: '/marketplace' },
  { label: 'Terms of Use', href: '/marketplace' },
];

const socialLinks = [
  { icon: 'GlobeAltIcon', label: 'Website', href: '#' },
  { icon: 'ChatBubbleLeftRightIcon', label: 'WhatsApp', href: '#' },
  { icon: 'EnvelopeIcon', label: 'Email', href: '#' },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
          <Link href="/" className="flex items-center gap-2">
            <AppLogo size={32} />
            <span className="font-display font-700 text-base text-secondary">FabricTrad</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-500 text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-border hover:border-primary hover:text-primary text-muted-foreground transition-colors"
              >
                <Icon name={s.icon as 'GlobeAltIcon'} size={16} />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground">© 2026 FabricTrad. All rights reserved.</p>
          <div className="flex flex-col items-center sm:items-end gap-1">
            <p className="text-xs text-muted-foreground text-center sm:text-right max-w-sm">
              Platform is a service provider only. Not responsible for seller taxes, courier RTO, or
              packing charges.
            </p>
            <p className="text-xs font-600 text-warning text-center sm:text-right">
              No Cash on Delivery · No Returns · Exchanges only for damage with unboxing video proof
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
