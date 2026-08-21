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

type WorkspaceStatus = {
  canBuy: boolean;
  canSell: boolean;
  buyer: {
    active: boolean;
    verified: boolean;
    type: string | null;
    label: string;
    needsAction: boolean;
  };
  seller: {
    active: boolean;
    verified: boolean;
    label: string;
    needsAction: boolean;
  };
  verificationSummary: string;
};

type ReadinessItem = {
  label: string;
  complete: boolean;
  detail: string;
  href?: string;
};

export default function AccountHomePage() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus | null>(null);
  const [workspaceStatusReady, setWorkspaceStatusReady] = useState(false);

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
  const displayName =
    profile?.business_name || profile?.full_name || user?.email?.split('@')[0] || 'FabricTrad account';

  useEffect(() => {
    if (!user || !profile) return;
    const controller = new AbortController();
    setWorkspaceStatusReady(false);

    const loadWorkspaceStatus = async () => {
      try {
        const response = await fetch('/api/account/workspace-status', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as WorkspaceStatus & {
          error?: string;
        };
        if (response.ok && !controller.signal.aborted) setWorkspaceStatus(payload);
      } catch {
        // Capability fields below remain a safe fallback if the status endpoint is temporarily unavailable.
      } finally {
        if (!controller.signal.aborted) setWorkspaceStatusReady(true);
      }
    };

    void loadWorkspaceStatus();
    return () => controller.abort();
  }, [profile, user]);

  const buyerVerified = workspaceStatus?.buyer.verified ?? (canBuy && profile?.account_kind === 'individual');
  const sellerVerified = workspaceStatus?.seller.verified ?? (canSell && profile?.verification_status === 'verified');
  const buyerDetail = workspaceStatus?.buyer.label || (workspaceStatusReady ? (buyerVerified ? 'Buyer access active' : 'Buyer setup needs attention') : 'Checking buyer status…');
  const sellerDetail = workspaceStatus?.seller.label || (workspaceStatusReady ? (sellerVerified ? 'Verified seller' : 'Seller setup needs attention') : 'Checking seller status…');

  const onboarding = useMemo<ReadinessItem[]>(() => {
    const items: ReadinessItem[] = [
      {
        label: 'Account created',
        complete: Boolean(user),
        detail: user?.email || '',
        href: '/profile',
      },
      {
        label: 'Contact number',
        complete: Boolean(profile?.phone),
        detail: profile?.phone ? `+91 ${profile.phone}` : 'Add your mobile number',
        href: '/profile',
      },
      {
        label: 'Delivery address',
        complete: Boolean(profile?.address_line1 && profile?.city && profile?.pincode),
        detail: [profile?.city, profile?.state].filter(Boolean).join(', ') || 'Add address',
        href: '/profile?tab=address',
      },
    ];

    if (canBuy) {
      items.push({
        label: 'Buyer verification',
        complete: buyerVerified,
        detail: buyerDetail,
        href: workspaceStatusReady && !buyerVerified ? '/buyer-registration' : undefined,
      });
    }

    if (canSell) {
      items.push({
        label: 'Seller verification',
        complete: sellerVerified,
        detail: sellerDetail,
        href: workspaceStatusReady && !sellerVerified ? '/seller-registration' : undefined,
      });
    }

    return items;
  }, [buyerDetail, buyerVerified, canBuy, canSell, profile, sellerDetail, sellerVerified, user, workspaceStatusReady]);

  const completedSteps = onboarding.filter((step) => step.complete).length;
  const verificationSummary =
    workspaceStatus?.verificationSummary ||
    (!workspaceStatusReady
      ? 'Checking workspace verification…'
      : canBuy && canSell
        ? `Buyer ${buyerVerified ? 'active' : 'setup pending'} · Seller ${sellerVerified ? 'verified' : 'review pending'}`
        : canSell
          ? sellerDetail
          : buyerDetail);

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
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-800 text-primary">
                One account · separate workspaces
              </span>
              <h1 className="mt-4 text-3xl font-800 tracking-tight text-foreground sm:text-4xl">
                Welcome, {displayName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Buyer and seller tools stay in their own workspaces. If this account has both permissions,
                switch explicitly from the workspace controls instead of being redirected between roles.
              </p>
            </div>
            <div className="min-w-64 rounded-2xl border border-border bg-muted/40 p-5">
              <div className="flex items-center justify-between text-xs font-800 text-muted-foreground">
                <span>Account setup</span>
                <span>{completedSteps}/{onboarding.length}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(completedSteps / onboarding.length) * 100}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Verification is read independently for buying and selling, so one workspace can never show
                the other workspace&apos;s pending state.
              </p>
            </div>
          </div>
        </section>

        <section className={`mt-6 grid gap-5 ${canBuy && canSell ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {canBuy && (
            <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon name="ShoppingBagIcon" size={23} />
                </span>
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-800 text-success">
                  {buyerVerified ? 'Active' : 'Buyer access'}
                </span>
              </div>
              <h2 className="mt-5 text-2xl font-800 text-foreground">Buyer workspace</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Search products, place personal or business orders, pay securely, download documents and track shipments.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link href="/marketplace" className="ft-primary-action inline-flex items-center justify-center gap-2 px-4 py-3 text-sm">
                  <Icon name="Squares2X2Icon" size={16} /> Marketplace
                </Link>
                <Link href="/buyer-dashboard" className="ft-secondary-action inline-flex items-center justify-center gap-2 px-4 py-3 text-sm">
                  <Icon name="HomeIcon" size={16} /> Dashboard
                </Link>
              </div>
            </article>
          )}

          {canSell && (
            <article className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  <Icon name="BuildingStorefrontIcon" size={23} />
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-800 ${sellerVerified ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                  {sellerVerified ? 'Verified' : 'Seller access'}
                </span>
              </div>
              <h2 className="mt-5 text-2xl font-800 text-foreground">Seller workspace</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Publish colour-level catalogues, process orders, upload invoices, manage inventory and payouts.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link href="/seller-dashboard" className="ft-primary-action inline-flex items-center justify-center gap-2 px-4 py-3 text-sm">
                  <Icon name="HomeIcon" size={16} /> Dashboard
                </Link>
                <Link href="/seller-dashboard?tab=upload" className="ft-secondary-action inline-flex items-center justify-center gap-2 px-4 py-3 text-sm">
                  <Icon name="PlusCircleIcon" size={16} /> Add product
                </Link>
              </div>
            </article>
          )}
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
              {onboarding.map((step) => {
                const row = (
                  <>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${step.complete ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      <Icon name={step.complete ? 'CheckIcon' : 'ClockIcon'} size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-800 text-foreground">{step.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{step.detail}</span>
                    </span>
                    {step.href && <Icon name="ChevronRightIcon" size={15} className="text-muted-foreground" />}
                  </>
                );

                return step.href ? (
                  <Link
                    key={step.label}
                    href={step.href}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary"
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={step.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    {row}
                  </div>
                );
              })}
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
                ['Verification', verificationSummary],
                ['GSTIN', profile.gstin || 'Not added'],
                ['Location', [profile.city, profile.state].filter(Boolean).join(', ') || 'Not added'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <dt className="text-xs font-800 uppercase tracking-wider text-muted-foreground">{label}</dt>
                  <dd className="max-w-[65%] break-words text-right text-sm font-800 text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={signingOut}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm font-800 text-error hover:bg-error hover:text-white disabled:opacity-50"
            >
              <Icon name="ArrowRightOnRectangleIcon" size={17} />
              {signingOut ? 'Signing out…' : 'Sign out of FabricTrad'}
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
