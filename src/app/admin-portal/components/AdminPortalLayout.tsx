'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import PreferenceControls from '@/components/PreferenceControls';
import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard from '@/app/admin-portal/components/AdminDashboard';
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

type AdminTab =
  | 'dashboard'
  | 'sellers'
  | 'top-sellers'
  | 'seller-metrics'
  | 'listings'
  | 'orders'
  | 'payments'
  | 'reconciliation'
  | 'fulfillment'
  | 'discounts'
  | 'activity'
  | 'errors'
  | 'settings';

type AdminNavItem = { key: AdminTab; label: string; icon: string };

const navGroups: { label: string; items: AdminNavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'ChartPieIcon' },
      { key: 'activity', label: 'Activity feed', icon: 'BoltIcon' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { key: 'sellers', label: 'Seller verification', icon: 'BuildingStorefrontIcon' },
      { key: 'listings', label: 'Listings', icon: 'TagIcon' },
      { key: 'orders', label: 'Orders', icon: 'ShoppingBagIcon' },
      { key: 'payments', label: 'Payments', icon: 'CreditCardIcon' },
      { key: 'reconciliation', label: 'Reconciliation', icon: 'ArrowsRightLeftIcon' },
    ],
  },
  {
    label: 'Performance',
    items: [
      { key: 'top-sellers', label: 'Top sellers', icon: 'TrophyIcon' },
      { key: 'seller-metrics', label: 'Seller metrics', icon: 'PresentationChartLineIcon' },
      { key: 'fulfillment', label: 'Fulfilment analytics', icon: 'TruckIcon' },
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

const allAdminTabs = navGroups.flatMap((group) => group.items.map((item) => item.key));
const getValidTab = (tab: string | null): AdminTab =>
  allAdminTabs.includes(tab as AdminTab) ? (tab as AdminTab) : 'dashboard';

export default function AdminPortalLayout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => getValidTab(searchParams?.get('tab') || null));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeItem = useMemo(
    () => navGroups.flatMap((group) => group.items).find((item) => item.key === activeTab),
    [activeTab]
  );

  useEffect(() => {
    setActiveTab(getValidTab(searchParams?.get('tab') || null));
  }, [searchParams]);

  const navigateToTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    router.replace(tab === 'dashboard' ? '/admin-portal' : `/admin-portal?tab=${tab}`, { scroll: false });
  };

  const adminName = profile?.full_name || user?.email?.split('@')[0] || 'Super Admin';
  const initials = adminName
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('');

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-4">
        <Link href="/admin-portal" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
          <AppLogo size={34} />
          <div className="min-w-0">
            <p className="truncate text-sm font-800 text-foreground">FabricTrad</p>
            <p className="truncate text-xs text-muted-foreground">Admin operations</p>
          </div>
        </Link>
      </div>

      <nav className="ft-sidebar-scroll flex-1 overflow-y-auto p-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className="mb-1.5 px-3 text-[10px] font-800 uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigateToTab(item.key)}
                  className={`ft-sidebar-item flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm ${activeTab === item.key ? 'is-active' : ''}`}
                >
                  <Icon name={item.icon as 'ChartPieIcon'} size={18} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-border p-3">
        <Link href="/marketplace" className="ft-sidebar-item flex items-center gap-3 px-3 py-2.5 text-sm">
          <Icon name="GlobeAltIcon" size={18} />
          <span>View marketplace</span>
        </Link>
        <Link href="/profile" className="ft-sidebar-item flex items-center gap-3 px-3 py-2.5 text-sm">
          <Icon name="UserCircleIcon" size={18} />
          <span>Admin profile</span>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent">
      <header className="ft-topbar sticky top-0 z-40 flex h-16 items-center gap-3 px-3 sm:px-5 lg:px-6">
        <button
          type="button"
          className="ft-icon-button !h-10 !w-10 !min-w-10 !shrink-0 md:!hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open admin navigation"
        >
          <Icon name="Bars3Icon" size={20} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-800 text-foreground">{activeItem?.label || 'Admin dashboard'}</p>
          <p className="hidden text-xs text-muted-foreground sm:block">Platform commerce, trust, payments and operations</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <PreferenceControls compact />
          <Link href="/admin-portal?tab=sellers" className="ft-primary-action hidden items-center gap-2 px-3 py-2 text-xs sm:inline-flex">
            <Icon name="ShieldCheckIcon" size={15} /> Review sellers
          </Link>
          <button type="button" onClick={() => navigateToTab('activity')} className="ft-icon-button relative" aria-label="Open activity feed">
            <Icon name="BellIcon" size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
          </button>
          <Link href="/profile" className="flex min-h-10 items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 shadow-sm hover:border-primary/30">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-800 text-white">{initials || 'SA'}</span>
            <span className="hidden max-w-32 truncate text-xs font-800 text-foreground sm:block">{adminName}</span>
          </Link>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="ft-sidebar hidden w-64 shrink-0 border-r md:block">{sidebar}</aside>

        {sidebarOpen && (
          <>
            <button type="button" className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close admin navigation" />
            <aside className="fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] bg-card shadow-2xl md:hidden">
              <button type="button" onClick={() => setSidebarOpen(false)} className="ft-icon-button absolute right-3 top-3 z-10 !h-10 !w-10 !min-w-10" aria-label="Close admin navigation">
                <Icon name="XMarkIcon" size={18} />
              </button>
              {sidebar}
            </aside>
          </>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-24 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1440px]">
            {activeTab === 'dashboard' && <AdminDashboard />}
            {activeTab === 'sellers' && <AdminSellers />}
            {activeTab === 'listings' && <AdminListings />}
            {activeTab === 'orders' && <AdminOrders />}
            {activeTab === 'payments' && <AdminPayments />}
            {activeTab === 'reconciliation' && <AdminReconciliation />}
            {activeTab === 'discounts' && <AdminDiscounts />}
            {activeTab === 'activity' && <AdminActivityFeed />}
            {activeTab === 'top-sellers' && <AdminTopSellers />}
            {activeTab === 'seller-metrics' && <AdminSellerMetrics />}
            {activeTab === 'fulfillment' && <AdminFulfillmentAnalytics />}
            {activeTab === 'errors' && <AdminErrorMonitor />}
            {activeTab === 'settings' && <AdminSettings />}
          </div>
        </main>
      </div>

      <nav className="ft-mobile-dock fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 p-2 md:hidden">
        {[
          { key: 'dashboard' as AdminTab, label: 'Home', icon: 'ChartPieIcon' },
          { key: 'sellers' as AdminTab, label: 'Sellers', icon: 'BuildingStorefrontIcon' },
          { key: 'orders' as AdminTab, label: 'Orders', icon: 'ShoppingBagIcon' },
          { key: 'payments' as AdminTab, label: 'Payments', icon: 'CreditCardIcon' },
        ].map((item) => (
          <button key={item.key} type="button" onClick={() => navigateToTab(item.key)} className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-800 ${activeTab === item.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
            <Icon name={item.icon as 'ChartPieIcon'} size={19} />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
