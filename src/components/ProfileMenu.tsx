'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type MenuItem = {
  label: string;
  href: string;
  icon: string;
};

const buyerItems: MenuItem[] = [
  { label: 'Buyer Profile', href: '/profile?tab=personal', icon: 'UserCircleIcon' },
  { label: 'Buyer Home', href: '/buyer-dashboard', icon: 'ChartBarSquareIcon' },
  { label: 'My Orders', href: '/buyer-dashboard?tab=orders', icon: 'ShoppingBagIcon' },
  { label: 'Track My Orders', href: '/buyer-dashboard?tab=tracking', icon: 'TruckIcon' },
  { label: 'Saved Fabrics', href: '/buyer-dashboard?tab=wishlist', icon: 'HeartIcon' },
  { label: 'My Sourcing Requests', href: '/buyer-dashboard?tab=requirements', icon: 'MegaphoneIcon' },
  { label: 'Support & Disputes', href: '/buyer-dashboard?tab=disputes', icon: 'ChatBubbleLeftRightIcon' },
  { label: 'AI Drape Studio', href: '/product-detail#drape-on', icon: 'SparklesIcon' },
];

const sellerItems: MenuItem[] = [
  { label: 'Store Profile', href: '/profile?tab=business', icon: 'BuildingOfficeIcon' },
  { label: 'Seller Home', href: '/seller-dashboard', icon: 'BuildingStorefrontIcon' },
  { label: 'Add a Product', href: '/seller-dashboard?tab=upload', icon: 'PlusCircleIcon' },
  { label: 'Orders to Fulfil', href: '/seller-dashboard?tab=orders', icon: 'ClipboardDocumentListIcon' },
  { label: 'Products & Stock', href: '/seller-dashboard?tab=inventory', icon: 'ArchiveBoxIcon' },
  { label: 'Colours, Designs & GTIN', href: '/seller-dashboard?tab=variants', icon: 'SwatchIcon' },
  { label: 'Payouts & Settlements', href: '/seller-dashboard?tab=earnings', icon: 'BanknotesIcon' },
  { label: 'Buyer Enquiries', href: '/seller-dashboard?tab=inbox', icon: 'ChatBubbleLeftRightIcon' },
  { label: 'Sales Analytics', href: '/seller-dashboard?tab=analytics', icon: 'ChartBarIcon' },
];

const adminItems: MenuItem[] = [
  { label: 'Administrator Home', href: '/admin-portal', icon: 'ChartPieIcon' },
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
  const { user, profile } = useAuth();

  const isAdmin = profile?.role === 'admin_staff' || profile?.role === 'super_admin';
  const isSeller = profile?.role === 'seller';
  const items = isAdmin ? adminItems : isSeller ? sellerItems : buyerItems;
  const dashboardHref = isAdmin ? '/admin-portal' : isSeller ? '/seller-dashboard' : '/buyer-dashboard';
  const dashboardLabel = isAdmin ? 'Administrator Home' : isSeller ? 'Seller Home' : 'Buyer Home';
  const roleLabel = isAdmin ? 'Administrator' : isSeller ? 'Seller account' : 'Buyer account';
  const name = isSeller
    ? profile?.business_name || profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0]
    : profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0];
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

  const handleSignOut = () => {
    setOpen(false);
    window.location.assign('/api/auth/logout');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
        aria-expanded={open}
        aria-label={`Open ${roleLabel.toLowerCase()} menu`}
      >
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10">
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
        <span className="hidden max-w-[120px] truncate text-left text-xs font-800 text-foreground lg:block">
          {name || roleLabel}
        </span>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[320px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="bg-gradient-to-r from-primary/10 via-card to-accent/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border bg-primary/10">
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
                <p className="truncate text-sm font-800 text-foreground">{name || roleLabel}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-800 uppercase ${
                      isAdmin
                        ? 'bg-error/10 text-error'
                        : isSeller
                          ? 'bg-primary/10 text-primary' :'bg-secondary/10 text-secondary'
                    }`}
                  >
                    {roleLabel}
                  </span>
                  {profile?.phone && <span className="text-[10px] font-700 text-success">Phone verified</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-border p-3">
            <Link
              href={dashboardHref}
              onClick={() => setOpen(false)}
              className="rounded-xl bg-primary px-3 py-2.5 text-center text-xs font-800 text-white hover:opacity-90"
            >
              {dashboardLabel}
            </Link>
            <Link
              href="/profile?tab=security"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-muted px-3 py-2.5 text-center text-xs font-800 text-foreground hover:bg-primary/10 hover:text-primary"
            >
              Security
            </Link>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {items.map((item) => (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-600 text-foreground transition-colors hover:bg-muted"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/60">
                  <Icon name={item.icon} size={16} className="text-muted-foreground" />
                </span>
                <span className="flex-1">{item.label}</span>
              </Link>
            ))}
          </div>

          {!isAdmin && (
            <p className="border-t border-border px-4 py-3 text-[11px] leading-5 text-muted-foreground">
              To use a different account type, sign out first and sign in with that account.
            </p>
          )}

          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-700 text-error transition-colors hover:bg-error/10"
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
