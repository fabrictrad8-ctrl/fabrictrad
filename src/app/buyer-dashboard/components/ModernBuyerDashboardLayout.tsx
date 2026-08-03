'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import PreferenceControls from '@/components/PreferenceControls';
import ProfileMenu from '@/components/ProfileMenu';
import BuyerOverview from '@/app/buyer-dashboard/components/BuyerOverview';
import BuyerOrders from '@/app/buyer-dashboard/components/BuyerOrders';
import BuyerTracking from '@/app/buyer-dashboard/components/BuyerTracking';
import BuyerWishlist from '@/app/buyer-dashboard/components/BuyerWishlist';
import DisputeMessaging from '@/app/buyer-dashboard/components/DisputeMessaging';
import NotificationPreferences from '@/app/components/NotificationPreferences';
import { useAuth } from '@/contexts/AuthContext';

type DashboardTab =
  | 'overview'
  | 'orders'
  | 'tracking'
  | 'wishlist'
  | 'requirements'
  | 'disputes'
  | 'notifications'
  | 'account';

type NavItem = {
  key: DashboardTab;
  label: string;
  icon: string;
  description: string;
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Home',
    items: [
      { key: 'overview', label: 'Home', icon: 'HomeIcon', description: 'Orders and sourcing overview' },
      { key: 'orders', label: 'Orders', icon: 'ShoppingBagIcon', description: 'Purchases, payment and documents' },
      { key: 'tracking', label: 'Tracking', icon: 'TruckIcon', description: 'Shipment and delivery status' },
    ],
  },
  {
    label: 'Sourcing',
    items: [
      { key: 'wishlist', label: 'Wishlist', icon: 'HeartIcon', description: 'Saved fabrics and suppliers' },
      { key: 'requirements', label: 'Requirements', icon: 'MegaphoneIcon', description: 'Post sourcing needs' },
      { key: 'disputes', label: 'Messages & disputes', icon: 'ChatBubbleLeftRightIcon', description: 'Seller and support conversations' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'notifications', label: 'Notifications', icon: 'BellIcon', description: 'Email and in-app preferences' },
      { key: 'account', label: 'Profile & settings', icon: 'UserCircleIcon', description: 'Identity, address and preferences' },
    ],
  },
];

const allItems = navGroups.flatMap((group) => group.items);
const validTabs = allItems.map((item) => item.key);
const normaliseTab = (value: string | null): DashboardTab =>
  validTabs.includes(value as DashboardTab) ? (value as DashboardTab) : 'overview';

