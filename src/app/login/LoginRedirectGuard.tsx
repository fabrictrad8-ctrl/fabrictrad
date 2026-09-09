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
/** Ceiling for the whole poll, covering transient network failures. */
const MAX_ATTEMPTS = 60;
/**
 * How many consecutive definitive "not signed in" replies to tolerate before
 * giving up. Two seconds is ample for the browser to persist an auth cookie
 * immediately after sign-in, and it stops a signed-out visitor from hammering
 * the endpoint for the full attempt ceiling.
 */
const UNAUTHENTICATED_GRACE_ATTEMPTS = 8;

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
    let unauthenticatedReplies = 0;
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

        // 401 is a definitive "no session", not a transient error. Only a short
        // grace window is needed, to cover the moment just after sign-in where
        // the auth cookie has not finished persisting. Polling all the way to
        // the attempt ceiling meant every signed-out visitor fired dozens of
        // failing requests at this endpoint for fifteen seconds.
        if (response.status === 401) {
          unauthenticatedReplies += 1;
          if (unauthenticatedReplies >= UNAUTHENTICATED_GRACE_ATTEMPTS) return;
        } else {
          unauthenticatedReplies = 0;
        }
      } catch {
        // Network hiccup rather than an answer — keep retrying within the ceiling.
      }

      if (!cancelled && attempts < MAX_ATTEMPTS) {
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
