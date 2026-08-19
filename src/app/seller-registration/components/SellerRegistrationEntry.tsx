'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeEmail, normalizeIndianPhone, validateIndianPhone } from '@/lib/authValidation';
import SellerApplicationResume from './SellerApplicationResume';
import SellerRegistrationFlowV2 from './SellerRegistrationFlowV2';

export default function SellerRegistrationEntry() {
  const {
    user,
    profile,
    loading,
    profileLoading,
    signUp,
    signIn,
    checkEmailUnique,
    checkPhoneUnique,
    refreshProfile,
  } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [createdMessage, setCreatedMessage] = useState('');
  const [sellerStatusLoading, setSellerStatusLoading] = useState(false);
  const [sellerApplicationSubmitted, setSellerApplicationSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!user || !profile?.can_sell) {
      setSellerApplicationSubmitted(false);
      setSellerStatusLoading(false);
      return;
    }

    let cancelled = false;
    setSellerStatusLoading(true);
    const loadStatus = async () => {
      try {
        const response = await fetch('/api/seller/verification-status', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => ({}))) as {
          applicationSubmitted?: boolean;
        };
        if (!cancelled) setSellerApplicationSubmitted(response.ok && payload.applicationSubmitted === true);
      } catch {
        if (!cancelled) setSellerApplicationSubmitted(false);
      } finally {
        if (!cancelled) setSellerStatusLoading(false);
      }
    };

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [profile?.can_sell, user]);

  const submitAccount = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setCreatedMessage('');

    const fullName = form.fullName.trim();
    const email = normalizeEmail(form.email);
    const phone = normalizeIndianPhone(form.phone);
    if (!fullName) return setError('Enter the owner or authorised contact name.');
    if (!email) return setError('Enter the business email address.');
    const phoneResult = validateIndianPhone(phone);
    if (!phoneResult.valid) return setError(phoneResult.message);
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');

    setSubmitting(true);
    try {
      const [emailCheck, phoneCheck] = await Promise.all([
        checkEmailUnique(email),
        checkPhoneUnique(phone),
      ]);
      if (!emailCheck.unique || !phoneCheck.unique) {
        setError(
          'This email or mobile number already belongs to a FabricTrad account. Sign in to that account and continue seller activation instead of creating a duplicate.'
        );
        return;
      }

      const signup = await signUp(email, form.password, {
        fullName,
        phone,
        role: 'seller',
      });
      if (!signup?.user?.id) throw new Error('FabricTrad could not confirm the new account.');

      const provisionResponse = await fetch('/api/auth/provision-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signup.session?.access_token
            ? { Authorization: `Bearer ${signup.session.access_token}` }
            : {}),
        },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          userId: signup.user.id,
          registrationNonce: signup.registrationNonce || '',
          requestedRole: 'seller',
        }),
      });
      const provision = (await provisionResponse.json().catch(() => ({}))) as {
        error?: string;
        userProfileId?: string | null;
        buyerProfileId?: string | null;
        sellerProfileId?: string | null;
      };

      if (
        !provisionResponse.ok ||
        !provision.userProfileId ||
        !provision.buyerProfileId ||
        !provision.sellerProfileId
      ) {
        setCreatedMessage(
          'Your login was created, but FabricTrad could not finish the seller workspace check. Sign in with the same email and password; account repair runs automatically on sign-in.'
        );
        return;
      }

      try {
        if (!signup.session?.access_token) await signIn(email, form.password);
        await refreshProfile().catch(() => undefined);
      } catch {
        setCreatedMessage(
          'Your FabricTrad account was created successfully. Sign in with the same email and password to continue the GST, bank and document steps.'
        );
        return;
      }

      window.location.replace('/seller-registration?resume=1');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Account creation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || profileLoading || sellerStatusLoading) {
    return (
      <section className="min-h-screen bg-muted/30 px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Preparing seller onboarding…</p>
        </div>
      </section>
    );
  }

  if (user && profile?.can_sell && sellerApplicationSubmitted) return <SellerApplicationResume />;
  if (user) return <SellerRegistrationFlowV2 />;

  return (
    <section className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-7 text-center">
          <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">Seller registration</p>
          <h1 className="mt-2 text-2xl font-800 text-foreground sm:text-3xl">Create your FabricTrad account first</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            This step creates the real login and seller workspace. Only after that do GST, bank and document verification steps open.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
          {error && (
            <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
              <Icon name="ExclamationTriangleIcon" size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {createdMessage ? (
            <div className="rounded-xl border border-success/25 bg-success/10 p-4 text-sm leading-6 text-foreground">
              <div className="flex items-start gap-2">
                <Icon name="CheckCircleIcon" size={18} className="mt-0.5 shrink-0 text-success" />
                <span>{createdMessage}</span>
              </div>
              <Link href="/login?role=seller&next=/seller-registration" className="btn-primary mt-4 inline-flex w-full justify-center px-4 py-3 text-sm">
                Sign in and continue
              </Link>
            </div>
          ) : (
            <form onSubmit={submitAccount} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-700 text-foreground">
                  Owner / contact name *
                  <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="input-base mt-1.5 w-full px-4 py-3 font-400" autoComplete="name" />
                </label>
                <label className="text-sm font-700 text-foreground">
                  Mobile number *
                  <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: normalizeIndianPhone(event.target.value) }))} className="input-base mt-1.5 w-full px-4 py-3 font-400" inputMode="numeric" maxLength={10} autoComplete="tel" placeholder="9876543210" />
                </label>
              </div>

              <label className="block text-sm font-700 text-foreground">
                Email address *
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: normalizeEmail(event.target.value) }))} className="input-base mt-1.5 w-full px-4 py-3 font-400" autoComplete="email" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-700 text-foreground">
                  Password *
                  <span className="relative mt-1.5 block">
                    <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="input-base w-full px-4 py-3 pr-11 font-400" autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={17} />
                    </button>
                  </span>
                </label>
                <label className="text-sm font-700 text-foreground">
                  Confirm password *
                  <input type="password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} className="input-base mt-1.5 w-full px-4 py-3 font-400" autoComplete="new-password" />
                </label>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
                <strong className="text-foreground">Created immediately:</strong> secure login, FabricTrad profile, buyer capability and seller workspace. Approval is a later step after GST, bank and documents are complete.
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-sm disabled:opacity-50">
                {submitting ? 'Creating account…' : 'Create account and continue'}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Already registered?{' '}
                <Link href="/login?role=seller&next=/seller-registration" className="font-800 text-primary">
                  Sign in and continue seller setup
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
