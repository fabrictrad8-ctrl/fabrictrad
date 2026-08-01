'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { normalizeIndianPhone, validateIndianPhone } from '@/lib/authValidation';

const safeReturnPath = (value: string | null, role: string) => {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  return role === 'seller' ? '/seller-dashboard' : '/buyer-dashboard';
};

const friendlyPhoneError = (message: string) => {
  if (/provider|sms.*not|phone.*disabled|unsupported/i.test(message)) {
    return 'SMS verification is temporarily unavailable. The administrator must enable the configured Supabase SMS provider before phone verification can finish.';
  }
  if (/already|registered|duplicate|unique/i.test(message)) {
    return 'This mobile number belongs to another FabricTrad account. Use the existing account instead of creating a second buyer or seller identity.';
  }
  if (/rate|too many/i.test(message)) {
    return 'Too many code requests. Wait a minute, then request a new code.';
  }
  return message;
};

export default function PhoneCollectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, checkPhoneUnique, refreshProfile } = useAuth();
  const [supabase] = useState(() => createClient());

  const role = searchParams?.get('role') || profile?.role || 'buyer';
  const returnTo = useMemo(
    () => safeReturnPath(searchParams?.get('returnTo') || null, role),
    [role, searchParams]
  );

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (profile?.phone && !phone) setPhone(normalizeIndianPhone(profile.phone));
  }, [phone, profile?.phone]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?role=${role}`);
      return;
    }
    if (profile?.phone && profile.phone_verified) router.replace(returnTo);
  }, [loading, profile?.phone, profile?.phone_verified, returnTo, role, router, user]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const normalizedPhone = normalizeIndianPhone(phone);
  const validation = validateIndianPhone(normalizedPhone);

  const sendCode = async () => {
    setError('');
    setInfo('');
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    if (!user) {
      setError('Sign in before verifying your mobile number.');
      return;
    }

    setSubmitting(true);
    try {
      const existingPhone = normalizeIndianPhone(profile?.phone || '');
      if (normalizedPhone !== existingPhone) {
        const uniqueness = await checkPhoneUnique(normalizedPhone);
        if (!uniqueness.unique) {
          throw new Error(
            'This mobile number already belongs to another FabricTrad account. One account can use both buyer and seller workspaces.'
          );
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        phone: `+91${normalizedPhone}`,
      });
      if (updateError) throw updateError;

      setCodeSent(true);
      setOtp('');
      setResendSeconds(60);
      setInfo(`A six-digit verification code was sent to +91 ${normalizedPhone}.`);
      window.setTimeout(() => document.getElementById('phone-verification-code')?.focus(), 50);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The verification code could not be sent.';
      setError(friendlyPhoneError(message));
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async () => {
    setError('');
    setInfo('');
    const token = otp.replace(/\D/g, '').slice(0, 6);
    if (token.length !== 6) {
      setError('Enter the complete six-digit verification code.');
      return;
    }
    if (!user) {
      setError('Your session expired. Sign in again and retry verification.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: `+91${normalizedPhone}`,
        token,
        type: 'phone_change',
      });
      if (verifyError) throw verifyError;

      const confirmedUser = data.user || (await supabase.auth.getUser()).data.user;
      if (!confirmedUser?.phone_confirmed_at) {
        throw new Error('The code was accepted, but the phone confirmation did not finish. Request a new code.');
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          phone: normalizedPhone,
          phone_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (profileError) throw profileError;

      await fetch('/api/seller/verification-status', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      }).catch(() => undefined);
      await refreshProfile();
      setInfo('Mobile number verified. Opening your workspace…');
      router.replace(returnTo);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The verification code is invalid or expired.';
      setError(friendlyPhoneError(message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="gradient-hero flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="gradient-hero flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <section className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mb-4 inline-flex items-center gap-2">
            <AppLogo size={40} />
            <span className="font-display text-xl font-800 text-secondary">FabricTrad</span>
          </div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <Icon name="DevicePhoneMobileIcon" size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-800 text-foreground">Verify your mobile number</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            One verified mobile number belongs to one FabricTrad account. That same account can buy and sell.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl md:p-8">
          <div className="mb-5 flex justify-center">
            <span className={`rounded-full border px-3 py-1 text-xs font-700 ${role === 'seller' ? 'border-secondary/20 bg-secondary/10 text-secondary' : 'border-primary/20 bg-primary/10 text-primary'}`}>
              {role === 'seller' ? 'Seller verification' : 'Buyer verification'}
            </span>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-xs text-error">
              <Icon name="ExclamationTriangleIcon" size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div aria-live="polite" className="mb-4 flex items-start gap-2 rounded-xl border border-success/20 bg-success/10 p-3 text-xs text-success">
              <Icon name="CheckCircleIcon" size={15} className="mt-0.5 shrink-0" />
              <span>{info}</span>
            </div>
          )}

          <div className="space-y-4">
            <label className="block text-sm font-700 text-foreground">
              Mobile number
              <div className="mt-2 flex items-center gap-2">
                <div className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-border bg-muted px-3">
                  <span aria-hidden="true">🇮🇳</span>
                  <span className="text-sm font-700 text-foreground">+91</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  value={phone}
                  disabled={codeSent}
                  onChange={(event) => {
                    setPhone(normalizeIndianPhone(event.target.value));
                    setError('');
                  }}
                  className="input-base min-h-12 min-w-0 flex-1 px-4 text-lg font-700 tracking-wider disabled:opacity-70"
                  placeholder="9876543210"
                />
              </div>
            </label>

            {!codeSent ? (
              <button
                type="button"
                onClick={sendCode}
                disabled={submitting || !validation.valid}
                className="btn-primary min-h-12 w-full rounded-xl px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Sending secure code…' : 'Send verification code'}
              </button>
            ) : (
              <>
                <label className="block text-sm font-700 text-foreground">
                  Six-digit code
                  <input
                    id="phone-verification-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input-base mt-2 min-h-12 w-full px-4 text-center text-xl font-800 tracking-[0.45em]"
                    placeholder="000000"
                  />
                </label>
                <button
                  type="button"
                  onClick={verifyCode}
                  disabled={submitting || otp.length !== 6}
                  className="btn-primary min-h-12 w-full rounded-xl px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Verifying…' : 'Verify and continue'}
                </button>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setCodeSent(false);
                      setOtp('');
                      setInfo('');
                    }}
                    className="font-700 text-muted-foreground hover:text-foreground"
                  >
                    Change number
                  </button>
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={submitting || resendSeconds > 0}
                    className="font-800 text-primary disabled:text-muted-foreground"
                  >
                    {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Send a new code'}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
            Phone verification is separate from GST, document and bank review. Completing this step removes the phone blocker without falsely approving the remaining business checks.
          </div>
        </div>
      </section>
    </main>
  );
}
