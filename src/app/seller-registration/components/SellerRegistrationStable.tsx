'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import SellerRegistrationEntry from './SellerRegistrationEntry';
import SellerRegistrationFlowV2 from './SellerRegistrationFlowV2';
import SellerReviewStatus, { type SellerReviewStatusData } from './SellerReviewStatus';

const cacheKey = (userId: string) => `fabrictrad:seller-review:${userId}`;

const readCachedStatus = (userId?: string): SellerReviewStatusData | null => {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SellerReviewStatusData;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeCachedStatus = (userId: string, status: SellerReviewStatusData) => {
  try {
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(status));
  } catch {
    // Database state remains the source of truth if browser storage is unavailable.
  }
};

export default function SellerRegistrationStable() {
  const { user, profile, loading, profileLoading } = useAuth();
  const [liveStatus, setLiveStatus] = useState<SellerReviewStatusData | null>(null);
  const [refreshError, setRefreshError] = useState('');

  const cachedStatus = useMemo(() => readCachedStatus(user?.id), [user?.id]);
  const status = liveStatus || cachedStatus;

  useEffect(() => {
    if (!user || !profile?.can_sell) {
      setLiveStatus(null);
      setRefreshError('');
      return;
    }

    let cancelled = false;
    let activeController: AbortController | null = null;

    const loadStatus = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const timeout = window.setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch('/api/seller/verification-status', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as SellerReviewStatusData & {
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || 'Seller status could not be refreshed.');
        if (cancelled) return;
        setLiveStatus(payload);
        setRefreshError('');
        writeCachedStatus(user.id, payload);
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          setRefreshError('Status refresh timed out.');
        } else {
          setRefreshError(caught instanceof Error ? caught.message : 'Seller status could not be refreshed.');
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void loadStatus();

    // While onboarding is incomplete, check frequently so a successful final
    // submit switches to the review page automatically. Once submitted, use a
    // light background refresh only.
    const interval = window.setInterval(
      () => void loadStatus(),
      status?.applicationSubmitted ? 30000 : 2500
    );

    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') void loadStatus();
    };
    document.addEventListener('visibilitychange', refreshOnVisible);

    return () => {
      cancelled = true;
      activeController?.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [profile?.can_sell, status?.applicationSubmitted, user]);

  if (loading || profileLoading) {
    return (
      <section className="min-h-screen bg-muted/30 px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Restoring your account…</p>
        </div>
      </section>
    );
  }

  if (!user) return <SellerRegistrationEntry />;

  if (profile?.can_sell && status?.applicationSubmitted) {
    return <SellerReviewStatus status={status} refreshError={refreshError} />;
  }

  return <SellerRegistrationFlowV2 />;
}
