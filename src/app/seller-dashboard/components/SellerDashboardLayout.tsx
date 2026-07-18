'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import SellerOverview from '@/app/seller-dashboard/components/SellerOverview';
import SellerOrders from '@/app/seller-dashboard/components/SellerOrders';
import SellerInventory from '@/app/seller-dashboard/components/SellerInventory';
import SellerAnalytics from '@/app/seller-dashboard/components/SellerAnalytics';
import SellerWhatsAppUpload from '@/app/seller-dashboard/components/SellerWhatsAppUpload';
import SellerEarnings from '@/app/seller-dashboard/components/SellerEarnings';
import SellerDisputes from '@/app/seller-dashboard/components/SellerDisputes';
import SellerFulfillment from '@/app/seller-dashboard/components/SellerFulfillment';
import NotificationPreferences from '@/app/components/NotificationPreferences';
import SellerCategories from '@/app/seller-dashboard/components/SellerCategories';
import SellerCourierSettings from '@/app/seller-dashboard/components/SellerCourierSettings';
import SellerInbox from '@/app/seller-dashboard/components/SellerInbox';

type SellerTab = 'overview' | 'orders' | 'inventory' | 'analytics' | 'upload' | 'profile' | 'earnings' | 'disputes' | 'notifications' | 'fulfillment' | 'categories' | 'courier' | 'inbox';

const navItems: {key: SellerTab;label: string;icon: string;badge?: number;}[] = [
{ key: 'overview', label: 'Dashboard', icon: 'HomeIcon' },
{ key: 'orders', label: 'Order Queue', icon: 'ClipboardDocumentListIcon', badge: 5 },
{ key: 'inventory', label: 'Inventory', icon: 'ArchiveBoxIcon' },
{ key: 'categories', label: 'Categories', icon: 'TagIcon' },
{ key: 'analytics', label: 'Analytics', icon: 'ChartBarIcon' },
{ key: 'fulfillment', label: 'Fulfillment', icon: 'TruckIcon' },
{ key: 'courier', label: 'Courier & Shipping', icon: 'TruckIcon' },
{ key: 'earnings', label: 'Earnings & Payouts', icon: 'BanknotesIcon' },
{ key: 'inbox', label: 'Buyer Inbox', icon: 'ChatBubbleLeftRightIcon', badge: 3 },
{ key: 'disputes', label: 'Disputes & Messages', icon: 'ChatBubbleLeftRightIcon', badge: 2 },
{ key: 'notifications', label: 'Notifications', icon: 'BellIcon' },
{ key: 'upload', label: 'Upload Catalog', icon: 'ArrowUpTrayIcon' },
{ key: 'profile', label: 'Business Profile', icon: 'BuildingOfficeIcon' }];


export default function SellerDashboardLayout() {
  const [activeTab, setActiveTab] = useState<SellerTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <span className="text-xs bg-secondary/10 text-secondary border border-secondary/20 rounded-full px-2.5 py-0.5 font-700">Seller Portal</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-success/10 border border-success/20 rounded-xl px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-600 text-success">Store Live</span>
          </div>
          <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
            <Icon name="BellIcon" size={18} className="text-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-muted">
              <AppImage
                src="https://img.rocket.new/generatedImages/rocket_gen_img_11db5aac6-1763292644655.png"
                alt="Seller Arjun Sharma profile photo"
                width={32} height={32} className="object-cover" />
              
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-700 text-foreground">Surat Textile Mills</p>
              <p className="text-xs text-muted-foreground mono-id">FT-SLR-001234</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`fixed md:static inset-y-0 left-0 z-30 w-56 seller-sidebar pt-14 md:pt-0 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-4 space-y-1 overflow-y-auto h-full">
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-700 text-muted-foreground uppercase tracking-widest">Seller Menu</p>
            </div>
            {navItems.map((item) =>
            <button
              key={item.key}
              onClick={() => {setActiveTab(item.key);setSidebarOpen(false);}}
              className={`sidebar-nav-item w-full text-left ${activeTab === item.key ? 'active' : ''}`}>
              
                <Icon name={item.icon as 'HomeIcon'} size={18} />
                <span className="flex-1">{item.label}</span>
                {item.badge &&
              <span className="bg-primary text-white text-xs font-700 w-5 h-5 rounded-full flex items-center justify-center">{item.badge}</span>
              }
              </button>
            )}
            <div className="pt-4 mt-4 border-t border-border">
              <Link href="/marketplace" className="sidebar-nav-item w-full text-left flex items-center gap-3">
                <Icon name="GlobeAltIcon" size={18} />
                <span>View Marketplace</span>
              </Link>
            </div>

            {/* Low Stock Alert */}
            <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="ExclamationTriangleIcon" size={14} className="text-error" />
                <p className="text-xs font-700 text-error">Low Stock Alert</p>
              </div>
              <p className="text-xs text-muted-foreground">3 products below minimum stock threshold</p>
            </div>
          </div>
        </aside>

        {sidebarOpen &&
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
        }

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0">
          {activeTab === 'overview' && <SellerOverview onNavigate={setActiveTab} />}
          {activeTab === 'orders' && <SellerOrders />}
          {activeTab === 'inventory' && <SellerInventory />}
          {activeTab === 'analytics' && <SellerAnalytics />}
          {activeTab === 'earnings' && <SellerEarnings />}
          {activeTab === 'disputes' && <SellerDisputes />}
          {activeTab === 'fulfillment' && <SellerFulfillment />}
          {activeTab === 'categories' && <SellerCategories />}
          {activeTab === 'courier' && <SellerCourierSettings />}
          {activeTab === 'inbox' && <SellerInbox />}
          {activeTab === 'notifications' && <NotificationPreferences mode="seller" />}
          {activeTab === 'upload' && <SellerWhatsAppUpload />}
          {activeTab === 'profile' &&
          <div className="max-w-2xl">
              <h2 className="text-xl font-800 text-foreground mb-6">Business Profile</h2>
              <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-border">
                  <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                    <span className="text-2xl font-800 text-white">ST</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-800 text-foreground">Surat Textile Mills Pvt Ltd</p>
                      <span className="badge-verified">Verified</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Manufacturer · Surat, Gujarat</p>
                    <p className="mono-id">FT-SLR-001234</p>
                  </div>
                </div>
                {[
              { label: 'GSTIN', value: '24AAAPL1234Z1Z5', verified: true },
              { label: 'PAN', value: 'AAAPL1234Z', verified: true },
              { label: 'Business Type', value: 'Manufacturer' },
              { label: 'Categories', value: 'Net Fabric, Embroidered, Georgette' },
              { label: 'Monthly Capacity', value: '50,000 metres' },
              { label: 'Pickup Address', value: 'Plot 45, Ring Road, Surat - 395003' },
              { label: 'Settlement Bank', value: 'HDFC Bank ****4521', verified: true }].
              map((field) =>
              <div key={field.label} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                    <div>
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p className="text-sm font-600 text-foreground">{field.value}</p>
                    </div>
                    {field.verified && <span className="badge-verified">Verified</span>}
                  </div>
              )}
              </div>
            </div>
          }
        </main>
      </div>
    </div>);

}