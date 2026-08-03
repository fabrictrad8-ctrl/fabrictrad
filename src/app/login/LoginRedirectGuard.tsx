'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type AccountRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';

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
 * A fail-safe for mobile custom tabs, slow provisioning requests and auth
 * callbacks whose UI state is delayed. Once a session exists, use a full
 * document navigation so server middleware reads the newly persisted cookies
 * and opens the correct workspace without requiring a manual refresh.
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
    const supabase = createClient();

    const checkPersistedSession = async () => {
      if (cancelled || window.location.pathname !== '/login') return;
      attempts += 1;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          let role = roleFromUser(session.user);
          const { data: persistedProfile } = await supabase
            .from('user_profiles')
            .select('role,is_active')
            .eq('id', session.user.id)
            .maybeSingle();

          if (persistedProfile?.is_active === false) {
            await supabase.auth.signOut().catch(() => undefined);
            window.location.replace('/login?error=account_inactive');
            return;
          }
          if (
            persistedProfile?.role === 'seller' ||
            persistedProfile?.role === 'admin_staff' ||
            persistedProfile?.role === 'super_admin' ||
            persistedProfile?.role === 'buyer'
          ) {
            role = persistedProfile.role;
          }

          window.location.replace(destinationFor(role, requestedNext));
          return;
        }
      } catch {
        // The normal AuthContext path remains active. Retry briefly because
        // session cookies may be written a moment after the password response.
      }

      if (!cancelled && attempts < 40) {
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
