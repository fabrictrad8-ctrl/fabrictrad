'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeEmail, normalizeIndianPhone, validateIndianPhone } from '@/lib/authValidation';

type Step = 'account' | 'address' | 'done';

const steps = [
  { key: 'account', label: 'Account', icon: 'UserIcon' },
  { key: 'address', label: 'Address', icon: 'MapPinIcon' },
  { key: 'done', label: 'Done', icon: 'CheckCircleIcon' },
];

const stepOrder: Step[] = ['account', 'address', 'done'];

const indianStates = [
  'Andhra Pradesh',
  'Gujarat',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
  'Delhi',
  'Haryana',
  'Bihar',
];
export default function BuyerRegistrationFlow() {
  const { signUp, signInWithGoogle, googleAuthEnabled, checkEmailUnique, checkPhoneUnique } =
    useAuth();

  const [currentStep, setCurrentStep] = useState<Step>('account');
  const [account, setAccount] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [address, setAddress] = useState({
    line1: '',
    line2: '',
    landmark: '',
    city: '',
    district: '',
    state: '',
    pin: '',
    country: 'India',
    recipientName: '',
    recipientPhone: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [buyerId] = useState('FT-BYR-007842');

  const currentIndex = stepOrder.indexOf(currentStep);

  const handleGoogleSignup = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle('buyer');
    } catch (e: any) {
      setError(e.message || 'Google sign-up failed');
      setSubmitting(false);
    }
  };

  const handleAccountContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const email = normalizeEmail(account.email);
    const phone = normalizeIndianPhone(account.phone);

    if (!account.fullName.trim()) {
      setError('Full name is required');
      return;
    }
    if (!email) {
      setError('Email is required');
      return;
    }
    const phoneValidation = validateIndianPhone(phone);
    if (!phoneValidation.valid) {
      setError(phoneValidation.message);
      return;
    }
    if (account.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (account.password !== account.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const [emailCheck, phoneCheck] = await Promise.all([
        checkEmailUnique(email),
        checkPhoneUnique(phone),
      ]);

      if (!emailCheck.unique) {
        setError(
          `This email is already registered as a ${emailCheck.usedAs || 'different'} account. Buyer and seller accounts must use different identity details.`
        );
        return;
      }

      if (!phoneCheck.unique) {
        setError(
          `This phone number is already registered as a ${phoneCheck.usedAs || 'different'} account. Buyer and seller accounts must use different identity details.`
        );
        return;
      }

      setAccount((prev) => ({ ...prev, email, phone }));
      setCurrentStep('address');
    } catch (e: any) {
      setError(e.message || 'Could not verify account details. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!agreed) return;
    setSubmitting(true);
    setError('');
    try {
      const email = normalizeEmail(account.email);
      const phone = normalizeIndianPhone(account.phone);
      const [emailCheck, phoneCheck] = await Promise.all([
        checkEmailUnique(email),
        checkPhoneUnique(phone),
      ]);

      if (!emailCheck.unique || !phoneCheck.unique) {
        setError(
          'This buyer identity is already in use. Use a different email and phone number from any seller account.'
        );
        return;
      }

      await signUp(email, account.password, {
        fullName: account.fullName,
        phone,
        role: 'buyer',
      });
      setCurrentStep('done');
    } catch (e: any) {
      setError(e.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-800 text-foreground mb-1">Create Buyer Account</h1>
          <p className="text-sm text-muted-foreground">
            Join 45,000+ businesses sourcing on FabricTrad
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-border z-0" />
          <div
            className="absolute top-5 left-0 h-0.5 bg-primary z-0 transition-all duration-500"
            style={{ width: `${(currentIndex / (stepOrder.length - 1)) * 100}%` }}
          />
          {steps.map((step, i) => {
            const isCompleted = i < currentIndex;
            const isActive = step.key === currentStep;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1.5 relative z-10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? 'bg-success border-success'
                      : isActive
                        ? 'bg-primary border-primary'
                        : 'bg-background border-border'
                  }`}
                >
                  {isCompleted ? (
                    <Icon name="CheckIcon" size={16} className="text-white" />
                  ) : (
                    <Icon
                      name={step.icon as 'UserIcon'}
                      size={16}
                      className={isActive ? 'text-white' : 'text-muted-foreground'}
                    />
                  )}
                </div>
                <span
                  className={`text-xs font-600 hidden sm:block ${isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'}`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 md:p-8 card-shadow-lg">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
              <Icon
                name="ExclamationTriangleIcon"
                size={14}
                className="text-error shrink-0 mt-0.5"
              />
              <p className="text-xs text-error">{error}</p>
            </div>
          )}

          {/* Step 1: Account */}
          {currentStep === 'account' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">Create your account</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Create your buyer account with email and password
              </p>

              {googleAuthEnabled && (
                <>
                  <button
                    onClick={handleGoogleSignup}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-3 text-sm font-600 text-foreground hover:bg-muted transition-colors disabled:opacity-50 mb-4"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </button>

                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">or</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                </>
              )}

              <form onSubmit={handleAccountContinue} className="space-y-4">
                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={account.fullName}
                    onChange={(e) => setAccount({ ...account, fullName: e.target.value })}
                    placeholder="Your full name"
                    className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={account.email}
                    onChange={(e) =>
                      setAccount({ ...account, email: normalizeEmail(e.target.value) })
                    }
                    placeholder="you@example.com"
                    className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">
                    Phone Number *
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-3 shrink-0">
                      <span className="text-sm font-600 text-foreground">+91</span>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={account.phone}
                      onChange={(e) =>
                        setAccount({ ...account, phone: normalizeIndianPhone(e.target.value) })
                      }
                      placeholder="9876543210"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={account.password}
                      onChange={(e) => setAccount({ ...account, password: e.target.value })}
                      placeholder="Min. 8 characters"
                      className="input-base w-full px-4 py-3 pr-10 text-sm rounded-xl"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={account.confirmPassword}
                    onChange={(e) => setAccount({ ...account, confirmPassword: e.target.value })}
                    placeholder="Repeat password"
                    className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    required
                  />
                </div>
                <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <Icon
                    name="InformationCircleIcon"
                    size={14}
                    className="text-primary shrink-0 mt-0.5"
                  />
                  <p className="text-xs text-primary">
                    Buyer and seller accounts must use different email addresses and phone numbers.
                    Contact details are kept private from other marketplace users.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full py-3 text-sm rounded-xl disabled:opacity-50"
                >
                  Continue
                </button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Already have an account?{' '}
                <Link href="/login" className="text-primary font-600 hover:underline">
                  Login here
                </Link>
              </p>
            </div>
          )}

          {/* Step 2: Address */}
          {currentStep === 'address' && (
            <div>
              <h2 className="text-xl font-800 text-foreground mb-1">Shipping Address</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Primary delivery address (can be updated later in profile)
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">
                      Recipient Name
                    </label>
                    <input
                      type="text"
                      value={address.recipientName}
                      onChange={(e) => setAddress({ ...address, recipientName: e.target.value })}
                      placeholder="Your name"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">
                      Recipient Phone
                    </label>
                    <input
                      type="tel"
                      value={address.recipientPhone}
                      onChange={(e) =>
                        setAddress({
                          ...address,
                          recipientPhone: normalizeIndianPhone(e.target.value),
                        })
                      }
                      placeholder="98765 43210"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={address.line1}
                    onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                    placeholder="Shop No. / Building Name / Street"
                    className="input-base w-full px-4 py-3 text-sm rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-700 text-foreground mb-1.5">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={address.line2}
                    onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                    placeholder="Area / Colony"
                    className="input-base w-full px-4 py-3 text-sm rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-700 text-foreground mb-1.5">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={address.pin}
                      onChange={(e) =>
                        setAddress({ ...address, pin: e.target.value.replace(/\D/g, '') })
                      }
                      placeholder="400001"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">City</label>
                    <input
                      type="text"
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      placeholder="Mumbai"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">
                      District
                    </label>
                    <input
                      type="text"
                      value={address.district}
                      onChange={(e) => setAddress({ ...address, district: e.target.value })}
                      placeholder="Mumbai"
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-1.5">State</label>
                    <select
                      value={address.state}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      className="input-base w-full px-4 py-3 text-sm rounded-xl"
                    >
                      <option value="">State</option>
                      {indianStates.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div
                  className="flex items-start gap-3 p-4 bg-muted rounded-xl cursor-pointer"
                  onClick={() => setAgreed(!agreed)}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${agreed ? 'bg-primary border-primary' : 'border-border bg-card'}`}
                  >
                    {agreed && <Icon name="CheckIcon" size={12} className="text-white" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    I agree to FabricTrad's{' '}
                    <span className="text-primary font-600">Buyer User Agreement</span>,{' '}
                    <span className="text-primary font-600">Terms of Use</span>, and{' '}
                    <span className="text-primary font-600">Privacy Policy</span>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setCurrentStep('account')}
                  className="btn-secondary flex-1 py-3 text-sm rounded-xl"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={!agreed || submitting}
                  className="btn-primary flex-1 py-3 text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Complete Registration'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {currentStep === 'done' && (
            <div className="text-center py-6">
              <div className="w-20 h-20 rounded-full bg-success/10 border-2 border-success flex items-center justify-center mx-auto mb-5">
                <Icon name="CheckCircleIcon" size={40} className="text-success" />
              </div>

              <h2 className="text-2xl font-800 text-foreground mb-2">Welcome to FabricTrad!</h2>
              <p className="text-muted-foreground text-sm mb-2">
                Your buyer account has been created successfully.
              </p>
              <p className="text-xs text-muted-foreground mb-5">
                Check your email to verify your account before using buyer features.
              </p>

              <div className="bg-muted rounded-2xl p-4 mb-6 inline-block">
                <p className="text-xs text-muted-foreground mb-1">Your Buyer ID</p>
                <p className="font-mono text-xl font-800 text-primary">{buyerId}</p>
              </div>

              <div className="space-y-2 text-left mb-6 bg-muted rounded-xl p-4">
                {[
                  '✅ Account created',
                  '📧 Verification email sent',
                  '📱 Phone number saved',
                  '🏠 Add address in profile settings',
                ].map((item) => (
                  <p key={item} className="text-sm text-foreground">
                    {item}
                  </p>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/marketplace"
                  className="btn-primary flex-1 py-3 text-sm rounded-xl text-center"
                >
                  Start Shopping
                </Link>
                <Link
                  href="/buyer-dashboard"
                  className="btn-secondary flex-1 py-3 text-sm rounded-xl text-center"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>

        {currentStep !== 'done' && (
          <div className="flex items-center justify-center gap-6 mt-6">
            {[
              { icon: 'LockClosedIcon', label: 'Secure & Encrypted' },
              { icon: 'ShieldCheckIcon', label: 'DPDP Compliant' },
              { icon: 'NoSymbolIcon', label: 'No Spam' },
            ].map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Icon name={b.icon as 'LockClosedIcon'} size={12} />
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
