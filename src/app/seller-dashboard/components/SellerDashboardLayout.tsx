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
import SellerCatalogOrders from '@/app/seller-dashboard/components/SellerCatalogOrders';
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
  | 'overview'
  | 'orders'
  | 'inventory'
  | 'variants'
  | 'catalogs'
  | 'upload'
  | 'requests'
  | 'inbox'
  | 'fulfillment'
  | 'courier'
  | 'earnings'
  | 'analytics'
  | 'categories'
  | 'billing'
  | 'disputes'
  | 'notifications'
  | 'profile';

type NavItem = { key: SellerTab; label: string; icon: string; description: string };

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Store',
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
const normaliseTab = (value: string | null): SellerTab => validTabs.includes(value as SellerTab) ? value as SellerTab : 'overview';
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

  const activeItem = useMemo(() => allItems.find((item) => item.key === activeTab) || allItems[0], [activeTab]);
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
    <div className="flex h-full flex-col">
      <div className="border-b border-[#dde1e5] p-3 dark:border-border">
        <Link href="/seller-dashboard" onClick={() => setSidebarOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-white dark:hover:bg-muted">
          <AppLogo size={30} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-850 text-foreground">{sellerName}</p>
            <p className="truncate text-[11px] text-muted-foreground">FabricTrad merchant</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Seller navigation">
        {navGroups.map((group) => (
          <section key={group.label} className="mb-4 last:mb-0">
            <p className="mb-1 px-2 text-[10px] font-850 uppercase tracking-[0.12em] text-muted-foreground">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigateTo(item.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[13px] font-700 transition ${active ? 'is-active bg-[#e7e8ea] text-foreground dark:bg-muted' : 'text-foreground/80 hover:bg-[#eceeef] hover:text-foreground dark:hover:bg-muted'}`}
                  >
                    <Icon name={item.icon as 'HomeIcon'} size={17} className={active ? 'text-foreground' : 'text-muted-foreground'} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-[#dde1e5] p-2 dark:border-border">
        <button type="button" onClick={() => void logout()} disabled={signingOut} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-750 text-error hover:bg-error/10 disabled:opacity-50">
          <Icon name="ArrowRightOnRectangleIcon" size={17} /> {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="ft-admin-shell ft-seller-admin">
      <header className="ft-admin-header sticky top-0 z-40 flex items-center gap-3 px-3 backdrop-blur-xl sm:px-4">
        <button type="button" onClick={() => setSidebarOpen(true)} className="ft-icon-button md:hidden" aria-label="Open seller navigation"><Icon name="Bars3Icon" size={20} /></button>

        <div className="hidden min-w-0 md:block lg:w-52">
          <p className="truncate text-sm font-850 text-foreground">{activeItem.label}</p>
          <p className="truncate text-[11px] text-muted-foreground">{activeItem.description}</p>
        </div>

        <form onSubmit={searchSellerTools} className="ft-admin-toolbar-search hidden min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 md:flex md:max-w-xl">
          <Icon name="MagnifyingGlassIcon" size={17} className="text-muted-foreground" />
          <input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search seller tools: orders, products, payouts…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-750 text-muted-foreground lg:inline">Ctrl K</kbd>
          <button type="submit" className="text-xs font-850 text-primary">Go</button>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-success/20 bg-success/5 px-2.5 py-1 text-[11px] font-800 text-success lg:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Store active</span>
          <Link href={storefrontHref} className="ft-secondary-action hidden items-center gap-2 px-3 py-2 text-xs lg:inline-flex"><Icon name="EyeIcon" size={15} /> View store</Link>
          <button type="button" onClick={() => navigateTo('upload')} className="ft-primary-action hidden items-center gap-2 px-3 py-2 text-xs sm:inline-flex"><Icon name="PlusIcon" size={15} /> Add product</button>
          <PreferenceControls compact />
          <button type="button" onClick={() => navigateTo('notifications')} className="ft-icon-button" aria-label="Open seller notifications"><Icon name="BellIcon" size={18} /></button>
          <ProfileMenu />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.75rem)]">
        <aside className="ft-admin-sidebar hidden shrink-0 md:block">{sidebar}</aside>

        {sidebarOpen && (
          <>
            <button type="button" className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close seller navigation" />
            <aside className="ft-admin-sidebar fixed inset-y-0 left-0 z-50 w-[min(88vw,290px)] shadow-2xl md:hidden">
              <button type="button" onClick={() => setSidebarOpen(false)} className="ft-icon-button absolute right-3 top-3 z-10" aria-label="Close seller navigation"><Icon name="XMarkIcon" size={18} /></button>
              {sidebar}
            </aside>
          </>
        )}

        <main className="ft-admin-main min-w-0 flex-1 overflow-y-auto px-3 pb-24 sm:px-5 lg:px-7">
          <div className="mx-auto">
            <SellerProfileReadiness />

            {activeTab === 'overview' && <SellerOverview onNavigate={navigateTo} />}
            {activeTab === 'orders' && <div className="space-y-5"><SellerCatalogOrders /><SellerOrders /></div>}
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
            {activeTab === 'profile' && (
              <section className="ft-shopify-card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="text-xs font-850 uppercase tracking-wider text-primary">Business settings</p><h1 className="ft-admin-page-title mt-2 text-2xl">Store identity, GST and fulfilment profile</h1></div>
                  <Link href="/profile?tab=business" className="ft-primary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">Edit settings <Icon name="ArrowRightIcon" size={15} /></Link>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['Business', profile?.business_name || sellerName],
                    ['Owner', profile?.full_name || 'Not added'],
                    ['Email', user?.email || 'Not available'],
                    ['Phone', profile?.phone ? `+91 ${profile.phone}` : 'Add phone'],
                    ['GSTIN', profile?.gstin || 'Add GSTIN'],
                    ['Location', [profile?.city, profile?.state].filter(Boolean).join(', ') || 'Add pickup location'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-border bg-muted/30 p-4"><p className="text-[11px] font-850 uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-800 text-foreground">{value}</p></div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 p-1.5 backdrop-blur-xl md:hidden">
        {[
          { key: 'overview' as SellerTab, label: 'Home', icon: 'HomeIcon' },
          { key: 'orders' as SellerTab, label: 'Orders', icon: 'ShoppingBagIcon' },
          { key: 'upload' as SellerTab, label: 'Add', icon: 'PlusCircleIcon' },
          { key: 'inventory' as SellerTab, label: 'Products', icon: 'ArchiveBoxIcon' },
          { key: 'earnings' as SellerTab, label: 'Payouts', icon: 'BanknotesIcon' },
        ].map((item) => (
          <button key={item.key} type="button" onClick={() => navigateTo(item.key)} className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-850 ${activeTab === item.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}><Icon name={item.icon as 'HomeIcon'} size={18} /> {item.label}</button>
        ))}
      </nav>
    </div>
  );
}
