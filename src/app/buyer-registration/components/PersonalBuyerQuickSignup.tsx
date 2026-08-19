'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeEmail, normalizeIndianPhone, validateIndianPhone } from '@/lib/authValidation';

type PreflightResponse = {
  emailUsed?: boolean;
  phoneUsed?: boolean;
  error?: string;
};

export default function PersonalBuyerQuickSignup() {
  const { signUp, signInWithGoogle, googleAuthEnabled } = useAuth();
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const fullName = form.fullName.trim();
    const email = normalizeEmail(form.email);
    const phone = normalizeIndianPhone(form.phone);
    if (!fullName) return setError('Enter your name.');
    if (!email || !email.includes('@')) return setError('Enter a valid email address.');
    const phoneResult = validateIndianPhone(phone);
    if (!phoneResult.valid) return setError(phoneResult.message);
    if (form.password.length < 8) return setError('Use a password with at least 8 characters.');

    setSubmitting(true);
    try {
      const preflightResponse = await fetch('/api/auth/registration-preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email, phone }),
      });
      const preflight = (await preflightResponse.json().catch(() => ({}))) as PreflightResponse;
      if (!preflightResponse.ok) {
        throw new Error(preflight.error || 'Could not check the account details.');
      }

      if (preflight.emailUsed) {
        const loginResponse = await fetch('/api/auth/password-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ email, password: form.password, next: '/marketplace' }),
        });
        const loginPayload = (await loginResponse.json().catch(() => ({}))) as {
          destination?: string;
          error?: string;
        };
        if (loginResponse.ok) {
          window.location.replace(
            loginPayload.destination?.startsWith('/') ? loginPayload.destination : '/marketplace'
          );
          return;
        }
        setError('That email already has a FabricTrad account. Sign in or reset the password instead of registering again.');
        return;
      }

      if (preflight.phoneUsed) {
        setError('That mobile number already belongs to a FabricTrad account. Sign in to the existing account instead of creating a duplicate.');
        return;
      }

      const signup = await signUp(email, form.password, {
        fullName,
        phone,
        role: 'buyer',
        verificationMethod: 'none',
      });
      if (!signup?.user?.id) throw new Error('Your FabricTrad account could not be created.');

      const submission = new FormData();
      submission.set('userId', signup.user.id);
      submission.set('registrationNonce', signup.registrationNonce || '');
      submission.set(
        'payload',
        JSON.stringify({
          buyerType: 'end_user',
          fullName,
          phone,
          businessName: '',
          gstRegistrationStatus: 'unregistered',
          gstin: '',
          pan: '',
          identityMethod: 'pan',
          addressLine1: '',
          addressLine2: '',
          city: '',
          state: '',
          pincode: '',
        })
      );

      const finalResponse = await fetch('/api/registration/buyer/finalize', {
        method: 'POST',
        headers: signup.session?.access_token
          ? { Authorization: `Bearer ${signup.session.access_token}` }
          : undefined,
        credentials: 'same-origin',
        cache: 'no-store',
        body: submission,
      });
      const finalPayload = (await finalResponse.json().catch(() => ({}))) as { error?: string };
      if (!finalResponse.ok) {
        throw new Error(finalPayload.error || 'Your personal buyer profile could not be completed.');
      }

      window.localStorage.removeItem('fabrictrad_buyer_type');
      window.sessionStorage.removeItem('fabrictrad_buyer_type');
      document.cookie = 'fabrictrad_buyer_type=; Path=/; Max-Age=0; SameSite=Lax';
      window.location.replace(signup.session?.access_token ? '/marketplace' : '/login?registered=1');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Account creation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const continueWithGoogle = async () => {
    setError('');
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle('buyer');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-up failed.');
      setGoogleSubmitting(false);
    }
  };

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-muted/30 px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <span className="inline-flex rounded-full bg-success/10 px-3 py-1 text-xs font-800 text-success">
            Personal buyer · no KYC documents
          </span>
          <h1 className="mt-4 text-3xl font-800 tracking-tight text-foreground sm:text-4xl">
            Create your account and start shopping
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            Just your basic account details. Add a delivery address when you actually place an order.
          </p>
        </div>

        <div className="mt-7 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          {error && (
            <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
              <Icon name="ExclamationTriangleIcon" size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {googleAuthEnabled && (
            <>
              <button
                type="button"
                onClick={continueWithGoogle}
                disabled={submitting || googleSubmitting}
                className="btn-secondary w-full py-3 text-sm disabled:opacity-50"
              >
                {googleSubmitting ? 'Connecting…' : 'Continue with Google'}
              </button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>or use email</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-700 text-foreground">
              Name
              <input
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className="input-base mt-1.5 w-full px-4 py-3 font-400"
                autoComplete="name"
                placeholder="Your name"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-700 text-foreground">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="input-base mt-1.5 w-full px-4 py-3 font-400"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>
              <label className="text-sm font-700 text-foreground">
                Mobile number
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: normalizeIndianPhone(event.target.value),
                    }))
                  }
                  className="input-base mt-1.5 w-full px-4 py-3 font-400"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel"
                  placeholder="9876543210"
                  required
                />
              </label>
            </div>

            <label className="block text-sm font-700 text-foreground">
              Password
              <span className="relative mt-1.5 block">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  className="input-base w-full px-4 py-3 pr-16 font-400"
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="At least 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 px-4 text-xs font-700 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting || googleSubmitting}
              className="btn-primary w-full py-3 text-sm disabled:opacity-50"
            >
              {submitting ? 'Creating your account…' : 'Create account & start shopping'}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
            <span>No PAN · No Aadhaar · No GST certificate</span>
            <Link href="/login" className="font-800 text-primary hover:underline">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
