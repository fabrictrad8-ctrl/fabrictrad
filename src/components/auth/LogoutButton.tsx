'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const AUTH_PATH_PREFIXES = [
  '/login',
  '/admin-login',
  '/buyer-registration',
  '/seller-registration',
  '/auth',
];

export default function LogoutButton() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const isAuthenticationPage = AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (loading || !user || isAuthenticationPage) return null;

  const handleLogout = () => {
    if (loggingOut) return;
    setLoggingOut(true);

    // A server redirect clears both Supabase and demo cookies before the login page is rendered.
    // Hard navigation also prevents a protected workspace from flashing while React state settles.
    window.location.replace('/api/auth/logout');
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      aria-label={loggingOut ? 'Logging out' : 'Log out of FabricTrad'}
      className="fixed bottom-4 right-4 z-[70] inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card/95 px-4 py-2.5 text-sm font-800 text-foreground shadow-xl shadow-black/15 backdrop-blur-lg transition hover:-translate-y-0.5 hover:border-orange-400/60 hover:text-orange-500 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-75 sm:bottom-6 sm:right-6"
    >
      {loggingOut ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        <Icon name="ArrowRightStartOnRectangleIcon" size={18} aria-hidden="true" />
      )}
      <span>{loggingOut ? 'Leaving…' : 'Log out'}</span>
    </button>
  );
}
