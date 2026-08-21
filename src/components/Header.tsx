'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import ProfileMenu from '@/components/ProfileMenu';
import WishlistMenu from '@/components/WishlistMenu';
import PreferenceControls from '@/components/PreferenceControls';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

type NavLink = { label: string; href: string; icon: string };
type Workspace = 'public' | 'buyer' | 'seller' | 'account' | 'admin';

const BUYER_PATH_PREFIXES = [
  '/marketplace',
  '/categories',
  '/vendors',
  '/buyer-dashboard',
  '/buyer-requirements',
  '/cart',
  '/checkout',
  '/product-detail',
  '/company-purchasing',
  '/orders',
];

const SELLER_PATH_PREFIXES = [
  '/seller-dashboard',
  '/seller-registration',
  '/catalogs-pricing',
];

const pathMatches = (pathname: string, prefixes: string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, profile, loading, signOut } = useAuth();
  const { t } = useAppPreferences();
  const router = useRouter();
  const pathname = usePathname() || '/';

  const isAdmin = profile?.role === 'admin_staff' || profile?.role === 'super_admin';
  const canBuy = !isAdmin && (profile?.can_buy ?? (profile?.role === 'buyer' || profile?.role === 'seller'));
  const canSell = !isAdmin && (profile?.can_sell ?? profile?.role === 'seller');
  const isLoggedIn = Boolean(user && profile);

  const activeWorkspace: Workspace = useMemo(() => {
    if (!isLoggedIn) return 'public';
    if (isAdmin) return 'admin';
    if (pathMatches(pathname, SELLER_PATH_PREFIXES)) return 'seller';
    if (pathMatches(pathname, BUYER_PATH_PREFIXES)) return 'buyer';
    return 'account';
  }, [isAdmin, isLoggedIn, pathname]);

  const buyerContext = activeWorkspace === 'buyer';
  const sellerContext = activeWorkspace === 'seller';

  const notificationsHref = isAdmin
    ? '/admin-portal?tab=activity'
    : sellerContext
      ? '/seller-dashboard?tab=notifications'
      : '/buyer-dashboard?tab=notifications';

  const accountRoleLabel = isAdmin
    ? 'Admin'
    : canBuy && canSell
      ? 'Buyer + Seller'
      : canSell
        ? 'Seller'
        : 'Buyer';

  const publicNavLinks = useMemo<NavLink[]>(
    () => [
      { label: t('nav.marketplace'), href: '/marketplace', icon: 'ShoppingBagIcon' },
      { label: 'Categories', href: '/categories', icon: 'Squares2X2Icon' },
      { label: 'AI Drape', href: '/product-detail#drape-on', icon: 'SparklesIcon' },
      { label: 'Vendors', href: '/vendors', icon: 'BuildingStorefrontIcon' },
    ],
    [t]
  );

  const buyerNavLinks = useMemo<NavLink[]>(
    () => [
      { label: t('nav.marketplace'), href: '/marketplace', icon: 'ShoppingBagIcon' },
      { label: 'Categories', href: '/categories', icon: 'Squares2X2Icon' },
      { label: 'Vendors', href: '/vendors', icon: 'BuildingStorefrontIcon' },
      { label: 'Requirements', href: '/buyer-requirements', icon: 'MegaphoneIcon' },
    ],
    [t]
  );

  const sellerNavLinks = useMemo<NavLink[]>(
    () => [
      { label: 'Seller dashboard', href: '/seller-dashboard', icon: 'HomeIcon' },
      { label: 'Products', href: '/seller-dashboard?tab=inventory', icon: 'ArchiveBoxIcon' },
      { label: 'Orders', href: '/seller-dashboard?tab=orders', icon: 'ClipboardDocumentListIcon' },
    ],
    []
  );

  const navLinks = useMemo<NavLink[]>(() => {
    if (!isLoggedIn) return publicNavLinks;
    if (isAdmin) return [];
    if (sellerContext) return canSell ? sellerNavLinks : [];
    if (buyerContext) return canBuy ? buyerNavLinks : [];
    if (canBuy && !canSell) return buyerNavLinks;
    if (canSell && !canBuy) return sellerNavLinks;
    return [];
  }, [buyerContext, buyerNavLinks, canBuy, canSell, isAdmin, isLoggedIn, publicNavLinks, sellerContext, sellerNavLinks]);

  const workspaceLinks = useMemo<NavLink[]>(() => {
    if (!isLoggedIn) return [];
    if (isAdmin) {
      return [
        { label: 'Admin overview', href: '/admin-portal', icon: 'ChartPieIcon' },
        { label: 'Review sellers', href: '/admin-portal?tab=sellers', icon: 'ShieldCheckIcon' },
        { label: 'Orders', href: '/admin-portal?tab=orders', icon: 'ClipboardDocumentListIcon' },
        { label: 'Payments', href: '/admin-portal?tab=payments', icon: 'CreditCardIcon' },
      ];
    }

    const links: NavLink[] = [];
    if (canBuy) {
      links.push(
        { label: 'Open buyer workspace', href: '/marketplace', icon: 'ShoppingBagIcon' },
        { label: 'Buyer dashboard', href: '/buyer-dashboard', icon: 'HomeIcon' }
      );
    }
    if (canSell) {
      links.push(
        { label: 'Open seller workspace', href: '/seller-dashboard', icon: 'BuildingStorefrontIcon' },
        { label: 'Products & inventory', href: '/seller-dashboard?tab=inventory', icon: 'ArchiveBoxIcon' }
      );
    } else if (canBuy) {
      links.push({ label: 'Activate selling', href: '/seller-registration', icon: 'PlusCircleIcon' });
    }
    links.push({ label: 'Account overview', href: '/account', icon: 'UserCircleIcon' });
    return links;
  }, [canBuy, canSell, isAdmin, isLoggedIn]);

  const quickAction = isAdmin
    ? { label: 'Review sellers', href: '/admin-portal?tab=sellers', icon: 'ShieldCheckIcon' }
    : sellerContext && canSell
      ? { label: 'Add product', href: '/seller-dashboard?tab=upload', icon: 'PlusIcon' }
      : buyerContext && canBuy
        ? { label: 'Post requirement', href: '/buyer-requirements', icon: 'PlusIcon' }
        : null;

  const brandHref = isAdmin
    ? '/admin-portal'
    : sellerContext && canSell
      ? '/seller-dashboard'
      : buyerContext && canBuy
        ? '/marketplace'
        : isLoggedIn
          ? '/account'
          : '/';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setWorkspaceOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const closeMenus = () => {
    setMobileOpen(false);
    setWorkspaceOpen(false);
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push(query ? `/marketplace?search=${encodeURIComponent(query)}` : '/marketplace#marketplace-search');
    closeMenus();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } finally {
      closeMenus();
    }
  };

  const avatarInitial = (profile?.full_name || user?.email || 'F').charAt(0).toUpperCase();
  const marketplaceSearchHref = pathname === '/marketplace' ? '#marketplace-search' : '/marketplace#marketplace-search';
  const showBuyerUtilities = isLoggedIn && canBuy && buyerContext;

  return (
    <>
      <header
        className={`ft-commerce-header fixed inset-x-0 top-0 z-50 transition-all duration-200 ${
          scrolled ? 'is-scrolled' : ''
        }`}
      >
        <div className="ft-header-inner mx-auto h-16 max-w-[1760px] gap-3 px-4 sm:px-6 lg:px-8">
          <Link href={brandHref} className="ft-header-brand flex shrink-0 items-center gap-2.5" onClick={closeMenus}>
            <AppLogo size={36} />
            <span className="hidden text-lg font-800 tracking-tight text-foreground sm:block">FabricTrad</span>
          </Link>

          <nav className="ft-header-primary-nav hidden items-center gap-1" aria-label="Primary navigation">
            {navLinks.slice(0, 5).map((link) => (
              <Link
                key={`${link.label}-${link.href}`}
                href={link.href}
                className={`ft-header-link ${pathname === link.href ? 'is-current' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ft-header-actions ml-auto hidden items-center gap-2 md:flex">
            {showBuyerUtilities && (
              <Link
                href={marketplaceSearchHref}
                onClick={closeMenus}
                className="ft-header-search-trigger"
                aria-label="Search FabricTrad marketplace"
              >
                <Icon name="MagnifyingGlassIcon" size={17} />
                <span>Search</span>
              </Link>
            )}

            {buyerContext && navLinks.length > 0 && (
              <Link href="/categories" className="ft-header-browse hidden items-center gap-2 md:inline-flex">
                <Icon name="Squares2X2Icon" size={16} />
                <span>Browse</span>
              </Link>
            )}

            <div className="ft-header-preferences">
              <PreferenceControls compact />
            </div>

            {loading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : isLoggedIn ? (
              <>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setWorkspaceOpen((current) => !current)}
                    className="ft-workspace-button"
                    aria-expanded={workspaceOpen}
                    aria-haspopup="menu"
                  >
                    <span className="ft-workspace-dot" />
                    <span className="ft-workspace-label">Workspaces</span>
                    <Icon name="ChevronDownIcon" size={14} />
                  </button>

                  {workspaceOpen && (
                    <div className="ft-workspace-menu" role="menu">
                      <div className="border-b border-border px-4 py-3">
                        <p className="text-xs font-800 uppercase tracking-[0.13em] text-primary">{accountRoleLabel}</p>
                        <p className="mt-1 truncate text-sm font-750 text-foreground">
                          {profile?.business_name || profile?.full_name || user?.email}
                        </p>
                        {!isAdmin && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Current: {sellerContext ? 'Seller workspace' : buyerContext ? 'Buyer workspace' : 'Account'}
                          </p>
                        )}
                      </div>
                      <div className="p-2">
                        {workspaceLinks.map((link) => (
                          <Link key={link.href} href={link.href} onClick={closeMenus} className="ft-workspace-link" role="menuitem">
                            <Icon name={link.icon as 'HomeIcon'} size={17} />
                            <span>{link.label}</span>
                          </Link>
                        ))}
                        <Link href="/profile" onClick={closeMenus} className="ft-workspace-link" role="menuitem">
                          <Icon name="Cog6ToothIcon" size={17} />
                          <span>Account settings</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {quickAction && (
                  <Link href={quickAction.href} className="ft-header-quick-action ft-primary-action hidden items-center gap-2 px-3 py-2 text-xs">
                    <Icon name={quickAction.icon as 'PlusIcon'} size={15} />
                    {quickAction.label}
                  </Link>
                )}

                {showBuyerUtilities && <WishlistMenu />}
                {(isAdmin || buyerContext || sellerContext) && (
                  <Link href={notificationsHref} className="ft-icon-button" aria-label="Open notifications">
                    <Icon name="BellIcon" size={18} />
                  </Link>
                )}
                <div className="ft-header-profile">
                  <ProfileMenu />
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="ft-secondary-action inline-flex items-center px-4 py-2 text-sm">
                  {t('nav.signIn')}
                </Link>
                <Link href="/register" className="ft-primary-action inline-flex items-center px-4 py-2 text-sm">
                  {t('nav.createAccount')}
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="ft-mobile-menu-trigger ft-icon-button ml-auto md:hidden"
            onClick={() => setMobileOpen((current) => !current)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <Icon name={mobileOpen ? 'XMarkIcon' : 'Bars3Icon'} size={22} />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={closeMenus} aria-label="Close menu" />
          <aside className="ft-mobile-commerce-menu fixed inset-y-0 right-0 z-50 w-[min(92vw,380px)] overflow-y-auto md:hidden">
            <div className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-card/95 px-4 backdrop-blur-xl">
              <div className="flex min-w-0 items-center gap-2.5">
                <AppLogo size={34} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-800 text-foreground">FabricTrad</p>
                  <p className="truncate text-xs text-muted-foreground">{isLoggedIn ? accountRoleLabel : 'Textile commerce'}</p>
                </div>
              </div>
              <button type="button" onClick={closeMenus} className="ft-icon-button ml-auto" aria-label="Close menu">
                <Icon name="XMarkIcon" size={19} />
              </button>
            </div>

            <div className="space-y-5 p-4 pb-10">
              {isLoggedIn && (
                <div className="ft-mobile-account-card">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-sm font-800 text-primary">
                      {profile?.avatar_url ? (
                        <AppImage src={profile.avatar_url} alt="Profile" width={44} height={44} className="h-full w-full object-cover" />
                      ) : (
                        avatarInitial
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-800 text-foreground">
                        {profile?.business_name || profile?.full_name || user?.email?.split('@')[0]}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <span className="ft-badge bg-primary/10 text-primary">{accountRoleLabel}</span>
                  </div>
                </div>
              )}

              {showBuyerUtilities && (
                <form onSubmit={handleSearch} className="ft-header-search flex">
                  <Icon name="MagnifyingGlassIcon" size={18} className="ml-3 shrink-0 text-muted-foreground" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search fabrics or vendors"
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                  />
                  <button type="submit" className="ft-search-submit px-4 text-sm font-750">Go</button>
                </form>
              )}

              {navLinks.length > 0 && (
                <div>
                  <p className="mb-2 px-1 text-[11px] font-800 uppercase tracking-[0.15em] text-muted-foreground">
                    {sellerContext ? 'Seller tools' : 'Explore'}
                  </p>
                  <div className="space-y-1">
                    {navLinks.map((link) => (
                      <Link key={`${link.label}-${link.href}`} href={link.href} onClick={closeMenus} className="ft-mobile-menu-link">
                        <Icon name={link.icon as 'ShoppingBagIcon'} size={18} />
                        <span>{link.label}</span>
                        <Icon name="ChevronRightIcon" size={15} className="ml-auto text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {isLoggedIn && (
                <div>
                  <p className="mb-2 px-1 text-[11px] font-800 uppercase tracking-[0.15em] text-muted-foreground">Workspaces</p>
                  <div className="space-y-1">
                    {workspaceLinks.map((link) => (
                      <Link key={link.href} href={link.href} onClick={closeMenus} className="ft-mobile-menu-link">
                        <Icon name={link.icon as 'HomeIcon'} size={18} />
                        <span>{link.label}</span>
                      </Link>
                    ))}
                    <Link href="/profile" onClick={closeMenus} className="ft-mobile-menu-link">
                      <Icon name="Cog6ToothIcon" size={18} />
                      <span>Profile & preferences</span>
                    </Link>
                    {(isAdmin || buyerContext || sellerContext) && (
                      <Link href={notificationsHref} onClick={closeMenus} className="ft-mobile-menu-link">
                        <Icon name="BellIcon" size={18} />
                        <span>Notifications</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Language · Theme</span>
                  <PreferenceControls compact />
                </div>
              </div>

              {isLoggedIn ? (
                <button type="button" onClick={handleSignOut} className="ft-secondary-action flex w-full items-center justify-center gap-2 px-4 py-3 text-sm">
                  <Icon name="ArrowRightOnRectangleIcon" size={17} />
                  Sign out
                </button>
              ) : (
                <div className="grid gap-2">
                  <Link href="/login" onClick={closeMenus} className="ft-primary-action flex items-center justify-center px-4 py-3 text-sm">
                    Sign in
                  </Link>
                  <Link href="/register" onClick={closeMenus} className="ft-secondary-action flex items-center justify-center px-4 py-3 text-sm">
                    Create account
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
