'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import PreferenceControls from '@/components/PreferenceControls';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';
import { getPublicLandingCopy } from '@/lib/publicLandingTranslations';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import TiltShowcase from '@/components/TiltShowcase';
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
const normalizeEmail = (value: string) => value.trim().toLowerCase();

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
      ? '/seller-dashboard'
      : '/marketplace';

const destinationForRole = (role?: AccountRole | null, requestedNext?: string | null) => {
  const fallback = defaultDestinationForRole(role);
  return fallback !== '/admin-portal' && requestedNext ? requestedNext : fallback;
};

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

function AuthVisual() {
  const { language } = useAppPreferences();
  const copy = getPublicLandingCopy(language);
  return (
    <section className="ft-auth-glass ft-auth-visual-panel" aria-label="FabricTrad">
      <Link href="/" className="mb-6 inline-flex w-fit items-center" aria-label="FabricTrad"><AppLogo size={40} /></Link>
      <div className="ft-auth-showcase-frame relative h-52 overflow-hidden rounded-[18px]">
        <TiltShowcase>
          <Image src="/images/textile-showroom.webp" alt="" fill sizes="(max-width: 900px) 100vw, 500px" className="object-cover" />
          <div className="ft-textile-caption">
            <Icon name="ShieldCheckIcon" size={22} />
            <div><strong>{copy.kicker}</strong></div>
          </div>
        </TiltShowcase>
      </div>
      <p className="ft-auth-eyebrow mt-7">{copy.kicker}</p>
      <h1 className="ft-auth-headline">{copy.titleLead} {copy.titleAccent}</h1>
      <p className="ft-auth-lede">{copy.heroCopy}</p>
      <div className="ft-auth-flow-grid">
        <div className="ft-auth-flow-item"><span className="ft-auth-flow-step">1</span><span className="ft-auth-flow-text">Enter your registered email</span></div>
        <div className="ft-auth-flow-item"><span className="ft-auth-flow-step">2</span><span className="ft-auth-flow-text">Sign in with your password</span></div>
        <div className="ft-auth-flow-item"><span className="ft-auth-flow-step">3</span><span className="ft-auth-flow-text">Open your FabricTrad workspace</span></div>
      </div>
    </section>
  );
}

