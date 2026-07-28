'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import SellerOverview from '@/app/seller-dashboard/components/SellerOverview';
import SellerOrders from '@/app/seller-dashboard/components/SellerOrders';
import SellerCatalogOrders from '@/app/seller-dashboard/components/SellerCatalogOrders';
import SellerInventory from '@/app/seller-dashboard/components/SellerInventory';
import SellerVariantCatalog from '@/app/seller-dashboard/components/SellerVariantCatalog';
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
  | 'analytics'
  | 'upload'
  | 'profile'
  | 'earnings'
  | 'disputes'
  | 'notifications'
  | 'fulfillment'
  | 'categories'
  | 'courier'
  | 'inbox'
  | 'requests'
  | 'billing';

const navItems: { key: SellerTab; label: string; icon: string; badge?: number }[] = [
  { key: 'overview', label: 'Dashboard', icon: 'HomeIcon' },
  { key: 'upload', label: 'AI Catalog Studio', icon: 'SparklesIcon' },
  { key: 'inventory', label: 'Parent Fabrics', icon: 'ArchiveBoxIcon' },
  { key: 'variants', label: 'Colours & Designs', icon: 'SwatchIcon' },
  { key: 'orders', label: 'Order Queue', icon: 'ClipboardDocumentListIcon' },
  { key: 'requests', label: 'Buyer Requests', icon: 'MegaphoneIcon' },
  { key: 'inbox', label: 'Buyer Inbox', icon: 'ChatBubbleLeftRightIcon' },
  { key: 'fulfillment', label: 'Fulfillment', icon: 'TruckIcon' },
  { key: 'courier', label: 'Courier & Shipping', icon: 'TruckIcon' },
  { key: 'earnings', label: 'Earnings & Payouts', icon: 'BanknotesIcon' },
  { key: 'analytics', label: 'Analytics', icon: 'ChartBarIcon' },
  { key: 'categories', label: 'Categories', icon: 'TagIcon' },
  { key: 'billing', label: 'Billing Uploads', icon: 'DocumentArrowUpIcon' },
  { key: 'disputes', label: 'Disputes & Messages', icon: 'ChatBubbleLeftRightIcon' },
  { key: 'notifications', label: 'Notifications', icon: 'BellIcon' },
  { key: 'profile', label: 'Business Profile', icon: 'BuildingOfficeIcon' },
];

const getValidTab = (tab: string | null): SellerTab =>
  navItems.some((item) => item.key === tab) ? (tab as SellerTab) : 'overview';

