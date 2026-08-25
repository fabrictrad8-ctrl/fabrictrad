'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type SellerVerificationState = {
  profileComplete?: boolean;
  phonePresent?: boolean;
  gstinEntered?: boolean;
  gstinVerified?: boolean;
  gstinStatus?: string;
  requiredDocumentsTotal?: number;
  requiredDocumentsUploaded?: number;
  requiredDocumentsApproved?: number;
  bankDetailsPresent?: boolean;
  bankVerified?: boolean;
  registrationStatus?: string;
  verificationStatus?: string;
  settlementEligible?: boolean;
  nextAction?: string;
};

type VerificationItem = {
  label: string;
  state: 'complete' | 'pending' | 'missing';
  detail: string;
};

const itemClass: Record<VerificationItem['state'], string> = {
  complete: 'border-success/25 bg-success/10 text-success',
  pending:
    'border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200',
  missing: 'border-border bg-card text-muted-foreground',
};

export default function SellerProfileReadiness() {
  const { user, profile, isDemoAccount } = useAuth();
  const [verification, setVerification] = useState<SellerVerificationState | null>(null);
  const [statusError, setStatusError] = useState('');
  const [statusResolved, setStatusResolved] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const canSell = profile?.can_sell ?? profile?.role === 'seller';

    if (isDemoAccount || !user?.id || !canSell) {
      setVerification(null);
      setStatusError('');
      setStatusResolved(true);
      return;
    }

    let cancelled = false;

    // Never render guessed readiness values while the authoritative seller state is loading.
    // Resetting here also prevents a previous account's verification state from flashing after
    // an account/session switch in the same browser tab.
    setVerification(null);
    setStatusError('');
    setStatusResolved(false);

    const load = async () => {
      try {
        const response = await fetch('/api/seller/verification-status', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => ({}))) as {
          status?: SellerVerificationState;
          error?: string;
        };
        if (!response.ok || !payload.status) {
          throw new Error(payload.error || 'Verification status could not be loaded.');
        }
        if (!cancelled) {
          setVerification(payload.status);
          setStatusError('');
        }
      } catch (caught) {
        if (!cancelled) {
          setStatusError(
            caught instanceof Error ? caught.message : 'Verification status could not be loaded.'
          );
        }
      } finally {
        if (!cancelled) setStatusResolved(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isDemoAccount, profile?.can_sell, profile?.role, reloadToken, user?.id]);

  const profileChecks = useMemo(
    () => [
      { label: 'Business name', complete: Boolean(profile?.business_name?.trim()) },
      { label: 'Mobile added', complete: Boolean(profile?.phone?.trim()) },
      { label: 'GSTIN added', complete: Boolean(profile?.gstin?.trim()) },
      { label: 'Pickup city', complete: Boolean(profile?.city?.trim()) },
      {
        label: 'Pickup address',
        complete: Boolean(profile?.address_line1?.trim() && profile?.pincode?.trim()),
      },
    ],
    [profile]
  );
  const profileCompleted = profileChecks.filter((item) => item.complete).length;
  const profilePercent = Math.round((profileCompleted / profileChecks.length) * 100);

  if (isDemoAccount) {
    return (
      <section className="mb-5 rounded-2xl border border-secondary/20 bg-secondary/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Icon
            name="IdentificationIcon"
            size={19}
            className="mt-0.5 shrink-0 text-secondary"
          />
          <div>
            <p className="text-sm font-800 text-foreground">Demo seller workspace</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Real publishing, verification, settlements and saved uploads require a live seller account.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // The previous implementation rendered default 0/3 and pending values before this request
  // finished, which made fully verified sellers briefly see a false 1/4 readiness card on reload.
  if (!statusResolved) return null;

  // A failed status request must never be presented as an incomplete seller account. Show a
  // compact retry state instead of inventing verification blockers from local defaults.
  if (!verification) {
    if (!statusError) return null;
    return (
      <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-warning/20 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Icon name="ExclamationTriangleIcon" size={18} className="mt-0.5 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="text-sm font-800 text-foreground">Couldn&apos;t refresh verification status</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Your seller access has not changed. Retry the status check instead of showing stale verification steps.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReloadToken((value) => value + 1)}
          className="btn-secondary inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs"
        >
          <Icon name="ArrowPathIcon" size={15} /> Retry
        </button>
      </section>
    );
  }

  const documentTotal = verification.requiredDocumentsTotal ?? 3;
  const documentsUploaded = verification.requiredDocumentsUploaded ?? 0;
  const documentsApproved = verification.requiredDocumentsApproved ?? 0;
  const phonePresent = Boolean(verification.phonePresent || profile?.phone?.trim());

  const items: VerificationItem[] = [
    {
      label: 'Mobile number',
      state: phonePresent ? 'complete' : 'missing',
      detail: phonePresent ? 'Contact number added' : 'Mobile number missing',
    },
    {
      label: 'GST registration',
      state: verification.gstinVerified
        ? 'complete'
        : verification.gstinEntered || profile?.gstin
          ? 'pending' :'missing',
      detail: verification.gstinVerified
        ? 'Active GSTIN confirmed'
        : verification.gstinStatus === 'manual_review' ?'Official GST status review pending'
          : verification.gstinEntered || profile?.gstin
            ? 'GST verification pending'
            : 'GSTIN missing',
    },
    {
      label: 'KYC documents',
      state:
        documentsApproved >= documentTotal
          ? 'complete'
          : documentsUploaded >= documentTotal
            ? 'pending' :'missing',
      detail:
        documentsApproved >= documentTotal
          ? `${documentTotal}/${documentTotal} approved`
          : documentsUploaded >= documentTotal
            ? `${documentsUploaded}/${documentTotal} uploaded · review pending`
            : `${documentsUploaded}/${documentTotal} required files uploaded`,
    },
    {
      label: 'Settlement bank',
      state: verification.bankVerified
        ? 'complete'
        : verification.bankDetailsPresent
          ? 'pending' :'missing',
      detail: verification.bankVerified
        ? 'Bank account verified'
        : verification.bankDetailsPresent
          ? 'Bank review pending' :'Settlement details missing',
    },
  ];

  const verificationCompleted = items.filter((item) => item.state === 'complete').length;
  const serverVerified =
    verification.verificationStatus === 'verified' &&
    verification.gstinVerified === true &&
    verification.bankVerified === true &&
    documentsApproved >= documentTotal;
  const fullyVerified = serverVerified || (profilePercent === 100 && verificationCompleted === items.length);
  if (fullyVerified) return null;

  const nextAction = verification.nextAction;
  const action =
    nextAction === 'add_phone'
      ? {
          href: '/auth/phone?role=seller&returnTo=/seller-dashboard',
          label: 'Add mobile number',
          icon: 'DevicePhoneMobileIcon',
        }
      : nextAction === 'contact_support'
        ? {
            href: '/help',
            label: 'Contact support',
            icon: 'LifebuoyIcon',
          }
        : {
            href: '/seller-registration?resume=1',
            label: 'Continue seller verification',
            icon: 'DocumentCheckIcon',
          };

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-secondary/5 shadow-sm">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Icon name="IdentificationIcon" size={19} className="text-primary" />
              <p className="text-sm font-800 text-foreground">Seller account readiness</p>
              <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[11px] font-800 text-success">
                Profile details {profilePercent}% complete
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
              Your mobile number is stored as contact information and does not require an SMS code. GST, business documents and settlement-bank checks remain separate verification requirements.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {items.map((item) => (
                <div key={item.label} className={`rounded-xl border p-3 ${itemClass[item.state]}`}>
                  <div className="flex items-center gap-2">
                    <Icon
                      name={
                        item.state === 'complete'
                          ? 'CheckCircleIcon'
                          : item.state === 'pending' ?'ClockIcon' :'MinusCircleIcon'
                      }
                      size={15}
                    />
                    <p className="text-xs font-800">{item.label}</p>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-4 opacity-90">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full shrink-0 xl:w-56">
            <div className="rounded-xl border border-border bg-card/80 p-3 text-center">
              <p className="text-2xl font-800 text-foreground">
                {verificationCompleted}/{items.length}
              </p>
              <p className="text-[11px] font-700 text-muted-foreground">
                verification checks complete
              </p>
            </div>
            <Link
              href={action.href}
              className="btn-primary mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs"
            >
              <Icon name={action.icon as 'DocumentCheckIcon'} size={16} />
              {action.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
