'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

type AdminRole = 'admin_staff' | 'super_admin';
type RecoveryResponse = { error?: string; sent?: boolean; method?: string };

const DEFAULT_ADMIN_EMAIL = 'fabrictrad8@gmail.com';
const isAdminRole = (role: unknown): role is AdminRole =>
  role === 'admin_staff' || role === 'super_admin';

export default function AdminLoginClient() {
  const { user, profile, loading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const passwordUpdated = new URLSearchParams(window.location.search).get('password_updated');
      if (passwordUpdated === '1') {
        setInfo('Administrator password updated. Sign in with the new password.');
      }
    }
  }, []);

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.is_active && isAdminRole(profile.role)) {
      window.location.replace('/admin-portal');
    }
  }, [loading, profile, user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInfo('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Enter the administrator email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signIn(normalizedEmail, password);
      const signedInEmail = String(result?.user?.email || '').trim().toLowerCase();
      const role = result?.role as AdminRole | undefined;

      if (!signedInEmail || !isAdminRole(role)) {
        await signOut().catch(() => undefined);
        throw new Error('This account does not have FabricTrad administrator access.');
      }

      window.location.replace('/admin-portal');
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : '';
      setError(
        /invalid login credentials|email not confirmed/i.test(message)
          ? 'The administrator email or password is incorrect.'
          : message || 'Administrator sign-in failed. Please try again.'
      );
      setSubmitting(false);
    }
  };

  const sendRecoveryEmail = async () => {
    setError('');
    setInfo('');
    setRecoverySubmitting(true);

    try {
      const response = await fetch('/api/auth/admin-password-recovery/request', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as RecoveryResponse;
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to send the administrator recovery email.');
      }
      setInfo(
        `A password-reset email was sent to the configured administrator inbox (${DEFAULT_ADMIN_EMAIL}).`
      );
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to send the administrator recovery email.'
      );
    } finally {
      setRecoverySubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0d1117] px-4 py-8 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(202,91,47,0.17),transparent_32%),radial-gradient(circle_at_86%_18%,rgba(62,77,111,0.22),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="FabricTrad home">
            <AppLogo size={44} />
            <span className="text-2xl font-800 tracking-tight text-white">FabricTrad</span>
          </Link>
          <p className="mt-8 text-xs font-800 uppercase tracking-[0.18em] text-orange-300">
            Restricted administration
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-800 leading-[1.02] tracking-[-0.04em] text-white">
            FabricTrad Admin Portal
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
            Sign in with the administrator account already stored securely in FabricTrad. Access
            is granted only after the server confirms an active administrator role.
          </p>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-6 text-center lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <AppLogo size={38} />
              <span className="text-xl font-800 text-white">FabricTrad</span>
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-[#151a21]/95 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-7">
            <p className="text-xs font-800 uppercase tracking-[0.16em] text-orange-300">
              Administrator access
            </p>
            <h2 className="mt-2 text-3xl font-800 tracking-tight text-white">
              Sign in to Admin Portal
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Use your administrator email and password. Email delivery is no longer required for
              normal access.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200"
              >
                {error}
              </div>
            )}
            {info && (
              <div
                aria-live="polite"
                className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200"
              >
                {info}
              </div>
            )}

            <form className="mt-6 space-y-5" onSubmit={submit}>
              <label className="block text-sm font-700 text-slate-300">
                Administrator email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 text-white outline-none transition placeholder:text-slate-600 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/10"
                />
              </label>

              <label className="block text-sm font-700 text-slate-300">
                Password
                <div className="relative mt-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 pr-20 text-white outline-none transition placeholder:text-slate-600 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-3 text-xs font-700 text-orange-300 hover:text-orange-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={submitting || recoverySubmitting}
                className="w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white transition hover:bg-[#d45c36] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Checking administrator access…' : 'Open Admin Portal'}
              </button>
            </form>

            <button
              type="button"
              onClick={sendRecoveryEmail}
              disabled={submitting || recoverySubmitting}
              className="mt-4 w-full text-sm font-700 text-orange-300 hover:text-orange-200 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              {recoverySubmitting ? 'Sending recovery email…' : 'Forgot administrator password?'}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              For launch security, enable authenticator-app MFA for administrator accounts after
              signing in.
            </p>

            <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 text-center text-sm">
              <Link href="/login" className="font-700 text-orange-300 hover:text-orange-200">
                Buyer and seller sign in
              </Link>
              <Link href="/" className="text-slate-400 hover:text-white">
                Back to FabricTrad
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
