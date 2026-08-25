'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { normalizeIndianPhone, validateIndianPhone } from '@/lib/authValidation';

const safeReturnPath = (value: string | null, role: string) => {
  if (value && value.startsWith('/') && !value.startsWith('//')) {
    try {
      const parsed = new URL(value, 'https://fabrictrad.com');
      if (
        parsed.origin === 'https://fabrictrad.com' &&
        parsed.pathname !== '/login'&& !parsed.pathname.startsWith('/auth/') &&
        !parsed.pathname.startsWith('/admin-')
      ) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      // Use the role-based destination below.
    }
  }
  return role === 'seller' ? '/seller-registration?resume=1' : '/marketplace';
};

export default function PhoneCollectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, checkPhoneUnique, refreshProfile, signOut } = useAuth();
  const [supabase] = useState(() => createClient());

  const role = searchParams?.get('role') === 'seller' ? 'seller' : 'buyer';
  const sellerContactRequired = role === 'seller';
  const returnTo = useMemo(
    () => safeReturnPath(searchParams?.get('returnTo') || null, role),
    [role, searchParams]
  );

  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [phoneConflict, setPhoneConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.phone && !phone) setPhone(normalizeIndianPhone(profile.phone));
  }, [phone, profile?.phone]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(returnTo)}`);
  }, [loading, returnTo, router, user]);

  const normalizedPhone = normalizeIndianPhone(phone);
  const validation = validateIndianPhone(normalizedPhone);
  const hasPhone = normalizedPhone.length > 0;

  const continueWithoutPhone = () => {
    if (sellerContactRequired) {
      setError('Add a contact mobile number to continue seller onboarding. No SMS OTP is required.');
      return;
    }
    setError('');
    setPhoneConflict(false);
    router.replace(returnTo);
  };

  const handleExistingAccountSignIn = async () => {
    setSubmitting(true);
    try {
      await signOut();
    } finally {
      window.location.replace(`/login?next=${encodeURIComponent(returnTo)}`);
    }
  };

  const savePhone = async () => {
    setError('');
    setInfo('');
    setPhoneConflict(false);

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
          setPhoneConflict(true);
          throw new Error('phone_conflict');
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

      setInfo(
        sellerContactRequired
          ? 'Contact number saved. Continuing seller onboarding…' :'Mobile number saved. Opening FabricTrad…'
      );
      window.setTimeout(() => router.replace(returnTo), 200);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The mobile number could not be saved.';
      if (message === 'phone_conflict' || /already|belongs|registered|duplicate|unique/i.test(message)) {
        setPhoneConflict(true);
        setError(
          sellerContactRequired
            ? 'That mobile number is already attached to another FabricTrad login. For security, FabricTrad will not move it automatically. Use another number for this seller account, or sign in to the existing account.'
            : 'That mobile number is already attached to another FabricTrad login. You can continue buying without adding it, use another number, or sign in to the existing account.'
        );
      } else {
        setError(message);
      }
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
          <h1 className="text-2xl font-800 text-foreground">
            {sellerContactRequired ? 'Add your seller contact number' : 'Add a mobile number'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {sellerContactRequired
              ? 'One contact number is required for seller onboarding, order coordination and account review. SMS verification is not required for this step.'
              : 'A mobile number is optional for buyer contact details. You can add it now or continue without one.'}
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl md:p-8">
          <div className="mb-5 flex justify-center">
            <span className={`rounded-full border px-3 py-1 text-xs font-700 ${sellerContactRequired ? 'border-secondary/20 bg-secondary/10 text-secondary' : 'border-primary/20 bg-primary/10 text-primary'}`}>
              {sellerContactRequired ? 'Required seller contact' : 'Optional buyer contact'}
            </span>
          </div>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-xs leading-5 text-error">
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
              Mobile number {sellerContactRequired ? <span className="text-error">*</span> : <span className="font-500 text-muted-foreground">(optional)</span>}
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
                    setPhoneConflict(false);
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
              {submitting ? 'Checking account…' : hasPhone ? 'Save and continue' : sellerContactRequired ? 'Add mobile number to continue' : 'Continue without mobile number'}
            </button>

            {!sellerContactRequired && hasPhone && (
              <button
                type="button"
                onClick={continueWithoutPhone}
                disabled={submitting}
                className="ft-secondary-action min-h-11 w-full px-4 text-sm"
              >
                Continue without mobile number
              </button>
            )}

            {phoneConflict && (
              <div className="grid gap-2 rounded-xl border border-border bg-muted/40 p-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setPhone('');
                    setError('');
                    setPhoneConflict(false);
                  }}
                  disabled={submitting}
                  className="min-h-11 rounded-xl border border-border bg-card px-3 text-xs font-700 text-foreground hover:border-primary/40"
                >
                  Use a different number
                </button>
                <button
                  type="button"
                  onClick={() => void handleExistingAccountSignIn()}
                  disabled={submitting}
                  className="min-h-11 rounded-xl border border-primary/30 bg-primary/5 px-3 text-xs font-700 text-primary hover:bg-primary/10"
                >
                  Sign in to existing account
                </button>
              </div>
            )}
          </div>

          <div id="mobile-number-help" className="mt-5 rounded-xl border border-border bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
            <strong className="text-foreground">No phone OTP:</strong>{' '}
            FabricTrad stores this number as contact information. A number already attached to another login is never silently transferred between accounts.
            {sellerContactRequired
              ? ' Seller approval still depends on GSTIN, required documents and settlement-bank review.'
              : ''}
          </div>
        </div>
      </section>
    </main>
  );
}
