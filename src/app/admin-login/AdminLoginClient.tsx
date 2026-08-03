'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

type AdminRole = 'admin_staff' | 'super_admin';
type OtpResponse = {
  error?: string;
  destination?: string;
  method?: string;
  retryAfter?: number;
};

const CONFIGURED_ADMIN_EMAIL = 'fabrictrad8@gmail.com';
const MIN_EMAIL_OTP_LENGTH = 6;
const MAX_EMAIL_OTP_LENGTH = 10;
const EMAIL_OTP_PATTERN = /^\d{6,10}$/;
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isAdminRole = (role: unknown): role is AdminRole =>
  role === 'admin_staff' || role === 'super_admin';

export default function AdminLoginClient() {
  const { user, profile, loading, verifyEmailOtp, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const emailAllowed = normalizedEmail === CONFIGURED_ADMIN_EMAIL;
  const otpReady = EMAIL_OTP_PATTERN.test(otp);

  useEffect(() => {
    if (loading || !user || !profile) return;

    const signedInEmail = normalizeEmail(user.email || '');
    const authorised =
      signedInEmail === CONFIGURED_ADMIN_EMAIL &&
      profile.is_active === true &&
      isAdminRole(profile.role);

    if (authorised) {
      window.location.replace('/admin-portal');
      return;
    }

    if (isAdminRole(profile.role) && signedInEmail !== CONFIGURED_ADMIN_EMAIL) {
      void signOut();
    }
  }, [loading, profile, signOut, user]);

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

  const rejectUnapprovedEmail = () => {
    setError('This email is not authorised for FabricTrad administration.');
    setInfo('');
  };

  const sendAdminCode = async () => {
    if (submitting || resendSeconds > 0) return;
    if (!emailAllowed) {
      rejectUnapprovedEmail();
      return;
    }

    clearMessages();
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/admin-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = (await response.json().catch(() => ({}))) as OtpResponse;
      if (!response.ok) {
        if (payload.retryAfter) setResendSeconds(Math.max(1, payload.retryAfter));
        throw new Error(payload.error || 'Unable to send the administrator email OTP.');
      }
      if (payload.method !== 'email_otp') {
        throw new Error('The administrator authentication service returned an invalid method.');
      }

      setOtp('');
      setCodeSent(true);
      setResendSeconds(60);
      setInfo(
        `An administrator OTP was sent to ${payload.destination || 'the configured administrator inbox'}. Enter the complete numeric code from that email.`
      );
      window.setTimeout(() => document.getElementById('admin-email-otp')?.focus(), 50);
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to send the administrator email OTP.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const verifyAdminCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!emailAllowed) {
      rejectUnapprovedEmail();
      return;
    }
    if (!otpReady) {
      setError(
        `Enter the complete ${MIN_EMAIL_OTP_LENGTH}–${MAX_EMAIL_OTP_LENGTH} digit administrator OTP from the email.`
      );
      return;
    }

    clearMessages();
    setSubmitting(true);
    try {
      const result = await verifyEmailOtp(normalizedEmail, otp);
      const signedInEmail = normalizeEmail(String(result?.user?.email || ''));
      if (signedInEmail !== CONFIGURED_ADMIN_EMAIL) {
        await signOut().catch(() => undefined);
        throw new Error('This OTP does not belong to the configured FabricTrad administrator.');
      }

      window.location.replace('/admin-portal');
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : '';
      setError(
        /expired|invalid|token|otp/i.test(message)
          ? 'That administrator OTP is invalid or expired. Request a new code and try again.'
          : message || 'Administrator OTP verification failed.'
      );
      setSubmitting(false);
    }
  };

  const changeEmail = () => {
    setCodeSent(false);
    setOtp('');
    setResendSeconds(0);
    clearMessages();
    window.setTimeout(() => document.getElementById('admin-email')?.focus(), 50);
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
            Access is restricted to one configured administrator email. A single-use numeric code is
            generated by Supabase and delivered through the configured SMTP connection.
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
              Sign in with email OTP
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Enter the administrator email first. Every other email is rejected and no administrator
              OTP is sent to it.
            </p>

            <label className="mt-6 block text-sm font-700 text-slate-300" htmlFor="admin-email">
              Administrator email
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError('');
                }}
                disabled={codeSent || submitting}
                autoComplete="username"
                inputMode="email"
                spellCheck={false}
                required
                placeholder="Enter administrator email"
                className="mt-2 h-14 w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 font-700 text-white outline-none transition placeholder:text-slate-600 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/10 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </label>

            {error && (
              <div role="alert" className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}
            {info && (
              <div aria-live="polite" className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200">
                {info}
              </div>
            )}

            {!codeSent ? (
              <button
                type="button"
                onClick={sendAdminCode}
                disabled={submitting || resendSeconds > 0 || !email.trim()}
                className="mt-6 w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white transition hover:bg-[#d45c36] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? 'Sending email OTP…'
                  : resendSeconds > 0
                    ? `Try again in ${resendSeconds}s`
                    : 'Send administrator OTP'}
              </button>
            ) : (
              <form className="mt-6 space-y-5" onSubmit={verifyAdminCode}>
                <label className="block text-sm font-700 text-slate-300" htmlFor="admin-email-otp">
                  Administrator email OTP
                  <input
                    id="admin-email-otp"
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, MAX_EMAIL_OTP_LENGTH))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6,10}"
                    minLength={MIN_EMAIL_OTP_LENGTH}
                    maxLength={MAX_EMAIL_OTP_LENGTH}
                    aria-describedby="admin-email-otp-help"
                    className="mt-2 h-14 w-full rounded-xl border border-white/10 bg-[#252d3a] px-4 text-center text-2xl font-800 tracking-[0.28em] text-white outline-none transition placeholder:text-slate-600 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/10"
                    placeholder="Enter code"
                  />
                  <span id="admin-email-otp-help" className="mt-2 block text-xs font-500 leading-5 text-slate-500">
                    Enter the complete numeric code sent to the authorised administrator inbox.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting || !otpReady}
                  className="w-full rounded-xl bg-[#c65330] px-4 py-3.5 font-700 text-white transition hover:bg-[#d45c36] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Validating OTP…' : 'Validate OTP and open admin portal'}
                </button>

                <button
                  type="button"
                  onClick={sendAdminCode}
                  disabled={submitting || resendSeconds > 0}
                  className="w-full text-sm font-700 text-orange-300 hover:text-orange-200 disabled:cursor-not-allowed disabled:text-slate-500"
                >
                  {resendSeconds > 0 ? `Send a new OTP in ${resendSeconds}s` : 'Send a new OTP'}
                </button>

                <button
                  type="button"
                  onClick={changeEmail}
                  disabled={submitting}
                  className="w-full text-sm text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Change administrator email
                </button>
              </form>
            )}

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
