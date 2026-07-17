'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import AdminDashboard from '@/app/admin-portal/components/AdminDashboard';
import AdminSellers from '@/app/admin-portal/components/AdminSellers';
import AdminOrders from '@/app/admin-portal/components/AdminOrders';
import AdminDiscounts from '@/app/admin-portal/components/AdminDiscounts';
import AdminActivityFeed from '@/app/admin-portal/components/AdminActivityFeed';
import AdminListings from '@/app/admin-portal/components/AdminListings';
import AdminPayments from '@/app/admin-portal/components/AdminPayments';
import AdminSettings from '@/app/admin-portal/components/AdminSettings';
import AdminReconciliation from '@/app/admin-portal/components/AdminReconciliation';

type AdminTab = 'dashboard' | 'sellers' | 'listings' | 'orders' | 'payments' | 'reconciliation' | 'discounts' | 'activity' | 'settings';

const navItems: { key: AdminTab; label: string; icon: string; badge?: number }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'ChartPieIcon' },
  { key: 'sellers', label: 'Sellers', icon: 'BuildingStorefrontIcon', badge: 4 },
  { key: 'listings', label: 'Listings', icon: 'TagIcon', badge: 12 },
  { key: 'orders', label: 'Orders', icon: 'ShoppingBagIcon' },
  { key: 'payments', label: 'Payments', icon: 'CreditCardIcon' },
  { key: 'reconciliation', label: 'Reconciliation', icon: 'ScaleIcon', badge: 4 },
  { key: 'discounts', label: 'Discounts', icon: 'ReceiptPercentIcon' },
  { key: 'activity', label: 'Activity Feed', icon: 'BoltIcon' },
  { key: 'settings', label: 'Settings', icon: 'CogIcon' },
];

export default function AdminPortalLayout() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--foreground)' }}>
      {/* Top Bar */}
      <header className="admin-sidebar border-b border-white/10 sticky top-0 z-40 h-14 flex items-center px-4 sm:px-6 gap-4">
        <button className="md:hidden p-1.5" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Icon name="Bars3Icon" size={20} className="text-white" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <AppLogo size={30} />
          <span className="font-800 text-sm text-white hidden sm:block">FabricTrad</span>
        </Link>
        <div className="ml-2">
          <span className="text-xs bg-error/20 text-red-300 border border-error/30 rounded-full px-2.5 py-0.5 font-700">Admin Portal</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-600 text-white">Super Admin</span>
          </div>
          <button className="relative p-2 hover:bg-white/10 rounded-lg transition-colors">
            <Icon name="BellIcon" size={18} className="text-white" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error" />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-xs font-800 text-white">SA</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Admin Sidebar */}
        <aside className={`fixed md:static inset-y-0 left-0 z-30 w-56 admin-sidebar pt-14 md:pt-0 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-4 space-y-1 overflow-y-auto h-full">
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-700 text-white/40 uppercase tracking-widest">Admin Menu</p>
            </div>
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 transition-all ${
                  activeTab === item.key
                    ? 'bg-primary text-white font-600' :'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon name={item.icon as 'ChartPieIcon'} size={18} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="bg-error text-white text-xs font-700 w-5 h-5 rounded-full flex items-center justify-center">{item.badge}</span>
                )}
              </button>
            ))}

            <div className="pt-4 mt-4 border-t border-white/10">
              <Link href="/marketplace" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 text-white/60 hover:text-white hover:bg-white/10 transition-all">
                <Icon name="GlobeAltIcon" size={18} />
                <span>View Marketplace</span>
              </Link>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 min-w-0">
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'sellers' && <AdminSellers />}
          {activeTab === 'listings' && <AdminListings />}
          {activeTab === 'orders' && <AdminOrders />}
          {activeTab === 'payments' && <AdminPayments />}
          {activeTab === 'reconciliation' && <AdminReconciliation />}
          {activeTab === 'discounts' && <AdminDiscounts />}
          {activeTab === 'activity' && <AdminActivityFeed />}
          {activeTab === 'settings' && <AdminSettings />}
        </main>
      </div>
    </div>
  );
}