'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type AccountRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';

const safeNextPath = (value: string | null) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
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

/**
 * A fail-safe for mobile custom tabs and slow provisioning requests.
 * Supabase may already have completed authentication while the submit handler
 * is still waiting. Once the session exists, use a document navigation so
 * middleware can validate the account and open the correct workspace.
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

    const role = (
      profile?.role ||
      user.app_metadata?.role ||
      user.user_metadata?.role ||
      'buyer'
    ) as AccountRole;
    const destination = destinationFor(role, requestedNext);

    const timer = window.setTimeout(() => {
      if (window.location.pathname === '/login') {
        window.location.replace(destination);
      }
    }, 50);

    return () => window.clearTimeout(timer);
  }, [loading, profile?.role, requestedNext, user]);

  return null;
}
