'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import ProfileMenu from '@/components/ProfileMenu';
import PreferenceControls from '@/components/PreferenceControls';
import DeleteAccountPanel from '@/components/account/DeleteAccountPanel';
import { useAuth } from '@/contexts/AuthContext';

export default function AccountHomePage() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && profile && (profile.role === 'super_admin' || profile.role === 'admin_staff')) {
      router.replace('/admin-portal');
    }
  }, [loading, profile, router, user]);

  const canBuy = Boolean(
    profile?.can_buy ?? (profile?.role === 'buyer' || profile?.role === 'seller')
  );
  const canSell = Boolean(profile?.can_sell || profile?.role === 'seller');
  const displayName = profile?.business_name || profile?.full_name || user?.email?.split('@')[0] || 'FabricTrad account';

  const onboarding = useMemo(
    () => [
      { label: 'Account created', complete: Boolean(user), href: '/profile', detail: user?.email || '' },
      { label: 'Contact number', complete: Boolean(profile?.phone), href: '/auth/phone?role=buyer', detail: profile?.phone ? `+91 ${profile.phone}` : 'Add your mobile number' },
      { label: 'Delivery address', complete: Boolean(profile?.address_line1 && profile?.city && profile?.pincode), href: '/profile?tab=address', detail: [profile?.city, profile?.state].filter(Boolean).join(', ') || 'Add address' },
      { label: 'Buyer verification', complete: profile?.account_kind === 'individual' || profile?.verification_status === 'verified', href: '/buyer-registration', detail: profile?.verification_status || 'Complete buyer setup' },
      { label: 'Seller verification', complete: canSell, href: '/seller-registration', detail: canSell ? 'Seller access active' : 'Optional: verify GST business to sell' },
    ],
    [canSell, profile, user]
  );
  const completedSteps = onboarding.filter((step) => step.complete).length;

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      window.location.replace('/login');
    }
  };

  if (loading || !user || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f1f1f1] dark:bg-background">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f1f1f1] text-foreground dark:bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur-xl sm:px-6">
        <Link href="/account" className="flex items-center gap-2.5">
          <AppLogo size={32} />
          <span className="text-sm font-800 text-foreground">FabricTrad Account</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <PreferenceControls compact />
          <ProfileMenu />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-800 text-primary">One account · multiple workspaces</span>
              <h1 className="mt-4 text-3xl font-800 tracking-tight text-foreground sm:text-4xl">Welcome, {displayName}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Use the same verified email and mobile number to buy fabrics, manage business purchasing, and activate seller tools without creating a duplicate account.
              </p>
            </div>
            <div className="min-w-64 rounded-2xl border border-border bg-muted/40 p-5">
              <div className="flex items-center justify-between text-xs font-800 text-muted-foreground">
                <span>Account setup</span><span>{completedSteps}/{onboarding.length}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(completedSteps / onboarding.length) * 100}%` }} />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Complete your profile once. FabricTrad reuses the verified information across buyer and seller workflows.</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon name="ShoppingBagIcon" size={23} /></span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-800 ${canBuy ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{canBuy ? 'Active' : 'Setup required'}</span>
            </div>
            <h2 className="mt-5 text-2xl font-800 text-foreground">Buyer workspace</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Search products, place personal or business orders, pay securely, download documents and track shipments.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link href="/marketplace" className="ft-primary-action inline-flex items-center justify-center gap-2 px-4 py-3 text-sm"><Icon name="Squares2X2Icon" size={16} /> Marketplace</Link>
              <Link href="/buyer-dashboard" className="ft-secondary-action inline-flex items-center justify-center gap-2 px-4 py-3 text-sm"><Icon name="HomeIcon" size={16} /> Dashboard</Link>
            </div>
          </article>

          <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary"><Icon name="BuildingStorefrontIcon" size={23} /></span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-800 ${canSell ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{canSell ? 'Active' : 'Optional'}</span>
            </div>
            <h2 className="mt-5 text-2xl font-800 text-foreground">Seller workspace</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Verify GST and bank information, publish colour-level catalogues, process orders, upload invoices and manage payouts.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link href={canSell ? '/seller-dashboard' : '/seller-registration'} className="ft-primary-action inline-flex items-center justify-center gap-2 px-4 py-3 text-sm">
                <Icon name={canSell ? 'HomeIcon' : 'ShieldCheckIcon'} size={16} /> {canSell ? 'Dashboard' : 'Activate selling'}
              </Link>
              <Link href={canSell ? '/seller-dashboard?tab=upload' : '/seller-registration'} className="ft-secondary-action inline-flex items-center justify-center gap-2 px-4 py-3 text-sm">
                <Icon name="PlusCircleIcon" size={16} /> {canSell ? 'Add product' : 'Requirements'}
              </Link>
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-800 uppercase tracking-wider text-primary">Onboarding</p>
                <h2 className="mt-1 text-xl font-800 text-foreground">Account readiness</h2>
              </div>
              <Link href="/profile" className="text-xs font-800 text-primary hover:underline">Manage profile</Link>
            </div>
            <div className="mt-5 divide-y divide-border">
              {onboarding.map((step) => (
                <Link key={step.label} href={step.href} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${step.complete ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    <Icon name={step.complete ? 'CheckIcon' : 'ClockIcon'} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-800 text-foreground">{step.label}</span>
                    <span className="block truncate text-xs capitalize text-muted-foreground">{step.detail}</span>
                  </span>
                  <Icon name="ChevronRightIcon" size={15} className="text-muted-foreground" />
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-800 uppercase tracking-wider text-secondary">Account details</p>
            <h2 className="mt-1 text-xl font-800 text-foreground">Identity and access</h2>
            <dl className="mt-5 space-y-4">
              {[
                ['Email', user.email || 'Not available'],
                ['Mobile', profile.phone ? `+91 ${profile.phone}` : 'Not added'],
                ['Access', canBuy && canSell ? 'Buyer + Seller' : canSell ? 'Seller' : 'Buyer'],
                ['Verification', profile.verification_status || 'unverified'],
                ['GSTIN', profile.gstin || 'Not added'],
                ['Location', [profile.city, profile.state].filter(Boolean).join(', ') || 'Not added'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <dt className="text-xs font-800 uppercase tracking-wider text-muted-foreground">{label}</dt>
                  <dd className="max-w-[65%] break-words text-right text-sm font-800 capitalize text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            <button type="button" onClick={() => void logout()} disabled={signingOut} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm font-800 text-error hover:bg-error hover:text-white disabled:opacity-50">
              <Icon name="ArrowRightOnRectangleIcon" size={17} /> {signingOut ? 'Signing out…' : 'Sign out of FabricTrad'}
            </button>
          </article>
        </section>

        <DeleteAccountPanel
          accountAccess={canBuy && canSell ? 'Buyer and seller' : canSell ? 'Seller' : 'Buyer'}
          email={user.email || ''}
        />
      </div>
    </main>
  );
}