export default function SellerDashboardLayout() {
  const { user, profile, isDemoAccount } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SellerTab>(() =>
    getValidTab(searchParams?.get('tab') || null)
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sellerName = profile?.business_name || profile?.full_name || 'Seller';
  const sellerInitials = sellerName
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('');

  useEffect(() => {
    setActiveTab(getValidTab(searchParams?.get('tab') || null));
  }, [searchParams]);

  const navigateToTab = (tab: SellerTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    router.replace(tab === 'overview' ? '/seller-dashboard' : `/seller-dashboard?tab=${tab}`, {
      scroll: false,
    });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-card border-b border-border sticky top-0 z-40 h-14 flex items-center px-3 sm:px-6 gap-3">
        <button
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Open seller menu"
        >
          <Icon name="Bars3Icon" size={20} className="text-foreground" />
        </button>
        <Link href="/seller-dashboard" className="flex items-center gap-2">
          <AppLogo size={30} />
          <span className="font-800 text-sm text-secondary hidden sm:block">FabricTrad</span>
        </Link>
        <div className="ml-1 hidden sm:block">
          <span className="text-xs bg-secondary/10 text-secondary border border-secondary/20 rounded-full px-2.5 py-0.5 font-700">
            Seller Portal
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => navigateToTab('upload')}
            className="hidden lg:inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-800 text-white"
          >
            <Icon name="SparklesIcon" size={15} /> Add product with AI
          </button>
          <button
            type="button"
            onClick={() => navigateToTab('notifications')}
            className="relative p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Open seller notifications"
          >
            <Icon name="BellIcon" size={18} className="text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="w-8 h-8 rounded-full overflow-hidden bg-secondary/10 border border-border flex items-center justify-center"
              aria-label="Open seller profile"
            >
              {profile?.avatar_url ? (
                <AppImage
                  src={profile.avatar_url}
                  alt={`${sellerName} profile photo`}
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-800 text-secondary">{sellerInitials || 'S'}</span>
              )}
            </Link>
            <div className="hidden sm:block">
              <p className="text-xs font-700 text-foreground">{sellerName}</p>
              <p className="text-xs text-muted-foreground mono-id">
                {profile?.phone ? `+91 ${profile.phone}` : user?.email}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`fixed md:static inset-y-0 left-0 z-30 w-64 seller-sidebar pt-14 md:pt-0 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        >
          <div className="p-3 space-y-1 overflow-y-auto h-full">
            <div className="px-3 py-2 mb-1 flex items-center justify-between">
              <p className="text-xs font-700 text-muted-foreground uppercase tracking-widest">Seller Menu</p>
              <button type="button" onClick={() => setSidebarOpen(false)} className="md:hidden p-1" aria-label="Close seller menu">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => navigateToTab(item.key)}
                className={`sidebar-nav-item w-full text-left ${activeTab === item.key ? 'active' : ''}`}
              >
                <Icon name={item.icon as 'HomeIcon'} size={18} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="bg-primary text-white text-xs font-700 w-5 h-5 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
            <div className="mt-4 p-3 bg-secondary/10 border border-secondary/20 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="PhotoIcon" size={14} className="text-secondary" />
                <p className="text-xs font-700 text-secondary">Modern product catalogue</p>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Add colours, stock, rates, front/back photos, close-ups and short reels without leaving the website.
              </p>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 min-w-0">
          <SellerProfileReadiness />
          {isDemoAccount && (
            <div className="mb-4 rounded-xl border border-secondary/20 bg-secondary/5 p-3">
              <div className="flex items-start gap-2">
                <Icon name="ShieldCheckIcon" size={16} className="mt-0.5 shrink-0 text-secondary" />
                <div>
                  <p className="text-xs font-800 text-secondary">Demo seller sandbox</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    This account is for interface testing. Real catalogue publishing, media uploads and order processing require a verified seller account.
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'overview' && <SellerOverview onNavigate={navigateToTab} />}
          {activeTab === 'orders' && (
            <>
              <SellerCatalogOrders />
              <SellerOrders />
            </>
          )}
          {activeTab === 'inventory' && <SellerInventory />}
          {activeTab === 'variants' && <SellerVariantCatalog />}
          {activeTab === 'analytics' && <SellerAnalytics />}
          {activeTab === 'earnings' && <SellerEarnings />}
          {activeTab === 'billing' && <SellerBillingDocuments />}
          {activeTab === 'disputes' && <SellerDisputes />}
          {activeTab === 'fulfillment' && <SellerFulfillment />}
          {activeTab === 'categories' && <SellerCategories />}
          {activeTab === 'courier' && <SellerCourierSettings />}
          {activeTab === 'inbox' && <SellerInbox />}
          {activeTab === 'requests' && <SellerBuyerRequests />}
          {activeTab === 'notifications' && <NotificationPreferences mode="seller" />}
          {activeTab === 'upload' && <SellerCatalogAssistant />}
          {activeTab === 'profile' && (
            <div className="max-w-2xl">
              <h2 className="text-xl font-800 text-foreground mb-6">Business Profile</h2>
              <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-border">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/10 overflow-hidden flex items-center justify-center">
                    {profile?.avatar_url ? (
                      <AppImage
                        src={profile.avatar_url}
                        alt={`${sellerName} seller profile photo`}
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-800 text-secondary">{sellerInitials || 'S'}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-800 text-foreground">{sellerName}</p>
                      <span className="badge-verified">Verified</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="mono-id">
                      {profile?.id ? `FT-SLR-${profile.id.slice(0, 6).toUpperCase()}` : 'FT-SLR'}
                    </p>
                  </div>
                </div>
                {[
                  { label: 'Mobile', value: profile?.phone ? `+91 ${profile.phone}` : 'Add phone', verified: !!profile?.phone },
                  { label: 'GSTIN', value: profile?.gstin || 'Add GSTIN', verified: !!profile?.gstin },
                  { label: 'Business Name', value: profile?.business_name || sellerName },
                  { label: 'Pickup City', value: profile?.city || 'Add city' },
                  { label: 'Pickup Address', value: [profile?.address_line1, profile?.pincode].filter(Boolean).join(' - ') || 'Add pickup address' },
                  { label: 'Store Status', value: profile?.is_active ? 'Live' : 'Inactive', verified: !!profile?.is_active },
                ].map((field) => (
                  <div key={field.label} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                    <div>
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p className="text-sm font-600 text-foreground">{field.value}</p>
                    </div>
                    {field.verified && <span className="badge-verified">Verified</span>}
                  </div>
                ))}
                <Link href="/profile" className="btn-primary mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm">
                  <Icon name="PencilSquareIcon" size={16} />
                  Manage Business Profile
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card/95 p-2 backdrop-blur-lg md:hidden">
        {[
          { key: 'overview' as SellerTab, label: 'Home', icon: 'HomeIcon' },
          { key: 'upload' as SellerTab, label: 'Add', icon: 'SparklesIcon' },
          { key: 'inventory' as SellerTab, label: 'Catalog', icon: 'ArchiveBoxIcon' },
          { key: 'orders' as SellerTab, label: 'Orders', icon: 'ClipboardDocumentListIcon' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => navigateToTab(item.key)}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-800 ${activeTab === item.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
          >
            <Icon name={item.icon as 'HomeIcon'} size={19} />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
