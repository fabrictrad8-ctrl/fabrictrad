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
import DisputeMessaging from '@/app/buyer-dashboard/components/DisputeMessaging';
import NotificationPreferences from '@/app/components/NotificationPreferences';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/lib/hooks/useCart';

type DashboardTab = 'overview' | 'orders' | 'tracking' | 'cart' | 'requirements' | 'disputes' | 'notifications' | 'account';
type NavItem = { key: DashboardTab; label: string; icon: string; description: string };

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: '',
    items: [
      { key: 'overview', label: 'Your account', icon: 'HomeIcon', description: 'Orders and buying shortcuts' },
      { key: 'orders', label: 'Your orders', icon: 'ShoppingBagIcon', description: 'Payment, invoices and order status' },
      { key: 'tracking', label: 'Track packages', icon: 'TruckIcon', description: 'Shipment and delivery status' },
      { key: 'cart', label: 'Cart', icon: 'ShoppingCartIcon', description: 'Products to review before ordering' },
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
    label: 'Account',
    items: [
      { key: 'notifications', label: 'Notifications', icon: 'BellIcon', description: 'Email and in-app preferences' },
      { key: 'account', label: 'Profile & addresses', icon: 'UserCircleIcon', description: 'Identity, delivery and business profile' },
    ],
  },
];

const allItems = navGroups.flatMap((group) => group.items);
const validTabs = allItems.map((item) => item.key);
const normaliseTab = (value: string | null): DashboardTab =>
  validTabs.includes(value as DashboardTab) ? (value as DashboardTab) : 'overview';
const money = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

const tabTitles: Record<DashboardTab, string> = {
  overview: 'Your Account',
  orders: 'Your Orders',
  tracking: 'Track Packages',
  cart: 'Cart',
  requirements: 'Sourcing Requests',
  disputes: 'Messages & Disputes',
  notifications: 'Notifications',
  account: 'Profile & Addresses',
};