export default function EmailOtpLoginClient() {
  const router = useRouter();
  const { t } = useAppPreferences();
  const searchParams = useSearchParams();
  const {
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

  const requestedNext = useMemo(() => safeNextPath(searchParams.get('next')), [searchParams]);
  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const otpReady = EMAIL_OTP_PATTERN.test(otp);

  useEffect(() => {
    const authError = searchParams.get('error');
    if (searchParams.get('password_updated') === '1') setInfo('Password updated successfully. Sign in with your new password.');
    if (searchParams.get('account_deleted') === '1') setInfo('Your FabricTrad account was permanently deleted.');
    if (searchParams.get('account_disabled') === '1') setInfo('Your account access and personal profile data were removed. Final cleanup is being reviewed.');
    if (authError === 'account_inactive') setError('This account is inactive. Contact FabricTrad support.');
    else if (authError === 'account_setup_failed') setError('Your login worked, but the account profile could not be prepared. Please sign in again.');
    else if (authError === 'recovery_failed') {
      setError('That recovery request is invalid or expired. Request a new email OTP.');
      setMode('forgot');
      setRecoveryStep('email');
    } else if (authError) setError('Authentication failed. Please try again.');
  }, [searchParams]);

  useEffect(() => {
    if (loading || mode !== 'login' || !user || !profile) return;
    router.replace(destinationForRole(profile.role, requestedNext));
  }, [loading, mode, profile, requestedNext, router, user]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const clearMessages = () => {
    setError('');
    setInfo('');
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalizedEmail || !password) return setError('Enter your registered email and password.');
    clearMessages();
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/password-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email: normalizedEmail, password, next: requestedNext }),
      });
      const payload = (await response.json().catch(() => ({}))) as { destination?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || 'The email or password is incorrect.');
      window.location.replace(payload.destination?.startsWith('/') ? payload.destination : '/marketplace');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Invalid email or password.';
      setError(/invalid login credentials/i.test(message) ? 'The email or password is incorrect.' : message);
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
    if (!normalizedEmail || !normalizedEmail.includes('@')) return setError('Enter the email address linked to your FabricTrad account.');
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
      if (payload.method !== 'email_otp') throw new Error('The password recovery service returned an invalid method.');
      setOtp('');
      setRecoveryStep('otp');
      setResendSeconds(60);
      setInfo(`A password-reset OTP was sent to ${payload.destination || 'your registered email'}. Enter the complete numeric code from the newest FabricTrad email.`);
      window.setTimeout(() => document.getElementById('password-reset-otp')?.focus(), 50);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to send the password-reset OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyPasswordResetOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!otpReady) return setError(`Enter the complete ${MIN_EMAIL_OTP_LENGTH}–${MAX_EMAIL_OTP_LENGTH} digit OTP from the email.`);
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
      setError(/expired|invalid|token|otp/i.test(message) ? 'That OTP is invalid or expired. Request a new code and try again.' : message || 'OTP verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveRecoveredPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 8) return setError('Your new password must contain at least 8 characters.');
    if (newPassword !== confirmNewPassword) return setError('The two password entries do not match.');
    clearMessages();
    setSubmitting(true);
    try {
      await updatePassword(newPassword);
      await signOut();
      window.location.replace('/login?password_updated=1');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update your password.');
      setSubmitting(false);
    }
  };

  const changeRecoveryEmail = () => {
    setRecoveryStep('email');
    setOtp('');
    setResendSeconds(0);
    clearMessages();
    window.setTimeout(() => document.getElementById('recovery-email')?.focus(), 50);
  };

  const backToSignIn = async () => {
    if (recoveryStep === 'password') await signOut().catch(() => undefined);
    setMode('login');
    setRecoveryStep('email');
    setOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResendSeconds(0);
    clearMessages();
  };

  const recoveryDescription = recoveryStep === 'email'
    ? t('auth.recoveryEmailCopy')
    : recoveryStep === 'otp'
      ? t('auth.recoveryCodeCopy')
      : t('auth.recoveryPasswordCopy');

  if (loading) {
    return <main className="ft-auth-shell"><div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" /></main>;
  }

  return (
    <main className="ft-auth-shell">
      <div className="ft-auth-shell-grid">
        <AuthVisual />

        <section className="ft-auth-glass ft-auth-form-panel" aria-labelledby="auth-title">
          <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
            <AppLogo size={34} />
            <PreferenceControls compact />
          </div>
          <div className="hidden justify-end lg:flex"><PreferenceControls compact /></div>
          <p className="ft-auth-tag mt-3 lg:mt-0">{mode === 'login' ? t('nav.signIn') : t('auth.reset')}</p>
          <h2 id="auth-title" className="ft-auth-heading">{mode === 'login' ? t('auth.welcome') : t('auth.reset')}</h2>
          <p className="ft-auth-copy">
            {mode === 'login'
              ? t('auth.loginCopy')
              : recoveryDescription}
          </p>

          {error && <div role="alert" className="ft-auth-alert ft-auth-alert-error mt-5">{error}</div>}
          {info && <div aria-live="polite" className="ft-auth-alert ft-auth-alert-success mt-5">{info}</div>}

          {mode === 'login' ? (
            <form className="mt-6 space-y-5" onSubmit={handleLogin}>
              <label className="ft-auth-field-label" htmlFor="login-email">
                {t('auth.email')}
                <input id="login-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="ft-auth-input mt-2 px-4 py-3.5" placeholder="you@business.com" />
              </label>

              <div className="ft-auth-field-label">
                <span className="flex items-center justify-between gap-4">
                  <label htmlFor="login-password">{t('auth.password')}</label>
                  <button type="button" onClick={openForgotPassword} className="ft-auth-link text-xs">{t('auth.forgot')}</button>
                </span>
                <span className="relative mt-2 block">
                  <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="ft-auth-input w-full px-4 py-3.5 pr-16" placeholder={t('auth.enterPassword')} />
                  <button type="button" onClick={() => setShowPassword((current) => !current)} aria-controls="login-password" aria-pressed={showPassword} aria-label={`${showPassword ? t('auth.hide') : t('auth.show')} ${t('auth.password')}`} className="ft-auth-input-icon-btn">{showPassword ? t('auth.hide') : t('auth.show')}</button>
                </span>
              </div>

              <button type="submit" disabled={submitting || googleSubmitting} className="ft-auth-cta">
                {submitting ? t('auth.loading') : t('auth.continue')}
              </button>

              {googleAuthEnabled && (
                <>
                  <div className="ft-auth-divider">{t('auth.or')}</div>
                  <button type="button" onClick={handleGoogle} disabled={submitting || googleSubmitting} className="ft-auth-google-btn"><GoogleMark /> {googleSubmitting ? t('auth.loading') : t('auth.google')}</button>
                </>
              )}

            </form>
          ) : recoveryStep === 'email' ? (
            <div className="mt-6 space-y-5">
              <label className="ft-auth-field-label" htmlFor="recovery-email">{t('auth.email')}
                <input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="ft-auth-input mt-2 px-4 py-3.5" placeholder="you@business.com" />
              </label>
              <button type="button" onClick={sendPasswordResetOtp} disabled={submitting || resendSeconds > 0 || !email.trim()} className="ft-auth-cta">
                {submitting ? t('auth.loading') : resendSeconds > 0 ? `${t('auth.loading')} (${resendSeconds})` : t('auth.sendCode')}
              </button>
              <button type="button" onClick={backToSignIn} className="ft-auth-link w-full text-center text-sm">{t('auth.back')}</button>
            </div>
          ) : recoveryStep === 'otp' ? (
            <form className="mt-6 space-y-5" onSubmit={verifyPasswordResetOtp}>
              <div className="ft-auth-note"><span className="font-800">{normalizedEmail}</span></div>
              <label className="ft-auth-field-label" htmlFor="password-reset-otp">{t('auth.code')}
                <input id="password-reset-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, MAX_EMAIL_OTP_LENGTH))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={MIN_EMAIL_OTP_LENGTH} maxLength={MAX_EMAIL_OTP_LENGTH} required className="ft-auth-input mt-2 h-14 px-4 text-center text-2xl font-850 tracking-[0.28em]" placeholder="000000" />
              </label>
              <button type="submit" disabled={submitting || !otpReady} className="ft-auth-cta">{submitting ? t('auth.loading') : t('auth.verifyCode')}</button>
              <button type="button" onClick={sendPasswordResetOtp} disabled={submitting || resendSeconds > 0} className="ft-auth-link-muted w-full text-center text-sm">{resendSeconds > 0 ? `${t('auth.loading')} (${resendSeconds})` : t('auth.sendCode')}</button>
              <button type="button" onClick={changeRecoveryEmail} disabled={submitting} className="ft-auth-link-muted w-full text-center text-sm">{t('auth.changeEmail')}</button>
              <button type="button" onClick={backToSignIn} disabled={submitting} className="ft-auth-link-muted w-full text-center text-sm">{t('auth.back')}</button>
            </form>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={saveRecoveredPassword}>
              <label className="ft-auth-field-label" htmlFor="new-recovery-password">{t('auth.newPassword')}
                <span className="relative mt-2 block">
                  <input id="new-recovery-password" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required className="ft-auth-input w-full px-4 py-3.5 pr-16" placeholder={t('auth.passwordLength')} />
                  <button type="button" onClick={() => setShowNewPassword((current) => !current)} aria-controls="new-recovery-password" aria-pressed={showNewPassword} className="ft-auth-input-icon-btn">{showNewPassword ? t('auth.hide') : t('auth.show')}</button>
                </span>
              </label>
              <label className="ft-auth-field-label" htmlFor="confirm-recovery-password">{t('auth.confirmPassword')}
                <input id="confirm-recovery-password" type={showNewPassword ? 'text' : 'password'} value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required className="ft-auth-input mt-2 px-4 py-3.5" placeholder={t('auth.confirmPassword')} />
              </label>
              <button type="submit" disabled={submitting} className="ft-auth-cta">{submitting ? t('auth.loading') : t('auth.savePassword')}</button>
              <button type="button" onClick={backToSignIn} disabled={submitting} className="ft-auth-link-muted w-full text-center text-sm">{t('auth.back')}</button>
            </form>
          )}

          <div className="ft-auth-footer">
            <Link href="/register" className="ft-auth-link">{t('nav.createAccount')}</Link>
            <Link href="/admin-login" className="ft-auth-link-muted">{t('auth.adminSignIn')}</Link>
          </div>

          <div className="ft-auth-trust">
            <div className="ft-auth-trust-item"><Icon name="LockClosedIcon" size={14} /><span>Encrypted OTP</span></div>
            <div className="ft-auth-trust-item"><Icon name="ShieldCheckIcon" size={14} /><span>Verified sellers</span></div>
            <div className="ft-auth-trust-item"><Icon name="SparklesIcon" size={14} /><span>Zero spam calls</span></div>
          </div>
        </section>
      </div>
    </main>
  );
}
