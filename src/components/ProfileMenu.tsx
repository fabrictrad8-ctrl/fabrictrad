'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type MenuItem = {
  label: string;
  href: string;
  icon: string;
  badge?: string;
};

const buyerItems: MenuItem[] = [
  { label: 'Your Profile', href: '/profile?tab=personal', icon: 'UserCircleIcon' },
  { label: 'Purchases', href: '/buyer-dashboard?tab=orders', icon: 'ShoppingBagIcon' },
  { label: 'Order History', href: '/buyer-dashboard?tab=tracking', icon: 'ClockIcon' },
  { label: 'Wishlist', href: '/buyer-dashboard?tab=wishlist', icon: 'HeartIcon' },
  { label: 'Requirements', href: '/buyer-dashboard?tab=requirements', icon: 'MegaphoneIcon' },
  { label: 'Messages', href: '/buyer-dashboard?tab=disputes', icon: 'ChatBubbleLeftRightIcon' },
  { label: 'Notifications', href: '/buyer-dashboard?tab=notifications', icon: 'BellIcon' },
  { label: 'AI Drape Credits', href: '/product-detail#drape-on', icon: 'SparklesIcon' },
];

const sellerItems: MenuItem[] = [
  { label: 'Business Profile', href: '/profile?tab=business', icon: 'BuildingOfficeIcon' },
  { label: 'Seller Dashboard', href: '/seller-dashboard', icon: 'HomeIcon' },
  {
    label: 'Orders',
    href: '/seller-dashboard?tab=orders',
    icon: 'ClipboardDocumentListIcon',
  },
  { label: 'Listings', href: '/seller-dashboard?tab=inventory', icon: 'ArchiveBoxIcon' },
  { label: 'Earnings', href: '/seller-dashboard?tab=earnings', icon: 'BanknotesIcon' },
  {
    label: 'Buyer Inbox',
    href: '/seller-dashboard?tab=inbox',
    icon: 'ChatBubbleLeftRightIcon',
  },
  { label: 'Buyer Requests', href: '/seller-dashboard?tab=requests', icon: 'MegaphoneIcon' },
  { label: 'Analytics', href: '/seller-dashboard?tab=analytics', icon: 'ChartBarIcon' },
  { label: 'Shipping', href: '/seller-dashboard?tab=fulfillment', icon: 'TruckIcon' },
  { label: 'Notifications', href: '/seller-dashboard?tab=notifications', icon: 'BellIcon' },
];

const adminItems: MenuItem[] = [
  { label: 'Admin Dashboard', href: '/admin-portal', icon: 'ChartPieIcon' },
  { label: 'Payments', href: '/admin-portal?tab=payments', icon: 'CreditCardIcon' },
  { label: 'Orders', href: '/admin-portal?tab=orders', icon: 'ClipboardDocumentListIcon' },
  { label: 'Sellers', href: '/admin-portal?tab=sellers', icon: 'BuildingStorefrontIcon' },
  { label: 'Listings', href: '/admin-portal?tab=listings', icon: 'ArchiveBoxIcon' },
  { label: 'Error Monitor', href: '/admin-portal?tab=errors', icon: 'ExclamationTriangleIcon' },
  { label: 'Security', href: '/profile?tab=security', icon: 'LockClosedIcon' },
];

function getInitials(name?: string, email?: string) {
  const source = name?.trim() || email?.trim() || 'FT';
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  const isSeller = profile?.role === 'seller';
  const isAdmin = profile?.role === 'admin_staff' || profile?.role === 'super_admin';
  const items = isAdmin ? adminItems : isSeller ? sellerItems : buyerItems;
  const dashboardHref = isAdmin
    ? '/admin-portal'
    : isSeller
      ? '/seller-dashboard'
      : '/buyer-dashboard';
  const roleLabel = isAdmin ? 'Admin' : isSeller ? 'Seller' : 'Buyer';
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0];
  const initials = getInitials(name, user?.email);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    router.push('/');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full border border-border bg-card pl-1 pr-2 py-1 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        <span className="h-9 w-9 overflow-hidden rounded-full bg-primary/10 border border-border flex items-center justify-center">
          {profile?.avatar_url ? (
            <AppImage
              src={profile.avatar_url}
              alt={`${name || 'User'} profile photo`}
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs font-800 text-primary">{initials}</span>
          )}
        </span>
        <span className="hidden lg:block max-w-[120px] truncate text-left text-xs font-800 text-foreground">
          {name || 'Account'}
        </span>
        <Icon
          name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'}
          size={14}
          className="text-muted-foreground"
        />
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-[310px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="bg-gradient-to-r from-primary/10 via-card to-secondary/10 p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-primary/10 border border-border flex items-center justify-center">
                {profile?.avatar_url ? (
                  <AppImage
                    src={profile.avatar_url}
                    alt={`${name || 'User'} profile photo`}
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-800 text-primary">{initials}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-800 text-foreground">
                  {name || 'FabricTrad User'}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-800 uppercase ${
                      isAdmin
                        ? 'bg-error/10 text-error'
                        : isSeller
                          ? 'bg-secondary/10 text-secondary'
                          : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {roleLabel}
                  </span>
                  {profile?.phone && (
                    <span className="text-[10px] font-700 text-success">Phone added</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-border p-3">
            <Link
              href={dashboardHref}
              onClick={() => setOpen(false)}
              className="rounded-lg bg-muted px-3 py-2 text-center text-xs font-800 text-foreground hover:bg-primary/10 hover:text-primary"
            >
              Dashboard
            </Link>
            <Link
              href="/profile?tab=security"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-muted px-3 py-2 text-center text-xs font-800 text-foreground hover:bg-primary/10 hover:text-primary"
            >
              Security
            </Link>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-600 text-foreground transition-colors hover:bg-muted"
              >
                <Icon name={item.icon} size={17} className="text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-800 text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-700 text-error transition-colors hover:bg-error/10"
            >
              <Icon name="ArrowRightOnRectangleIcon" size={17} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
