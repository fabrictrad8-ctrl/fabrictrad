'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { panFromGstin } from '@/lib/commerceIdentifiers';

const REQUIRED_DOCUMENTS = [
  { key: 'gst_certificate', label: 'GST registration certificate' },
  { key: 'pan_card', label: 'Business or proprietor PAN card' },
  { key: 'cancelled_cheque', label: 'Cancelled cheque or bank statement' },
] as const;

type DocumentKey = (typeof REQUIRED_DOCUMENTS)[number]['key'];

type DocumentStatus = {
  id: string;
  document_type: string;
  file_name: string | null;
  upload_status: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
};

type SellerStatus = {
  verificationStatus?: string;
  registrationStatus?: string;
  nextAction?: string;
  profileComplete?: boolean;
  phonePresent?: boolean;
  gstinEntered?: boolean;
  gstinVerified?: boolean;
  gstinStatus?: string;
  bankDetailsPresent?: boolean;
  bankVerified?: boolean;
  requiredDocumentsUploaded?: number;
  requiredDocumentsApproved?: number;
  requiredDocumentsTotal?: number;
  settlementEligible?: boolean;
  applicationSubmitted?: boolean;
  missingDocuments?: string[];
  phone?: string | null;
  application?: {
    ownerName?: string | null;
    businessName?: string | null;
    businessType?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    address?: string | null;
    categories?: string[];
    monthlyCapacity?: string | null;
    gstin?: string | null;
    pan?: string | null;
    bankAccountMasked?: string | null;
    bankIfsc?: string | null;
    bankAccountName?: string | null;
    bankName?: string | null;
    submittedAt?: string | null;
    approvedAt?: string | null;
    rejectionReason?: string | null;
  };
  documents?: DocumentStatus[];
};

const fileAllowed = (file: File) =>
  file.size > 0 &&
  file.size <= 10 * 1024 * 1024 &&
  (file.type === 'application/pdf' || file.type.startsWith('image/'));

