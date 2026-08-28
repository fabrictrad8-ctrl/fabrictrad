'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type OtpResponse = { error?: string; destination?: string; method?: string; retryAfter?: number };
type AdminLoginClientProps = { configuredEmail: string };

const MIN_EMAIL_OTP_LENGTH = 6;
const MAX_EMAIL_OTP_LENGTH = 10;
const EMAIL_OTP_PATTERN = /^\d{6,10}$/;
const normalizeEmail = (value: string) => value.trim().toLowerCase();

export default function AdminLoginClient({ configuredEmail }: AdminLoginClientProps) {
  const { loading, verifyEmailOtp, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const authorisedEmail = useMemo(() => normalizeEmail(configuredEmail), [configuredEmail]);
  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const emailAllowed = normalizedEmail === authorisedEmail;
  const otpReady = EMAIL_OTP_PATTERN.test(otp);

  // Existing valid Admin OTP sessions are redirected by server middleware before this
  // component is rendered. This screen never upgrades an arbitrary existing session.
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const clearMessages = () => { setError(''); setInfo(''); };
  const rejectUnapprovedEmail = () => { setError('This email is not authorised for FabricTrad administration.'); setInfo(''); };

  const sendAdminCode = async () => {
    if (submitting || resendSeconds > 0) return;
    if (!emailAllowed) { rejectUnapprovedEmail(); return; }
    clearMessages();
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/admin-otp/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await response.json().catch(() => ({})) as OtpResponse;
      if (!response.ok) {
        if (payload.retryAfter) setResendSeconds(Math.max(1, payload.retryAfter));
        throw new Error(payload.error || 'Unable to send the administrator email OTP.');
      }
      if (payload.method !== 'email_otp') throw new Error('The administrator authentication service returned an invalid method.');
      setOtp('');
      setCodeSent(true);
      setResendSeconds(60);
      setInfo(`An administrator OTP was sent to ${payload.destination || 'the configured administrator inbox'}. Enter the newest numeric code.`);
      window.setTimeout(() => document.getElementById('admin-email-otp')?.focus(), 50);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to send the administrator email OTP.');
    } finally { setSubmitting(false); }
  };

  const verifyAdminCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!emailAllowed) { rejectUnapprovedEmail(); return; }
    if (!otpReady) { setError(`Enter the complete ${MIN_EMAIL_OTP_LENGTH}–${MAX_EMAIL_OTP_LENGTH} digit administrator OTP from the email.`); return; }
    clearMessages();
    setSubmitting(true);
    try {
      const result = await verifyEmailOtp(normalizedEmail, otp);
      const signedInEmail = normalizeEmail(String(result?.user?.email || ''));
      if (signedInEmail !== authorisedEmail) {
        await signOut().catch(() => undefined);
        throw new Error('This OTP does not belong to the configured FabricTrad administrator.');
      }
      window.location.replace('/admin-portal');
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : '';
      setError(/expired|invalid|token|otp/i.test(message) ? 'That administrator OTP is invalid or expired. Request a new code and try again.' : message || 'Administrator OTP verification failed.');
      setSubmitting(false);
    }
  };

  const changeEmail = () => {
    setCodeSent(false); setOtp(''); setResendSeconds(0); clearMessages();
    window.setTimeout(() => document.getElementById('admin-email')?.focus(), 50);
  };

  if (loading) return <main className="ft-auth-page flex min-h-screen items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" /></main>;

  return (
    <main className="ft-auth-page">
      <div className="ft-auth-stage">
        <section className="ft-auth-visual" aria-label="FabricTrad protected administration">
          <Link href="/" className="ft-auth-brandline" aria-label="FabricTrad home"><AppLogo size={44} /><span>FabricTrad</span></Link>
          <div className="ft-auth-graphic" aria-hidden="true">
            <span className="ft-auth-swatch" /><span className="ft-auth-swatch" /><span className="ft-auth-swatch" />
            <span className="absolute left-[110px] top-[72px] z-20 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/70 bg-white/90 text-orange-700 shadow-2xl backdrop-blur-xl"><Icon name="ShieldCheckIcon" size={38} /></span>
          </div>
          <p className="ft-auth-eyebrow">Restricted administration</p>
          <h1 className="ft-auth-title">Protected access for marketplace operations.</h1>
          <p className="ft-auth-subtitle">Administrator sign-in is intentionally separate from buyer and seller access. Only the configured administrator identity can request and verify the one-time code.</p>
          <div className="ft-auth-flow">
            <div className="ft-auth-flow-card"><strong>1</strong><span>Enter the authorised admin email</span></div>
            <div className="ft-auth-flow-card"><strong>2</strong><span>Receive a single-use email OTP</span></div>
            <div className="ft-auth-flow-card"><strong>3</strong><span>Open protected admin operations</span></div>
          </div>
        </section>

        <section className="ft-auth-card-wrap" aria-labelledby="admin-auth-title">
          <div className="mb-5 flex items-center justify-center gap-2 lg:hidden"><AppLogo size={36} /><span className="text-lg font-850 text-slate-900">FabricTrad Admin</span></div>
          <div className="ft-auth-card">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-850 text-orange-800"><Icon name="LockClosedIcon" size={13} /> Restricted access</div>
            <p className="ft-auth-kicker">Administrator access</p>
            <h2 id="admin-auth-title" className="mt-2">Sign in with email OTP</h2>
            <p className="ft-auth-copy mt-2 text-sm leading-6">Every unapproved email is rejected before an administrator OTP is sent.</p>

            <label className="mt-6 block text-sm font-700 text-slate-600" htmlFor="admin-email">Administrator email
              <input id="admin-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); if (error) setError(''); }} disabled={codeSent || submitting} autoComplete="username" inputMode="email" spellCheck={false} required placeholder="Enter administrator email" className="ft-auth-field mt-2 h-14 px-4 font-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70" />
            </label>

            {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {info && <div aria-live="polite" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>}

            {!codeSent ? (
              <button type="button" onClick={sendAdminCode} disabled={submitting || resendSeconds > 0 || !email.trim()} className="ft-auth-submit mt-6 px-4 py-3.5 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Sending email OTP…' : resendSeconds > 0 ? `Try again in ${resendSeconds}s` : 'Send administrator OTP'}</button>
            ) : (
              <form className="mt-6 space-y-5" onSubmit={verifyAdminCode}>
                <label className="block text-sm font-700 text-slate-600" htmlFor="admin-email-otp">Administrator email OTP
                  <input id="admin-email-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, MAX_EMAIL_OTP_LENGTH))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={MIN_EMAIL_OTP_LENGTH} maxLength={MAX_EMAIL_OTP_LENGTH} aria-describedby="admin-email-otp-help" className="ft-auth-field mt-2 h-14 px-4 text-center text-2xl font-850 tracking-[0.28em] outline-none" placeholder="Enter code" />
                  <span id="admin-email-otp-help" className="mt-2 block text-xs font-500 leading-5 text-slate-500">Use the newest complete numeric code sent to the authorised administrator inbox.</span>
                </label>
                <button type="submit" disabled={submitting || !otpReady} className="ft-auth-submit px-4 py-3.5 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Validating OTP…' : 'Validate OTP and open admin portal'}</button>
                <button type="button" onClick={sendAdminCode} disabled={submitting || resendSeconds > 0} className="w-full text-sm font-800 text-orange-700 hover:text-orange-900 disabled:text-slate-400">{resendSeconds > 0 ? `Send a new OTP in ${resendSeconds}s` : 'Send a new OTP'}</button>
                <button type="button" onClick={changeEmail} disabled={submitting} className="w-full text-sm text-slate-500 hover:text-slate-900 disabled:opacity-50">Change administrator email</button>
              </form>
            )}

            <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5 text-center text-sm">
              <Link href="/login" className="font-800 text-orange-700 hover:text-orange-900">Buyer and seller sign in</Link>
              <Link href="/" className="text-slate-500 hover:text-slate-900">Back to FabricTrad</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
