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

type DashboardTab = 'overview' | 'orders' | 'tracking' | 'wishlist' | 'requirements' | 'disputes' | 'notifications' | 'account';
type NavItem = { key: DashboardTab; label: string; icon: string; description: string };

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Purchases',
    items: [
      { key: 'overview', label: 'Your account', icon: 'HomeIcon', description: 'Orders and buying shortcuts' },
      { key: 'orders', label: 'Your orders', icon: 'ShoppingBagIcon', description: 'Payment, invoices and order status' },
      { key: 'tracking', label: 'Track packages', icon: 'TruckIcon', description: 'Shipment and delivery status' },
      { key: 'wishlist', label: 'Saved items', icon: 'HeartIcon', description: 'Saved fabrics and suppliers' },
    ],
  },
  {
    label: 'Sourcing',
    items: [
      { key: 'requirements', label: 'Sourcing requests', icon: 'MegaphoneIcon', description: 'Post what you need' },
      { key: 'disputes', label: 'Messages & disputes', icon: 'ChatBubbleLeftRightIcon', description: 'Seller and support conversations' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { key: 'notifications', label: 'Notifications', icon: 'BellIcon', description: 'Email and in-app preferences' },
      { key: 'account', label: 'Profile & addresses', icon: 'UserCircleIcon', description: 'Identity, delivery and business profile' },
    ],
  },
];

const allItems = navGroups.flatMap((group) => group.items);
const validTabs = allItems.map((item) => item.key);
const normaliseTab = (value: string | null): DashboardTab => validTabs.includes(value as DashboardTab) ? value as DashboardTab : 'overview';

