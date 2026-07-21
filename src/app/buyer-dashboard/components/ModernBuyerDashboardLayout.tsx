'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import PreferenceControls from '@/components/PreferenceControls';
import BuyerOverview from '@/app/buyer-dashboard/components/BuyerOverview';
import BuyerOrders from '@/app/buyer-dashboard/components/BuyerOrders';
import BuyerTracking from '@/app/buyer-dashboard/components/BuyerTracking';
import BuyerWishlist from '@/app/buyer-dashboard/components/BuyerWishlist';
import DisputeMessaging from '@/app/buyer-dashboard/components/DisputeMessaging';
import NotificationPreferences from '@/app/components/NotificationPreferences';
import { useAuth } from '@/contexts/AuthContext';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';
import { SUPPORTED_LANGUAGES } from '@/lib/india';

type DashboardTab =
  | 'overview'
  | 'orders'
  | 'tracking'
  | 'wishlist'
  | 'disputes'
  | 'requirements'
  | 'notifications'
  | 'account';

const validTabs: DashboardTab[] = [
  'overview',
  'orders',
  'tracking',
  'wishlist',
  'disputes',
  'requirements',
  'notifications',
  'account',
];

const normaliseTab = (value: string | null): DashboardTab =>
  validTabs.includes(value as DashboardTab) ? (value as DashboardTab) : 'overview';

