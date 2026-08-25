'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import PreferenceControls from '@/components/PreferenceControls';
import ProfileMenu from '@/components/ProfileMenu';
import { useAuth } from '@/contexts/AuthContext';
import SellerOverview from '@/app/seller-dashboard/components/SellerOverview';
import SellerOrders from '@/app/seller-dashboard/components/SellerOrders';

import SellerInventory from '@/app/seller-dashboard/components/SellerInventory';
import SellerVariantCatalog from '@/app/seller-dashboard/components/SellerVariantCatalog';
import SellerCatalogPricing from '@/app/seller-dashboard/components/SellerCatalogPricing';
import SellerAnalytics from '@/app/seller-dashboard/components/SellerAnalytics';
import SellerCatalogAssistant from '@/app/seller-dashboard/components/SellerCatalogAssistant';
import SellerProfileReadiness from '@/app/seller-dashboard/components/SellerProfileReadiness';
import SellerEarnings from '@/app/seller-dashboard/components/SellerEarnings';
import SellerDisputes from '@/app/seller-dashboard/components/SellerDisputes';
import SellerFulfillment from '@/app/seller-dashboard/components/SellerFulfillment';
import NotificationPreferences from '@/app/components/NotificationPreferences';
import SellerCategories from '@/app/seller-dashboard/components/SellerCategories';
import SellerCourierSettings from '@/app/seller-dashboard/components/SellerCourierSettings';
import SellerInbox from '@/app/seller-dashboard/components/SellerInbox';
import SellerBuyerRequests from '@/app/seller-dashboard/components/SellerBuyerRequests';
import SellerBillingDocuments from '@/app/seller-dashboard/components/SellerBillingDocuments';

type SellerTab =
  | 'overview' |'orders' |'inventory' |'variants' |'catalogs' |'upload' |'requests' |'inbox' |'fulfillment' |'courier' |'earnings' |'analytics' |'categories' |'billing' |'disputes' |'notifications' |'profile';

