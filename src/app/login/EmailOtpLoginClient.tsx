'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type ScreenMode = 'login' | 'forgot';
type RecoveryStep = 'email' | 'otp' | 'password';
type AccountRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';

type RecoveryResponse = {
  sent?: boolean;
  method?: string;
  destination?: string;
  retryAfter?: number;
  error?: string;
};

const MIN_EMAIL_OTP_LENGTH = 6;
const MAX_EMAIL_OTP_LENGTH = 10;
const EMAIL_OTP_PATTERN = /^\d{6,10}$/;

const safeNextPath = (value: string | null) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const parsed = new URL(value, 'https://fabrictrad.com');
    if (parsed.origin !== 'https://fabrictrad.com') return null;
    if (parsed.pathname.startsWith('/admin-')) return null;
    if (parsed.pathname === '/login' || parsed.pathname.startsWith('/auth/')) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

const defaultDestinationForRole = (role?: AccountRole | null) =>
  role === 'admin_staff' || role === 'super_admin'
    ? '/admin-portal'
    : role === 'seller'
      ? '/account'
      : '/marketplace';

const destinationForRole = (role?: AccountRole | null, requestedNext?: string | null) => {
  const fallback = defaultDestinationForRole(role);
  return fallback !== '/admin-portal' && requestedNext ? requestedNext : fallback;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.7 3.1-4.3 3.1-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 1-3.5 1a5.9 5.9 0 0 1-5.5-4.1H3.2v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.5 14a6 6 0 0 1 0-3.8V7.6H3.2a10 10 0 0 0 0 9l3.3-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.1c1.6 0 3 .5 4.1 1.6l3.1-3A10 10 0 0 0 3.2 7.6l3.3 2.6A5.9 5.9 0 0 1 12 6.1Z"
      />
    </svg>
  );
}

