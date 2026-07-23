'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type LoginRole = 'buyer' | 'seller';
type AccountRole = LoginRole | 'admin_staff' | 'super_admin';
type LoginStep = 'email' | 'otp';

type RoleResponse = {
  role?: AccountRole;
  error?: string;
};

const destinationForRole = (role?: AccountRole | null) => {
  if (role === 'seller') return '/seller-dashboard';
  if (role === 'admin_staff' || role === 'super_admin') return '/admin-portal';
  return '/buyer-dashboard';
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

async function resolveAuthenticatedRole(fallbackRole: AccountRole): Promise<AccountRole> {
  const response = await fetch('/api/auth/resolve-role', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as RoleResponse;
  if (!response.ok) throw new Error(payload.error || 'Unable to open this account.');
  return payload.role || fallbackRole;
}

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmailOtp, user, profile, loading } = useAuth();

  const [role, setRole] = useState<LoginRole>('buyer');
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const registrationHref = role === 'seller' ? '/seller-registration' : '/buyer-registration';
  const currentDestination = useMemo(
    () => destinationForRole(profile?.role),
    [profile?.role]
  );

  useEffect(() => {
    const requestedRole = searchParams.get('role');
    if (requestedRole === 'seller') setRole('seller');

    const requestedEmail = searchParams.get('email');
    if (requestedEmail) setEmail(requestedEmail);

    const authError = searchParams.get('error');
    if (authError === 'account_inactive') {
      setError('This account is inactive. Please contact FabricTrad support.');
    } else if (authError === 'profile_not_found') {
      setError('This email is not linked to a completed FabricTrad account.');
    } else if (authError) {
      setError(authError.replace(/_/g, ' '));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user && profile) {
      router.replace(currentDestination);
    }
  }, [currentDestination, loading, profile, router, user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const chooseRole = (nextRole: LoginRole) => {
    if (submitting) return;
    setRole(nextRole);
    setError('');
    setInfo('');
  };

  const requestOtp = async () => {
    const normalized = normalizeEmail(email);
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      setError('Enter the email address registered with your FabricTrad account.');
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
        body: JSON.stringify({ email: normalized }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to send the sign-in code.');

      setEmail(normalized);
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
      setInfo(`A six-digit code was sent to ${normalized}.`);
      setCooldown(60);
      window.setTimeout(() => document.getElementById('login-otp-0')?.focus(), 50);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to send the sign-in code.');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    const token = otp.join('');
    if (token.length !== 6) {
      setError('Enter the complete six-digit code from your email.');
      return;
    }

    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      const result = await verifyEmailOtp(email, token);
      const fallbackRole =
        (result?.user?.app_metadata?.role as AccountRole | undefined) ||
        (result?.user?.user_metadata?.role as AccountRole | undefined) ||
        role;
      const authenticatedRole = await resolveAuthenticatedRole(fallbackRole);
      router.replace(destinationForRole(authenticatedRole));
      router.refresh();
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'The code is invalid or has expired.');
      setSubmitting(false);
    }
  };

  const updateOtp = (index: number, value: string) => {
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
    if (event.key === 'Enter') void verifyOtp();
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

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-10 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="FabricTrad home">
            <AppLogo size={44} />
            <span className="text-2xl font-800 tracking-tight text-white">FabricTrad</span>
          </Link>
          <p className="mt-8 text-xs font-800 uppercase tracking-[0.18em] text-orange-300">
            Private B2B textile commerce
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-800 leading-[1.02] tracking-[-0.04em] text-white">
            Secure access tied to your business inbox.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
            A one-time code verifies the email connected to your account. FabricTrad then opens the correct private workspace automatically.
          </p>
          <div className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              ['ShoppingBagIcon', 'Buyer', 'Sourcing, requirements, orders and shipment tracking'],
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
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-6 text-center lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <AppLogo size={38} />
              <span className="text-xl font-800 text-white">FabricTrad</span>
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-[#101a2a]/95 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-7">
            <p className="text-xs font-800 uppercase tracking-[0.16em] text-orange-300">Secure account access</p>
            <h2 className="mt-2 text-3xl font-800 tracking-tight text-white">
              {step === 'email' ? 'Sign in with email OTP' : 'Enter your verification code'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {step === 'email'
                ? 'Use the email registered with your FabricTrad account.'
                : `Check ${email} for the six-digit code.`}
            </p>

            {step === 'email' && (
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
                    role === 'seller' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Seller
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-300/20 bg-red-400/10 p-3" role="alert">
                <Icon name="ExclamationTriangleIcon" size={15} className="mt-0.5 shrink-0 text-red-200" />
                <p className="text-xs leading-5 text-red-100">{error}</p>
              </div>
            )}

            {info && !error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3" aria-live="polite">
                <Icon name="CheckCircleIcon" size={15} className="mt-0.5 shrink-0 text-emerald-200" />
                <p className="text-xs leading-5 text-emerald-100">{info}</p>
              </div>
            )}

            {step === 'email' ? (
              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-700 text-slate-200">Registered email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void requestOtp();
                    }}
                    autoComplete="email"
                    placeholder="name@company.com"
                    className="w-full rounded-xl border border-white/15 bg-[#111f32] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void requestOtp()}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3.5 text-sm font-800 text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending code…
                    </>
                  ) : (
                    <>
                      Send verification code <Icon name="ArrowRightIcon" size={16} />
                    </>
                  )}
                </button>
                <p className="text-center text-xs leading-5 text-slate-500">
                  Codes are sent only to emails already connected to FabricTrad.
                </p>
              </div>
            ) : (
              <div className="mt-6">
                <div className="flex justify-between gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`login-otp-${index}`}
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      value={digit}
                      onChange={(event) => updateOtp(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                      maxLength={1}
                      aria-label={`OTP digit ${index + 1}`}
                      className="h-14 min-w-0 flex-1 rounded-xl border border-white/15 bg-[#111f32] text-center text-xl font-800 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void verifyOtp()}
                  disabled={submitting || otp.join('').length !== 6}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3.5 text-sm font-800 text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      Verify and continue <Icon name="ArrowRightIcon" size={16} />
                    </>
                  )}
                </button>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setOtp(['', '', '', '', '', '']);
                      setInfo('');
                      setError('');
                    }}
                    className="font-700 text-slate-400 hover:text-white"
                  >
                    Change email
                  </button>
                  <button
                    type="button"
                    onClick={() => void requestOtp()}
                    disabled={cooldown > 0 || submitting}
                    className="font-700 text-orange-300 disabled:text-slate-600"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-7 border-t border-white/10 pt-5 text-center text-xs text-slate-500">
              Need an account?{' '}
              <Link href={registrationHref} className="font-800 text-orange-300 hover:text-orange-200">
                Create a {role} account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
