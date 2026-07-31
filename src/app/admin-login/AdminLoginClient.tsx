'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

type AdminRole = 'admin_staff' | 'super_admin';

type RoleResponse = {
  role?: string;
  error?: string;
};

export default function AdminLoginClient() {
  const router = useRouter();
  const { signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Enter your administrator email and password.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await signIn(normalizedEmail, password);
      const response = await fetch('/api/auth/resolve-role', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as RoleResponse;
      if (!response.ok) throw new Error(payload.error || 'Unable to verify administrator access.');

      const role = payload.role as AdminRole | undefined;
      if (role !== 'admin_staff' && role !== 'super_admin') {
        await signOut();
        throw new Error('This account does not have administrator access.');
      }

      router.replace('/admin-portal');
      router.refresh();
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Administrator sign-in failed.');
      setSubmitting(false);
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
          <p className="mt-8 text-xs font-800 uppercase tracking-[0.18em] text-orange-300">Restricted administration</p>
          <h1 className="mt-4 max-w-xl text-5xl font-800 leading-[1.02] tracking-[-0.04em] text-white">
            FabricTrad Admin Portal
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
            Manage users, catalog approvals, orders, settlements, platform operations and business analytics from the secure administrator workspace.
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
            <p className="text-xs font-800 uppercase tracking-[0.16em] text-orange-300">Administrator access</p>
            <h2 className="mt-2 text-3xl font-800 tracking-tight text-white">Open admin dashboard</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Sign in using an active FabricTrad administrator account. Buyer and seller accounts cannot enter this portal.
            </p>

            {error && (
              <div role="alert" className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <label className="block text-sm text-slate-300">
                Administrator email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/10"
                  placeholder="admin@fabrictrad.com"
                  required
                />
              </label>

              <label className="block text-sm text-slate-300">
                Password
                <span className="relative mt-2 block">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 pr-16 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/10"
                    placeholder="Enter your password"
                    required
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

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white transition hover:bg-[#d45c36] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Verifying access…' : 'Enter admin dashboard'}
              </button>
            </form>

            <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 text-center text-sm">
              <Link href="/login" className="font-700 text-orange-300 hover:text-orange-200">
                Reset password or use normal sign in
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
