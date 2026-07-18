'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type AuthMode = 'choose' | 'email-password' | 'email-otp' | 'otp-verify';
type LoginRole = 'buyer' | 'seller';

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signInWithGoogle, sendEmailOtp, verifyEmailOtp, user, profile, loading } = useAuth();

  const [mode, setMode] = useState<AuthMode>('choose');
  const [role, setRole] = useState<LoginRole>('buyer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    const r = searchParams?.get('role');
    if (r === 'seller') setRole('seller');
    const err = searchParams?.get('error');
    if (err === 'auth_failed') setError('Authentication failed. Please try again.');
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'super_admin' || profile.role === 'admin_staff') {
        router.replace('/admin-portal');
      } else if (profile.role === 'seller') {
        router.replace('/seller-dashboard');
      } else {
        router.replace('/buyer-dashboard');
      }
    }
  }, [user, profile, loading]);

  const startOtpCooldown = () => {
    setOtpCooldown(60);
    const interval = setInterval(() => {
      setOtpCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle(role);
    } catch (e: any) {
      setError(e.message || 'Google sign-in failed');
      setSubmitting(false);
    }
  };

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (e: any) {
      setError(e.message || 'Invalid email or password');
      setSubmitting(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) { setError('Please enter your email'); return; }
    setError('');
    setSubmitting(true);
    try {
      await sendEmailOtp(email);
      setMode('otp-verify');
      setInfo(`A 6-digit OTP has been sent to ${email}`);
      startOtpCooldown();
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = val.replace(/\D/g, '');
    setOtp(newOtp);
    if (val && index < 5) {
      document.getElementById(`login-otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`login-otp-${index - 1}`)?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const token = otp.join('');
    if (token.length !== 6) { setError('Please enter the complete 6-digit OTP'); return; }
    setError('');
    setSubmitting(true);
    try {
      await verifyEmailOtp(email, token);
    } catch (e: any) {
      setError(e.message || 'Invalid or expired OTP');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <AppLogo size={40} />
            <span className="font-display font-800 text-xl text-secondary">FabricTrad</span>
          </Link>
          <h1 className="text-2xl font-800 text-foreground mb-1">
            {mode === 'otp-verify' ? 'Enter OTP' : 'Welcome back'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'otp-verify' ? 'Check your email for the 6-digit code' : 'Sign in to your account'}
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 md:p-8 card-shadow-lg">
          {/* Role Selector */}
          {mode !== 'otp-verify' && (
            <div className="flex rounded-xl border border-border overflow-hidden mb-6">
              <button
                onClick={() => setRole('buyer')}
                className={`flex-1 py-2.5 text-sm font-600 transition-colors ${
                  role === 'buyer' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                Buyer Login
              </button>
              <button
                onClick={() => setRole('seller')}
                className={`flex-1 py-2.5 text-sm font-600 transition-colors ${
                  role === 'seller' ? 'bg-secondary text-white' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                Seller Login
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
              <Icon name="ExclamationTriangleIcon" size={14} className="text-error shrink-0 mt-0.5" />
              <p className="text-xs text-error">{error}</p>
            </div>
          )}
          {info && !error && (
            <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/20 rounded-xl mb-4">
              <Icon name="CheckCircleIcon" size={14} className="text-success shrink-0 mt-0.5" />
              <p className="text-xs text-success">{info}</p>
            </div>
          )}

          {/* OTP Verify Step */}
          {mode === 'otp-verify' && (
            <div>
              <p className="text-sm text-muted-foreground mb-5 text-center">
                OTP sent to <span className="font-600 text-foreground">{email}</span>
              </p>
              <div className="flex justify-center gap-2 mb-6">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`login-otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-11 h-14 text-center text-xl font-800 input-base rounded-xl"
                  />
                ))}
              </div>
              <button
                onClick={handleVerifyOtp}
                disabled={submitting || otp.join('').length !== 6}
                className="btn-primary w-full py-3 text-sm rounded-xl mb-3 disabled:opacity-50"
              >
                {submitting ? 'Verifying...' : 'Verify OTP'}
              </button>
              <div className="text-center">
                {otpCooldown > 0 ? (
                  <p className="text-xs text-muted-foreground">Resend in {otpCooldown}s</p>
                ) : (
                  <button onClick={() => handleSendOtp()} className="text-xs text-primary font-600 hover:underline">
                    Resend OTP
                  </button>
                )}
              </div>
              <button
                onClick={() => { setMode('email-otp'); setOtp(['', '', '', '', '', '']); setInfo(''); }}
                className="mt-4 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
              >
                <Icon name="ArrowLeftIcon" size={12} />
                Change email
              </button>
            </div>
          )}

          {/* Choose Mode */}
          {mode === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-3 text-sm font-600 text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button
                onClick={() => setMode('email-password')}
                className="w-full flex items-center justify-center gap-2 border border-border rounded-xl py-3 text-sm font-600 text-foreground hover:bg-muted transition-colors"
              >
                <Icon name="EnvelopeIcon" size={16} className="text-muted-foreground" />
                Sign in with Email and Password
              </button>

              <button
                onClick={() => setMode('email-otp')}
                className="w-full flex items-center justify-center gap-2 border border-border rounded-xl py-3 text-sm font-600 text-foreground hover:bg-muted transition-colors"
              >
                <Icon name="KeyIcon" size={16} className="text-muted-foreground" />
                Sign in with Email OTP
              </button>
            </div>
          )}

          {/* Email + Password */}
          {mode === 'email-password' && (
            <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input-base w-full px-4 py-3 text-sm rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    required
                    className="input-base w-full px-4 py-3 pr-10 text-sm rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3 text-sm rounded-xl disabled:opacity-50"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
              >
                <Icon name="ArrowLeftIcon" size={12} />
                Back
              </button>
            </form>
          )}

          {/* Email OTP */}
          {mode === 'email-otp' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input-base w-full px-4 py-3 text-sm rounded-xl"
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <Icon name="InformationCircleIcon" size={14} className="text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary">We will send a 6-digit OTP to your email. No password needed.</p>
              </div>
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="btn-primary w-full py-3 text-sm rounded-xl disabled:opacity-50"
              >
                {submitting ? 'Sending OTP...' : 'Send OTP'}
              </button>
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
              >
                <Icon name="ArrowLeftIcon" size={12} />
                Back
              </button>
            </form>
          )}

          {mode !== 'otp-verify' && (
            <div className="mt-6 pt-5 border-t border-border text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                New buyer?{' '}
                <Link href="/buyer-registration" className="text-primary font-600 hover:underline">
                  Register as Buyer
                </Link>
              </p>
              <p className="text-xs text-muted-foreground">
                Want to sell?{' '}
                <Link href="/seller-registration" className="text-secondary font-600 hover:underline">
                  Register as Seller
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
