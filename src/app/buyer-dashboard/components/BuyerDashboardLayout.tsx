'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import BuyerOverview from '@/app/buyer-dashboard/components/BuyerOverview';
import BuyerOrders from '@/app/buyer-dashboard/components/BuyerOrders';
import BuyerTracking from '@/app/buyer-dashboard/components/BuyerTracking';
import BuyerWishlist from '@/app/buyer-dashboard/components/BuyerWishlist';
import DisputeMessaging from '@/app/buyer-dashboard/components/DisputeMessaging';
import NotificationPreferences from '@/app/components/NotificationPreferences';

type DashTab = 'overview' | 'orders' | 'tracking' | 'wishlist' | 'disputes' | 'notifications' | 'account';

const navItems: {key: DashTab;label: string;icon: string;badge?: number;}[] = [
{ key: 'overview', label: 'Overview', icon: 'HomeIcon' },
{ key: 'orders', label: 'My Orders', icon: 'ShoppingBagIcon', badge: 3 },
{ key: 'tracking', label: 'Track Shipments', icon: 'TruckIcon', badge: 2 },
{ key: 'wishlist', label: 'Wishlist', icon: 'HeartIcon' },
{ key: 'disputes', label: 'Disputes & Messages', icon: 'ChatBubbleLeftRightIcon', badge: 2 },
{ key: 'notifications', label: 'Notifications', icon: 'BellIcon' },
{ key: 'account', label: 'Account', icon: 'UserCircleIcon' }];


export default function BuyerDashboardLayout() {
  const [activeTab, setActiveTab] = useState<DashTab>('overview');
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
          <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 font-700">Buyer Portal</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
            <Icon name="BellIcon" size={18} className="text-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-muted">
              <AppImage
                src="https://img.rocket.new/generatedImages/rocket_gen_img_1e0b06c28-1763294358632.png"
                alt="Buyer Rajesh Mehta profile photo"
                width={32} height={32} className="object-cover" />
              
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-700 text-foreground">Rajesh Mehta</p>
              <p className="text-xs text-muted-foreground mono-id">FT-BYR-004521</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`fixed md:static inset-y-0 left-0 z-30 w-56 seller-sidebar pt-14 md:pt-0 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-4 space-y-1 overflow-y-auto h-full">
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-700 text-muted-foreground uppercase tracking-widest">Navigation</p>
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
                <Icon name="ShoppingBagIcon" size={18} />
                <span>Back to Shop</span>
              </Link>
            </div>

            {/* Try-On Credits */}
            <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="SparklesIcon" size={14} className="text-primary" />
                <p className="text-xs font-700 text-primary">Virtual Try-On</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">2 free credits remaining</p>
              <button className="btn-primary w-full py-1.5 text-xs rounded-lg">Buy Credits ₹10/img</button>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen &&
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
        }

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0">
          {activeTab === 'overview' && <BuyerOverview onNavigate={setActiveTab} />}
          {activeTab === 'orders' && <BuyerOrders />}
          {activeTab === 'tracking' && <BuyerTracking />}
          {activeTab === 'wishlist' && <BuyerWishlist />}
          {activeTab === 'disputes' && <DisputeMessaging mode="buyer" />}
          {activeTab === 'notifications' && <NotificationPreferences mode="buyer" />}
          {activeTab === 'account' &&
          <div className="max-w-lg">
              <h2 className="text-xl font-800 text-foreground mb-6">Account Settings</h2>
              <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-border">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted">
                    <AppImage src="https://img.rocket.new/generatedImages/rocket_gen_img_1cbee50a4-1763296279384.png" alt="Rajesh Mehta buyer profile photo" width={64} height={64} className="object-cover" />
                  </div>
                  <div>
                    <p className="font-800 text-foreground">Rajesh Mehta</p>
                    <p className="text-sm text-muted-foreground">Mehta Garments, Mumbai</p>
                    <p className="mono-id">FT-BYR-004521</p>
                  </div>
                </div>
                {[
              { label: 'Mobile', value: '+91 98765 43210', verified: true },
              { label: 'Email', value: 'rajesh@mehtagarments.com', verified: true },
              { label: 'GSTIN', value: '27AAACM1234Z1Z5', verified: true },
              { label: 'Business Type', value: 'Wholesaler' }].
              map((field) =>
              <div key={field.label} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                    <div>
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p className="text-sm font-600 text-foreground">{field.value}</p>
                    </div>
                    {field.verified &&
                <span className="badge-verified">Verified</span>
                }
                  </div>
              )}
              </div>
            </div>
          }
        </main>
      </div>
    </div>);

}