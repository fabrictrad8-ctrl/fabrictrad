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
import SellerAttentionCenter from '@/app/seller-dashboard/components/SellerAttentionCenter';
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
import SellerStoreIdentity from '@/app/seller-dashboard/components/SellerStoreIdentity';
import SellerDiscounts from '@/app/seller-dashboard/components/SellerDiscounts';
import CommerceNotificationBell from '@/app/components/CommerceNotificationBell';
import AiAssistantWidget from '@/components/AiAssistantWidget';
// Seller-only stylesheet. Kept out of src/app/layout.tsx on purpose so it is
// scoped to this route's bundle; every rule inside is scoped to .ft-seller-admin.
import '@/styles/seller-workspace-orders.css';
import ViewportFixedLayer from '@/components/ViewportFixedLayer';
import { focusTarget, withFocus } from '@/lib/focusTarget';

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
  | 'discounts'
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
      { key: 'orders', label: 'Orders', icon: 'ShoppingBagIcon', description: 'Payment, dispatch and fulfilment' },
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
      { key: 'discounts', label: 'Discounts & coupons', icon: 'TicketIcon', description: 'Your own shop and product offers' },
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
  orders: 'orders sales purchases payment dispatch ship fulfil fulfillment delivery status cancel',
  inventory: 'products inventory stock listings sku out of stock low stock restock unpublished draft',
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
  discounts: 'discounts coupons codes offers sale campaigns promotions',
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
  const [storeHandle, setStoreHandle] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setActiveTab(normaliseTab(searchParams.get('tab'))), [searchParams]);

  // A ?focus= link pasted, bookmarked or arrived at from elsewhere should behave
  // exactly like pressing the in-app button that produced it.
  useEffect(() => {
    const focus = searchParams.get('focus');
    if (focus) void focusTarget(focus);
  }, [searchParams]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetch('/api/seller/store', { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { storeHandle?: string } | null) => {
        if (!cancelled && payload?.storeHandle) setStoreHandle(payload.storeHandle);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
  const storefrontHref = storeHandle ? `/store/${storeHandle}` : `/marketplace?search=${encodeURIComponent(sellerName)}`;

  const canvasRef = useRef<HTMLElement>(null);

  const navigateTo = (tab: SellerTab, focus?: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    const base = tab === 'overview' ? '/seller-dashboard' : `/seller-dashboard?tab=${tab}`;
    router.replace(withFocus(base, focus), { scroll: false });
    // With a focus target, the destination control does the scrolling -- jumping
    // to the top first would drag the reader away from what they asked for.
    if (focus) {
      void focusTarget(focus);
      return;
    }
    // .ft-canvas-main is its own scroll container (overflow-y: auto), so neither
    // Next's scroll restoration nor window.scrollTo moves it -- switching tabs
    // left the reader exactly where they were. On a phone the attention panel
    // fills the viewport, so tapping "Connect payout bank" swapped the content
    // far below the fold and the screen simply did not change: the button read
    // as broken when the navigation had actually worked.
    canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
      <div className="ft-workspace-brand p-3">
        <Link href="/seller-dashboard" onClick={() => setSidebarOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-2">
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
            <p className="ft-workspace-group-label mb-1 px-2 text-[10px] font-850 uppercase tracking-[0.12em]">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigateTo(item.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`ft-workspace-nav-item flex min-h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[13px] ${active ? 'is-active' : ''}`}
                  >
                    <Icon name={item.icon as 'HomeIcon'} size={17} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        <button type="button" onClick={() => void logout()} disabled={signingOut} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-750 text-error transition hover:bg-error/10 disabled:opacity-50">
          <Icon name="ArrowRightOnRectangleIcon" size={17} /> {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="ft-workspace-shell ft-seller-admin">
      <div className="ft-workspace-shell-grid">
        <aside className="ft-dock hidden shrink-0 md:flex">{sidebar}</aside>

        {sidebarOpen && (
          <>
            <button type="button" className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close seller navigation" />
            <aside className="ft-dock is-drawer fixed inset-y-0 left-0 z-50 flex w-[min(88vw,290px)] shadow-2xl md:hidden">
              <button type="button" onClick={() => setSidebarOpen(false)} className="ft-icon-button absolute right-3 top-3 z-10" aria-label="Close seller navigation"><Icon name="XMarkIcon" size={18} /></button>
              {sidebar}
            </aside>
          </>
        )}

        <div className="ft-canvas">
          <header className="ft-dock-bar flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <button type="button" onClick={() => setSidebarOpen(true)} className="ft-icon-button md:hidden" aria-label="Open seller navigation"><Icon name="Bars3Icon" size={20} /></button>

            <div className="hidden min-w-0 lg:block lg:w-52">
              <p className="truncate text-sm font-850 text-foreground">{activeItem.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{activeItem.description}</p>
            </div>

            <form onSubmit={searchSellerTools} className="ft-workspace-search hidden min-h-10 min-w-[160px] flex-1 items-center gap-2 rounded-lg border px-3 lg:flex lg:max-w-xl">
              <Icon name="MagnifyingGlassIcon" size={17} className="text-muted-foreground" />
              <input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search seller tools: orders, products, payouts…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-750 text-muted-foreground xl:inline">Ctrl K</kbd>
              <button type="submit" className="text-xs font-850 text-primary">Go</button>
            </form>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-success/20 bg-success/5 px-2.5 py-1 text-[11px] font-800 text-success xl:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Store active</span>
              <Link href={storefrontHref} className="ft-secondary-action hidden items-center gap-2 px-3 py-2 text-xs xl:inline-flex"><Icon name="EyeIcon" size={15} /> View store</Link>
              <button type="button" onClick={() => navigateTo('upload')} className="ft-primary-action hidden items-center gap-2 px-3 py-2 text-xs md:inline-flex"><Icon name="PlusIcon" size={15} /> Add product</button>
              <div className="hidden sm:flex"><PreferenceControls compact /></div>
              <CommerceNotificationBell mode="seller" onClick={() => navigateTo('notifications')} label="Open seller notifications" />
              <ProfileMenu />
            </div>
          </header>

          <main ref={canvasRef} className="ft-canvas-main min-w-0 px-3 pb-24 pt-4 sm:px-5 lg:px-7">
          <div className="mx-auto">
            {/* Real blockers first, then the detailed verification checklist. */}
            <SellerAttentionCenter onNavigate={navigateTo} />
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
            {activeTab === 'discounts' && <SellerDiscounts />}
            {activeTab === 'billing' && <SellerBillingDocuments />}
            {activeTab === 'disputes' && <SellerDisputes />}
            {activeTab === 'notifications' && <NotificationPreferences mode="seller" />}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <SellerStoreIdentity />
                <section className="ft-glass-card p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><p className="text-xs font-850 uppercase tracking-wider text-primary">Business settings</p><h1 className="ft-admin-page-title mt-2 text-2xl">Legal, GST and fulfilment profile</h1></div>
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
              </div>
            )}
          </div>
          </main>
        </div>
      </div>

      {/* Portalled to <body>: this bar is position:fixed inside the routed
          page, so the route-enter transform made it anchor to the page scroll
          height instead of the screen -- the mobile audit measured it at
          top 3280px on a 780px viewport. */}
      <ViewportFixedLayer>
        <nav className="ft-workspace-tabbar fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 p-1.5 md:hidden">
          {[
            { key: 'overview' as SellerTab, label: 'Home', icon: 'HomeIcon' },
            { key: 'orders' as SellerTab, label: 'Orders', icon: 'ShoppingBagIcon' },
            { key: 'upload' as SellerTab, label: 'Add', icon: 'PlusCircleIcon' },
            { key: 'inventory' as SellerTab, label: 'Products', icon: 'ArchiveBoxIcon' },
            { key: 'earnings' as SellerTab, label: 'Payouts', icon: 'BanknotesIcon' },
          ].map((item) => (
            <button key={item.key} type="button" onClick={() => navigateTo(item.key)} className={`ft-workspace-tab flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-850 ${activeTab === item.key ? 'is-active' : ''}`}><Icon name={item.icon as 'HomeIcon'} size={18} /> {item.label}</button>
          ))}
        </nav>
      </ViewportFixedLayer>

      <AiAssistantWidget role="seller" context={`Seller is currently viewing: ${activeItem.label} (${activeItem.description})`} />
    </div>
  );
}
