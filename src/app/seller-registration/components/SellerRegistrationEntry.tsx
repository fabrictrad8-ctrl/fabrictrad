'use client';

import SellerApplicationResume from './SellerApplicationResume';
import SellerRegistrationFlowV2 from './SellerRegistrationFlowV2';
import { useAuth } from '@/contexts/AuthContext';

export default function SellerRegistrationEntry() {
  const { user, profile, loading, profileLoading } = useAuth();

  if (loading || profileLoading) {
    return (
      <section className="min-h-screen bg-muted/30 px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Preparing seller onboarding…</p>
        </div>
      </section>
    );
  }

  if (user && profile?.can_sell) return <SellerApplicationResume />;
  return <SellerRegistrationFlowV2 />;
}
