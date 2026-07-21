'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import PublicAccessLanding from '@/app/components/PublicAccessLanding';

export default function HomeExperience() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user || !profile) return;

    if (profile.role === 'seller') {
      router.replace('/seller-dashboard');
      return;
    }

    if (profile.role === 'admin_staff' || profile.role === 'super_admin') {
      router.replace('/admin-portal');
      return;
    }

    router.replace('/buyer-dashboard');
  }, [loading, profile, router, user]);

  if (loading || (user && profile)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-700 text-muted-foreground">
            {user ? 'Opening your FabricTrad workspace…' : 'Loading FabricTrad…'}
          </p>
        </div>
      </main>
    );
  }

  return <PublicAccessLanding />;
}
