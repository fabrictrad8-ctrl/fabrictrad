'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

export default function BuyerOnlyGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, loading, profileLoading } = useAuth();
  const isSeller = profile?.role === 'seller';

  useEffect(() => {
    if (!loading && !profileLoading && isSeller) {
      router.replace('/seller-dashboard?tab=requests');
    }
  }, [isSeller, loading, profileLoading, router]);

  if (loading || profileLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </main>
    );
  }

  if (isSeller) {
    return (
      <main className="min-h-screen bg-muted/30">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
          <AppLogo size={44} />
          <div className="mt-5 rounded-2xl border border-border bg-card p-6">
            <Icon name="ShieldCheckIcon" size={28} className="mx-auto mb-3 text-secondary" />
            <h1 className="text-lg font-800 text-foreground">Buyer area</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Marketplace, vendor listings, categories, and product pages are for buyer accounts.
              Sellers can manage their own catalog and respond to buyer requests from the seller
              dashboard.
            </p>
            <Link
              href="/seller-dashboard?tab=requests"
              className="btn-primary mt-5 inline-flex w-full justify-center rounded-xl px-4 py-3 text-sm"
            >
              Open Buyer Requests
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