export default function EmailOtpLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    signIn,
    signInWithGoogle,
    googleAuthEnabled,
    user,
    profile,
    loading,
    verifyEmailOtp,
    updatePassword,
    signOut,
  } = useAuth();

  const [mode, setMode] = useState<ScreenMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('email');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const requestedNext = useMemo(
    () => safeNextPath(searchParams.get('next')),
    [searchParams]
  );
  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const otpReady = EMAIL_OTP_PATTERN.test(otp);

  useEffect(() => {
    const authError = searchParams.get('error');
    if (searchParams.get('password_updated') === '1') {
      setInfo('Password updated successfully. Sign in with your new password.');
    }
    if (searchParams.get('account_deleted') === '1') {
      setInfo('Your FabricTrad account was permanently deleted.');
    }
    if (searchParams.get('account_disabled') === '1') {
      setInfo(
        'Your account access and personal profile data were removed. Final cleanup is being reviewed.'
      );
    }
    if (authError === 'account_inactive') {
      setError('This account is inactive. Contact FabricTrad support.');
    } else if (authError === 'account_setup_failed') {
      setError(
        'Your login worked, but the account profile could not be prepared. Please sign in again.'
      );
    } else if (authError === 'recovery_failed') {
      setError('That recovery request is invalid or expired. Request a new email OTP.');
      setMode('forgot');
      setRecoveryStep('email');
    } else if (authError) {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (loading || mode !== 'login' || !user || !profile) return;
    router.replace(destinationForRole(profile.role, requestedNext));
  }, [loading, mode, profile, requestedNext, router, user]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const clearMessages = () => {
    setError('');
    setInfo('');
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalizedEmail || !password) {
      setError('Enter your registered email and password.');
      return;
    }

    clearMessages();
    setSubmitting(true);
    try {
      const isDemoEmail =
        normalizedEmail === 'demo.buyer@fabrictrad.com' ||
        normalizedEmail === 'demo.seller@fabrictrad.com';

      if (isDemoEmail) {
        const result = await signIn(normalizedEmail, password);
        const role =
          (result?.role as AccountRole | undefined) ||
          (result?.user?.app_metadata?.role as AccountRole | undefined) ||
          (result?.user?.user_metadata?.role as AccountRole | undefined) ||
          'buyer';
        window.location.replace(destinationForRole(role, requestedNext));
        return;
      }

      const response = await fetch('/api/auth/password-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          next: requestedNext,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        destination?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || 'The email or password is incorrect.');
      }
      window.location.replace(
        payload.destination?.startsWith('/') ? payload.destination : '/marketplace'
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Invalid email or password.';
      setError(
        /invalid login credentials/i.test(message)
          ? 'The email or password is incorrect.'
          : message
      );
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    clearMessages();
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle('buyer');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Google sign-in failed.');
      setGoogleSubmitting(false);
    }
  };

  const openForgotPassword = () => {
    setMode('forgot');
    setRecoveryStep('email');
    setOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResendSeconds(0);
    clearMessages();
  };

  const sendPasswordResetOtp = async () => {
    if (submitting || resendSeconds > 0) return;
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Enter the email address linked to your FabricTrad account.');
      return;
    }
    if (
      normalizedEmail === 'demo.buyer@fabrictrad.com' ||
      normalizedEmail === 'demo.seller@fabrictrad.com'
    ) {
      setError('The shared demo account password cannot be changed.');
      return;
    }

    clearMessages();
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/password-reset-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = (await response.json().catch(() => ({}))) as RecoveryResponse;
      if (!response.ok) {
        if (payload.retryAfter) setResendSeconds(Math.max(1, payload.retryAfter));
        throw new Error(payload.error || 'Unable to send the password-reset OTP.');
      }
      if (payload.method !== 'email_otp') {
        throw new Error('The password recovery service returned an invalid method.');
      }

      setOtp('');
      setRecoveryStep('otp');
      setResendSeconds(60);
      setInfo(
        `A password-reset OTP was sent to ${payload.destination || 'your registered email'}. Enter the complete numeric code from the newest FabricTrad email.`
      );
      window.setTimeout(() => document.getElementById('password-reset-otp')?.focus(), 50);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to send the password-reset OTP.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const verifyPasswordResetOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!otpReady) {
      setError(
        `Enter the complete ${MIN_EMAIL_OTP_LENGTH}–${MAX_EMAIL_OTP_LENGTH} digit OTP from the email.`
      );
      return;
    }

    clearMessages();
    setSubmitting(true);
    try {
      const result = await verifyEmailOtp(normalizedEmail, otp);
      const verifiedEmail = normalizeEmail(String(result?.user?.email || ''));
      if (!verifiedEmail || verifiedEmail !== normalizedEmail) {
        await signOut().catch(() => undefined);
        throw new Error('This OTP does not belong to the email address being recovered.');
      }

      setRecoveryStep('password');
      setNewPassword('');
      setConfirmNewPassword('');
      setInfo('Email OTP verified. Create your new password below.');
      window.setTimeout(() => document.getElementById('new-recovery-password')?.focus(), 50);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : '';
      setError(
        /expired|invalid|token|otp/i.test(message)
          ? 'That OTP is invalid or expired. Request a new code and try again.'
          : message || 'OTP verification failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveRecoveredPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError('Your new password must contain at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('The two password entries do not match.');
      return;
    }

    clearMessages();
    setSubmitting(true);
    try {
      await updatePassword(newPassword);
      await signOut();
      window.location.replace('/login?password_updated=1');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Unable to update your password.'
      );
      setSubmitting(false);
    }
  };

  const changeRecoveryEmail = async () => {
    setRecoveryStep('email');
    setOtp('');
    setResendSeconds(0);
    clearMessages();
    window.setTimeout(() => document.getElementById('recovery-email')?.focus(), 50);
  };

  const backToSignIn = async () => {
    if (recoveryStep === 'password') {
      await signOut().catch(() => undefined);
    }
    setMode('login');
    setRecoveryStep('email');
    setOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResendSeconds(0);
    clearMessages();
  };

  const recoveryDescription =
    recoveryStep === 'email'
      ? 'Enter your registered email to receive a one-time password.'
      : recoveryStep === 'otp'
        ? 'Enter the OTP sent to your registered email. The code must be verified before you can choose a new password.'
        : 'Your email has been verified. Enter and confirm the new password you want to use.';

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d1117]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0d1117] px-4 py-8 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(202,91,47,0.17),transparent_32%),radial-gradient(circle_at_86%_18%,rgba(62,77,111,0.22),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.85fr]">
        <section className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="FabricTrad home">
            <AppLogo size={44} />
            <span className="text-2xl font-800 tracking-tight text-white">FabricTrad</span>
          </Link>
          <p className="mt-9 text-xs font-800 uppercase tracking-[0.18em] text-orange-300">
            One account for textile commerce
          </p>
          <h1 className="mt-4 max-w-2xl text-5xl font-800 leading-[1.02] tracking-[-0.04em] text-white">
            Buy, sell and manage your business without duplicate accounts.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
            Sign in once. FabricTrad opens the workspaces your account is approved to use—marketplace
            purchasing, seller operations, or administration.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              ['1', 'Sign in once'],
              ['2', 'Choose a workspace'],
              ['3', 'Continue where you left off'],
            ].map(([number, label]) => (
              <div key={number} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-xs font-800 text-orange-300">
                  {number}
                </span>
                <p className="mt-3 text-sm font-800 text-white">{label}</p>
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

          <div className="rounded-[1.75rem] border border-white/10 bg-[#151a21]/95 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-7">
            <p className="text-xs font-800 uppercase tracking-[0.16em] text-orange-300">
              {mode === 'login' ? 'Account sign in' : 'Password recovery'}
            </p>
            <h2 className="mt-2 text-3xl font-800 tracking-tight text-white">
              {mode === 'login' ? 'Welcome back' : 'Reset your password'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {mode === 'login'
                ? requestedNext
                  ? 'Sign in to continue to the page you selected.'
                  : 'Use the email and password registered with your FabricTrad account.'
                : recoveryDescription}
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

            {mode === 'login' ? (
              <form className="mt-6 space-y-5" onSubmit={handleLogin}>
                <label className="block text-sm text-slate-300">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/10"
                    placeholder="you@business.com"
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  <span className="flex items-center justify-between gap-4">
                    <span>Password</span>
                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="text-xs font-700 text-orange-300 hover:text-orange-200"
                    >
                      Forgot password?
                    </button>
                  </span>
                  <span className="relative mt-2 block">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                      className="w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 pr-16 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/10"
                      placeholder="Enter your password"
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
                  disabled={submitting || googleSubmitting}
                  className="w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white transition hover:bg-[#d45c36] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? 'Opening your account…'
                    : requestedNext
                      ? 'Sign in and continue'
                      : 'Continue to FabricTrad'}
                </button>

                {googleAuthEnabled && (
                  <>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="h-px flex-1 bg-white/10" />
                      <span>or</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogle}
                      disabled={submitting || googleSubmitting}
                      className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white px-4 py-3.5 font-700 text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                    >
                      <GoogleMark /> {googleSubmitting ? 'Connecting…' : 'Continue with Google'}
                    </button>
                  </>
                )}

                <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-xs leading-5 text-slate-400">
                  <Icon
                    name="InformationCircleIcon"
                    size={15}
                    className="mr-1 inline text-orange-300"
                  />
                  Your account can use both buyer and seller workspaces after the required
                  verification. You do not need a second mobile number.
                </div>
              </form>
            ) : recoveryStep === 'email' ? (
              <div className="mt-6 space-y-5">
                <label className="block text-sm text-slate-300" htmlFor="recovery-email">
                  Registered email
                  <input
                    id="recovery-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 text-white outline-none focus:border-orange-400/60"
                    placeholder="you@business.com"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Send password reset email OTP"
                  onClick={sendPasswordResetOtp}
                  disabled={submitting || resendSeconds > 0 || !email.trim()}
                  className="w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white hover:bg-[#d45c36] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? 'Sending OTP…'
                    : resendSeconds > 0
                      ? `Try again in ${resendSeconds}s`
                      : 'Send OTP to email'}
                </button>
                <button
                  type="button"
                  onClick={backToSignIn}
                  className="w-full text-sm font-700 text-orange-300 hover:text-orange-200"
                >
                  Back to sign in
                </button>
              </div>
            ) : recoveryStep === 'otp' ? (
              <form className="mt-6 space-y-5" onSubmit={verifyPasswordResetOtp}>
                <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-slate-300">
                  Code sent to <span className="font-700 text-white">{normalizedEmail}</span>
                </div>

                <label className="block text-sm text-slate-300" htmlFor="password-reset-otp">
                  Email OTP
                  <input
                    id="password-reset-otp"
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, MAX_EMAIL_OTP_LENGTH))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6,10}"
                    minLength={MIN_EMAIL_OTP_LENGTH}
                    maxLength={MAX_EMAIL_OTP_LENGTH}
                    required
                    className="mt-2 h-14 w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 text-center text-2xl font-800 tracking-[0.28em] text-white outline-none focus:border-orange-400/60"
                    placeholder="Enter code"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting || !otpReady}
                  className="w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white hover:bg-[#d45c36] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Verifying OTP…' : 'Verify OTP'}
                </button>

                <button
                  type="button"
                  onClick={sendPasswordResetOtp}
                  disabled={submitting || resendSeconds > 0}
                  className="w-full text-sm font-700 text-orange-300 hover:text-orange-200 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  {resendSeconds > 0 ? `Send a new OTP in ${resendSeconds}s` : 'Send a new OTP'}
                </button>

                <button
                  type="button"
                  onClick={changeRecoveryEmail}
                  disabled={submitting}
                  className="w-full text-sm text-slate-400 hover:text-white disabled:opacity-50"
                >
                  Change email address
                </button>

                <button
                  type="button"
                  onClick={backToSignIn}
                  disabled={submitting}
                  className="w-full text-sm text-slate-400 hover:text-white disabled:opacity-50"
                >
                  Back to sign in
                </button>
              </form>
            ) : (
              <form className="mt-6 space-y-5" onSubmit={saveRecoveredPassword}>
                <label className="block text-sm text-slate-300" htmlFor="new-recovery-password">
                  New password
                  <span className="relative mt-2 block">
                    <input
                      id="new-recovery-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      className="w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 pr-16 text-white outline-none focus:border-orange-400/60"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 px-4 text-xs font-700 text-slate-400 hover:text-white"
                    >
                      {showNewPassword ? 'Hide' : 'Show'}
                    </button>
                  </span>
                </label>

                <label className="block text-sm text-slate-300">
                  Confirm new password
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
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
                  className="w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white hover:bg-[#d45c36] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Setting new password…' : 'Set new password'}
                </button>

                <button
                  type="button"
                  onClick={backToSignIn}
                  disabled={submitting}
                  className="w-full text-sm text-slate-400 hover:text-white disabled:opacity-50"
                >
                  Cancel and return to sign in
                </button>
              </form>
            )}

            <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 text-center text-sm">
              <Link href="/register" className="font-700 text-orange-300 hover:text-orange-200">
                Create a FabricTrad account
              </Link>
              <Link href="/admin-login" className="text-slate-400 hover:text-white">
                Administrator sign in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
