'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const redirectExistingAdmin = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active || !session?.user) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (
        active &&
        (data?.role === 'super_admin' || data?.role === 'admin_staff')
      ) {
        router.replace('/admin-portal');
      }
    };

    void redirectExistingAdmin();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

      if (!data.user) {
        throw new Error('Unable to verify this account. Please try again.');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profileData?.role === 'super_admin' || profileData?.role === 'admin_staff') {
        router.replace('/admin-portal');
        return;
      }

      await supabase.auth.signOut();
      setError('Access denied. This sign-in is restricted to FabricTrad administrators.');
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] px-4 py-10 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(200,96,10,0.18),transparent_32%),radial-gradient(circle_at_85%_18%,rgba(45,67,105,0.35),transparent_35%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:42px_42px]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <section className="w-full max-w-md">
          <div className="mb-7 text-center">
            <Link href="/" className="mb-6 inline-flex items-center gap-2.5" aria-label="Return to FabricTrad">
              <AppLogo size={38} />
              <span className="text-xl font-800 tracking-tight text-white">FabricTrad</span>
            </Link>

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-300/25 bg-red-400/10 shadow-lg shadow-red-950/20">
              <Icon name="ShieldCheckIcon" size={27} className="text-red-200" />
            </div>
            <h1 className="text-3xl font-800 tracking-tight text-white">Admin Portal</h1>
            <p className="mt-2 text-sm text-slate-400">Restricted access for authorised administrators</p>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-[#0d192b]/95 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-7">
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-300/20 bg-red-400/10 p-3.5">
              <Icon name="ExclamationTriangleIcon" size={16} className="mt-0.5 shrink-0 text-red-200" />
              <p className="text-xs leading-5 text-red-100">
                This area is restricted to FabricTrad administrators. Unauthorised access attempts are logged.
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-300/25 bg-red-500/15 p-3.5" role="alert">
                <Icon name="XCircleIcon" size={16} className="mt-0.5 shrink-0 text-red-200" />
                <p className="text-xs leading-5 text-red-100">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="mb-1.5 block text-sm font-700 text-slate-200">
                  Admin email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@fabrictrad.com"
                  required
                  className="w-full rounded-xl border border-white/15 bg-[#101f34] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/25"
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="mb-1.5 block text-sm font-700 text-slate-200">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Admin password"
                    required
                    className="w-full rounded-xl border border-white/15 bg-[#101f34] px-4 py-3 pr-11 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={17} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex w-full items-center justify-center rounded-xl bg-orange-600 px-4 py-3.5 text-sm font-800 text-white shadow-lg shadow-orange-950/25 transition hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Authenticating…
                  </span>
                ) : (
                  'Access Admin Portal'
                )}
              </button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-5 text-center">
              <Link href="/" className="text-xs font-700 text-slate-400 transition hover:text-white">
                ← Return to FabricTrad
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Not an administrator?{' '}
            <Link href="/login" className="font-700 text-slate-300 underline decoration-slate-600 underline-offset-4 hover:text-white">
              Buyer or seller sign-in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
