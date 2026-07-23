'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type LoginRole = 'buyer' | 'seller';
type LoginMethod = 'otp' | 'password';
type AccountRole = LoginRole | 'admin_staff' | 'super_admin';

type SignInResult = {
  role?: AccountRole | null;
  user?: {
    app_metadata?: { role?: AccountRole };
    user_metadata?: { role?: AccountRole };
  } | null;
};

type RoleResponse = {
  role?: AccountRole;
  error?: string;
};

const destinationForRole = (role?: AccountRole | null) => {
  if (role === 'seller') return '/seller-dashboard';
  if (role === 'admin_staff' || role === 'super_admin') return '/admin-portal';
  return '/marketplace';
};

const resolveAuthenticatedRole = async (fallbackRole: AccountRole): Promise<AccountRole> => {
  const response = await fetch('/api/auth/resolve-role', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as RoleResponse;
  if (!response.ok) throw new Error(payload.error || 'Unable to open this account.');
  return payload.role || fallbackRole;
};

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    signIn,
    signInWithGoogle,
    googleAuthEnabled,
    verifyEmailOtp,
    user,
    profile,
    loading,
  } = useAuth();

  const [role, setRole] = useState<LoginRole>('buyer');
  const [method, setMethod] = useState<LoginMethod>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    const requestedRole = searchParams.get('role');
    if (requestedRole === 'seller') setRole('seller');

    const authError = searchParams.get('error');
    if (authError === 'account_inactive') {
      setError('This account is inactive. Please contact FabricTrad support.');
    } else if (authError === 'auth_failed') {
      setError('Authentication failed. Please try again.');
    } else if (authError === 'profile_setup_failed') {
      setError('Your account was authenticated, but its profile could not be completed.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (loading || !user || !profile) return;

    if (!profile.phone && profile.role !== 'admin_staff' && profile.role !== 'super_admin') {
      router.replace(`/auth/phone?role=${profile.role}`);
      return;
    }

    router.replace(destinationForRole(profile.role));
  }, [loading, profile, router, user]);

  const chooseRole = (nextRole: LoginRole) => {
    if (submitting) return;
    setRole(nextRole);
    setOtpSent(false);
    setOtp(['', '', '', '', '', '']);
    setError('');
    setInfo('');
  };

  const switchMethod = (nextMethod: LoginMethod) => {
    if (submitting) return;
    setMethod(nextMethod);
    setOtpSent(false);
    setOtp(['', '', '', '', '', '']);
    setError('');
    setInfo('');
  };

  const continueToWorkspace = (authenticatedRole: AccountRole) => {
    router.replace(destinationForRole(authenticatedRole));
    router.refresh();
  };

  const handlePasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    try {
      const result = (await signIn(email, password)) as SignInResult;
      const fallbackRole =
        result.role || result.user?.app_metadata?.role || result.user?.user_metadata?.role || role;
      const authenticatedRole = await resolveAuthenticatedRole(fallbackRole);
      continueToWorkspace(authenticatedRole);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Invalid email or password.');
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setInfo('');
    setSubmitting(true);

    try {
      await signInWithGoogle(role);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Google sign-in failed.');
      setSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter the email address linked to your FabricTrad account.');
      return;
    }

    setError('');
    setInfo('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/email-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to send the sign-in code.');

      setOtpSent(true);
      setOtp(['', '', '', '', '', '']);
      setInfo(`A six-digit sign-in code was sent to ${normalizedEmail}.`);
      window.setTimeout(() => document.getElementById('login-otp-0')?.focus(), 50);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to send the sign-in code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtp((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));

    if (digit && index < 5) {
      document.getElementById(`login-otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`login-otp-${index - 1}`)?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const token = otp.join('');
    if (token.length !== 6) {
      setError('Enter the complete six-digit code.');
      return;
    }

    setError('');
    setInfo('');
    setSubmitting(true);

    try {
      const result = await verifyEmailOtp(email.trim().toLowerCase(), token);
      const fallbackRole =
        (result?.user?.app_metadata?.role as AccountRole | undefined) ||
        (result?.user?.user_metadata?.role as AccountRole | undefined) ||
        role;
      const authenticatedRole = await resolveAuthenticatedRole(fallbackRole);
      continueToWorkspace(authenticatedRole);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'The code is invalid or expired.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09111f]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#09111f] px-4 py-10 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(218,119,48,0.18),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(64,84,130,0.28),transparent_34%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:44px_44px]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="FabricTrad home">
            <AppLogo size={44} />
            <span className="text-2xl font-800 tracking-tight text-white">FabricTrad</span>
          </Link>
          <p className="mt-8 text-xs font-800 uppercase tracking-[0.18em] text-orange-300">
            Private B2B textile commerce
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-800 leading-[1.02] tracking-[-0.04em] text-white">
            Secure access for verified textile businesses.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
            Use the email linked to your account. Buyers enter sourcing and orders, while sellers enter store operations and fulfilment.
          </p>
          <div className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              ['ShoppingBagIcon', 'Buyer', 'Marketplace, sourcing, orders and shipment tracking'],
              ['BuildingStorefrontIcon', 'Seller', 'Inventory, quotations, fulfilment and payouts'],
            ].map(([icon, title, copy]) => (
              <div key={title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-orange-300">
                  <Icon name={icon as 'ShoppingBagIcon'} size={17} />
                </span>
                <span>
                  <strong className="block text-white">{title}</strong>
                  <span className="text-xs leading-5 text-slate-400">{copy}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-8 flex max-w-lg items-start gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-4">
            <Icon name="ShieldCheckIcon" size={18} className="mt-0.5 shrink-0 text-emerald-300" />
            <p className="text-xs leading-5 text-slate-400">
              Email codes are sent only to registered accounts. Access requires control of the account inbox.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-6 text-center lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <AppLogo size={38} />
              <span className="text-xl font-800 text-white">FabricTrad</span>
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-[#101a2a]/95 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-7">
            <div>
              <p className="text-xs font-800 uppercase tracking-[0.16em] text-orange-300">Welcome back</p>
              <h2 className="mt-2 text-3xl font-800 tracking-tight text-white">Sign in to FabricTrad</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Select your account type and use the email linked to your account.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/10 bg-black/10 p-1">
              <button
                type="button"
                onClick={() => chooseRole('buyer')}
                className={`rounded-lg px-3 py-2.5 text-sm font-700 transition ${
                  role === 'buyer' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Buyer
              </button>
              <button
                type="button"
                onClick={() => chooseRole('seller')}
                className={`rounded-lg px-3 py-2.5 text-sm font-700 transition ${
                  role === 'seller' ? 'bg-indigo-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Seller
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => switchMethod('otp')}
                className={`rounded-xl border px-3 py-2.5 text-xs font-700 transition ${
                  method === 'otp'
                    ? 'border-orange-400/40 bg-orange-400/10 text-orange-200'
                    : 'border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                Email code
              </button>
              <button
                type="button"
                onClick={() => switchMethod('password')}
                className={`rounded-xl border px-3 py-2.5 text-xs font-700 transition ${
                  method === 'password'
                    ? 'border-orange-400/40 bg-orange-400/10 text-orange-200'
                    : 'border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                Password
              </button>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-300/20 bg-red-400/10 p-3" role="alert">
                <Icon name="ExclamationTriangleIcon" size={15} className="mt-0.5 shrink-0 text-red-200" />
                <p className="text-xs leading-5 text-red-100">{error}</p>
              </div>
            )}

            {info && !error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3" role="status">
                <Icon name="CheckCircleIcon" size={15} className="mt-0.5 shrink-0 text-emerald-200" />
                <p className="text-xs leading-5 text-emerald-100">{info}</p>
              </div>
            )}

            {method === 'otp' ? (
              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="otp-email" className="mb-1.5 block text-sm font-700 text-slate-200">
                    Account email
                  </label>
                  <input
                    id="otp-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (otpSent) {
                        setOtpSent(false);
                        setOtp(['', '', '', '', '', '']);
                        setInfo('');
                      }
                    }}
                    placeholder="you@company.com"
                    className="w-full rounded-xl border border-white/15 bg-[#0c1625] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                  />
                </div>

                {!otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={submitting}
                    className="w-full rounded-xl bg-orange-600 px-4 py-3.5 text-sm font-800 text-white transition hover:bg-orange-500 disabled:opacity-60"
                  >
                    {submitting ? 'Sending code…' : 'Send sign-in code'}
                  </button>
                ) : (
                  <>
                    <div>
                      <p className="mb-2 text-xs font-700 text-slate-300">Enter the six-digit code</p>
                      <div className="flex justify-between gap-2">
                        {otp.map((digit, index) => (
                          <input
                            key={index}
                            id={`login-otp-${index}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(event) => handleOtpChange(index, event.target.value)}
                            onKeyDown={(event) => handleOtpKeyDown(index, event)}
                            aria-label={`Digit ${index + 1}`}
                            className="h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0c1625] text-center text-lg font-800 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={submitting || otp.join('').length !== 6}
                      className="w-full rounded-xl bg-orange-600 px-4 py-3.5 text-sm font-800 text-white transition hover:bg-orange-500 disabled:opacity-60"
                    >
                      {submitting ? 'Verifying…' : 'Verify and continue'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={submitting}
                      className="w-full rounded-xl py-2 text-xs font-700 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-60"
                    >
                      Resend code
                    </button>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handlePasswordLogin} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-sm font-700 text-slate-200">
                    Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder={role === 'buyer' ? 'buyer@company.com' : 'seller@company.com'}
                    className="w-full rounded-xl border border-white/15 bg-[#0c1625] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-sm font-700 text-slate-200">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-white/15 bg-[#0c1625] px-4 py-3 pr-11 text-sm text-white outline-none placeholder:text-slate-600 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"
                    >
                      <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={17} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center rounded-xl bg-orange-600 px-4 py-3.5 text-sm font-800 text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Signing in…' : role === 'buyer' ? 'Enter marketplace' : 'Enter seller workspace'}
                </button>
              </form>
            )}

            {googleAuthEnabled && role === 'buyer' && (
              <>
                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="text-xs text-slate-500">or</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-700 text-slate-200 transition hover:bg-white/5 disabled:opacity-60"
                >
                  Continue with Google
                </button>
              </>
            )}

            <div className="mt-6 border-t border-white/10 pt-5 text-center text-xs text-slate-500">
              New to FabricTrad?{' '}
              <Link
                href={role === 'buyer' ? '/buyer-registration' : '/seller-registration'}
                className="font-700 text-orange-300 hover:text-orange-200"
              >
                Create {role} account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
