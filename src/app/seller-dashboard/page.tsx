'use client';
import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import SellerDashboardLayout from '@/app/seller-dashboard/components/SellerDashboardLayout';

function DashboardRouteState({
  title,
  message,
  href,
  actionLabel,
}: {
  title: string;
  message: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className="ft-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="ft-card w-full max-w-md p-6 text-center sm:p-8">
        <div className="mb-6 flex items-center justify-center gap-2">
          <AppLogo size={36} />
          <span className="text-lg font-800 text-foreground">FabricTrad</span>
        </div>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-secondary/20 bg-secondary/10">
          <Icon name="ArrowPathIcon" size={22} className="animate-spin text-secondary" />
        </div>
        <h1 className="text-xl font-800 text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        <Link href={href} className="ft-primary-action mt-6 inline-flex w-full justify-center px-4 py-3 text-sm">
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

export default function SellerDashboardPage() {
  const { user, profile, loading, isDemoAccount, refreshProfile } = useAuth();
  const router = useRouter();
  const [accountReady, setAccountReady] = useState(false);
  const [accountError, setAccountError] = useState('');

  useEffect(() => {
    if (loading || !user || accountReady) return;
    if (isDemoAccount) {
      setAccountReady(true);
      return;
    }
    let cancelled = false;
    const prepare = async () => {
      try {
        const response = await fetch('/api/auth/provision-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: '{}',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'Account setup failed.');
        await refreshProfile();
        if (!cancelled) setAccountReady(true);
      } catch (error) {
        if (!cancelled) setAccountError(error instanceof Error ? error.message : 'Account setup failed.');
      }
    };
    void prepare();
    return () => {
      cancelled = true;
    };
  }, [accountReady, isDemoAccount, loading, profile, refreshProfile, user]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login?role=seller');
      return;
    }

    if (!profile) return;

    if (!(profile.can_sell ?? profile.role === 'seller')) {
      router.replace('/seller-registration');
      return;
    }

    if (profile.role === 'admin_staff' || profile.role === 'super_admin') {
      router.replace('/admin-portal');
      return;
    }

    if (!profile.phone) {
      router.replace('/auth/phone?role=seller');
    }
  }, [user, profile, loading, router]);

  if (accountError) {
    return (
      <DashboardRouteState
        title="Account setup needs attention"
        message={accountError}
        href="/login?role=seller"
        actionLabel="Sign in again"
      />
    );
  }

  if (loading || (user && !accountReady)) {
    return (
      <div className="ft-shell flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
          <p className="text-sm font-600 text-muted-foreground">Loading your seller workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <DashboardRouteState
        title="Sign in required"
        message="Please sign in to open your seller workspace."
        href="/login?role=seller"
        actionLabel="Sign in"
      />
    );
  }

  if (!profile) {
    return (
      <DashboardRouteState
        title="Finishing account setup"
        message="Your login is active, but your seller profile is still being prepared. Continue to complete setup."
        href="/auth/phone?role=seller"
        actionLabel="Continue setup"
      />
    );
  }

  if (!(profile.can_sell ?? profile.role === 'seller')) {
    return (
      <DashboardRouteState
        title="Activate seller access"
        message="This account can already buy. Add your GST business details once to unlock seller tools on the same mobile number."
        href="/seller-registration"
        actionLabel="Activate selling"
      />
    );
  }

  if (profile.role === 'admin_staff' || profile.role === 'super_admin') {
    return (
      <DashboardRouteState
        title="Opening admin portal"
        message="This account has admin access, so the seller workspace is not shown for it."
        href="/admin-portal"
        actionLabel="Go to admin portal"
      />
    );
  }

  if (!profile.phone) {
    return (
      <DashboardRouteState
        title="Complete seller setup"
        message="Add your phone number to finish account setup and open your seller tools."
        href="/auth/phone?role=seller"
        actionLabel="Add phone number"
      />
    );
  }

  return (
    <div className="ft-shell">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
          </div>
        }
      >
        <SellerDashboardLayout />
      </Suspense>
    </div>
  );
}
