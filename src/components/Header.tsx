'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const publicNavLinks = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Categories', href: '/categories' },
  { label: 'Vendors', href: '/vendors' },
  { label: 'How It Works', href: '/#how-it-works' },
];

const buyerNavLinks = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Categories', href: '/categories' },
  { label: 'Vendors', href: '/vendors' },
  { label: 'Requirements Board', href: '/buyer-requirements' },
];

const sellerNavLinks = [
  { label: 'Dashboard', href: '/seller-dashboard' },
  { label: 'Marketplace', href: '/marketplace' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  const isSeller = profile?.role === 'seller';
  const isBuyer = profile?.role === 'buyer';
  const isLoggedIn = !!user && !!profile;

  const navLinks = isLoggedIn
    ? isSeller ? sellerNavLinks : buyerNavLinks
    : publicNavLinks;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 16);
      if (mobileOpen) setMobileOpen(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      router?.push('/');
    } catch {
      // ignore
    }
    closeMobile();
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'nav-blur border-b border-border shadow-sm' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0" onClick={closeMobile}>
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
            {loading ? (
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : isLoggedIn ? (
              <>
                {/* Role badge */}
                <span className={`text-xs font-700 px-2.5 py-1 rounded-full border ${
                  isSeller
                    ? 'bg-secondary/10 text-secondary border-secondary/20' :'bg-primary/10 text-primary border-primary/20'
                }`}>
                  {isSeller ? 'Seller' : 'Buyer'}
                </span>
                {/* Dashboard link */}
                <Link
                  href={isSeller ? '/seller-dashboard' : '/buyer-dashboard'}
                  className="px-3 py-2 text-sm font-600 text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  My Dashboard
                </Link>
                {/* Sign out */}
                <button
                  onClick={handleSignOut}
                  className="btn-secondary px-3 py-2 text-sm rounded-lg"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-2 text-sm font-500 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/buyer-registration"
                  className="btn-primary px-4 py-2 text-sm rounded-lg"
                >
                  Register as Buyer
                </Link>
                <Link
                  href="/seller-registration"
                  className="px-3 py-2 text-sm font-600 text-secondary hover:text-primary transition-colors"
                >
                  Sell on FabricTrad
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <Icon
              name={mobileOpen ? 'XMarkIcon' : 'Bars3Icon'}
              size={22}
              className="text-foreground"
            />
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <div className="fixed top-16 left-0 right-0 bottom-0 z-40 bg-background overflow-y-auto md:hidden border-t border-border">
            <div className="p-4 space-y-1">
              <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-xl">
                <AppLogo size={32} />
                <span className="font-700 text-base text-secondary">FabricTrad</span>
                {isLoggedIn && (
                  <span className={`ml-auto text-xs font-700 px-2 py-0.5 rounded-full border ${
                    isSeller
                      ? 'bg-secondary/10 text-secondary border-secondary/20' :'bg-primary/10 text-primary border-primary/20'
                  }`}>
                    {isSeller ? 'Seller' : 'Buyer'}
                  </span>
                )}
              </div>
              {navLinks?.map((link) => (
                <Link
                  key={link?.label}
                  href={link?.href}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors"
                  onClick={closeMobile}
                >
                  {link?.label}
                </Link>
              ))}
              <div className="pt-4 space-y-2 border-t border-border mt-4">
                {isLoggedIn ? (
                  <>
                    <Link
                      href={isSeller ? '/seller-dashboard' : '/buyer-dashboard'}
                      className="btn-primary w-full px-4 py-3 text-sm rounded-lg text-center block"
                      onClick={closeMobile}
                    >
                      My Dashboard
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="btn-secondary w-full px-4 py-3 text-sm rounded-lg text-center block"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/buyer-registration"
                      className="btn-primary w-full px-4 py-3 text-sm rounded-lg text-center block"
                      onClick={closeMobile}
                    >
                      Register as Buyer
                    </Link>
                    <Link
                      href="/login"
                      className="btn-secondary w-full px-4 py-3 text-sm rounded-lg text-center block"
                      onClick={closeMobile}
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/seller-registration"
                      className="btn-navy w-full px-4 py-3 text-sm rounded-lg text-center block"
                      onClick={closeMobile}
                    >
                      Sell on FabricTrad
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}