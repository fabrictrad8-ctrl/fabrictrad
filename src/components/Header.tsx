'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';

const navLinks = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Categories', href: '/categories' },
  { label: 'Vendors', href: '/vendors' },
  { label: 'How It Works', href: '/#how-it-works' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      const handleScroll = () => setMobileOpen(false);
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [mobileOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'nav-blur border-b border-border shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <AppLogo size={36} />
          <span className="font-display font-800 text-lg text-secondary hidden sm:block tracking-tight">
            FabricTrad
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks?.map((link) => (
            <Link
              key={link?.label}
              href={link?.href}
              className="px-3 py-2 text-sm font-500 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              {link?.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/seller-dashboard"
            className="px-3 py-2 text-sm font-600 text-secondary hover:text-primary transition-colors"
          >
            Seller Portal
          </Link>
          <Link
            href="/buyer-registration"
            className="btn-primary px-4 py-2 text-sm rounded-lg"
          >
            Register as Buyer
          </Link>
          <Link
            href="/buyer-dashboard"
            className="btn-secondary px-3 py-2 text-sm rounded-lg"
          >
            Login
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          <Icon name={mobileOpen ? 'XMarkIcon' : 'Bars3Icon'} size={22} className="text-foreground" />
        </button>
      </div>
      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-40 bg-background/95 backdrop-blur-md border-t border-border">
          <div className="p-4 space-y-1">
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-xl">
              <AppLogo size={32} />
              <span className="font-700 text-base text-secondary">FabricTrad</span>
            </div>
            {navLinks?.map((link) => (
              <Link
                key={link?.label}
                href={link?.href}
                className="flex items-center gap-3 px-4 py-3 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link?.label}
              </Link>
            ))}
            <div className="pt-4 space-y-2 border-t border-border mt-4">
              <Link
                href="/buyer-registration"
                className="btn-primary w-full px-4 py-3 text-sm rounded-lg text-center block"
                onClick={() => setMobileOpen(false)}
              >
                Register as Buyer
              </Link>
              <Link
                href="/seller-dashboard"
                className="btn-navy w-full px-4 py-3 text-sm rounded-lg text-center block"
                onClick={() => setMobileOpen(false)}
              >
                Seller Portal
              </Link>
              <Link
                href="/buyer-dashboard"
                className="btn-secondary w-full px-4 py-3 text-sm rounded-lg text-center block"
                onClick={() => setMobileOpen(false)}
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}