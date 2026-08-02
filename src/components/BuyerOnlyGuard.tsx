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
  const buyingDisabled = !!profile && profile.can_buy === false;

  useEffect(() => {
    if (!loading && !profileLoading && !user) {
      const query = searchParams.toString();
      const next = `${pathname || '/marketplace'}${query ? `?${query}` : ''}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
    if (!loading && !profileLoading && buyingDisabled) router.replace('/profile');
  }, [buyingDisabled, loading, pathname, profileLoading, router, searchParams, user]);

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
    return (
      <main className="min-h-screen bg-muted/30">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
          <AppLogo size={44} />
          <div className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-xl">
            <Icon name="ShoppingBagIcon" size={28} className="mx-auto mb-3 text-primary" />
            <h1 className="text-lg font-800 text-foreground">Buying access is not enabled</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This account currently has selling access only. Review the account capabilities or contact FabricTrad support to enable purchasing.
            </p>
            <Link href="/profile" className="btn-primary mt-5 inline-flex w-full justify-center rounded-xl px-4 py-3 text-sm">
              Review account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