export default function ModernBuyerDashboardLayout() {
  const { user, profile, isDemoAccount } = useAuth();
  const { language, t } = useAppPreferences();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    normaliseTab(searchParams?.get('tab') || null)
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setActiveTab(normaliseTab(searchParams?.get('tab') || null));
  }, [searchParams]);

  const buyerName = profile?.full_name || user?.email?.split('@')[0] || 'Buyer';
  const buyerInitial = buyerName.charAt(0).toUpperCase();
  const languageLabel =
    SUPPORTED_LANGUAGES.find((item) => item.code === language)?.label || 'English';

  const navItems = useMemo(
    () => [
      { key: 'overview' as const, label: t('nav.dashboard'), icon: 'HomeIcon' },
      { key: 'orders' as const, label: 'My Orders', icon: 'ShoppingBagIcon' },
      { key: 'tracking' as const, label: 'Track Shipments', icon: 'TruckIcon' },
      { key: 'wishlist' as const, label: 'Wishlist', icon: 'HeartIcon' },
      { key: 'disputes' as const, label: 'Messages & Disputes', icon: 'ChatBubbleLeftRightIcon' },
      { key: 'requirements' as const, label: t('nav.requirements'), icon: 'MegaphoneIcon' },
      { key: 'notifications' as const, label: t('nav.notifications'), icon: 'BellIcon' },
      { key: 'account' as const, label: 'Account & Preferences', icon: 'UserCircleIcon' },
    ],
    [t]
  );

  const navigateToTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
    router.replace(tab === 'overview' ? '/buyer-dashboard' : `/buyer-dashboard?tab=${tab}`, {
      scroll: false,
    });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          <AppLogo size={34} />
          <div>
            <p className="text-sm font-800 text-foreground">FabricTrad</p>
            <p className="text-xs text-muted-foreground">Buyer workspace</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => navigateToTab(item.key)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-700 transition ${
              activeTab === item.key
                ? 'bg-primary text-white shadow-md'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon name={item.icon as 'HomeIcon'} size={18} />
            <span className="flex-1">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="space-y-3 border-t border-border p-4">
        <Link
          href="/product-detail#drape-on"
          className="block rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-secondary/10 p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="flex items-center gap-2 text-primary">
            <Icon name="SparklesIcon" size={18} />
            <span className="text-sm font-800">AI Drape Studio</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Upload a photo, choose a garment and preview fabric before ordering.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-800 text-primary">
            Open studio <Icon name="ArrowRightIcon" size={13} />
          </span>
        </Link>
        <Link
          href="/marketplace"
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-800 text-foreground hover:border-primary/40 hover:text-primary"
        >
          <Icon name="ShoppingBagIcon" size={17} /> {t('nav.marketplace')}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(200,96,10,0.10),transparent_28%),radial-gradient(circle_at_100%_10%,rgba(31,41,68,0.10),transparent_30%)] dark:bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-border bg-card/90 px-4 backdrop-blur-xl sm:px-6">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="mr-2 flex h-10 w-10 items-center justify-center rounded-xl border border-border md:hidden"
          aria-label="Open dashboard navigation"
        >
          <Icon name="Bars3Icon" size={20} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-800 text-foreground">Buyer Portal</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Orders, sourcing, drape previews and account preferences
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <PreferenceControls compact />
          <Link
            href="/buyer-dashboard?tab=notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:border-primary/40 hover:text-primary"
            aria-label="Open notifications"
          >
            <Icon name="BellIcon" size={18} />
          </Link>
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 shadow-sm hover:border-primary/40"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-800 text-primary">
              {buyerInitial}
            </span>
            <span className="hidden max-w-36 truncate text-xs font-800 text-foreground sm:block">
              {buyerName}
            </span>
          </Link>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card/85 backdrop-blur md:block">
          {sidebar}
        </aside>

        {mobileOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/45 md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close dashboard navigation"
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-[86vw] max-w-72 bg-card shadow-2xl md:hidden">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-muted"
                aria-label="Close dashboard navigation"
              >
                <Icon name="XMarkIcon" size={18} />
              </button>
              {sidebar}
            </aside>
          </>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {isDemoAccount && (
            <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              <span className="font-800 text-primary">Demo buyer account:</span> real checkout is disabled, but the full buyer workflow remains available for testing.
            </div>
          )}

          {activeTab === 'overview' && (
            <section className="mb-7 overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl">
              <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-xs font-800 uppercase tracking-wider text-success">
                    <Icon name="CheckBadgeIcon" size={15} /> Verified buyer account
                  </span>
                  <h1 className="mt-4 text-3xl font-800 tracking-tight text-foreground sm:text-4xl">
                    Good to see you, {buyerName}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Source verified fabrics, manage pending orders, track shipments and preview drapes from one account.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href="/marketplace" className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm">
                      Browse fabrics <Icon name="ArrowRightIcon" size={15} />
                    </Link>
                    <Link href="/product-detail#drape-on" className="btn-secondary inline-flex items-center gap-2 px-5 py-3 text-sm">
                      <Icon name="SparklesIcon" size={16} /> Try Drape Studio
                    </Link>
                    <button
                      type="button"
                      onClick={() => navigateToTab('orders')}
                      className="btn-navy inline-flex items-center gap-2 px-5 py-3 text-sm"
                    >
                      <Icon name="ClockIcon" size={16} /> Pending orders
                    </button>
                  </div>
                </div>
                <div className="grid min-w-56 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl bg-muted p-4">
                    <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground">State</p>
                    <p className="mt-1 text-sm font-800 text-foreground">{profile?.state || 'Add in profile'}</p>
                  </div>
                  <div className="rounded-2xl bg-muted p-4">
                    <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground">Language</p>
                    <p className="mt-1 text-sm font-800 text-foreground">{languageLabel}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-[1.75rem] border border-border bg-card/92 p-4 shadow-lg sm:p-6">
            {activeTab === 'overview' && <BuyerOverview onNavigate={navigateToTab} />}
            {activeTab === 'orders' && <BuyerOrders />}
            {activeTab === 'tracking' && <BuyerTracking />}
            {activeTab === 'wishlist' && <BuyerWishlist />}
            {activeTab === 'disputes' && <DisputeMessaging mode="buyer" />}
            {activeTab === 'notifications' && <NotificationPreferences mode="buyer" />}
            {activeTab === 'requirements' && (
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div>
                  <p className="text-xs font-800 uppercase tracking-wider text-primary">Buyer requirement board</p>
                  <h2 className="mt-2 text-2xl font-800 text-foreground">Post exactly what you need</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Add fabric type, GSM, width, quantity, state, budget and deadline. Verified sellers can respond through secure in-site messaging.
                  </p>
                  <Link href="/buyer-requirements" className="btn-primary mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm">
                    <Icon name="PlusIcon" size={16} /> Open requirements board
                  </Link>
                </div>
                <div className="rounded-2xl border border-border bg-muted/60 p-5">
                  <Icon name="ShieldCheckIcon" size={26} className="text-success" />
                  <p className="mt-3 text-sm font-800 text-foreground">Private and account-scoped</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Buyer contact details remain protected while requirements, replies and order records stay tied to this account.
                  </p>
                </div>
              </div>
            )}
            {activeTab === 'account' && (
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <div>
                  <p className="text-xs font-800 uppercase tracking-wider text-primary">Account</p>
                  <h2 className="mt-2 text-2xl font-800 text-foreground">Profile and regional preferences</h2>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                      ['Name', buyerName],
                      ['Email', user?.email || 'Not available'],
                      ['Phone', profile?.phone ? `+91 ${profile.phone}` : 'Add phone'],
                      ['State', profile?.state || 'Add state'],
                      ['City', profile?.city || 'Add city'],
                      ['Language', languageLabel],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-border bg-muted/50 p-4">
                        <p className="text-xs font-700 uppercase tracking-wider text-muted-foreground">{label}</p>
                        <p className="mt-1 break-words text-sm font-800 text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                  <Link href="/profile" className="btn-primary mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm">
                    Edit full profile <Icon name="ArrowRightIcon" size={15} />
                  </Link>
                </div>
                <div className="rounded-2xl border border-border bg-muted/60 p-5">
                  <p className="text-sm font-800 text-foreground">Appearance and language</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    These controls switch between light, dark and system appearance and save the selected Indian language.
                  </p>
                  <div className="mt-5 inline-flex rounded-2xl border border-border bg-card p-2">
                    <PreferenceControls />
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
