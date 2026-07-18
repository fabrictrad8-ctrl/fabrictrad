'use client';
import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import BuyerDashboardLayout from '@/app/buyer-dashboard/components/BuyerDashboardLayout';

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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center card-shadow-lg">
        <div className="flex items-center justify-center gap-2 mb-6">
          <AppLogo size={36} />
          <span className="font-display text-lg font-800 text-secondary">FabricTrad</span>
        </div>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
          <Icon name="ArrowPathIcon" size={22} className="text-primary animate-spin" />
        </div>
        <h1 className="text-xl font-800 text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Link
          href={href}
          className="btn-primary mt-6 inline-flex w-full justify-center rounded-xl py-3"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

export default function BuyerDashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login?role=buyer');
      return;
    }

    if (!profile) return;

    if (profile.role === 'seller') {
      router.replace('/seller-dashboard');
      return;
    }

    if (profile.role === 'admin_staff' || profile.role === 'super_admin') {
      router.replace('/admin-portal');
      return;
    }

    if (!profile.phone) {
      router.replace('/auth/phone?role=buyer');
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-600 text-muted-foreground">Loading your buyer account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <DashboardRouteState
        title="Sign in required"
        message="Please sign in to open your buyer dashboard."
        href="/login?role=buyer"
        actionLabel="Sign In"
      />
    );
  }

  if (!profile) {
    return (
      <DashboardRouteState
        title="Finishing account setup"
        message="Your login is active, but your account profile is still being prepared. Continue to complete setup."
        href="/auth/phone?role=buyer"
        actionLabel="Continue Setup"
      />
    );
  }

  if (profile.role === 'seller') {
    return (
      <DashboardRouteState
        title="Opening seller dashboard"
        message="This account is registered as a seller, so we are taking you to the seller tools."
        href="/seller-dashboard"
        actionLabel="Go to Seller Dashboard"
      />
    );
  }

  if (profile.role === 'admin_staff' || profile.role === 'super_admin') {
    return (
      <DashboardRouteState
        title="Opening admin portal"
        message="This account has admin access, so the buyer dashboard is not shown for it."
        href="/admin-portal"
        actionLabel="Go to Admin Portal"
      />
    );
  }

  if (!profile.phone) {
    return (
      <DashboardRouteState
        title="Complete buyer setup"
        message="Add your phone number to finish account setup and open your dashboard."
        href="/auth/phone?role=buyer"
        actionLabel="Add Phone Number"
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BuyerDashboardLayout />
    </Suspense>
  );
}
