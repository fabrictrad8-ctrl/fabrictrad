'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type AdminRole = 'admin_staff' | 'super_admin';
type OtpResponse = { error?: string; destination?: string; method?: string; retryAfter?: number };
type AdminLoginClientProps = { configuredEmail: string };

const MIN_EMAIL_OTP_LENGTH = 6;
const MAX_EMAIL_OTP_LENGTH = 10;
const EMAIL_OTP_PATTERN = /^\d{6,10}$/;
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isAdminRole = (role: unknown): role is AdminRole => role === 'admin_staff' || role === 'super_admin';

export default function AdminLoginClient({ configuredEmail }: AdminLoginClientProps) {
  const { user, profile, loading, verifyEmailOtp, signOut } = useAuth();
  const [email, setEmail] = useState(configuredEmail);
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

  useEffect(() => {
    if (loading || !user || !profile) return;
    const signedInEmail = normalizeEmail(user.email || '');
    const authorised = signedInEmail === authorisedEmail && profile.is_active === true && isAdminRole(profile.role);
    if (authorised) { window.location.replace('/admin-portal'); return; }
    if (isAdminRole(profile.role) && signedInEmail !== authorisedEmail) void signOut().catch(() => undefined);
  }, [authorisedEmail, loading, profile, signOut, user]);

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

  if (loading) return <main className="ft-auth-shell"><div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" /></main>;

  return (
    <main className="ft-auth-shell">
      <div className="ft-auth-shell-grid">
        <section className="ft-auth-glass ft-auth-visual-panel" aria-label="FabricTrad protected administration">
          <Link href="/" className="mb-6 inline-flex w-fit items-center" aria-label="FabricTrad home"><AppLogo size={40} /></Link>
          <div className="ft-auth-shield" aria-hidden="true"><Icon name="ShieldCheckIcon" size={40} /></div>
          <p className="ft-auth-eyebrow mt-6">Restricted administration</p>
          <h1 className="ft-auth-headline">Protected access for marketplace operations.</h1>
          <p className="ft-auth-lede">Administrator sign-in is intentionally separate from buyer and seller access. Only the configured administrator identity can request and verify the one-time code.</p>
          <div className="ft-auth-flow-grid">
            <div className="ft-auth-flow-item"><span className="ft-auth-flow-step">1</span><span className="ft-auth-flow-text">Enter the authorised admin email</span></div>
            <div className="ft-auth-flow-item"><span className="ft-auth-flow-step">2</span><span className="ft-auth-flow-text">Receive a single-use email OTP</span></div>
            <div className="ft-auth-flow-item"><span className="ft-auth-flow-step">3</span><span className="ft-auth-flow-text">Open protected admin operations</span></div>
          </div>
        </section>

        <section className="ft-auth-glass ft-auth-form-panel" aria-labelledby="admin-auth-title">
          <div className="mb-5 flex items-center justify-center lg:hidden"><AppLogo size={34} /></div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="ft-auth-tag"><Icon name="LockClosedIcon" size={12} /> Restricted access</span>
            <span className="ft-auth-tag">Administrator access</span>
          </div>
          <h2 id="admin-auth-title" className="ft-auth-heading">Sign in with email OTP</h2>
          <p className="ft-auth-copy">Every unapproved email is rejected before an administrator OTP is sent.</p>

          <label className="ft-auth-field-label mt-6" htmlFor="admin-email">Administrator email
            <input id="admin-email" type="email" value={email} disabled autoComplete="username" inputMode="email" spellCheck={false} required className="ft-auth-input mt-2 h-14 px-4 font-700 disabled:cursor-not-allowed disabled:opacity-70" />
          </label>
          <p className="ft-auth-copy mt-1.5 text-xs">This is the only email authorised for FabricTrad administration and cannot be changed here.</p>

          {error && <div role="alert" className="ft-auth-alert ft-auth-alert-error mt-5">{error}</div>}
          {info && <div aria-live="polite" className="ft-auth-alert ft-auth-alert-success mt-5">{info}</div>}

          {!codeSent ? (
            <button type="button" onClick={sendAdminCode} disabled={submitting || resendSeconds > 0 || !email.trim()} className="ft-auth-cta mt-6">{submitting ? 'Sending email OTP…' : resendSeconds > 0 ? `Try again in ${resendSeconds}s` : 'Send administrator OTP'}</button>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={verifyAdminCode}>
              <label className="ft-auth-field-label" htmlFor="admin-email-otp">Administrator email OTP
                <input id="admin-email-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, MAX_EMAIL_OTP_LENGTH))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={MIN_EMAIL_OTP_LENGTH} maxLength={MAX_EMAIL_OTP_LENGTH} aria-describedby="admin-email-otp-help" className="ft-auth-input mt-2 h-14 px-4 text-center text-2xl font-850 tracking-[0.28em]" placeholder="Enter code" />
                <span id="admin-email-otp-help" className="ft-auth-copy mt-2 block text-xs">Use the newest complete numeric code sent to the authorised administrator inbox.</span>
              </label>
              <button type="submit" disabled={submitting || !otpReady} className="ft-auth-cta">{submitting ? 'Validating OTP…' : 'Validate OTP and open admin portal'}</button>
              <button type="button" onClick={sendAdminCode} disabled={submitting || resendSeconds > 0} className="ft-auth-link-muted w-full text-center text-sm">{resendSeconds > 0 ? `Send a new OTP in ${resendSeconds}s` : 'Send a new OTP'}</button>
            </form>
          )}

          <div className="ft-auth-footer">
            <Link href="/login" className="ft-auth-link">Buyer and seller sign in</Link>
            <Link href="/" className="ft-auth-link-muted">Back to FabricTrad</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
