'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type AccountRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';

type DestinationResponse = {
  authenticated?: boolean;
  ready?: boolean;
  destination?: string;
  error?: string;
};

const PRODUCTION_ORIGIN = 'https://fabrictrad.com';

const safeNextPath = (value: string | null) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const parsed = new URL(value, PRODUCTION_ORIGIN);
    if (parsed.origin !== PRODUCTION_ORIGIN) return null;
    if (parsed.pathname === '/login' || parsed.pathname.startsWith('/auth/')) return null;
    if (parsed.pathname.startsWith('/admin-')) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

const destinationFor = (role: AccountRole, requestedNext: string | null) => {
  if (role === 'admin_staff' || role === 'super_admin') return '/admin-portal';
  if (role === 'seller') return '/seller-dashboard';
  if (requestedNext) return requestedNext;
  return '/marketplace';
};

/**
 * A fail-safe for mobile custom tabs, slow provisioning requests and delayed
 * client auth state. The database-backed profile wins. When the profile is
 * missing, the server session endpoint performs a safe repair instead of the
 * browser guessing a role from stale auth metadata.
 */
export default function LoginRedirectGuard() {
  const searchParams = useSearchParams();
  const { user, profile, loading } = useAuth();
  const requestedNext = useMemo(
    () => safeNextPath(searchParams.get('next')),
    [searchParams]
  );

  useEffect(() => {
    if (loading || !user || !profile) return;

    const destination = destinationFor(profile.role as AccountRole, requestedNext);
    const timer = window.setTimeout(() => {
      if (window.location.pathname === '/login') {
        window.location.replace(destination);
      }
    }, 25);

    return () => window.clearTimeout(timer);
  }, [loading, profile, requestedNext, user]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const query = requestedNext ? `?next=${encodeURIComponent(requestedNext)}` : '';

    const checkPersistedSession = async () => {
      if (cancelled || window.location.pathname !== '/login') return;
      attempts += 1;

      try {
        const response = await fetch(`/api/auth/session-destination${query}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const payload = (await response.json().catch(() => ({}))) as DestinationResponse;

        if (response.ok && payload.authenticated && payload.destination?.startsWith('/')) {
          window.location.replace(payload.destination);
          return;
        }

        if (response.status === 403) {
          window.location.replace('/login?error=account_inactive');
          return;
        }
      } catch {
        // Retry briefly while the browser finishes persisting the auth cookie.
      }

      if (!cancelled && attempts < 60) {
        timer = window.setTimeout(checkPersistedSession, 250);
      }
    };

    timer = window.setTimeout(checkPersistedSession, 100);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [requestedNext]);

  return null;
}
