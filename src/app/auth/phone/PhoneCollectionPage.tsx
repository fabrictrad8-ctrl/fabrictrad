'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

// Indian phone number validation
function validateIndianPhone(phone: string): { valid: boolean; message: string } {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length !== 10)
    return { valid: false, message: 'Phone number must be exactly 10 digits' };
  if (!/^[6-9]/.test(cleaned))
    return { valid: false, message: 'Indian mobile numbers must start with 6, 7, 8, or 9' };
  if (/^(\d)\1{9}$/.test(cleaned))
    return { valid: false, message: 'Please enter a valid phone number' };
  return { valid: true, message: '' };
}

export default function PhoneCollectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, updatePhone, checkPhoneUnique, refreshProfile } = useAuth();

  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationMsg, setValidationMsg] = useState('');

  const role = searchParams?.get('role') || profile?.role || 'buyer';

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (profile?.phone) {
        if (profile.role === 'seller') {
          router.replace('/seller-dashboard');
        } else {
          router.replace('/buyer-dashboard');
        }
      }
    }
  }, [user, profile, loading]);

  const handlePhoneChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    setPhone(cleaned);
    setError('');
    if (cleaned.length > 0) {
      const { valid, message } = validateIndianPhone(cleaned);
      if (!valid && cleaned.length === 10) {
        setValidationMsg(message);
      } else {
        setValidationMsg('');
      }
    } else {
      setValidationMsg('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { valid, message } = validateIndianPhone(phone);
    if (!valid) {
      setError(message);
      return;
    }

    setSubmitting(true);
    try {
      const { unique, usedAs } = await checkPhoneUnique(phone);
      if (!unique) {
        const roleLabel = usedAs === 'seller' ? 'Seller' : 'Buyer';
        setError(
          `This phone number is already registered as a ${roleLabel}. The same number cannot be used for both buyer and seller accounts.`
        );
        setSubmitting(false);
        return;
      }

      await updatePhone(phone);
      await refreshProfile();

      if (role === 'seller') {
        router.replace('/seller-dashboard');
      } else {
        router.replace('/buyer-dashboard');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save phone number');
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
          <div className="inline-flex items-center gap-2 mb-4">
            <AppLogo size={40} />
            <span className="font-display font-800 text-xl text-secondary">FabricTrad</span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Icon name="DevicePhoneMobileIcon" size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-800 text-foreground mb-1">Add Your Phone Number</h1>
          <p className="text-sm text-muted-foreground">
            One last step — add your mobile number to complete setup
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 md:p-8 card-shadow-lg">
          <div className="flex justify-center mb-5">
            <span
              className={`text-xs font-700 px-3 py-1 rounded-full border ${
                role === 'seller'
                  ? 'bg-secondary/10 text-secondary border-secondary/20'
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}
            >
              {role === 'seller' ? '🏪 Seller Account' : '🛍️ Buyer Account'}
            </span>
          </div>

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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-700 text-foreground mb-2">
                Mobile Number (India)
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-3 shrink-0">
                  <span className="text-lg">🇮🇳</span>
                  <span className="text-sm font-600 text-foreground">+91</span>
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="98765 43210"
                  className={`input-base flex-1 px-4 py-3 text-lg font-600 rounded-xl tracking-widest ${
                    validationMsg
                      ? 'border-error'
                      : phone.length === 10 && !validationMsg
                        ? 'border-success'
                        : ''
                  }`}
                />
              </div>
              {validationMsg && (
                <p className="text-xs text-error mt-1.5 flex items-center gap-1">
                  <Icon name="ExclamationCircleIcon" size={12} />
                  {validationMsg}
                </p>
              )}
              {phone.length === 10 && !validationMsg && (
                <p className="text-xs text-success mt-1.5 flex items-center gap-1">
                  <Icon name="CheckCircleIcon" size={12} />
                  Valid Indian mobile number
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Icon
                name="InformationCircleIcon"
                size={14}
                className="text-warning shrink-0 mt-0.5"
              />
              <p className="text-xs text-warning">
                <strong>Important:</strong> This phone number cannot be used for another account
                (buyer or seller). Each number must be unique across the platform.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting || phone.length !== 10 || !!validationMsg}
              className="btn-primary w-full py-3 text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                'Continue to Dashboard'
              )}
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Phone number verification (OTP) will be added soon. Your number is saved securely.
          </p>
        </div>
      </div>
    </div>
  );
}
