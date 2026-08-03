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
  if (requestedNext) return requestedNext;
  return role === 'seller' ? '/account' : '/marketplace';
};

const roleFromUser = (user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): AccountRole => {
  const role = user.app_metadata?.role || user.user_metadata?.role;
  return role === 'seller' || role === 'admin_staff' || role === 'super_admin'
    ? role
    : 'buyer';
};

/**
 * A fail-safe for mobile custom tabs, slow provisioning requests and delayed
 * client auth state. The server endpoint reads the newly persisted Supabase
 * cookie, validates the account and returns the database-backed workspace.
 */
export default function LoginRedirectGuard() {
  const searchParams = useSearchParams();
  const { user, profile, loading } = useAuth();
  const requestedNext = useMemo(
    () => safeNextPath(searchParams.get('next')),
    [searchParams]
  );

  useEffect(() => {
    if (loading || !user) return;

    const role = (profile?.role || roleFromUser(user)) as AccountRole;
    const destination = destinationFor(role, requestedNext);

    const timer = window.setTimeout(() => {
      if (window.location.pathname === '/login') {
        window.location.replace(destination);
      }
    }, 25);

    return () => window.clearTimeout(timer);
  }, [loading, profile?.role, requestedNext, user]);

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

        if (response.ok && payload.ready && payload.destination?.startsWith('/')) {
          window.location.replace(payload.destination);
          return;
        }

        if (response.status === 403) {
          window.location.replace('/login?error=account_inactive');
          return;
        }
      } catch {
        // The normal AuthContext path remains active. Retry briefly because
        // the browser may still be writing the freshly issued auth cookie.
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