export default function ModernBuyerDashboardLayout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => normaliseTab(searchParams.get('tab')));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => setActiveTab(normaliseTab(searchParams.get('tab'))), [searchParams]);

  const activeItem = useMemo(() => allItems.find((item) => item.key === activeTab) || allItems[0], [activeTab]);
  const buyerName = profile?.full_name || user?.email?.split('@')[0] || 'Buyer';

  const navigateTo = (tab: DashboardTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
    router.replace(tab === 'overview' ? '/buyer-dashboard' : `/buyer-dashboard?tab=${tab}`, { scroll: false });
  };

  const searchMarketplace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/marketplace?search=${encodeURIComponent(query)}` : '/marketplace');
  };

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try { await signOut(); } finally { window.location.replace('/login'); }
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#dde1e5] p-3 dark:border-border">
        <Link href="/marketplace" onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-white dark:hover:bg-muted">
          <AppLogo size={30} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-850 text-foreground">FabricTrad</p><p className="truncate text-[11px] text-muted-foreground">Buyer account</p></div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Buyer navigation">
        {navGroups.map((group) => (
          <section key={group.label} className="mb-4 last:mb-0">
            <p className="mb-1 px-2 text-[10px] font-850 uppercase tracking-[0.12em] text-muted-foreground">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = activeTab === item.key;
                return <button key={item.key} type="button" onClick={() => navigateTo(item.key)} aria-current={active ? 'page' : undefined} className={`flex min-h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[13px] font-700 transition ${active ? 'is-active bg-[#e7e8ea] text-foreground dark:bg-muted' : 'text-foreground/80 hover:bg-[#eceeef] hover:text-foreground dark:hover:bg-muted'}`}><Icon name={item.icon as 'HomeIcon'} size={17} className={active ? 'text-foreground' : 'text-muted-foreground'} /><span className="min-w-0 flex-1 truncate">{item.label}</span></button>;
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="space-y-1 border-t border-[#dde1e5] p-2 dark:border-border">
        <Link href="/marketplace" className="flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-700 text-foreground/80 hover:bg-white dark:hover:bg-muted"><Icon name="Squares2X2Icon" size={17} className="text-muted-foreground" /> Browse marketplace</Link>
        <Link href="/account" className="flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-700 text-foreground/80 hover:bg-white dark:hover:bg-muted"><Icon name="ArrowsRightLeftIcon" size={17} className="text-muted-foreground" /> Switch workspace</Link>
        <button type="button" onClick={() => void logout()} disabled={signingOut} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-750 text-error hover:bg-error/10 disabled:opacity-50"><Icon name="ArrowRightOnRectangleIcon" size={17} /> {signingOut ? 'Signing out…' : 'Sign out'}</button>
      </div>
    </div>
  );

  const overviewTiles = [
    { title: 'Your orders', copy: 'Pay accepted orders, download invoices and view order history.', icon: 'ShoppingBagIcon', tab: 'orders' as DashboardTab },
    { title: 'Track packages', copy: 'See dispatch and delivery progress for active shipments.', icon: 'TruckIcon', tab: 'tracking' as DashboardTab },
    { title: 'Saved items', copy: 'Return to fabrics and suppliers you saved while browsing.', icon: 'HeartIcon', tab: 'wishlist' as DashboardTab },
    { title: 'Sourcing requests', copy: 'Tell verified sellers exactly what you need and your deadline.', icon: 'MegaphoneIcon', tab: 'requirements' as DashboardTab },
    { title: 'Profile & addresses', copy: 'Keep your delivery, contact and business details current.', icon: 'MapPinIcon', tab: 'account' as DashboardTab },
    { title: 'Messages & disputes', copy: 'Keep seller conversations and support cases in one place.', icon: 'ChatBubbleLeftRightIcon', tab: 'disputes' as DashboardTab },
  ];

  return (
    <div className="ft-admin-shell ft-buyer-account">
      <header className="ft-admin-header sticky top-0 z-40 flex items-center gap-3 px-3 backdrop-blur-xl sm:px-4">
        <button type="button" onClick={() => setMobileOpen(true)} className="ft-icon-button md:hidden" aria-label="Open buyer navigation"><Icon name="Bars3Icon" size={20} /></button>
        <div className="hidden min-w-0 md:block lg:w-52"><p className="truncate text-sm font-850 text-foreground">{activeItem.label}</p><p className="truncate text-[11px] text-muted-foreground">{activeItem.description}</p></div>
        <form onSubmit={searchMarketplace} className="ft-admin-toolbar-search hidden min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 md:flex md:max-w-xl"><Icon name="MagnifyingGlassIcon" size={17} className="text-muted-foreground" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search FabricTrad products and suppliers" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" /><button type="submit" className="text-xs font-850 text-primary">Search</button></form>
        <Link href="/marketplace" className="ft-icon-button md:hidden" aria-label="Search marketplace"><Icon name="MagnifyingGlassIcon" size={18} /></Link>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/marketplace" className="ft-secondary-action hidden items-center gap-2 px-3 py-2 text-xs sm:inline-flex"><Icon name="Squares2X2Icon" size={15} /> Shop</Link>
          <Link href="/cart" className="ft-icon-button" aria-label="Open cart"><Icon name="ShoppingCartIcon" size={18} /></Link>
          <PreferenceControls compact />
          <button type="button" onClick={() => navigateTo('notifications')} className="ft-icon-button" aria-label="Open notifications"><Icon name="BellIcon" size={18} /></button>
          <ProfileMenu />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.75rem)]">
        <aside className="ft-admin-sidebar hidden shrink-0 md:block">{sidebar}</aside>
        {mobileOpen && <><button type="button" className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close buyer navigation" /><aside className="ft-admin-sidebar fixed inset-y-0 left-0 z-50 w-[min(88vw,290px)] shadow-2xl md:hidden"><button type="button" onClick={() => setMobileOpen(false)} className="ft-icon-button absolute right-3 top-3 z-10" aria-label="Close buyer navigation"><Icon name="XMarkIcon" size={18} /></button>{sidebar}</aside></>}

        <main className="ft-admin-main min-w-0 flex-1 overflow-y-auto px-3 pb-24 sm:px-5 lg:px-7">
          <div className="mx-auto">
            {activeTab === 'overview' && (
              <>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div><p className="text-xs font-800 text-muted-foreground">Your account</p><h1 className="ft-admin-page-title mt-1 text-2xl sm:text-3xl">Hi, {buyerName}</h1><p className="mt-1 text-sm text-muted-foreground">Manage purchases and get back to shopping quickly.</p></div>
                  <div className="flex flex-wrap gap-2"><Link href="/marketplace" className="ft-primary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">Continue shopping <Icon name="ArrowRightIcon" size={15} /></Link><button type="button" onClick={() => navigateTo('orders')} className="ft-secondary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm"><Icon name="ShoppingBagIcon" size={15} /> Orders</button></div>
                </div>

                <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {overviewTiles.map((tile) => <button key={tile.title} type="button" onClick={() => navigateTo(tile.tab)} className="ft-shopify-card flex items-start gap-4 p-5 text-left transition hover:border-[#b7bec7] hover:shadow-md"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name={tile.icon as 'ShoppingBagIcon'} size={20} /></span><span><span className="block text-base font-850 text-foreground">{tile.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{tile.copy}</span></span></button>)}
                </section>

                <section className="ft-shopify-card p-4 sm:p-6"><BuyerOverview onNavigate={navigateTo} /></section>
              </>
            )}

            {activeTab !== 'overview' && <section className="ft-shopify-card p-4 sm:p-6">
              {activeTab === 'orders' && <BuyerOrders />}
              {activeTab === 'tracking' && <BuyerTracking />}
              {activeTab === 'wishlist' && <BuyerWishlist />}
              {activeTab === 'disputes' && <DisputeMessaging mode="buyer" />}
              {activeTab === 'notifications' && <NotificationPreferences mode="buyer" />}
              {activeTab === 'requirements' && <div className="grid gap-5 lg:grid-cols-[1fr_320px]"><div><p className="text-xs font-850 uppercase tracking-wider text-primary">Sourcing requests</p><h2 className="mt-2 text-2xl font-850 text-foreground">Tell verified sellers exactly what you need</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Add fabric type, GSM, width, colour, quantity, budget, state and deadline. Responses stay inside FabricTrad.</p><Link href="/buyer-requirements" className="ft-primary-action mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm"><Icon name="PlusIcon" size={16} /> Open requirements board</Link></div><div className="rounded-xl border border-border bg-muted/30 p-5"><Icon name="ShieldCheckIcon" size={25} className="text-success" /><p className="mt-3 text-sm font-850 text-foreground">Account-scoped sourcing</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Requirements, responses and resulting orders stay associated with your verified account.</p></div></div>}
              {activeTab === 'account' && <div><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-850 uppercase tracking-wider text-primary">Account</p><h2 className="mt-2 text-2xl font-850 text-foreground">Profile, business and delivery settings</h2></div><Link href="/profile" className="ft-primary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">Edit profile <Icon name="ArrowRightIcon" size={15} /></Link></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
                ['Name', buyerName], ['Email', user?.email || 'Not available'], ['Phone', profile?.phone ? `+91 ${profile.phone}` : 'Add phone'], ['Account type', profile?.account_kind || 'individual'], ['Verification', profile?.verification_status || 'unverified'], ['Location', [profile?.city, profile?.state].filter(Boolean).join(', ') || 'Add location'],
              ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-muted/30 p-4"><p className="text-[11px] font-850 uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-800 capitalize text-foreground">{value}</p></div>)}</div></div>}
            </section>}
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
        ].map((item) => <button key={item.key} type="button" onClick={() => navigateTo(item.key)} className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-850 ${activeTab === item.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}><Icon name={item.icon as 'HomeIcon'} size={18} /> {item.label}</button>)}
      </nav>
    </div>
  );
}
