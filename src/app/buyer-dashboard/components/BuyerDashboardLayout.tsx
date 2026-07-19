'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import BuyerOverview from '@/app/buyer-dashboard/components/BuyerOverview';
import BuyerOrders from '@/app/buyer-dashboard/components/BuyerOrders';
import BuyerTracking from '@/app/buyer-dashboard/components/BuyerTracking';
import BuyerWishlist from '@/app/buyer-dashboard/components/BuyerWishlist';
import DisputeMessaging from '@/app/buyer-dashboard/components/DisputeMessaging';
import NotificationPreferences from '@/app/components/NotificationPreferences';

type DashTab =
  | 'overview'
  | 'orders'
  | 'tracking'
  | 'wishlist'
  | 'disputes'
  | 'notifications'
  | 'account'
  | 'requirements';

const navItems: { key: DashTab; label: string; icon: string; badge?: number }[] = [
  { key: 'overview', label: 'Overview', icon: 'HomeIcon' },
  { key: 'orders', label: 'My Orders', icon: 'ShoppingBagIcon' },
  { key: 'tracking', label: 'Track Shipments', icon: 'TruckIcon' },
  { key: 'wishlist', label: 'Wishlist', icon: 'HeartIcon' },
  { key: 'disputes', label: 'Disputes & Messages', icon: 'ChatBubbleLeftRightIcon' },
  { key: 'requirements', label: 'Requirements Board', icon: 'MegaphoneIcon' },
  { key: 'notifications', label: 'Notifications', icon: 'BellIcon' },
  { key: 'account', label: 'Account', icon: 'UserCircleIcon' },
];

const getValidTab = (tab: string | null): DashTab =>
  navItems.some((item) => item.key === tab) ? (tab as DashTab) : 'overview';