export default function ModernBuyerDashboardLayout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, signOut } = useAuth();
  const { items: cartItems, lineCount, estimatedTotal } = useCart();
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
    <div className="flex h-full flex-col bg-[#131921] text-white">
      {/* Account header */}
      <div className="border-b border-white/10 px-3 py-3">
        <Link
          href="/marketplace"
          onClick={() => setMobileOpen(false)}
          className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/10"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#febd69]">
            <AppLogo size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-700 text-white">FabricTrad</p>
            <p className="truncate text-[11px] text-white/50">Buyer account</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Buyer navigation">
        {navGroups.map((group) => (
          <div key={group.label || 'top'} className="mb-5 last:mb-0">
            {group.label && (
              <p className="mb-1.5 px-3 text-[10px] font-700 uppercase tracking-[0.15em] text-white/40">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigateTo(item.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex min-h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-600 transition-all ${
                      active
                        ? 'bg-[#febd69] text-[#131921] shadow-sm'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon
                      name={item.icon as 'HomeIcon'}
                      size={16}
                      className={active ? 'text-[#131921]' : 'text-white/50 group-hover:text-white/80'}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.key === 'cart' && lineCount > 0 && (
                      <span className="rounded-full bg-[#febd69] px-1.5 py-0.5 text-[10px] font-700 text-[#131921]">
                        {lineCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-2 space-y-0.5">
        <Link
          href="/marketplace"
          className="flex min-h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-600 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <Icon name="Squares2X2Icon" size={16} className="text-white/40" />
          Browse marketplace
        </Link>
        <Link
          href="/account"
          className="flex min-h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-600 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <Icon name="ArrowsRightLeftIcon" size={16} className="text-white/40" />
          Switch workspace
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={signingOut}
          className="flex min-h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-600 text-red-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
        >
          <Icon name="ArrowRightOnRectangleIcon" size={16} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f3f3f3] text-foreground dark:bg-background">
      {/* Amazon-style top header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-[#131921] px-3 sm:px-4">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 md:hidden"
          aria-label="Open buyer navigation"
        >
          <Icon name="Bars3Icon" size={20} />
        </button>

        {/* Logo */}
        <Link href="/buyer-dashboard" className="hidden shrink-0 items-center gap-2 md:flex">
          <AppLogo size={28} />
          <span className="text-sm font-700 text-white">FabricTrad</span>
        </Link>

        {/* Search bar — Amazon style */}
        <form
          onSubmit={searchMarketplace}
          className="flex min-h-10 min-w-0 flex-1 items-center overflow-hidden rounded-lg bg-white md:max-w-2xl"
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search FabricTrad products and suppliers"
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#febd69] text-[#131921] hover:bg-[#f3a847]"
            aria-label="Search"
          >
            <Icon name="MagnifyingGlassIcon" size={18} />
          </button>
        </form>

        <div className="ml-auto flex items-center gap-1">
          <PreferenceControls compact />
          <button
            type="button"
            onClick={() => navigateTo('notifications')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10"
            aria-label="Notifications"
          >
            <Icon name="BellIcon" size={18} />
          </button>
          <Link
            href="/cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10"
            aria-label={`Cart (${lineCount})`}
          >
            <Icon name="ShoppingCartIcon" size={18} />
            {lineCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#febd69] px-1 text-[9px] font-700 text-[#131921]">
                {lineCount}
              </span>
            )}
          </Link>
          <ProfileMenu />
        </div>
      </header>

      {/* Secondary nav bar */}
      <div className="sticky top-14 z-30 flex h-9 items-center gap-4 overflow-x-auto bg-[#232f3e] px-4 scrollbar-none">
        {[
          { key: 'overview' as DashboardTab, label: 'Account' },
          { key: 'orders' as DashboardTab, label: 'Orders' },
          { key: 'tracking' as DashboardTab, label: 'Track packages' },
          { key: 'requirements' as DashboardTab, label: 'Sourcing requests' },
          { key: 'disputes' as DashboardTab, label: 'Messages' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => navigateTo(item.key)}
            className={`shrink-0 text-xs font-600 transition ${
              activeTab === item.key
                ? 'text-[#febd69] underline underline-offset-4'
                : 'text-white/70 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
        <Link
          href="/marketplace"
          className="ml-auto shrink-0 text-xs font-600 text-white/70 hover:text-white"
        >
          Browse marketplace →
        </Link>
      </div>

      <div className="flex min-h-[calc(100vh-5.25rem)]">
        {/* Desktop sidebar */}
        <aside className="hidden w-[220px] shrink-0 md:block">{sidebar}</aside>

        {/* Mobile sidebar */}
        {mobileOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-[min(88vw,260px)] shadow-2xl md:hidden">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white"
                aria-label="Close navigation"
              >
                <Icon name="XMarkIcon" size={16} />
              </button>
              {sidebar}
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-5 pb-24 sm:px-6">
            {activeTab === 'overview' && (
              <>
                {/* Account overview header */}
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-600 text-muted-foreground">Your account</p>
                    <h1 className="mt-1 text-2xl font-700 text-foreground">Hello, {buyerName}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Manage purchases and get back to shopping quickly.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/marketplace"
                      className="flex items-center gap-2 rounded-lg bg-[#febd69] px-4 py-2 text-sm font-700 text-[#131921] shadow-sm hover:bg-[#f3a847]"
                    >
                      Continue shopping
                      <Icon name="ArrowRightIcon" size={14} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => navigateTo('orders')}
                      className="flex items-center gap-2 rounded-lg border border-[#e1e3e5] bg-white px-4 py-2 text-sm font-600 text-foreground shadow-sm hover:bg-gray-50"
                    >
                      <Icon name="ShoppingBagIcon" size={14} />
                      Orders
                    </button>
                  </div>
                </div>

                {/* Quick access tiles */}
                <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    { title: 'Your orders', copy: 'Pay accepted orders, download invoices and view order history.', icon: 'ShoppingBagIcon', tab: 'orders' as DashboardTab, color: 'bg-[#febd69]/20 text-[#131921]' },
                    { title: 'Track packages', copy: 'See dispatch and delivery progress for active shipments.', icon: 'TruckIcon', tab: 'tracking' as DashboardTab, color: 'bg-blue-50 text-blue-700' },
                    { title: 'Cart', copy: lineCount ? `${lineCount} product${lineCount === 1 ? '' : 's'} waiting for review.` : 'Keep products together before placing order requests.', icon: 'ShoppingCartIcon', tab: 'cart' as DashboardTab, color: 'bg-[#008060]/10 text-[#008060]' },
                    { title: 'Sourcing requests', copy: 'Tell verified sellers exactly what you need and your deadline.', icon: 'MegaphoneIcon', tab: 'requirements' as DashboardTab, color: 'bg-purple-50 text-purple-700' },
                    { title: 'Profile & addresses', copy: 'Keep your delivery, contact and business details current.', icon: 'MapPinIcon', tab: 'account' as DashboardTab, color: 'bg-amber-50 text-amber-700' },
                    { title: 'Messages & disputes', copy: 'Keep seller conversations and support cases in one place.', icon: 'ChatBubbleLeftRightIcon', tab: 'disputes' as DashboardTab, color: 'bg-rose-50 text-rose-700' },
                  ].map((tile) => (
                    <button
                      key={tile.title}
                      type="button"
                      onClick={() => navigateTo(tile.tab)}
                      className="flex items-start gap-4 rounded-xl border border-[#e1e3e5] bg-white p-5 text-left shadow-sm transition hover:border-[#c8c8c8] hover:shadow-md"
                    >
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile.color}`}>
                        <Icon name={tile.icon as 'ShoppingBagIcon'} size={20} />
                      </span>
                      <span>
                        <span className="block text-sm font-700 text-foreground">{tile.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{tile.copy}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {/* Overview content */}
                <div className="rounded-xl border border-[#e1e3e5] bg-white p-5 shadow-sm sm:p-6">
                  <BuyerOverview onNavigate={navigateTo} />
                </div>
              </>
            )}

            {activeTab !== 'overview' && (
              <div className="rounded-xl border border-[#e1e3e5] bg-white p-5 shadow-sm sm:p-6">
                {activeTab === 'orders' && <BuyerOrders />}
                {activeTab === 'tracking' && <BuyerTracking />}
                {activeTab === 'cart' && (
                  <div>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-600 uppercase tracking-wider text-[#febd69]">Cart</p>
                        <h2 className="mt-2 text-2xl font-700 text-foreground">Review products before you order</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {lineCount
                            ? `${lineCount} product${lineCount === 1 ? '' : 's'} · estimated ${money(estimatedTotal)}`
                            : 'Your cart is empty.'}
                        </p>
                      </div>
                      <Link
                        href="/cart"
                        className="flex items-center gap-2 rounded-lg bg-[#febd69] px-5 py-2.5 text-sm font-700 text-[#131921] hover:bg-[#f3a847]"
                      >
                        Open full cart <Icon name="ArrowRightIcon" size={14} />
                      </Link>
                    </div>
                    {lineCount > 0 ? (
                      <div className="mt-5 divide-y divide-[#f3f3f3] rounded-xl border border-[#e1e3e5]">
                        {cartItems.slice(0, 5).map((item) => (
                          <div key={item.key} className="flex items-center gap-3 p-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f3f3f3] text-muted-foreground">
                              <Icon name="ShoppingCartIcon" size={17} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-600 text-foreground">{item.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{item.quantity} {item.unit} · {item.seller}</span>
                            </span>
                            <span className="text-sm font-700 text-foreground">{money(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-6 rounded-xl border border-dashed border-[#e1e3e5] p-10 text-center">
                        <Icon name="ShoppingCartIcon" size={28} className="mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-sm font-600 text-foreground">Nothing in your cart yet</p>
                        <Link href="/marketplace" className="mt-2 inline-flex text-xs font-600 text-[#008060]">
                          Browse marketplace
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'disputes' && <DisputeMessaging mode="buyer" />}
                {activeTab === 'notifications' && <NotificationPreferences mode="buyer" />}
                {activeTab === 'requirements' && (
                  <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                    <div>
                      <p className="text-xs font-600 uppercase tracking-wider text-[#febd69]">Sourcing requests</p>
                      <h2 className="mt-2 text-2xl font-700 text-foreground">Tell verified sellers exactly what you need</h2>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Add fabric type, GSM, width, colour, quantity, budget, state and deadline. Responses stay inside FabricTrad.
                      </p>
                      <Link
                        href="/buyer-requirements"
                        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#febd69] px-5 py-3 text-sm font-700 text-[#131921] hover:bg-[#f3a847]"
                      >
                        <Icon name="PlusIcon" size={16} />
                        Open requirements board
                      </Link>
                    </div>
                    <div className="rounded-xl border border-[#e1e3e5] bg-[#f3f3f3] p-5">
                      <Icon name="ShieldCheckIcon" size={25} className="text-[#008060]" />
                      <p className="mt-3 text-sm font-700 text-foreground">Account-scoped sourcing</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Requirements, responses and resulting orders stay associated with your verified account.
                      </p>
                    </div>
                  </div>
                )}
                {activeTab === 'account' && (
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-600 uppercase tracking-wider text-[#febd69]">Account</p>
                        <h2 className="mt-2 text-2xl font-700 text-foreground">Profile, business and delivery settings</h2>
                      </div>
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 rounded-lg bg-[#febd69] px-4 py-2 text-sm font-700 text-[#131921] hover:bg-[#f3a847]"
                      >
                        Edit profile <Icon name="ArrowRightIcon" size={14} />
                      </Link>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ['Name', buyerName],
                        ['Email', user?.email || 'Not available'],
                        ['Phone', profile?.phone ? `+91 ${profile.phone}` : 'Add phone'],
                        ['Account type', profile?.account_kind || 'individual'],
                        ['Verification', profile?.verification_status || 'unverified'],
                        ['Location', [profile?.city, profile?.state].filter(Boolean).join(', ') || 'Add location'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-[#e1e3e5] bg-[#f3f3f3] p-4">
                          <p className="text-[11px] font-700 uppercase tracking-wider text-muted-foreground">{label}</p>
                          <p className="mt-1 break-words text-sm font-600 capitalize text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#e1e3e5] bg-white/95 p-1.5 backdrop-blur-xl md:hidden">
        {[
          { key: 'overview' as DashboardTab, label: 'Home', icon: 'HomeIcon' },
          { key: 'orders' as DashboardTab, label: 'Orders', icon: 'ShoppingBagIcon' },
          { key: 'tracking' as DashboardTab, label: 'Track', icon: 'TruckIcon' },
          { key: 'cart' as DashboardTab, label: 'Cart', icon: 'ShoppingCartIcon' },
          { key: 'account' as DashboardTab, label: 'Account', icon: 'UserCircleIcon' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => navigateTo(item.key)}
            className={`relative flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-700 transition ${
              activeTab === item.key ? 'bg-[#febd69]/20 text-[#131921]' : 'text-muted-foreground'
            }`}
          >
            <Icon name={item.icon as 'HomeIcon'} size={18} />
            {item.label}
            {item.key === 'cart' && lineCount > 0 && (
              <span className="absolute right-[22%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#febd69] px-1 text-[9px] font-700 text-[#131921]">
                {lineCount}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
