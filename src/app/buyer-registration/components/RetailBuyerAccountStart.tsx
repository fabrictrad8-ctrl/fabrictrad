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

export default function RetailBuyerAccountStart() {
  const { signUp, signIn } = useAuth();
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const fullName = form.fullName.trim();
    const email = normalizeEmail(form.email);
    const phone = normalizeIndianPhone(form.phone);
    if (!fullName) return setError('Enter the owner or authorised contact name.');
    if (!email || !email.includes('@')) return setError('Enter a valid business email address.');
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
        try {
          await signIn(email, form.password);
          window.location.replace('/buyer-registration?type=retail_store&resume=1');
          return;
        } catch {
          setError('That email already has a FabricTrad account. Sign in or reset the password instead of registering again.');
          return;
        }
      }
      if (preflight.phoneUsed) {
        setError('That mobile number already belongs to a FabricTrad account. Sign in to the existing account instead of creating a duplicate.');
        return;
      }

      const signup = await signUp(email, form.password, {
        fullName,
        phone,
        role: 'buyer',
      });
      if (!signup?.user?.id) throw new Error('FabricTrad could not create the account.');

      if (!signup.session?.access_token) {
        try {
          await signIn(email, form.password);
        } catch {
          window.location.replace('/login?next=%2Fbuyer-registration%3Ftype%3Dretail_store%26resume%3D1');
          return;
        }
      }

      window.location.replace('/buyer-registration?type=retail_store&resume=1');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Account creation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-muted/30 px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-800 text-primary">
            Step 1 · secure your login
          </span>
          <h1 className="mt-4 text-3xl font-800 tracking-tight text-foreground">
            Create the account before business KYC
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            Four basic details first. Your shop, GST and document checks come after the login is safely created, so you can leave and return without starting again.
          </p>
        </div>

        <div className="mt-7 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          {error && (
            <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
              <Icon name="ExclamationTriangleIcon" size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-700 text-foreground">
              Owner / contact name
              <input
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className="input-base mt-1.5 w-full px-4 py-3 font-400"
                autoComplete="name"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-700 text-foreground">
                Business email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="input-base mt-1.5 w-full px-4 py-3 font-400"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="text-sm font-700 text-foreground">
                Mobile number
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: normalizeIndianPhone(event.target.value) }))}
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

            <div className="rounded-xl border border-success/20 bg-success/10 p-3 text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">After this:</strong> your login is protected and reusable. You can complete shop details and upload documents now or return later.
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-sm disabled:opacity-50">
              {submitting ? 'Creating your account…' : 'Create account & continue KYC'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Already have a FabricTrad login?{' '}
            <Link href="/login?next=%2Fbuyer-registration%3Ftype%3Dretail_store%26resume%3D1" className="font-800 text-primary hover:underline">
              Sign in and continue
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
