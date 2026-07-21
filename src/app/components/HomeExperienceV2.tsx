'use client';

import HomeExperience from '@/app/components/HomeExperience';
import ModernLandingPage from '@/app/components/ModernLandingPage';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeExperienceV2() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  if (profile?.role === 'seller' || profile?.role === 'admin_staff' || profile?.role === 'super_admin') {
    return <HomeExperience />;
  }

  return <ModernLandingPage />;
}