export default function ModernBuyerDashboardLayout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => normaliseTab(searchParams.get('tab')));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setActiveTab(normaliseTab(searchParams.get('tab')));
  }, [searchParams]);

  const activeItem = useMemo(
    () => allItems.find((item) => item.key === activeTab) || allItems[0],
    [activeTab]
  );
  const buyerName = profile?.full_name || user?.email?.split('@')[0] || 'Buyer';
  const canSell = Boolean(profile?.can_sell || profile?.role === 'seller');

  const navigateTo = (tab: DashboardTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
    router.replace(tab === 'overview' ? '/buyer-dashboard' : `/buyer-dashboard?tab=${tab}`, {
      scroll: false,
    });
  };

  const searchMarketplace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/marketplace?search=${encodeURIComponent(query)}` : '/marketplace');
  };

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      window.location.replace('/login');
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-[#f6f6f7] dark:bg-card">
      <div className="border-b border-border p-3">
        <Link href="/buyer-dashboard" onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-card">
          <AppLogo size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-800 text-foreground">FabricTrad</p>
            <p className="truncate text-[11px] text-muted-foreground">Buyer account</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Buyer navigation">
        {navGroups.map((group) => (
          <section key={group.label} className="mb-4 last:mb-0">
            <p className="mb-1 px-2 text-[10px] font-800 uppercase tracking-[0.14em] text-muted-foreground">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigateTo(item.key)}
                  className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-650 transition ${
                    activeTab === item.key
                      ? 'bg-[#e1e3e5] text-foreground shadow-sm dark:bg-muted'
                      : 'text-foreground/80 hover:bg-[#ebebeb] hover:text-foreground dark:hover:bg-muted'
                  }`}
                >
                  <Icon name={item.icon as 'HomeIcon'} size={18} className="text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="space-y-1 border-t border-border p-2">
        <Link href="/marketplace" className="flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-650 text-foreground/80 hover:bg-card">
          <Icon name="Squares2X2Icon" size={18} className="text-muted-foreground" /> Browse marketplace
        </Link>
        <Link
          href={canSell ? '/seller-dashboard' : '/seller-registration'}
          className="flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-650 text-foreground/80 hover:bg-card"
        >
          <Icon name="BuildingStorefrontIcon" size={18} className="text-muted-foreground" />
          {canSell ? 'Open seller workspace' : 'Activate selling'}
        </Link>
        <button type="button" onClick={() => void logout()} disabled={signingOut} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-700 text-error hover:bg-error/10 disabled:opacity-50">
          <Icon name="ArrowRightOnRectangleIcon" size={18} /> {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f1f1f1] text-foreground dark:bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-3 shadow-sm backdrop-blur-xl sm:px-4">
        <button type="button" onClick={() => setMobileOpen(true)} className="ft-icon-button md:hidden" aria-label="Open buyer navigation">
          <Icon name="Bars3Icon" size={20} />
        </button>
        <div className="hidden min-w-0 md:block lg:w-48">
          <p className="truncate text-sm font-800 text-foreground">{activeItem.label}</p>
          <p className="truncate text-[11px] text-muted-foreground">{activeItem.description}</p>
        </div>
        <form onSubmit={searchMarketplace} className="hidden min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 md:flex md:max-w-xl">
          <Icon name="MagnifyingGlassIcon" size={17} className="text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search fabrics, colours, suppliers, GSM or SKU"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" className="text-xs font-800 text-primary">Search</button>
        </form>
        <Link href="/marketplace" className="ft-icon-button md:hidden" aria-label="Search marketplace">
          <Icon name="MagnifyingGlassIcon" size={18} />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <PreferenceControls compact />
          <button type="button" onClick={() => navigateTo('notifications')} className="ft-icon-button" aria-label="Open notifications">
            <Icon name="BellIcon" size={18} />
          </button>
          <ProfileMenu />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="hidden w-[240px] shrink-0 border-r border-border md:block">{sidebar}</aside>

        {mobileOpen && (
          <>
            <button type="button" className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close buyer navigation" />
            <aside className="fixed inset-y-0 left-0 z-50 w-[min(88vw,290px)] border-r border-border shadow-2xl md:hidden">
              <button type="button" onClick={() => setMobileOpen(false)} className="ft-icon-button absolute right-3 top-3 z-10" aria-label="Close buyer navigation">
                <Icon name="XMarkIcon" size={18} />
              </button>
              {sidebar}
            </aside>
          </>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto px-3 py-4 pb-24 sm:px-5 sm:py-6 lg:px-7">
          <div className="mx-auto max-w-[1440px]">
            {activeTab === 'overview' && (
              <section className="mb-5 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
                <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-800 text-success">
                      <Icon name="CheckBadgeIcon" size={15} /> {profile?.verification_status === 'verified' ? 'Verified account' : 'Account active'}
                    </span>
                    <h1 className="mt-3 text-3xl font-800 tracking-tight text-foreground">Welcome back, {buyerName}</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Search verified fabrics, submit orders, pay securely, download order documents and track delivery from one account.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link href="/marketplace" className="ft-primary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">
                        Browse products <Icon name="ArrowRightIcon" size={15} />
                      </Link>
                      <button type="button" onClick={() => navigateTo('orders')} className="ft-secondary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">
                        <Icon name="ShoppingBagIcon" size={16} /> View orders
                      </button>
                      <button type="button" onClick={() => navigateTo('requirements')} className="ft-secondary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">
                        <Icon name="MegaphoneIcon" size={16} /> Post requirement
                      </button>
                    </div>
                  </div>
                  <div className="grid min-w-60 grid-cols-2 gap-3 lg:grid-cols-1">
                    <div className="rounded-2xl border border-border bg-muted/40 p-4">
                      <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Buying as</p>
                      <p className="mt-1 text-sm font-800 text-foreground">{profile?.account_kind === 'business' ? profile.business_name || 'Business' : 'Personal buyer'}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/40 p-4">
                      <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Delivery location</p>
                      <p className="mt-1 text-sm font-800 text-foreground">{[profile?.city, profile?.state].filter(Boolean).join(', ') || 'Add address'}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
              {activeTab === 'overview' && <BuyerOverview onNavigate={navigateTo} />}
              {activeTab === 'orders' && <BuyerOrders />}
              {activeTab === 'tracking' && <BuyerTracking />}
              {activeTab === 'wishlist' && <BuyerWishlist />}
              {activeTab === 'disputes' && <DisputeMessaging mode="buyer" />}
              {activeTab === 'notifications' && <NotificationPreferences mode="buyer" />}
              {activeTab === 'requirements' && (
                <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                  <div>
                    <p className="text-xs font-800 uppercase tracking-wider text-primary">Buyer requirement board</p>
                    <h2 className="mt-2 text-2xl font-800 text-foreground">Tell verified sellers exactly what you need</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Add fabric type, GSM, width, colour, quantity, budget, state and deadline. Responses stay inside FabricTrad.</p>
                    <Link href="/buyer-requirements" className="ft-primary-action mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm">
                      <Icon name="PlusIcon" size={16} /> Open requirements board
                    </Link>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/40 p-5">
                    <Icon name="ShieldCheckIcon" size={25} className="text-success" />
                    <p className="mt-3 text-sm font-800 text-foreground">Account-scoped sourcing</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">Contact details remain protected while requirements, replies and orders stay tied to your verified account.</p>
                  </div>
                </div>
              )}
              {activeTab === 'account' && (
                <div>
                  <p className="text-xs font-800 uppercase tracking-wider text-primary">Account</p>
                  <h2 className="mt-2 text-2xl font-800 text-foreground">Profile, business and regional settings</h2>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ['Name', buyerName],
                      ['Email', user?.email || 'Not available'],
                      ['Phone', profile?.phone ? `+91 ${profile.phone}` : 'Add phone'],
                      ['Account type', profile?.account_kind || 'individual'],
                      ['Verification', profile?.verification_status || 'unverified'],
                      ['Location', [profile?.city, profile?.state].filter(Boolean).join(', ') || 'Add location'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-border bg-muted/40 p-4">
                        <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">{label}</p>
                        <p className="mt-1 break-words text-sm font-800 capitalize text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                  <Link href="/profile" className="ft-primary-action mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm">
                    Manage full profile <Icon name="ArrowRightIcon" size={15} />
                  </Link>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 p-1.5 backdrop-blur-xl md:hidden">
        {[
          { key: 'overview' as DashboardTab, label: 'Home', icon: 'HomeIcon' },
          { key: 'orders' as DashboardTab, label: 'Orders', icon: 'ShoppingBagIcon' },
          { key: 'tracking' as DashboardTab, label: 'Track', icon: 'TruckIcon' },
          { key: 'wishlist' as DashboardTab, label: 'Saved', icon: 'HeartIcon' },
          { key: 'account' as DashboardTab, label: 'Account', icon: 'UserCircleIcon' },
        ].map((item) => (
          <button key={item.key} type="button" onClick={() => navigateTo(item.key)} className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-800 ${activeTab === item.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
            <Icon name={item.icon as 'HomeIcon'} size={18} /> {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
