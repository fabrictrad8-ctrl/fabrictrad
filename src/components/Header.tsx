'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import ProfileMenu from '@/components/ProfileMenu';

const publicNavLinks: { label: string; href: string }[] = [];

const buyerNavLinks = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Categories', href: '/categories' },
  { label: 'Vendors', href: '/vendors' },
  { label: 'Requirements Board', href: '/buyer-requirements' },
];

const sellerNavLinks = [
  { label: 'Dashboard', href: '/seller-dashboard' },
  { label: 'Upload Catalog', href: '/seller-dashboard?tab=upload' },
  { label: 'Orders', href: '/seller-dashboard?tab=orders' },
  { label: 'Buyer Requests', href: '/seller-dashboard?tab=requests' },
  { label: 'Payouts', href: '/seller-dashboard?tab=earnings' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  const isSeller = profile?.role === 'seller';
  const isAdmin = profile?.role === 'admin_staff' || profile?.role === 'super_admin';
  const isLoggedIn = !!user && !!profile;
  const dashboardHref = isAdmin
    ? '/admin-portal'
    : isSeller
      ? '/seller-dashboard'
      : '/buyer-dashboard';
  const accountRoleLabel = isAdmin ? 'Admin' : isSeller ? 'Seller' : 'Buyer';

  const navLinks = isLoggedIn
    ? isAdmin
      ? []
      : isSeller
        ? sellerNavLinks
        : buyerNavLinks
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
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push(query ? `/marketplace?search=${encodeURIComponent(query)}` : '/marketplace');
    closeMobile();
  };

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0" onClick={closeMobile}>
            <AppLogo size={36} />
            <span className="font-display font-800 text-lg text-secondary hidden sm:block tracking-tight">
              FabricTrad
            </span>
          </Link>

          {isLoggedIn && !isSeller && !isAdmin && (
            <form
              onSubmit={handleSearch}
              className="hidden lg:flex h-10 flex-1 max-w-md items-center overflow-hidden rounded-lg border border-border bg-card shadow-sm focus-within:border-primary"
            >
              <div className="flex h-full w-11 items-center justify-center bg-muted">
                <Icon name="MagnifyingGlassIcon" size={18} className="text-muted-foreground" />
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search fabrics, sellers, GSM..."
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="h-full bg-primary px-4 text-sm font-800 text-white transition-colors hover:bg-saffron-light"
              >
                Search
              </button>
            </form>
          )}

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
                <Link
                  href={dashboardHref}
                  className="px-3 py-2 text-sm font-600 text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  {isAdmin ? 'Admin Portal' : 'My Dashboard'}
                </Link>
                <ProfileMenu />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-2 text-sm font-500 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
                <Link href="/register" className="btn-primary px-4 py-2 text-sm rounded-lg">
                  Create Account
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
              {isLoggedIn && !isSeller && !isAdmin && (
                <form
                  onSubmit={handleSearch}
                  className="mb-4 flex overflow-hidden rounded-xl border border-border bg-card"
                >
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search fabrics"
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none"
                  />
                  <button type="submit" className="bg-primary px-4 text-sm font-800 text-white">
                    Go
                  </button>
                </form>
              )}
              <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-xl">
                <AppLogo size={32} />
                <span className="font-700 text-base text-secondary">FabricTrad</span>
                {isLoggedIn && (
                  <span
                    className={`ml-auto text-xs font-700 px-2 py-0.5 rounded-full border ${
                      isAdmin
                        ? 'bg-error/10 text-error border-error/20'
                        : isSeller
                          ? 'bg-secondary/10 text-secondary border-secondary/20'
                          : 'bg-primary/10 text-primary border-primary/20'
                    }`}
                  >
                    {accountRoleLabel}
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
                    <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
                      <div className="w-11 h-11 rounded-full bg-primary/10 border border-border overflow-hidden flex items-center justify-center">
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={`${profile?.full_name || 'User'} profile photo`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-800 text-primary">
                            {(profile?.full_name || user?.email || 'F')[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-800 text-foreground">
                          {profile?.full_name || user?.email?.split('@')[0] || 'FabricTrad User'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    <Link
                      href={dashboardHref}
                      className="btn-primary w-full px-4 py-3 text-sm rounded-lg text-center block"
                      onClick={closeMobile}
                    >
                      {isAdmin ? 'Admin Portal' : 'My Dashboard'}
                    </Link>
                    <Link
                      href="/profile"
                      className="btn-secondary w-full px-4 py-3 text-sm rounded-lg text-center flex items-center justify-center gap-2"
                      onClick={closeMobile}
                    >
                      <Icon name="UserCircleIcon" size={16} />
                      My Profile
                    </Link>
                    {(isAdmin
                      ? [
                          ['Payments', '/admin-portal?tab=payments'],
                          ['Orders', '/admin-portal?tab=orders'],
                          ['Sellers', '/admin-portal?tab=sellers'],
                          ['Error Monitor', '/admin-portal?tab=errors'],
                        ]
                      : isSeller
                        ? [
                            ['Orders', '/seller-dashboard?tab=orders'],
                            ['Listings', '/seller-dashboard?tab=inventory'],
                            ['Earnings', '/seller-dashboard?tab=earnings'],
                            ['Buyer Inbox', '/seller-dashboard?tab=inbox'],
                          ]
                        : [
                            ['Purchases', '/buyer-dashboard?tab=orders'],
                            ['History', '/buyer-dashboard?tab=tracking'],
                            ['Wishlist', '/buyer-dashboard?tab=wishlist'],
                            ['Requirements', '/buyer-dashboard?tab=requirements'],
                          ]
                    ).map(([label, href]) => (
                      <Link
                        key={label}
                        href={href}
                        className="w-full px-4 py-3 text-sm rounded-lg text-center block border border-border text-foreground hover:bg-muted transition-colors"
                        onClick={closeMobile}
                      >
                        {label}
                      </Link>
                    ))}
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-3 text-sm rounded-lg text-center block border border-border text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="btn-primary w-full px-4 py-3 text-sm rounded-lg text-center block"
                      onClick={closeMobile}
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      className="btn-secondary w-full px-4 py-3 text-sm rounded-lg text-center block"
                      onClick={closeMobile}
                    >
                      Create Account
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