const titleCaseStatus = (value?: string) =>
  String(value || 'not started')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function SellerApplicationResume() {
  const { profile, refreshProfile } = useAuth();
  const [status, setStatus] = useState<SellerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [documents, setDocuments] = useState<Partial<Record<DocumentKey, File>>>({});
  const [bank, setBank] = useState({
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifsc: '',
  });

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/seller/verification-status', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as SellerStatus & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Seller application status could not be loaded.');
      setStatus(payload);
      setBank((current) => ({
        ...current,
        accountHolderName:
          current.accountHolderName || payload.application?.bankAccountName || '',
        bankName: current.bankName || payload.application?.bankName || '',
        ifsc: current.ifsc || payload.application?.bankIfsc || '',
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Seller application status could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const missingDocuments = useMemo(
    () =>
      REQUIRED_DOCUMENTS.filter((item) =>
        (status?.missingDocuments || []).includes(item.key)
      ),
    [status]
  );

  const reviewComplete = Boolean(
    status?.gstinVerified &&
      status?.bankVerified &&
      (status?.requiredDocumentsApproved || 0) >= 3
  );
  const fullyApproved = status?.verificationStatus === 'verified' && reviewComplete;
  const needsApplicationInput = Boolean(
    status &&
      (!status.bankDetailsPresent || missingDocuments.length > 0 || !status.applicationSubmitted)
  );

  const selectDocument = (key: DocumentKey, file?: File) => {
    if (!file) return;
    if (!fileAllowed(file)) {
      setError('Each document must be a PDF or image up to 10 MB.');
      return;
    }
    setError('');
    setDocuments((current) => ({ ...current, [key]: file }));
  };

  const submit = async () => {
    if (!status) return;
    setError('');
    setMessage('');

    if (!status.bankDetailsPresent) {
      const accountNumber = bank.accountNumber.replace(/\D/g, '');
      const ifsc = bank.ifsc.trim().toUpperCase();
      if (!/^\d{9,18}$/.test(accountNumber)) {
        return setError('Enter a valid bank account number containing 9 to 18 digits.');
      }
      if (accountNumber !== bank.confirmAccountNumber.replace(/\D/g, '')) {
        return setError('Bank account numbers do not match.');
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        return setError('Enter a valid IFSC code.');
      }
      if (!bank.accountHolderName.trim() || !bank.bankName.trim()) {
        return setError('Enter the account-holder and bank names.');
      }
    }

    const missingFile = missingDocuments.find((item) => !documents[item.key]);
    if (missingFile) return setError(`Upload the ${missingFile.label}.`);

    const application = status.application || {};
    const gstin = String(application.gstin || profile?.gstin || '').toUpperCase();
    const formData = new FormData();
    formData.set(
      'payload',
      JSON.stringify({
        ownerName: application.ownerName || profile?.full_name || '',
        phone: status.phone || profile?.phone || '',
        businessName:
          application.businessName || profile?.business_name || 'Seller business',
        businessType: application.businessType || 'Business seller',
        city: application.city || profile?.city || '',
        state: application.state || profile?.state || '',
        pincode: application.pincode || profile?.pincode || '',
        address: application.address || profile?.address_line1 || '',
        categories: application.categories || [],
        monthlyCapacity: application.monthlyCapacity || '',
        gstin,
        pan: application.pan || (gstin.length === 15 ? panFromGstin(gstin) : ''),
        bankAccountNumber: status.bankDetailsPresent ? '' : bank.accountNumber,
        bankIfsc: status.bankDetailsPresent ? application.bankIfsc || '' : bank.ifsc,
        bankAccountName: status.bankDetailsPresent
          ? application.bankAccountName || ''
          : bank.accountHolderName,
        bankName: status.bankDetailsPresent ? application.bankName || '' : bank.bankName,
      })
    );
    Object.entries(documents).forEach(([key, file]) => {
      if (file) formData.set(`document_${key}`, file);
    });

    setSubmitting(true);
    try {
      const response = await fetch('/api/account/enable-selling', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        warning?: string;
        message?: string;
        applicationSubmitted?: boolean;
      };
      if (!response.ok && response.status !== 202 && response.status !== 207) {
        throw new Error(payload.error || 'Seller application could not be submitted.');
      }
      if (payload.warning) setMessage(payload.warning);
      else setMessage(payload.message || 'Your seller application progress has been saved.');
      setDocuments({});
      await refreshProfile().catch(() => undefined);
      await loadStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Seller application could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="min-h-screen bg-muted/30 px-4 py-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Checking your seller application…</p>
        </div>
      </section>
    );
  }

  if (!status || !status.profileComplete) {
    return (
      <section className="min-h-screen bg-muted/30 px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-amber-300 bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-800 text-foreground">Complete your seller business profile</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your seller profile exists, but the business identity is incomplete. Continue the full
            registration form before submitting bank details and documents.
          </p>
          <Link href="/profile" className="btn-primary mt-5 inline-flex px-5 py-3 text-sm">
            Complete business profile
          </Link>
          {error && <p className="mt-4 text-sm text-error">{error}</p>}
        </div>
      </section>
    );
  }

  const stages = [
    {
      label: 'Business profile',
      complete: Boolean(status.profileComplete && status.phonePresent && status.gstinEntered),
      detail: status.profileComplete ? 'Business identity saved' : 'Business details missing',
    },
    {
      label: 'Settlement account',
      complete: Boolean(status.bankDetailsPresent),
      detail: status.bankDetailsPresent
        ? status.bankVerified
          ? 'Bank verified'
          : 'Bank submitted, verification pending'
        : 'Bank details not submitted',
    },
    {
      label: 'Required documents',
      complete: (status.requiredDocumentsUploaded || 0) >= 3,
      detail: `${status.requiredDocumentsUploaded || 0} of 3 uploaded · ${status.requiredDocumentsApproved || 0} approved`,
    },
    {
      label: 'FabricTrad approval',
      complete: fullyApproved,
      detail: fullyApproved
        ? 'Seller account approved'
        : status.applicationSubmitted
          ? 'GSTIN, documents and bank are under review'
          : 'Review has not started because the application is incomplete',
    },
  ];

  return (
    <section className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">
                Seller verification
              </p>
              <h1 className="mt-2 text-2xl font-800 text-foreground sm:text-3xl">
                {applicationTitle(status, fullyApproved)}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {status.applicationSubmitted
                  ? 'Your application is in the review workflow. Each verification item is shown separately below.'
                  : 'Your seller account was created, but the application has not entered review yet. Complete the missing items below.'}
              </p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-800 ${
                fullyApproved
                  ? 'bg-success/10 text-success'
                  : status.applicationSubmitted
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-error/10 text-error'
              }`}
            >
              {fullyApproved
                ? 'Approved'
                : status.applicationSubmitted
                  ? 'Under review'
                  : 'Not submitted'}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {stages.map((stage, index) => (
              <div key={stage.label} className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      stage.complete
                        ? 'bg-success text-white'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {stage.complete ? (
                      <Icon name="CheckIcon" size={17} />
                    ) : (
                      <span className="text-xs font-900">{index + 1}</span>
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-800 text-foreground">{stage.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-2xl border border-success/20 bg-success/10 p-4 text-sm text-success">
            {message}
          </div>
        )}

        {needsApplicationInput && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-800 text-foreground">Complete the missing submission</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Progress is saved. Existing uploaded documents will not be deleted or requested again.
            </p>

            {!status.bankDetailsPresent && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Icon name="BanknotesIcon" size={19} className="text-primary" />
                  <h3 className="font-800 text-foreground">Settlement account</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-700 text-foreground">
                    Account-holder name
                    <input
                      value={bank.accountHolderName}
                      onChange={(event) =>
                        setBank((current) => ({ ...current, accountHolderName: event.target.value }))
                      }
                      className="input-base mt-1.5 w-full px-4 py-3 font-400"
                    />
                  </label>
                  <label className="text-sm font-700 text-foreground">
                    Bank name
                    <input
                      value={bank.bankName}
                      onChange={(event) =>
                        setBank((current) => ({ ...current, bankName: event.target.value }))
                      }
                      className="input-base mt-1.5 w-full px-4 py-3 font-400"
                    />
                  </label>
                  <label className="text-sm font-700 text-foreground">
                    Account number
                    <input
                      value={bank.accountNumber}
                      onChange={(event) =>
                        setBank((current) => ({
                          ...current,
                          accountNumber: event.target.value.replace(/\D/g, '').slice(0, 18),
                        }))
                      }
                      inputMode="numeric"
                      className="input-base mt-1.5 w-full px-4 py-3 font-mono font-400"
                    />
                  </label>
                  <label className="text-sm font-700 text-foreground">
                    Confirm account number
                    <input
                      value={bank.confirmAccountNumber}
                      onChange={(event) =>
                        setBank((current) => ({
                          ...current,
                          confirmAccountNumber: event.target.value.replace(/\D/g, '').slice(0, 18),
                        }))
                      }
                      inputMode="numeric"
                      className="input-base mt-1.5 w-full px-4 py-3 font-mono font-400"
                    />
                  </label>
                  <label className="text-sm font-700 text-foreground sm:col-span-2">
                    IFSC code
                    <input
                      value={bank.ifsc}
                      onChange={(event) =>
                        setBank((current) => ({
                          ...current,
                          ifsc: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11),
                        }))
                      }
                      className="input-base mt-1.5 w-full px-4 py-3 font-mono uppercase font-400"
                    />
                  </label>
                </div>
              </div>
            )}

            {missingDocuments.length > 0 && (
              <div className="mt-7 space-y-4">
                <div className="flex items-center gap-2">
                  <Icon name="DocumentCheckIcon" size={19} className="text-primary" />
                  <h3 className="font-800 text-foreground">Missing required documents</h3>
                </div>
                {missingDocuments.map((item) => (
                  <label key={item.key} className="block rounded-2xl border border-border p-4">
                    <span className="text-sm font-800 text-foreground">{item.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      PDF, JPG, PNG or WEBP · maximum 10 MB
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(event) => selectDocument(item.key, event.target.files?.[0])}
                      className="mt-3 block w-full text-sm text-muted-foreground"
                    />
                    {documents[item.key] && (
                      <span className="mt-2 block text-xs font-700 text-success">
                        Selected: {documents[item.key]?.name}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="btn-primary mt-7 w-full py-3 text-sm disabled:opacity-50"
            >
              {submitting ? 'Saving and submitting…' : 'Save and submit for review'}
            </button>
          </div>
        )}

        {!needsApplicationInput && !fullyApproved && (
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-sm sm:p-8">
            <h2 className="text-lg font-800">Review is in progress</h2>
            <p className="mt-2 text-sm leading-6">
              GSTIN status: <strong>{titleCaseStatus(status.gstinStatus)}</strong> · Documents approved:{' '}
              <strong>{status.requiredDocumentsApproved || 0}/3</strong> · Bank:{' '}
              <strong>{status.bankVerified ? 'Verified' : 'Pending verification'}</strong>.
            </p>
            <p className="mt-2 text-sm leading-6">
              Products may be prepared as drafts, but publishing and settlements stay locked until all
              three checks are approved.
            </p>
          </div>
        )}

        {fullyApproved && (
          <div className="rounded-3xl border border-success/30 bg-success/10 p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-800 text-success">Seller account approved</h2>
            <p className="mt-2 text-sm leading-6 text-foreground">
              Your GSTIN, documents and settlement account have been verified. Seller publishing and
              settlement eligibility are active.
            </p>
            <Link href="/seller-dashboard" className="btn-primary mt-5 inline-flex px-5 py-3 text-sm">
              Open seller dashboard
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function applicationTitle(status: SellerStatus, fullyApproved: boolean) {
  if (fullyApproved) return 'Your seller account is approved';
  if (status.applicationSubmitted) return 'Your seller application is under review';
  return 'Your seller application is not submitted yet';
}
