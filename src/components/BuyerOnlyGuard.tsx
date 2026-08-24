'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

export default function BuyerOnlyGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile, loading, profileLoading } = useAuth();
  const primarySeller = profile?.role === 'seller';
  const buyingDisabled = !!profile && (primarySeller || profile.can_buy === false);

  useEffect(() => {
    if (!loading && !profileLoading && !user) {
      const query = searchParams.toString();
      const next = `${pathname || '/marketplace'}${query ? `?${query}` : ''}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
    if (!loading && !profileLoading && buyingDisabled) {
      router.replace(primarySeller ? '/seller-dashboard' : '/profile');
    }
  }, [buyingDisabled, loading, pathname, primarySeller, profileLoading, router, searchParams, user]);

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

  if (buyingDisabled) {
    const destination = primarySeller ? '/seller-dashboard' : '/profile';
    return (
      <main className="min-h-screen bg-muted/30">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
          <AppLogo size={44} />
          <div className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-xl">
            <Icon name="ShoppingBagIcon" size={28} className="mx-auto mb-3 text-primary" />
            <h1 className="text-lg font-800 text-foreground">
              {primarySeller ? 'This is a seller account' : 'Buying access is not enabled'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {primarySeller
                ? 'Seller accounts stay inside the Seller workspace and cannot open buyer-only dashboards or place buyer orders.'
                : 'This account is not currently enabled for purchasing. Review the account profile or contact FabricTrad support.'}
            </p>
            <Link href={destination} className="btn-primary mt-5 inline-flex w-full justify-center rounded-xl px-4 py-3 text-sm">
              {primarySeller ? 'Return to Seller workspace' : 'Review account'}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
