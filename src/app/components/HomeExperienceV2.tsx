'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PublicAccessLanding from '@/app/components/PublicAccessLanding';
import { useAuth } from '@/contexts/AuthContext';

const destinationForRole = (role?: string | null) => {
  if (role === 'seller') return '/seller-dashboard';
  if (role === 'admin_staff' || role === 'super_admin') return '/admin-portal';
  return '/marketplace';
};

export default function HomeExperienceV2() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && profile) {
      router.replace(destinationForRole(profile.role));
    }
  }, [loading, profile, router, user]);

  if (loading || (user && profile)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  return <PublicAccessLanding />;
}
