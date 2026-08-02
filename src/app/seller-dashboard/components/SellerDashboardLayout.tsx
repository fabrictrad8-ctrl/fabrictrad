'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
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

type NavItem = {
  key: SellerTab;
  label: string;
  icon: string;
  description: string;
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Home',
    items: [
      { key: 'overview', label: 'Home', icon: 'HomeIcon', description: 'Store health and next actions' },
      { key: 'orders', label: 'Orders', icon: 'ShoppingBagIcon', description: 'Accept, reject, invoice and fulfill' },
    ],
  },
  {
    label: 'Products',
    items: [
      { key: 'upload', label: 'Add product', icon: 'PlusCircleIcon', description: 'AI-assisted catalogue creation' },
      { key: 'inventory', label: 'Products', icon: 'ArchiveBoxIcon', description: 'Parent fabrics and stock' },
      { key: 'variants', label: 'Variants', icon: 'SwatchIcon', description: 'Colours, designs and GTIN' },
      { key: 'catalogs', label: 'Catalogues & pricing', icon: 'TagIcon', description: 'MOQ and buyer pricing' },
      { key: 'categories', label: 'Categories', icon: 'Squares2X2Icon', description: 'Product organization' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { key: 'requests', label: 'Buyer requests', icon: 'MegaphoneIcon', description: 'Open sourcing requirements' },
      { key: 'inbox', label: 'Inbox', icon: 'ChatBubbleLeftRightIcon', description: 'Buyer conversations' },
      { key: 'earnings', label: 'Earnings & payouts', icon: 'BanknotesIcon', description: 'Payments and settlements' },
      { key: 'analytics', label: 'Analytics', icon: 'ChartBarIcon', description: 'Sales and product performance' },
    ],
  },
  {
    label: 'Fulfillment',
    items: [
      { key: 'fulfillment', label: 'Shipments', icon: 'TruckIcon', description: 'Dispatch and tracking' },
      { key: 'courier', label: 'Shipping settings', icon: 'MapPinIcon', description: 'Pickup and courier configuration' },
      { key: 'billing', label: 'Invoices & documents', icon: 'DocumentTextIcon', description: 'Tax invoices and billing uploads' },
      { key: 'disputes', label: 'Returns & disputes', icon: 'FlagIcon', description: 'Claims and resolutions' },
    ],
  },
  {
    label: 'Account',
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

export default function SellerDashboardLayout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, isDemoAccount, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<SellerTab>(() => normaliseTab(searchParams.get('tab')));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setActiveTab(normaliseTab(searchParams.get('tab')));
  }, [searchParams]);

  const activeItem = useMemo(
    () => allItems.find((item) => item.key === activeTab) || allItems[0],
    [activeTab]
  );
  const sellerName = profile?.business_name || profile?.full_name || user?.email?.split('@')[0] || 'Seller';

  const navigateTo = (tab: SellerTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    router.replace(tab === 'overview' ? '/seller-dashboard' : `/seller-dashboard?tab=${tab}`, {
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
        <Link href="/seller-dashboard" onClick={() => setSidebarOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-card">
          <AppLogo size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-800 text-foreground">{sellerName}</p>
            <p className="truncate text-[11px] text-muted-foreground">FabricTrad seller</p>
          </div>
          <Icon name="ChevronUpDownIcon" size={15} className="text-muted-foreground" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Seller navigation">
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
          <Icon name="ShoppingBagIcon" size={18} className="text-muted-foreground" /> Buy fabrics
        </Link>
        <Link href="/buyer-dashboard" className="flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-650 text-foreground/80 hover:bg-card">
          <Icon name="UserCircleIcon" size={18} className="text-muted-foreground" /> Buyer workspace
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
        <button type="button" onClick={() => setSidebarOpen(true)} className="ft-icon-button md:hidden" aria-label="Open seller navigation">
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
            placeholder="Search marketplace products, suppliers, GSM or SKU"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" className="text-xs font-800 text-primary">Search</button>
        </form>
        <Link href="/marketplace" className="ft-icon-button md:hidden" aria-label="Search marketplace">
          <Icon name="MagnifyingGlassIcon" size={18} />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => navigateTo('upload')} className="ft-primary-action hidden items-center gap-2 px-3 py-2 text-xs sm:inline-flex">
            <Icon name="PlusIcon" size={15} /> Add product
          </button>
          <PreferenceControls compact />
          <button type="button" onClick={() => navigateTo('notifications')} className="ft-icon-button" aria-label="Open seller notifications">
            <Icon name="BellIcon" size={18} />
          </button>
          <ProfileMenu />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="hidden w-[240px] shrink-0 border-r border-border md:block">{sidebar}</aside>

        {sidebarOpen && (
          <>
            <button type="button" className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close seller navigation" />
            <aside className="fixed inset-y-0 left-0 z-50 w-[min(88vw,290px)] border-r border-border shadow-2xl md:hidden">
              <button type="button" onClick={() => setSidebarOpen(false)} className="ft-icon-button absolute right-3 top-3 z-10" aria-label="Close seller navigation">
                <Icon name="XMarkIcon" size={18} />
              </button>
              {sidebar}
            </aside>
          </>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto px-3 py-4 pb-24 sm:px-5 sm:py-6 lg:px-7">
          <div className="mx-auto max-w-[1500px]">
            <SellerProfileReadiness />
            {isDemoAccount && (
              <div className="mb-4 rounded-xl border border-secondary/20 bg-secondary/5 p-3 text-xs leading-5 text-muted-foreground">
                <strong className="text-secondary">Demo seller sandbox:</strong> real publishing, payments, fulfillment and billing require a verified production seller account.
              </div>
            )}

            {activeTab === 'overview' && <SellerOverview onNavigate={navigateTo} />}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <SellerCatalogOrders />
                <SellerOrders />
              </div>
            )}
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
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                <p className="text-xs font-800 uppercase tracking-wider text-primary">Business settings</p>
                <h1 className="mt-2 text-2xl font-800 text-foreground">Store identity, GST and fulfillment profile</h1>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['Business', profile?.business_name || sellerName],
                    ['Owner', profile?.full_name || 'Not added'],
                    ['Email', user?.email || 'Not available'],
                    ['Phone', profile?.phone ? `+91 ${profile.phone}` : 'Add phone'],
                    ['GSTIN', profile?.gstin || 'Add GSTIN'],
                    ['Location', [profile?.city, profile?.state].filter(Boolean).join(', ') || 'Add pickup location'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-border bg-muted/40 p-4">
                      <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className="mt-1 break-words text-sm font-800 text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
                <Link href="/profile?tab=business" className="ft-primary-action mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm">
                  Manage business profile <Icon name="ArrowRightIcon" size={15} />
                </Link>
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
          <button key={item.key} type="button" onClick={() => navigateTo(item.key)} className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-800 ${activeTab === item.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
            <Icon name={item.icon as 'HomeIcon'} size={18} /> {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