type NavItem = { key: SellerTab; label: string; icon: string; description: string };

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: '',
    items: [
      { key: 'overview', label: 'Home', icon: 'HomeIcon', description: 'Store health and next actions' },
      { key: 'orders', label: 'Orders', icon: 'ShoppingBagIcon', description: 'Accept, payment and fulfilment' },
    ],
  },
  {
    label: 'Products',
    items: [
      { key: 'inventory', label: 'Products', icon: 'ArchiveBoxIcon', description: 'Listings and inventory' },
      { key: 'upload', label: 'Add product', icon: 'PlusCircleIcon', description: 'AI-assisted catalogue creation' },
      { key: 'variants', label: 'Variants', icon: 'SwatchIcon', description: 'Colours, designs and GTIN' },
      { key: 'catalogs', label: 'Catalogues & pricing', icon: 'TagIcon', description: 'MOQ and buyer pricing' },
      { key: 'categories', label: 'Categories', icon: 'Squares2X2Icon', description: 'Product organization' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { key: 'requests', label: 'Buyer requests', icon: 'MegaphoneIcon', description: 'Open sourcing requirements' },
      { key: 'inbox', label: 'Inbox', icon: 'ChatBubbleLeftRightIcon', description: 'Buyer conversations' },
      { key: 'disputes', label: 'Returns & disputes', icon: 'FlagIcon', description: 'Claims and resolutions' },
    ],
  },
  {
    label: 'Finances',
    items: [
      { key: 'earnings', label: 'Earnings & payouts', icon: 'BanknotesIcon', description: 'Captured payments and settlements' },
      { key: 'billing', label: 'Invoices & documents', icon: 'DocumentTextIcon', description: 'Automatic invoices and manual documents' },
      { key: 'analytics', label: 'Analytics', icon: 'ChartBarIcon', description: 'Sales and product performance' },
    ],
  },
  {
    label: 'Fulfilment',
    items: [
      { key: 'fulfillment', label: 'Shipments', icon: 'TruckIcon', description: 'Dispatch and tracking' },
      { key: 'courier', label: 'Shipping settings', icon: 'MapPinIcon', description: 'Pickup and courier configuration' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { key: 'notifications', label: 'Notifications', icon: 'BellIcon', description: 'Email and in-app alerts' },
      { key: 'profile', label: 'Business settings', icon: 'BuildingOfficeIcon', description: 'GST, bank and store profile' },
    ],
  },
];

const allItems = navGroups.flatMap((group) => group.items);
const validTabs = allItems.map((item) => item.key);
const normaliseTab = (value: string | null): SellerTab =>
  validTabs.includes(value as SellerTab) ? (value as SellerTab) : 'overview';

const sellerSearchAliases: Record<SellerTab, string> = {
  overview: 'home overview store health tasks setup',
  orders: 'orders sales purchases accept payment fulfil fulfillment status',
  inventory: 'products inventory stock listings sku',
  variants: 'variants colours colors designs gtin options',
  catalogs: 'catalog catalogue pricing price moq wholesale breaks',
  upload: 'add create upload new product listing ai',
  requests: 'buyer requests sourcing requirements leads',
  inbox: 'inbox messages chat conversations buyers',
  fulfillment: 'shipments dispatch tracking fulfilment fulfillment delivery',
  courier: 'shipping courier pickup logistics settings',
  earnings: 'earnings payouts settlements money finance',
  analytics: 'analytics reports performance sales metrics',
  categories: 'categories organization taxonomy product groups',
  billing: 'billing invoices documents receipts gst invoice',
  disputes: 'returns disputes exchanges claims refunds',
  notifications: 'notifications alerts email sms settings',
  profile: 'business settings profile gst bank address identity',
};

const tabTitles: Record<SellerTab, string> = {
  overview: 'Home',
  orders: 'Orders',
  inventory: 'Products',
  variants: 'Variants',
  catalogs: 'Catalogues & Pricing',
  upload: 'Add Product',
  requests: 'Buyer Requests',
  inbox: 'Inbox',
  fulfillment: 'Shipments',
  courier: 'Shipping Settings',
  earnings: 'Earnings & Payouts',
  analytics: 'Analytics',
  categories: 'Categories',
  billing: 'Invoices & Documents',
  disputes: 'Returns & Disputes',
  notifications: 'Notifications',
  profile: 'Business Settings',
};

export default function SellerDashboardLayout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<SellerTab>(() => normaliseTab(searchParams.get('tab')));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setActiveTab(normaliseTab(searchParams.get('tab'))), [searchParams]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const _activeItem = useMemo(() => allItems.find((item) => item.key === activeTab) || allItems[0], [activeTab]);
  const sellerName = profile?.business_name || profile?.full_name || user?.email?.split('@')[0] || 'Seller';
  const storefrontHref = `/marketplace?search=${encodeURIComponent(sellerName)}`;

  const navigateTo = (tab: SellerTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    router.replace(tab === 'overview' ? '/seller-dashboard' : `/seller-dashboard?tab=${tab}`, { scroll: false });
  };

  const searchSellerTools = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim().toLowerCase();
    if (!query) return;
    const match = allItems.find((item) =>
      `${item.label} ${item.description} ${sellerSearchAliases[item.key]}`.toLowerCase().includes(query)
    );
    if (match) {
      navigateTo(match.key);
      setSearch('');
      return;
    }
    setSearch('');
    searchRef.current?.blur();
  };

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try { await signOut(); } finally { window.location.replace('/login'); }
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-[#1a1f2e] text-white">
      {/* Store header */}
      <div className="border-b border-white/10 px-3 py-3">
        <Link
          href="/seller-dashboard"
          onClick={() => setSidebarOpen(false)}
          className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/10"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#008060]">
            <AppLogo size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-700 text-white">{sellerName}</p>
            <p className="truncate text-[11px] text-white/50">FabricTrad merchant</p>
          </div>
          <Icon name="ChevronUpDownIcon" size={14} className="text-white/40" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Seller navigation">
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
                        ? 'bg-[#008060] text-white shadow-sm'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon
                      name={item.icon as 'HomeIcon'}
                      size={16}
                      className={active ? 'text-white' : 'text-white/50 group-hover:text-white/80'}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
          href={storefrontHref}
          className="flex min-h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-600 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <Icon name="EyeIcon" size={16} className="text-white/40" />
          View storefront
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
    <div className="min-h-screen bg-[#f6f6f7] text-foreground dark:bg-background">
      {/* Top header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[#e1e3e5] bg-white/95 px-3 shadow-sm backdrop-blur-xl dark:border-border dark:bg-card/95 sm:px-4">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
          aria-label="Open seller navigation"
        >
          <Icon name="Bars3Icon" size={20} />
        </button>

        {/* Breadcrumb */}
        <div className="hidden min-w-0 md:flex md:items-center md:gap-2">
          <span className="text-sm text-muted-foreground">Seller</span>
          <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground/50" />
          <span className="text-sm font-700 text-foreground">{tabTitles[activeTab]}</span>
        </div>

        {/* Search */}
        <form
          onSubmit={searchSellerTools}
          className="hidden min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e1e3e5] bg-[#f6f6f7] px-3 md:flex md:max-w-md"
        >
          <Icon name="MagnifyingGlassIcon" size={16} className="text-muted-foreground" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search seller tools…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-[#e1e3e5] bg-white px-1.5 py-0.5 text-[10px] font-600 text-muted-foreground lg:inline">
            ⌘K
          </kbd>
        </form>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Store status badge */}
          <span className="hidden items-center gap-1.5 rounded-full border border-[#008060]/20 bg-[#008060]/5 px-2.5 py-1 text-[11px] font-700 text-[#008060] lg:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#008060]" />
            Store active
          </span>
          <Link
            href={storefrontHref}
            className="hidden items-center gap-1.5 rounded-lg border border-[#e1e3e5] bg-white px-3 py-1.5 text-xs font-600 text-foreground shadow-sm hover:bg-gray-50 lg:inline-flex"
          >
            <Icon name="EyeIcon" size={14} />
            View store
          </Link>
          <button
            type="button"
            onClick={() => navigateTo('upload')}
            className="hidden items-center gap-1.5 rounded-lg bg-[#008060] px-3 py-1.5 text-xs font-700 text-white shadow-sm hover:bg-[#006e52] sm:inline-flex"
          >
            <Icon name="PlusIcon" size={14} />
            Add product
          </button>
          <PreferenceControls compact />
          <button
            type="button"
            onClick={() => navigateTo('notifications')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Notifications"
          >
            <Icon name="BellIcon" size={18} />
          </button>
          <ProfileMenu />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Desktop sidebar */}
        <aside className="hidden w-[220px] shrink-0 md:block">{sidebar}</aside>

        {/* Mobile sidebar */}
        {sidebarOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation"
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-[min(88vw,260px)] shadow-2xl md:hidden">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
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
          <div className="mx-auto max-w-[1600px] px-4 py-5 pb-24 sm:px-6 lg:px-8">
            {activeTab === 'overview' && <SellerOverview onNavigate={navigateTo} />}
            {activeTab === 'orders' && <SellerOrders />}
            {activeTab === 'inventory' && <SellerInventory />}
            {activeTab === 'variants' && <SellerVariantCatalog />}
            {activeTab === 'catalogs' && <SellerCatalogPricing />}
            {activeTab === 'upload' && <SellerCatalogAssistant />}
            {activeTab === 'requests' && <SellerBuyerRequests />}
            {activeTab === 'inbox' && <SellerInbox />}
            {activeTab === 'fulfillment' && <SellerFulfillment />}
            {activeTab === 'courier' && <SellerCourierSettings />}
            {activeTab === 'earnings' && <SellerEarnings />}
            {activeTab === 'analytics' && <SellerAnalytics />}
            {activeTab === 'categories' && <SellerCategories />}
            {activeTab === 'billing' && <SellerBillingDocuments />}
            {activeTab === 'disputes' && <SellerDisputes />}
            {activeTab === 'notifications' && <NotificationPreferences mode="seller" />}
            {activeTab === 'profile' && <SellerProfileReadiness />}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#e1e3e5] bg-white/95 p-1.5 backdrop-blur-xl md:hidden">
        {[
          { key: 'overview' as SellerTab, label: 'Home', icon: 'HomeIcon' },
          { key: 'orders' as SellerTab, label: 'Orders', icon: 'ShoppingBagIcon' },
          { key: 'inventory' as SellerTab, label: 'Products', icon: 'ArchiveBoxIcon' },
          { key: 'analytics' as SellerTab, label: 'Analytics', icon: 'ChartBarIcon' },
          { key: 'earnings' as SellerTab, label: 'Earnings', icon: 'BanknotesIcon' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => navigateTo(item.key)}
            className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-700 transition ${
              activeTab === item.key ? 'bg-[#008060]/10 text-[#008060]' : 'text-muted-foreground'
            }`}
          >
            <Icon name={item.icon as 'HomeIcon'} size={18} />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
