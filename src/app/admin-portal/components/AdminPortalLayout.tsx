'use client';

import { useEffect, useState } from 'react';
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
import AdminDiscounts from '@/app/admin-portal/components/AdminDiscounts';
import AdminActivityFeed from '@/app/admin-portal/components/AdminActivityFeed';
import AdminListings from '@/app/admin-portal/components/AdminListings';
import AdminPayments from '@/app/admin-portal/components/AdminPayments';
import AdminSettings from '@/app/admin-portal/components/AdminSettings';
import AdminReconciliation from '@/app/admin-portal/components/AdminReconciliation';
import AdminTopSellers from '@/app/admin-portal/components/AdminTopSellers';
import AdminErrorMonitor from '@/app/admin-portal/components/AdminErrorMonitor';
import AdminFulfillmentAnalytics from '@/app/admin-portal/components/AdminFulfillmentAnalytics';
import AdminSellerMetrics from '@/app/admin-portal/components/AdminSellerMetrics';
import AdminDisputes from '@/app/admin-portal/components/AdminDisputes';
import AdminPayoutRequests from '@/app/admin-portal/components/AdminPayoutRequests';

type AdminTab =
  | 'dashboard' |'orders' |'listings' |'customers' |'sellers' |'payments' |'disputes' |'reconciliation' |'fulfillment' |'seller-metrics' |'top-sellers' |'discounts' |'activity' |'errors' |'settings' | 'payout-requests';

type NavItem = {
  key: AdminTab;
  label: string;
  icon: string;
  badge?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: '',
    items: [
      { key: 'dashboard', label: 'Home', icon: 'HomeIcon' },
      { key: 'activity', label: 'Activity', icon: 'BoltIcon' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { key: 'orders', label: 'Orders', icon: 'ShoppingBagIcon' },
      { key: 'listings', label: 'Products', icon: 'TagIcon' },
      { key: 'customers', label: 'Customers', icon: 'UsersIcon' },
      { key: 'sellers', label: 'Sellers', icon: 'BuildingStorefrontIcon' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: 'payments', label: 'Payments', icon: 'CreditCardIcon' },
      { key: 'payout-requests', label: 'Payout Requests', icon: 'BanknotesIcon', badge: 0 },
      { key: 'disputes', label: 'Returns & disputes', icon: 'ChatBubbleLeftRightIcon' },
      { key: 'reconciliation', label: 'Reconciliation', icon: 'ArrowsRightLeftIcon' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: 'fulfillment', label: 'Fulfillment', icon: 'TruckIcon' },
      { key: 'seller-metrics', label: 'Analytics', icon: 'PresentationChartLineIcon' },
      { key: 'top-sellers', label: 'Top sellers', icon: 'TrophyIcon' },
      { key: 'discounts', label: 'Discounts', icon: 'ReceiptPercentIcon' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { key: 'errors', label: 'Error monitor', icon: 'ExclamationTriangleIcon' },
      { key: 'settings', label: 'Settings', icon: 'CogIcon' },
    ],
  },
];

const flatItems = navGroups.flatMap((group) => group.items);
const validTabs = flatItems.map((item) => item.key);
const normaliseTab = (value: string | null): AdminTab =>
  validTabs.includes(value as AdminTab) ? (value as AdminTab) : 'dashboard';

const tabTitles: Record<AdminTab, string> = {
  dashboard: 'Home',
  orders: 'Orders',
  listings: 'Products',
  customers: 'Customers',
  sellers: 'Sellers',
  payments: 'Payments',
  'payout-requests': 'Payout Requests',
  disputes: 'Returns & Disputes',
  reconciliation: 'Reconciliation',
  fulfillment: 'Fulfillment',
  'seller-metrics': 'Analytics',
  'top-sellers': 'Top Sellers',
  discounts: 'Discounts',
  activity: 'Activity',
  errors: 'Error Monitor',
  settings: 'Settings',
};

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

  const navigateTo = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    router.replace(tab === 'dashboard' ? '/admin-portal' : `/admin-portal?tab=${tab}`, {
      scroll: false,
    });
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
  void adminName; // used in sidebar greeting below

  const sidebar = (
    <div className="flex h-full flex-col bg-[#1a1f2e] text-white">
      {/* Store header */}
      <div className="border-b border-white/10 px-3 py-3">
        <Link
          href="/admin-portal"
          onClick={() => setSidebarOpen(false)}
          className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/10"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#008060]">
            <AppLogo size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-700 text-white">FabricTrad</p>
            <p className="truncate text-[11px] text-white/50">Admin portal</p>
          </div>
          <Icon name="ChevronUpDownIcon" size={14} className="text-white/40" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Admin navigation">
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
                    {item.badge ? (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-700 text-white">
                        {item.badge}
                      </span>
                    ) : null}
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
          <Icon name="ArrowTopRightOnSquareIcon" size={16} className="text-white/40" />
          View marketplace
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
          aria-label="Open admin navigation"
        >
          <Icon name="Bars3Icon" size={20} />
        </button>

        {/* Breadcrumb */}
        <div className="hidden min-w-0 md:flex md:items-center md:gap-2">
          <span className="text-sm text-muted-foreground">Admin</span>
          <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground/50" />
          <span className="text-sm font-700 text-foreground">{tabTitles[activeTab]}</span>
        </div>

        <div className="flex-1">
          <AdminCommandSearch />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <PreferenceControls compact />
          <button
            type="button"
            onClick={() => navigateTo('activity')}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Notifications"
          >
            <Icon name="BellIcon" size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
          <ProfileMenu />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Desktop sidebar */}
        <aside className="hidden w-[220px] shrink-0 md:block">{sidebar}</aside>

        {/* Mobile sidebar overlay */}
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
            {activeTab === 'dashboard' && <AdminDashboard />}
            {activeTab === 'orders' && <AdminOrders />}
            {activeTab === 'listings' && <AdminListings />}
            {activeTab === 'customers' && <AdminCustomers />}
            {activeTab === 'sellers' && <AdminSellers />}
            {activeTab === 'payments' && <AdminPayments />}
            {activeTab === 'payout-requests' && <AdminPayoutRequests />}
            {activeTab === 'disputes' && <AdminDisputes />}
            {activeTab === 'reconciliation' && <AdminReconciliation />}
            {activeTab === 'fulfillment' && <AdminFulfillmentAnalytics />}
            {activeTab === 'seller-metrics' && <AdminSellerMetrics />}
            {activeTab === 'top-sellers' && <AdminTopSellers />}
            {activeTab === 'discounts' && <AdminDiscounts />}
            {activeTab === 'activity' && <AdminActivityFeed />}
            {activeTab === 'errors' && <AdminErrorMonitor />}
            {activeTab === 'settings' && <AdminSettings />}
          </div>
        </main>
      </div>
    </div>
  );
}
