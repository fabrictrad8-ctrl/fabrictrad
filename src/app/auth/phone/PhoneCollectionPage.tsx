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
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.phone && !phone) setPhone(normalizeIndianPhone(profile.phone));
  }, [phone, profile?.phone]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?role=${role}`);
  }, [loading, role, router, user]);

  const normalizedPhone = normalizeIndianPhone(phone);
  const validation = validateIndianPhone(normalizedPhone);
  const hasPhone = normalizedPhone.length > 0;

  const continueWithoutPhone = () => {
    setError('');
    router.replace(returnTo);
  };

  const savePhone = async () => {
    setError('');
    setInfo('');

    if (!hasPhone) {
      continueWithoutPhone();
      return;
    }
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    if (!user) {
      setError('Sign in before adding your mobile number.');
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

      const { error: saveError } = await supabase.rpc('set_current_account_phone', {
        p_phone: normalizedPhone,
      });
      if (saveError) throw saveError;

      await refreshProfile();
      await fetch('/api/seller/verification-status', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      }).catch(() => undefined);

      setInfo('Mobile number saved. Opening your workspace…');
      window.setTimeout(() => router.replace(returnTo), 250);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The mobile number could not be saved.';
      setError(
        /already|registered|duplicate|unique/i.test(message)
          ? 'This mobile number belongs to another FabricTrad account. Use that existing account instead.'
          : message
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="gradient-hero flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading account" />
      </div>
    );
  }

  return (
    <main id="main-content" className="gradient-hero flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <section className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mb-4 inline-flex items-center gap-2">
            <AppLogo size={40} />
            <span className="font-display text-xl font-800 text-secondary">FabricTrad</span>
          </div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <Icon name="DevicePhoneMobileIcon" size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-800 text-foreground">Add an optional mobile number</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This is only for order contact details. You can skip it now and add it later from your account settings.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl md:p-8">
          <div className="mb-5 flex justify-center">
            <span className={`rounded-full border px-3 py-1 text-xs font-700 ${role === 'seller' ? 'border-secondary/20 bg-secondary/10 text-secondary' : 'border-primary/20 bg-primary/10 text-primary'}`}>
              {role === 'seller' ? 'Optional seller contact' : 'Optional buyer contact'}
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
              Mobile number <span className="font-500 text-muted-foreground">(optional)</span>
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
                  onChange={(event) => {
                    setPhone(normalizeIndianPhone(event.target.value));
                    setError('');
                  }}
                  className="input-base min-h-12 min-w-0 flex-1 px-4 text-lg font-700 tracking-wider"
                  placeholder="9876543210"
                  aria-describedby="mobile-number-help"
                />
              </div>
            </label>

            <button
              type="button"
              onClick={savePhone}
              disabled={submitting || (hasPhone && !validation.valid)}
              className="btn-primary min-h-12 w-full rounded-xl px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Saving mobile number…' : hasPhone ? 'Save and continue' : 'Continue without mobile number'}
            </button>

            {hasPhone && (
              <button
                type="button"
                onClick={continueWithoutPhone}
                disabled={submitting}
                className="ft-secondary-action min-h-11 w-full px-4 text-sm"
              >
                Skip for now
              </button>
            )}
          </div>

          <div id="mobile-number-help" className="mt-5 rounded-xl border border-border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
            SMS verification is not required. Seller approval continues to depend on GST status, required business documents and settlement-bank review, not on a phone OTP.
          </div>
        </div>
      </section>
    </main>
  );
}