export default function BuyerDashboardLayout() {
  const { user, profile, isDemoAccount } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<DashTab>(() =>
    getValidTab(searchParams?.get('tab') || null)
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const buyerName = profile?.full_name || user?.email?.split('@')[0] || 'Buyer';
  const buyerInitial = buyerName[0]?.toUpperCase() || 'B';

  useEffect(() => {
    setActiveTab(getValidTab(searchParams?.get('tab') || null));
  }, [searchParams]);

  const navigateToTab = (tab: DashTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    router.replace(tab === 'overview' ? '/buyer-dashboard' : `/buyer-dashboard?tab=${tab}`, {
      scroll: false,
    });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Top Bar */}
      <header className="bg-card border-b border-border sticky top-0 z-40 h-14 flex items-center px-4 sm:px-6 gap-4">
        <button className="md:hidden p-1.5" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Icon name="Bars3Icon" size={20} className="text-foreground" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <AppLogo size={30} />
          <span className="font-800 text-sm text-secondary hidden sm:block">FabricTrad</span>
        </Link>
        <div className="ml-2 hidden sm:block">
          <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 font-700">
            Buyer Portal
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
            <Icon name="BellIcon" size={18} className="text-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
          </button>
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 border border-border flex items-center justify-center"
            >
              {profile?.avatar_url ? (
                <AppImage
                  src={profile.avatar_url}
                  alt={`${buyerName} profile photo`}
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-800 text-primary">{buyerInitial}</span>
              )}
            </Link>
            <div className="hidden sm:block">
              <p className="text-xs font-700 text-foreground">{buyerName}</p>
              <p className="text-xs text-muted-foreground mono-id">
                {profile?.phone ? `+91 ${profile.phone}` : user?.email}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-30 w-56 seller-sidebar pt-14 md:pt-0 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        >
          <div className="p-4 space-y-1 overflow-y-auto h-full">
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-700 text-muted-foreground uppercase tracking-widest">
                Navigation
              </p>
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

            <div className="pt-4 mt-4 border-t border-border">
              <Link
                href="/marketplace"
                className="sidebar-nav-item w-full text-left flex items-center gap-3"
              >
                <Icon name="ShoppingBagIcon" size={18} />
                <span>Back to Shop</span>
              </Link>
            </div>

            {/* Account-scoped try-on credits placeholder */}
            <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="SparklesIcon" size={14} className="text-primary" />
                <p className="text-xs font-700 text-primary">Virtual Try-On</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Credits are tied to this account</p>
              <button className="btn-primary w-full py-1.5 text-xs rounded-lg">
                Buy Credits ₹10/img
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0">
          {isDemoAccount && (
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Icon
                  name="ShieldCheckIcon"
                  size={16}
                  className="mt-0.5 shrink-0 text-primary"
                />
                <div>
                  <p className="text-xs font-800 text-primary">Demo buyer sandbox</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    This account is for testing only. You can explore buyer features, but real
                    checkout and product ordering are disabled.
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'overview' && <BuyerOverview onNavigate={navigateToTab} />}
          {activeTab === 'orders' && <BuyerOrders />}
          {activeTab === 'tracking' && <BuyerTracking />}
          {activeTab === 'wishlist' && <BuyerWishlist />}
          {activeTab === 'disputes' && <DisputeMessaging mode="buyer" />}
          {activeTab === 'requirements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-800 text-foreground">Requirements Board</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Post what you need — sellers will connect with you via in-website chat
                  </p>
                </div>
                <Link
                  href="/buyer-requirements"
                  className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2"
                >
                  <Icon name="ArrowTopRightOnSquareIcon" size={14} />
                  Open Board
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: 'MegaphoneIcon',
                    title: 'Post Requirements',
                    desc: 'Tell sellers exactly what fabric you need — quantity, budget, deadline',
                    color: 'text-primary bg-primary/10',
                  },
                  {
                    icon: 'ChatBubbleLeftRightIcon',
                    title: 'Sellers Connect',
                    desc: 'Interested sellers reach out via secure in-website chat only',
                    color: 'text-secondary bg-secondary/10',
                  },
                  {
                    icon: 'ShieldCheckIcon',
                    title: 'Privacy Protected',
                    desc: 'No phone numbers or emails shared — all communication on FabricTrad',
                    color: 'text-success bg-success/10',
                  },
                ].map((item) => (
                  <div key={item.title} className="bg-card border border-border rounded-2xl p-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${item.color}`}
                    >
                      <Icon
                        name={item.icon as 'MegaphoneIcon'}
                        size={20}
                        className={item.color.split(' ')[0]}
                      />
                    </div>
                    <p className="font-700 text-foreground text-sm mb-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 text-center">
                <Icon
                  name="MegaphoneIcon"
                  size={32}
                  className="text-primary mx-auto mb-3 opacity-60"
                />
                <p className="font-700 text-foreground mb-1">Ready to post your requirement?</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Hundreds of verified sellers are waiting to fulfil your fabric needs
                </p>
                <Link
                  href="/buyer-requirements"
                  className="btn-primary px-6 py-2.5 text-sm rounded-xl inline-flex items-center gap-2"
                >
                  <Icon name="PlusIcon" size={14} />
                  Post a Requirement
                </Link>
              </div>
            </div>
          )}
          {activeTab === 'notifications' && <NotificationPreferences mode="buyer" />}
          {activeTab === 'account' && (
            <div className="max-w-lg">
              <h2 className="text-xl font-800 text-foreground mb-6">Account Settings</h2>
              <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-border">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center">
                    {profile?.avatar_url ? (
                      <AppImage
                        src={profile.avatar_url}
                        alt={`${buyerName} buyer profile photo`}
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-800 text-primary">{buyerInitial}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-800 text-foreground">{buyerName}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="mono-id">
                      {profile?.id ? `FT-BYR-${profile.id.slice(0, 6).toUpperCase()}` : 'FT-BYR'}
                    </p>
                  </div>
                </div>
                {[
                  {
                    label: 'Mobile',
                    value: profile?.phone ? `+91 ${profile.phone}` : 'Add phone',
                    verified: !!profile?.phone,
                  },
                  {
                    label: 'Email',
                    value: user?.email || 'Not available',
                    verified: !!user?.email_confirmed_at,
                  },
                  { label: 'Account Type', value: 'Buyer' },
                  { label: 'Status', value: profile?.is_active ? 'Active' : 'Inactive' },
                ].map((field) => (
                  <div
                    key={field.label}
                    className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p className="text-sm font-600 text-foreground">{field.value}</p>
                    </div>
                    {field.verified && <span className="badge-verified">Verified</span>}
                  </div>
                ))}
                <Link
                  href="/profile"
                  className="btn-primary mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm"
                >
                  <Icon name="PencilSquareIcon" size={16} />
                  Manage Full Profile
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
