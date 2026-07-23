'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAIL = 'fabrictrad8@gmail.com';
type LoginRole = 'buyer' | 'seller';
type LoginStep = 'email' | 'otp';

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sendEmailOtp, verifyEmailOtp, user, profile, loading } = useAuth();

  const [role, setRole] = useState<LoginRole>('buyer');
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const registrationHref = role === 'seller' ? '/seller-registration' : '/buyer-registration';
  const destination = useMemo(() => {
    if (normalizeEmail(user?.email || '') === ADMIN_EMAIL) return '/admin-portal';
    if (profile?.role === 'super_admin' || profile?.role === 'admin_staff') return '/admin-portal';
    if (profile?.role === 'seller') return '/seller-dashboard';
    return '/buyer-dashboard';
  }, [profile?.role, user?.email]);

  useEffect(() => {
    const selectedRole = searchParams.get('role');
    if (selectedRole === 'seller') setRole('seller');
    const prefilledEmail = searchParams.get('email');
    if (prefilledEmail) setEmail(prefilledEmail);
    const queryError = searchParams.get('error');
    if (queryError === 'account_inactive') setError('This account is currently inactive. Contact FabricTrad support.');
    else if (queryError) setError(queryError.replace(/_/g, ' '));
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user && profile) router.replace(destination);
  }, [destination, loading, profile, router, user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const requestOtp = async () => {
    const normalized = normalizeEmail(email);
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      setError('Enter the email address registered with your FabricTrad account.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await sendEmailOtp(normalized);
      setEmail(normalized);
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
      setCooldown(60);
      window.setTimeout(() => document.getElementById('otp-0')?.focus(), 50);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to send the verification code.');
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
    setSubmitting(true);
    try {
      await verifyEmailOtp(email, token);
      router.replace('/auth/route');
      router.refresh();
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'The code is invalid or has expired.');
      setSubmitting(false);
    }
  };

  const updateOtp = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtp((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    if (digit && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
    if (event.key === 'Enter') void verifyOtp();
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#0a101a]"><span className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" /></main>;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a101a] px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(196,91,24,0.20),transparent_34%),radial-gradient(circle_at_88%_15%,rgba(77,99,150,0.22),transparent_32%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:42px_42px]" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1726]/95 shadow-2xl shadow-black/35 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden min-h-[650px] border-r border-white/10 bg-[linear-gradient(145deg,rgba(200,96,10,0.18),rgba(12,24,42,0.92))] p-10 lg:flex lg:flex-col lg:justify-between">
            <Link href="/" className="inline-flex items-center gap-3" aria-label="FabricTrad home"><AppLogo size={42} /><span className="text-xl font-800 tracking-tight text-white">FabricTrad</span></Link>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-800 text-emerald-200"><Icon name="ShieldCheckIcon" size={15} /> Secure email verification</span>
              <h1 className="mt-6 max-w-xl text-5xl font-800 leading-[1.02] tracking-[-0.04em] text-white">Your workspace opens only after your email is verified.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">FabricTrad uses one-time codes instead of public demo access. Your registered account decides which private workspace you enter.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Icon name="LockClosedIcon" size={19} className="text-orange-300" /><p className="mt-3 text-sm font-800 text-white">No shared passwords</p><p className="mt-1 text-xs leading-5 text-slate-400">Access requires the inbox connected to the account.</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Icon name="UserCircleIcon" size={19} className="text-blue-300" /><p className="mt-3 text-sm font-800 text-white">Role-correct routing</p><p className="mt-1 text-xs leading-5 text-slate-400">Verified users are sent to their assigned workspace automatically.</p></div>
            </div>
          </div>

          <div className="flex min-h-[650px] items-center p-6 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              <Link href="/" className="mb-8 inline-flex items-center gap-2.5 lg:hidden"><AppLogo size={36} /><span className="text-lg font-800 text-white">FabricTrad</span></Link>
              <p className="text-xs font-800 uppercase tracking-[0.18em] text-orange-300">Secure account access</p>
              <h2 className="mt-3 text-3xl font-800 tracking-tight text-white">{step === 'email' ? 'Sign in with email OTP' : 'Enter your verification code'}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{step === 'email' ? 'Choose your account type and use the email registered with FabricTrad.' : `We sent a six-digit code to ${email}.`}</p>

              {step === 'email' && <div className="mt-7 grid grid-cols-2 rounded-xl border border-white/10 bg-black/15 p-1">
                <button type="button" onClick={() => setRole('buyer')} className={`rounded-lg px-3 py-2.5 text-sm font-800 transition ${role === 'buyer' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Buyer</button>
                <button type="button" onClick={() => setRole('seller')} className={`rounded-lg px-3 py-2.5 text-sm font-800 transition ${role === 'seller' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Seller</button>
              </div>}

              {error && <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-300/20 bg-red-400/10 p-3.5" role="alert"><Icon name="ExclamationTriangleIcon" size={16} className="mt-0.5 shrink-0 text-red-200" /><p className="text-xs leading-5 text-red-100">{error}</p></div>}

              {step === 'email' ? (
                <div className="mt-6 space-y-4">
                  <label className="block"><span className="mb-1.5 block text-sm font-700 text-slate-200">Registered email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void requestOtp(); }} autoComplete="email" placeholder="name@company.com" className="w-full rounded-xl border border-white/15 bg-[#111f32] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20" /></label>
                  <button type="button" onClick={() => void requestOtp()} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3.5 text-sm font-800 text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Sending code…</> : <>Send verification code <Icon name="ArrowRightIcon" size={16} /></>}</button>
                  <p className="text-center text-xs leading-5 text-slate-500">Only an existing FabricTrad account or the authorised business administrator can complete sign-in.</p>
                </div>
              ) : (
                <div className="mt-7">
                  <div className="flex justify-between gap-2">{otp.map((digit, index) => <input key={index} id={`otp-${index}`} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} value={digit} onChange={(event) => updateOtp(index, event.target.value)} onKeyDown={(event) => handleOtpKeyDown(index, event)} maxLength={1} aria-label={`OTP digit ${index + 1}`} className="h-14 min-w-0 flex-1 rounded-xl border border-white/15 bg-[#111f32] text-center text-xl font-800 text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20" />)}</div>
                  <button type="button" onClick={() => void verifyOtp()} disabled={submitting || otp.join('').length !== 6} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3.5 text-sm font-800 text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Verifying…</> : <>Verify and continue <Icon name="ArrowRightIcon" size={16} /></>}</button>
                  <div className="mt-4 flex items-center justify-between text-xs"><button type="button" onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); setError(''); }} className="font-700 text-slate-400 hover:text-white">Change email</button><button type="button" onClick={() => void requestOtp()} disabled={cooldown > 0 || submitting} className="font-700 text-orange-300 disabled:text-slate-600">{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button></div>
                </div>
              )}

              <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-slate-500">Need an account? <Link href={registrationHref} className="font-800 text-orange-300 hover:text-orange-200">Create a {role} account</Link></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
