'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

export default function SellerCapabilityGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, loading, profileLoading } = useAuth();
  const sellingDisabled = !!profile && !profile.can_sell;

  useEffect(() => {
    if (!loading && !profileLoading && !user) router.replace('/login?role=seller');
  }, [loading, profileLoading, router, user]);

  if (loading || profileLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </main>
    );
  }

  if (!user) return null;

  if (sellingDisabled) {
    return (
      <main className="min-h-screen bg-muted/30">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
          <AppLogo size={44} />
          <div className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-xl">
            <Icon name="BuildingStorefrontIcon" size={28} className="mx-auto mb-3 text-primary" />
            <h1 className="text-lg font-800 text-foreground">Activate selling tools</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Complete business verification before creating catalog pricing, publishing inventory or receiving buyer orders.
            </p>
            <Link href="/seller-registration" className="btn-primary mt-5 inline-flex w-full justify-center rounded-xl px-4 py-3 text-sm">
              Activate seller access
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}