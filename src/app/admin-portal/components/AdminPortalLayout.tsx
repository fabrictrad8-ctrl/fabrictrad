'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import PreferenceControls from '@/components/PreferenceControls';
import ProfileMenu from '@/components/ProfileMenu';
import { useAuth } from '@/contexts/AuthContext';
import AdminCommandSearch from '@/app/admin-portal/components/AdminCommandSearch';
import AdminDashboard from '@/app/admin-portal/components/AdminDashboard';
import AdminCustomers from '@/app/admin-portal/components/AdminCustomers';
import AdminSellers from '@/app/admin-portal/components/AdminSellers';
import AdminOrders from '@/app/admin-portal/components/AdminOrders';
import AdminBespokeOrders from '@/app/admin-portal/components/AdminBespokeOrders';
import AdminDiscounts from '@/app/admin-portal/components/AdminDiscounts';
import AdminSponsoredListings from '@/app/admin-portal/components/AdminSponsoredListings';
import AdminActivityFeed from '@/app/admin-portal/components/AdminActivityFeed';
import AdminListings from '@/app/admin-portal/components/AdminListings';
import AdminPayments from '@/app/admin-portal/components/AdminPayments';
import AdminSettings from '@/app/admin-portal/components/AdminSettings';
import AdminReconciliation from '@/app/admin-portal/components/AdminReconciliation';
import AdminTopSellers from '@/app/admin-portal/components/AdminTopSellers';
import AdminErrorMonitor from '@/app/admin-portal/components/AdminErrorMonitor';
import AdminFulfillmentAnalytics from '@/app/admin-portal/components/AdminFulfillmentAnalytics';
import AdminSellerMetrics from '@/app/admin-portal/components/AdminSellerMetrics';
import AdminAnalyticsCharts from '@/app/admin-portal/components/AdminAnalyticsCharts';
import AdminDisputes from '@/app/admin-portal/components/AdminDisputes';
import AiAssistantWidget from '@/components/AiAssistantWidget';
import '@/styles/admin-workspace-console.css';
import ViewportFixedLayer from '@/components/ViewportFixedLayer';

type AdminTab =
  | 'dashboard'
  | 'orders'
  | 'bespoke'
  | 'listings'
  | 'customers'
  | 'sellers'
  | 'payments'
  | 'disputes'
  | 'reconciliation'
  | 'fulfillment'
  | 'seller-metrics'
  | 'top-sellers'
  | 'discounts'
  | 'sponsored'
  | 'activity'
  | 'errors'
  | 'settings';

type NavItem = {
  key: AdminTab;
  label: string;
  icon: string;
  description: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { key: 'dashboard', label: 'Home', icon: 'HomeIcon', description: 'Live metrics and tasks' },
      { key: 'activity', label: 'Activity', icon: 'BoltIcon', description: 'Operational timeline' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { key: 'orders', label: 'Orders', icon: 'ShoppingBagIcon', description: 'Payment and fulfillment state' },
      { key: 'bespoke', label: 'Custom orders', icon: 'ScissorsIcon', description: 'Tailoring, trials and approvals' },
      { key: 'listings', label: 'Products', icon: 'TagIcon', description: 'Listings, inventory and GTIN' },
      { key: 'customers', label: 'Customers', icon: 'UsersIcon', description: 'Buyer and business accounts' },
      { key: 'sellers', label: 'Sellers', icon: 'BuildingStorefrontIcon', description: 'Verification and eligibility' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: 'payments', label: 'Payments', icon: 'CreditCardIcon', description: 'Captures, failures and refunds' },
      { key: 'disputes', label: 'Returns & disputes', icon: 'ChatBubbleLeftRightIcon', description: 'Evidence, resolutions and refund reviews' },
      { key: 'reconciliation', label: 'Reconciliation', icon: 'ArrowsRightLeftIcon', description: 'Commission and settlements' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'fulfillment', label: 'Fulfillment', icon: 'TruckIcon', description: 'Shipments and delivery' },
      { key: 'seller-metrics', label: 'Analytics', icon: 'PresentationChartLineIcon', description: 'Seller performance' },
      { key: 'top-sellers', label: 'Top sellers', icon: 'TrophyIcon', description: 'Marketplace leaders' },
      { key: 'discounts', label: 'Discounts', icon: 'ReceiptPercentIcon', description: 'Campaigns and promotions' },
      { key: 'sponsored', label: 'Sponsored Listings', icon: 'MegaphoneIcon', description: 'Paid placement in the marketplace grid' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { key: 'errors', label: 'Error monitor', icon: 'ExclamationTriangleIcon', description: 'Runtime and webhook issues' },
      { key: 'settings', label: 'Settings', icon: 'CogIcon', description: 'Platform policy and controls' },
    ],
  },
];

