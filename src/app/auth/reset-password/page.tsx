'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

export default function ResetPasswordPage() {
  const { user, session, loading, updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isAdminRecovery, setIsAdminRecovery] = useState(false);

  useEffect(() => {
    setIsAdminRecovery(new URLSearchParams(window.location.search).get('admin') === '1');
  }, []);

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      setError('Your new password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two password entries do not match.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await updatePassword(password);
      await signOut();
      window.location.replace(
        isAdminRecovery ? '/admin-login?password_updated=1' : '/login?password_updated=1'
      );
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update your password.');
      setSubmitting(false);
    }
  };

  const recoverySessionReady = Boolean(user && session);
  const recoveryLoginHref = isAdminRecovery
    ? '/admin-login?error=recovery_failed' :'/login?error=recovery_failed';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d1117] px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(202,91,47,0.17),transparent_32%),radial-gradient(circle_at_86%_18%,rgba(62,77,111,0.22),transparent_35%)]" />
      <div className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#151a21]/95 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-7">
        <Link href="/" className="inline-flex items-center gap-2.5" aria-label="FabricTrad home">
          <AppLogo size={38} />
          <span className="text-xl font-800 text-white">FabricTrad</span>
        </Link>

        <p className="mt-7 text-xs font-800 uppercase tracking-[0.16em] text-orange-300">Password recovery</p>
        <h1 className="mt-2 text-3xl font-800 tracking-tight text-white">Choose a new password</h1>

        {loading ? (
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-4 py-4 text-sm text-slate-300">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
            Verifying your password reset request…
          </div>
        ) : recoverySessionReady ? (
          <form className="mt-7 space-y-5" onSubmit={savePassword}>
            {error && (
              <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <label className="block text-sm text-slate-300">
              New password
              <span className="relative mt-2 block">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 pr-16 text-white outline-none focus:border-orange-400/60"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 px-4 text-xs font-700 text-slate-400 hover:text-white"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>

            <label className="block text-sm text-slate-300">
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 text-white outline-none focus:border-orange-400/60"
                placeholder="Repeat your new password"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white transition hover:bg-[#d45c36] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Updating password…' : 'Save new password'}
            </button>
          </form>
        ) : (
          <div className="mt-7 space-y-5">
            <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm leading-6 text-rose-200">
              This password reset link is invalid, expired, or has already been used. Request a new recovery email from the sign-in page.
            </div>
            <Link
              href={recoveryLoginHref}
              className="block w-full rounded-xl bg-[#c65330] px-4 py-3.5 text-center font-700 text-white transition hover:bg-[#d45c36]"
            >
              Request a new reset email
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
