'use client';

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

type LoginRole = 'buyer' | 'seller';
type AccountRole = LoginRole | 'admin_staff' | 'super_admin';
type ScreenMode = 'login' | 'forgot';
type ResetStep = 'request' | 'verify' | 'new-password';

const destinationForRole = (role?: AccountRole | null) => {
  if (role === 'seller') return '/seller-dashboard';
  if (role === 'admin_staff' || role === 'super_admin') return '/admin-portal';
  return '/marketplace';
};

async function resolveRole(fallback: AccountRole): Promise<AccountRole> {
  const response = await fetch('/api/auth/resolve-role', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as {
    role?: AccountRole;
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || 'Unable to open this account.');
  return payload.role || fallback;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.7 3.1-4.3 3.1-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 1-3.5 1a5.9 5.9 0 0 1-5.5-4.1H3.2v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.8V7.6H3.2a10 10 0 0 0 0 9l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 6.1c1.6 0 3 .5 4.1 1.6l3.1-3A10 10 0 0 0 3.2 7.6l3.3 2.6A5.9 5.9 0 0 1 12 6.1Z" />
    </svg>
  );
}

const emptyOtp = () => ['', '', '', '', '', ''];

export default function EmailOtpLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    signIn,
    signInWithGoogle,
    googleAuthEnabled,
    verifyEmailOtp,
    updatePassword,
    signOut,
    user,
    profile,
    loading,
  } = useAuth();

  const [role, setRole] = useState<LoginRole>('buyer');
  const [mode, setMode] = useState<ScreenMode>('login');
  const [resetStep, setResetStep] = useState<ResetStep>('request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(emptyOtp);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (searchParams.get('role') === 'seller') setRole('seller');
    const authError = searchParams.get('error');
    if (authError === 'account_inactive') {
      setError('This account is inactive. Please contact FabricTrad support.');
    } else if (authError === 'account_not_found') {
      setError('This Google account is not linked to an active FabricTrad buyer account.');
    } else if (authError === 'google_buyer_only') {
      setError('Google sign-in is available for buyer accounts only.');
    } else if (authError) {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (mode !== 'login' || loading || !user || !profile) return;
    if (!profile.phone && profile.role !== 'admin_staff' && profile.role !== 'super_admin') {
      router.replace(`/auth/phone?role=${profile.role}`);
      return;
    }
    router.replace(destinationForRole(profile.role));
  }, [loading, mode, profile, router, user]);

  const clearMessages = () => {
    setError('');
    setInfo('');
  };

  const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Enter your registered email and password.');
      return;
    }

    clearMessages();
    setSubmitting(true);
    try {
      const result = await signIn(normalizedEmail, password);
      const fallback =
        (result?.role as AccountRole | undefined) ||
        (result?.user?.app_metadata?.role as AccountRole | undefined) ||
        (result?.user?.user_metadata?.role as AccountRole | undefined) ||
        role;
      const accountRole = result?.isDemo ? fallback : await resolveRole(fallback);
      router.replace(destinationForRole(accountRole));
      router.refresh();
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Invalid email or password.');
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    clearMessages();
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle('buyer');
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Google sign-in failed.');
      setGoogleSubmitting(false);
    }
  };

  const openForgotPassword = () => {
    setMode('forgot');
    setResetStep('request');
    setOtp(emptyOtp());
    setNewPassword('');
    setConfirmPassword('');
    clearMessages();
  };

  const returnToLogin = () => {
    setMode('login');
    setResetStep('request');
    setOtp(emptyOtp());
    setNewPassword('');
    setConfirmPassword('');
    clearMessages();
  };

  const sendResetCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter the email address linked to your FabricTrad account.');
      return;
    }

    clearMessages();
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/email-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to send the reset code.');

      setEmail(normalizedEmail);
      setOtp(emptyOtp());
      setResetStep('verify');
      setInfo(`A six-digit password reset code was sent to ${normalizedEmail}.`);
      window.setTimeout(() => document.getElementById('reset-otp-0')?.focus(), 50);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to send the reset code.');
    } finally {
      setSubmitting(false);
    }
  };

  const changeOtp = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtp((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    if (digit && index < 5) document.getElementById(`reset-otp-${index + 1}`)?.focus();
  };

  const handleOtpKey = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`reset-otp-${index - 1}`)?.focus();
    }
  };

  const verifyResetCode = async () => {
    const token = otp.join('');
    if (token.length !== 6) {
      setError('Enter the complete six-digit code.');
      return;
    }

    clearMessages();
    setSubmitting(true);
    try {
      await verifyEmailOtp(email, token);
      setResetStep('new-password');
      setInfo('Email verified. Create a new password for your account.');
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'The code is invalid or expired.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveNewPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError('Your new password must contain at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two password entries do not match.');
      return;
    }

    clearMessages();
    setSubmitting(true);
    try {
      await updatePassword(newPassword);
      await signOut();
      setMode('login');
      setResetStep('request');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtp(emptyOtp());
      setInfo('Password updated successfully. Sign in with your new password.');
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update the password.');
    } finally {
      setSubmitting(false);
    }
  };

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

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="FabricTrad home">
            <AppLogo size={44} />
            <span className="text-2xl font-800 tracking-tight text-white">FabricTrad</span>
          </Link>
          <p className="mt-8 text-xs font-800 uppercase tracking-[0.18em] text-orange-300">Private B2B textile commerce</p>
          <h1 className="mt-4 max-w-xl text-5xl font-800 leading-[1.02] tracking-[-0.04em] text-white">
            Secure access to your FabricTrad workspace.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
            Buyers and sellers can manage sourcing, products, orders and business operations from one focused workspace.
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
              {mode === 'login' ? 'Welcome back' : 'Account recovery'}
            </p>
            <h2 className="mt-2 text-3xl font-800 tracking-tight text-white">
              {mode === 'login' ? 'Sign in to FabricTrad' : 'Reset your password'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {mode === 'login'
                ? 'Use the email and password registered with your account.'
                : resetStep === 'request'
                  ? 'We will send a one-time code to your registered email.'
                  : resetStep === 'verify'
                    ? 'Enter the six-digit code sent to your email.'
                    : 'Choose a secure new password for your account.'}
            </p>

            {mode === 'login' && (
              <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/10 bg-black/10 p-1">
                {(['buyer', 'seller'] as LoginRole[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      if (submitting || googleSubmitting) return;
                      setRole(item);
                      clearMessages();
                    }}
                    className={`rounded-lg px-4 py-2.5 text-sm font-700 capitalize transition ${
                      role === item ? 'bg-[#c65330] text-white shadow-lg' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}
            {info && (
              <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200">
                {info}
              </div>
            )}

            {mode === 'login' ? (
              <form className="mt-6 space-y-5" onSubmit={handlePasswordLogin}>
                <label className="block text-sm text-slate-300">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/10"
                    placeholder={role === 'seller' ? 'seller@business.com' : 'buyer@business.com'}
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  <span className="flex items-center justify-between gap-4">
                    <span>Password</span>
                    <button type="button" onClick={openForgotPassword} className="text-xs font-700 text-orange-300 hover:text-orange-200">
                      Forgot password?
                    </button>
                  </span>
                  <span className="relative mt-2 block">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
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
                  {submitting ? 'Signing in…' : role === 'seller' ? 'Enter seller workspace' : 'Enter marketplace'}
                </button>

                {role === 'buyer' && (
                  <>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="h-px flex-1 bg-white/10" />
                      <span>or</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={submitting || googleSubmitting}
                      aria-disabled={!googleAuthEnabled}
                      className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3.5 font-700 text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <GoogleMark />
                      {googleSubmitting ? 'Opening Google…' : 'Continue with Google'}
                    </button>
                  </>
                )}
              </form>
            ) : (
              <div className="mt-6">
                {resetStep === 'request' && (
                  <div className="space-y-5">
                    <label className="block text-sm text-slate-300">
                      Registered email
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 text-white outline-none focus:border-orange-400/60"
                        placeholder="name@business.com"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={sendResetCode}
                      disabled={submitting}
                      className="w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white disabled:opacity-60"
                    >
                      {submitting ? 'Sending code…' : 'Send reset code'}
                    </button>
                  </div>
                )}

                {resetStep === 'verify' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-6 gap-2">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          id={`reset-otp-${index}`}
                          value={digit}
                          onChange={(event) => changeOtp(index, event.target.value)}
                          onKeyDown={(event) => handleOtpKey(index, event)}
                          inputMode="numeric"
                          maxLength={1}
                          aria-label={`Code digit ${index + 1}`}
                          className="h-12 min-w-0 rounded-lg border border-white/10 bg-[#252d3a] text-center text-lg font-800 text-white outline-none focus:border-orange-400/60"
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={verifyResetCode}
                      disabled={submitting}
                      className="w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white disabled:opacity-60"
                    >
                      {submitting ? 'Verifying…' : 'Verify code'}
                    </button>
                  </div>
                )}

                {resetStep === 'new-password' && (
                  <form className="space-y-5" onSubmit={saveNewPassword}>
                    <label className="block text-sm text-slate-300">
                      New password
                      <span className="relative mt-2 block">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          autoComplete="new-password"
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
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 py-3.5 text-white outline-none focus:border-orange-400/60"
                        placeholder="Repeat your new password"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white disabled:opacity-60"
                    >
                      {submitting ? 'Updating password…' : 'Save new password'}
                    </button>
                  </form>
                )}

                <button type="button" onClick={returnToLogin} className="mt-5 w-full text-sm font-700 text-orange-300 hover:text-orange-200">
                  Back to sign in
                </button>
              </div>
            )}

            {mode === 'login' && (
              <p className="mt-6 border-t border-white/10 pt-5 text-center text-xs text-slate-500">
                New to FabricTrad?{' '}
                <Link href={role === 'seller' ? '/seller-registration' : '/buyer-registration'} className="font-700 text-orange-300 hover:text-orange-200">
                  Create {role} account
                </Link>
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