const flatItems = navGroups.flatMap((group) => group.items);
const validTabs = flatItems.map((item) => item.key);
const normaliseTab = (value: string | null): AdminTab =>
  validTabs.includes(value as AdminTab) ? (value as AdminTab) : 'dashboard';

export default function AdminPortalLayout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => normaliseTab(searchParams.get('tab')));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setActiveTab(normaliseTab(searchParams.get('tab')));
  }, [searchParams]);

  const activeItem = useMemo(
    () => flatItems.find((item) => item.key === activeTab) || flatItems[0],
    [activeTab]
  );

  const canvasRef = useRef<HTMLElement>(null);

  const navigateTo = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    router.replace(tab === 'dashboard' ? '/admin-portal' : `/admin-portal?tab=${tab}`, {
      scroll: false,
    });
    // The workspace main element is its own scroll container, so neither Next's
    // scroll restoration nor the window position moves it and switching tabs left
    // the reader where they were. On a phone that reads as a dead button: the
    // content changed far below the fold and the screen did not.
    canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      window.location.replace('/admin-login');
    }
  };

  const adminName = profile?.full_name || user?.email?.split('@')[0] || 'Administrator';

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="ft-workspace-brand px-3 py-3">
        <Link href="/admin-portal" onClick={() => setSidebarOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-2">
          <AppLogo size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-800 text-foreground">Commerce administration</p>
          </div>
          <Icon name="ChevronUpDownIcon" size={15} className="text-muted-foreground" />
        </Link>
      </div>

      <nav className="ft-sidebar-scroll flex-1 overflow-y-auto px-2 py-3" aria-label="Administrator navigation">
        {navGroups.map((group) => (
          <section key={group.label} className="mb-4 last:mb-0">
            <p className="ft-workspace-group-label mb-1 px-2 text-[10px] font-800 uppercase tracking-[0.14em]">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigateTo(item.key)}
                  className={`ft-workspace-nav-item flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-650 ${activeTab === item.key ? 'is-active' : ''}`}
                >
                  <Icon name={item.icon as 'HomeIcon'} size={18} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="space-y-1 border-t border-border p-2">
        <Link href="/marketplace" className="ft-workspace-footer-link flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-650">
          <Icon name="ArrowTopRightOnSquareIcon" size={18} />
          View marketplace
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={signingOut}
          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-700 text-error transition hover:bg-error/10 disabled:opacity-50"
        >
          <Icon name="ArrowRightOnRectangleIcon" size={18} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="ft-workspace-shell">
      <div className="ft-workspace-shell-grid">
        <aside className="ft-dock hidden w-[240px] shrink-0 md:flex">{sidebar}</aside>

        {sidebarOpen && (
          <>
            <button type="button" className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close admin navigation" />
            <aside className="ft-dock is-drawer fixed inset-y-0 left-0 z-50 flex w-[min(88vw,290px)] shadow-2xl md:hidden">
              <button type="button" onClick={() => setSidebarOpen(false)} className="ft-icon-button absolute right-3 top-3 z-10" aria-label="Close admin navigation">
                <Icon name="XMarkIcon" size={18} />
              </button>
              {sidebar}
            </aside>
          </>
        )}

        <div className="ft-canvas">
          <header className="ft-dock-bar flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <button type="button" onClick={() => setSidebarOpen(true)} className="ft-icon-button min-h-10 min-w-10 shrink-0 justify-center md:!hidden" aria-label="Open admin navigation">
              <Icon name="Bars3Icon" size={20} />
            </button>

            <div className="hidden min-w-0 lg:block lg:w-52">
              <p className="truncate text-sm font-800 text-foreground">{activeItem.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{activeItem.description}</p>
            </div>

            <AdminCommandSearch />

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:flex"><PreferenceControls compact /></div>
              {/* No unread badge: nothing in this layout tracks unread state,
                  so a permanent red dot was a standing false alarm. The
                  Home tab's action centre carries the real counts. */}
              <button type="button" onClick={() => navigateTo('activity')} className="ft-icon-button" aria-label="Open the activity timeline">
                <Icon name="BellIcon" size={18} />
              </button>
              <ProfileMenu />
            </div>
          </header>

          <main ref={canvasRef} className="ft-canvas-main min-w-0 px-3 py-4 pb-24 pt-4 sm:px-5 sm:py-6 lg:px-7">
          <div className="mx-auto max-w-[1500px]">
            {activeTab === 'dashboard' && <AdminDashboard />}
            {activeTab === 'orders' && <AdminOrders />}
            {activeTab === 'bespoke' && <AdminBespokeOrders />}
            {activeTab === 'listings' && <AdminListings />}
            {activeTab === 'customers' && <AdminCustomers />}
            {activeTab === 'sellers' && <AdminSellers />}
            {activeTab === 'payments' && <AdminPayments />}
            {activeTab === 'disputes' && <AdminDisputes />}
            {activeTab === 'reconciliation' && <AdminReconciliation />}
            {activeTab === 'fulfillment' && <AdminFulfillmentAnalytics />}
            {activeTab === 'seller-metrics' && (
              <div className="space-y-8">
                <AdminAnalyticsCharts />
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <p className="text-xs font-800 uppercase tracking-[0.12em] text-muted-foreground">Per-seller breakdown</p>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <AdminSellerMetrics />
                </div>
              </div>
            )}
            {activeTab === 'top-sellers' && <AdminTopSellers />}
            {activeTab === 'discounts' && <AdminDiscounts />}
            {activeTab === 'sponsored' && <AdminSponsoredListings />}
            {activeTab === 'activity' && <AdminActivityFeed />}
            {activeTab === 'errors' && <AdminErrorMonitor />}
            {activeTab === 'settings' && <AdminSettings />}
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
            { key: 'dashboard' as AdminTab, label: 'Home', icon: 'HomeIcon' },
            { key: 'orders' as AdminTab, label: 'Orders', icon: 'ShoppingBagIcon' },
            { key: 'bespoke' as AdminTab, label: 'Custom', icon: 'ScissorsIcon' },
            { key: 'listings' as AdminTab, label: 'Products', icon: 'TagIcon' },
            { key: 'customers' as AdminTab, label: 'Customers', icon: 'UsersIcon' },
          ].map((item) => (
            <button key={item.key} type="button" onClick={() => navigateTo(item.key)} className={`ft-workspace-tab flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-800 ${activeTab === item.key ? 'is-active' : ''}`}>
              <Icon name={item.icon as 'HomeIcon'} size={18} />
              {item.label}
            </button>
          ))}
        </nav>
      </ViewportFixedLayer>

      <span className="sr-only">Signed in as {adminName}</span>

      <AiAssistantWidget role="admin" context={`Administrator is currently viewing: ${activeItem.label} (${activeItem.description})`} />
    </div>
  );
}
