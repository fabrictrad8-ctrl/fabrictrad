'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';

const DOCUMENT_LABELS: Record<string, string> = {
  gst_certificate: 'GST registration certificate',
  pan_card: 'PAN card',
  cancelled_cheque: 'Cancelled cheque / bank proof',
  business_proof: 'Business proof',
  address_proof: 'Address proof',
};

type ReviewDocument = {
  id: string;
  document_type: string;
  file_name: string | null;
  upload_status: string;
  rejection_reason: string | null;
  signedUrl: string | null;
};

type SellerApplication = {
  sellerId: string;
  userId: string;
  seller: {
    legal_business_name: string | null;
    display_name: string | null;
    business_type: string | null;
    gstin: string | null;
    gstin_status: string | null;
    gstin_verified: boolean;
    verification_status: string;
    settlement_eligible: boolean;
    is_active: boolean;
    updated_at: string;
  };
  user: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    is_active: boolean;
  } | null;
  registration: {
    id: string;
    registration_status: string;
    submitted_at: string | null;
    approved_at: string | null;
    rejection_reason: string | null;
  } | null;
  bank: {
    id: string;
    account_holder_name: string | null;
    bank_name: string | null;
    account_number_masked: string | null;
    ifsc_code: string | null;
    is_verified: boolean;
  } | null;
  documents: ReviewDocument[];
  blockers: string[];
  applicationSubmitted: boolean;
  readyForApproval: boolean;
};

type ReviewAction =
  | 'confirm_gstin'
  | 'approve_document'
  | 'reject_document'
  | 'verify_bank'
  | 'approve_seller'
  | 'reject_seller';

const humanStatus = (value?: string | null) =>
  String(value || 'not started')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusClass = (application: SellerApplication) => {
  if (application.seller.verification_status === 'verified') return 'bg-success/10 text-success';
  if (application.seller.verification_status === 'rejected') return 'bg-error/10 text-error';
  if (application.readyForApproval) return 'bg-primary/10 text-primary';
  if (application.applicationSubmitted) return 'bg-amber-100 text-amber-900';
  return 'bg-muted text-muted-foreground';
};

const statusLabel = (application: SellerApplication) => {
  if (application.seller.verification_status === 'verified') return 'Approved';
  if (application.seller.verification_status === 'rejected') return 'Rejected';
  if (application.readyForApproval) return 'Ready for final approval';
  if (application.applicationSubmitted) return 'Verification in progress';
  return 'Application incomplete';
};

export default function AdminSellerVerification() {
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'review' | 'ready' | 'approved'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/sellers/verification', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as {
        applications?: SellerApplication[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Seller applications could not be loaded.');
      setApplications(payload.applications || []);
      setSelectedId((current) => {
        if (current && payload.applications?.some((item) => item.sellerId === current)) return current;
        return payload.applications?.[0]?.sellerId || null;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Seller applications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = applications.find((item) => item.sellerId === selectedId) || null;
  const filtered = useMemo(
    () =>
      applications.filter((application) => {
        if (filter === 'all') return true;
        if (filter === 'incomplete') return !application.applicationSubmitted;
        if (filter === 'review') {
          return application.applicationSubmitted && !application.readyForApproval && application.seller.verification_status !== 'verified';
        }
        if (filter === 'ready') return application.readyForApproval;
        return application.seller.verification_status === 'verified';
      }),
    [applications, filter]
  );

  const act = async (
    action: ReviewAction,
    options: { documentId?: string; reason?: string } = {}
  ) => {
    if (!selected) return;
    const operationKey = `${action}:${options.documentId || selected.sellerId}`;
    setWorking(operationKey);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/sellers/verification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action,
          sellerId: selected.sellerId,
          documentId: options.documentId,
          reason: options.reason,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        blockers?: string[];
      };
      if (!response.ok) {
        const blockers = payload.blockers?.length ? ` ${payload.blockers.join(' ')}` : '';
        throw new Error(`${payload.error || 'Review action failed.'}${blockers}`);
      }
      setMessage('Seller verification updated successfully.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Review action failed.');
    } finally {
      setWorking('');
    }
  };

  const rejectDocument = (document: ReviewDocument) => {
    const reason = window.prompt(`Reason for rejecting ${DOCUMENT_LABELS[document.document_type] || document.document_type}:`);
    if (reason?.trim()) void act('reject_document', { documentId: document.id, reason });
  };

  const rejectSeller = () => {
    const reason = window.prompt('Reason for rejecting this seller application:');
    if (reason?.trim()) void act('reject_seller', { reason });
  };

  const counts = {
    incomplete: applications.filter((item) => !item.applicationSubmitted).length,
    review: applications.filter(
      (item) => item.applicationSubmitted && !item.readyForApproval && item.seller.verification_status !== 'verified'
    ).length,
    ready: applications.filter((item) => item.readyForApproval).length,
    approved: applications.filter((item) => item.seller.verification_status === 'verified').length,
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading seller verification queue…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-800 uppercase tracking-[0.14em] text-primary">Seller operations</p>
            <h1 className="mt-1 text-2xl font-800 text-foreground">Verification and approval</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              An application enters review only after the seller submits bank details and all three required documents. GSTIN, documents and bank verification must be completed separately before final approval.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <Icon name="ArrowPathIcon" size={17} /> Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Incomplete', counts.incomplete],
            ['In review', counts.review],
            ['Ready', counts.ready],
            ['Approved', counts.approved],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-xs font-700 text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-800 text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-error/20 bg-error/10 p-4 text-sm text-error">{error}</div>}
      {message && <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success">{message}</div>}

      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'All'],
          ['incomplete', 'Incomplete'],
          ['review', 'In review'],
          ['ready', 'Ready'],
          ['approved', 'Approved'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-2 text-xs font-800 ${filter === key ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.65fr)]">
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-4">
            <h2 className="font-800 text-foreground">Applications</h2>
            <p className="text-xs text-muted-foreground">{filtered.length} shown</p>
          </div>
          <div className="max-h-[760px] divide-y divide-border overflow-y-auto">
            {filtered.map((application) => (
              <button
                key={application.sellerId}
                type="button"
                onClick={() => setSelectedId(application.sellerId)}
                className={`w-full p-4 text-left transition hover:bg-muted/30 ${selectedId === application.sellerId ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-800 text-foreground">
                      {application.seller.legal_business_name || application.seller.display_name || 'Unnamed seller'}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {application.user?.full_name || application.user?.email || 'Account details unavailable'}
                    </p>
                  </div>
                  <Icon name="ChevronRightIcon" size={16} className="shrink-0 text-muted-foreground" />
                </div>
                <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-800 ${statusClass(application)}`}>
                  {statusLabel(application)}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No seller applications match this filter.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          {!selected ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Select a seller application to review.</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-800 text-foreground">
                    {selected.seller.legal_business_name || selected.seller.display_name || 'Seller application'}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected.user?.full_name} · {selected.user?.email} · {selected.user?.phone || 'No phone'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Application: {selected.applicationSubmitted ? 'Submitted' : 'Not submitted'} · Registration: {humanStatus(selected.registration?.registration_status)}
                  </p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-800 ${statusClass(selected)}`}>
                  {statusLabel(selected)}
                </span>
              </div>

              {!selected.applicationSubmitted && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  This seller has created a profile but has not completed the application. Do not approve it yet. Missing bank details or required documents must be submitted by the seller first.
                </div>
              )}

              <ReviewRow
                title="GSTIN verification"
                detail={`${selected.seller.gstin || 'Not provided'} · ${humanStatus(selected.seller.gstin_status)}`}
                complete={selected.seller.gstin_verified && selected.seller.gstin_status === 'active'}
                actionLabel="Confirm Active GSTIN"
                actionDisabled={!selected.seller.gstin || selected.seller.gstin_verified}
                working={working === `confirm_gstin:${selected.sellerId}`}
                onAction={() => void act('confirm_gstin')}
              />

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${selected.documents.filter((item) => item.upload_status === 'approved' && ['gst_certificate','pan_card','cancelled_cheque'].includes(item.document_type)).length >= 3 ? 'bg-success text-white' : 'bg-amber-100 text-amber-900'}`}>
                    <Icon name="DocumentCheckIcon" size={18} />
                  </span>
                  <div>
                    <h3 className="text-sm font-800 text-foreground">Required documents</h3>
                    <p className="text-xs text-muted-foreground">Approve each document after checking the file.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {['gst_certificate', 'pan_card', 'cancelled_cheque'].map((type) => {
                    const document = selected.documents.find((item) => item.document_type === type);
                    return (
                      <div key={type} className="rounded-lg bg-muted/30 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-700 text-foreground">{DOCUMENT_LABELS[type]}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {document ? `${document.file_name || 'Uploaded file'} · ${humanStatus(document.upload_status)}` : 'Not uploaded'}
                            </p>
                            {document?.rejection_reason && <p className="mt-1 text-xs text-error">{document.rejection_reason}</p>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {document?.signedUrl && (
                              <a href={document.signedUrl} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-2 text-xs">View</a>
                            )}
                            {document && document.upload_status !== 'approved' && (
                              <button
                                type="button"
                                onClick={() => void act('approve_document', { documentId: document.id })}
                                disabled={working === `approve_document:${document.id}`}
                                className="rounded-lg bg-success px-3 py-2 text-xs font-800 text-white disabled:opacity-50"
                              >
                                Approve
                              </button>
                            )}
                            {document && document.upload_status !== 'rejected' && (
                              <button type="button" onClick={() => rejectDocument(document)} className="rounded-lg border border-error/30 px-3 py-2 text-xs font-800 text-error">Reject</button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <ReviewRow
                title="Settlement account"
                detail={selected.bank ? `${selected.bank.account_holder_name || 'Account holder'} · ${selected.bank.bank_name || 'Bank'} · ${selected.bank.account_number_masked || 'Masked account'} · ${selected.bank.ifsc_code || 'No IFSC'}` : 'No settlement account submitted'}
                complete={selected.bank?.is_verified === true}
                actionLabel="Verify bank account"
                actionDisabled={!selected.bank || selected.bank.is_verified}
                working={working === `verify_bank:${selected.sellerId}`}
                onAction={() => void act('verify_bank')}
              />

              {selected.blockers.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <h3 className="text-sm font-800 text-foreground">Remaining blockers</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {selected.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                {selected.seller.verification_status !== 'verified' && (
                  <button type="button" onClick={rejectSeller} className="rounded-xl border border-error/30 px-5 py-3 text-sm font-800 text-error">Reject application</button>
                )}
                <button
                  type="button"
                  onClick={() => void act('approve_seller')}
                  disabled={!selected.readyForApproval || working === `approve_seller:${selected.sellerId}` || selected.seller.verification_status === 'verified'}
                  className="btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {selected.seller.verification_status === 'verified' ? 'Seller approved' : 'Final approve seller'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ReviewRow({
  title,
  detail,
  complete,
  actionLabel,
  actionDisabled,
  working,
  onAction,
}: {
  title: string;
  detail: string;
  complete: boolean;
  actionLabel: string;
  actionDisabled: boolean;
  working: boolean;
  onAction: () => void;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${complete ? 'bg-success text-white' : 'bg-amber-100 text-amber-900'}`}>
            <Icon name={complete ? 'CheckIcon' : 'ClockIcon'} size={18} />
          </span>
          <div>
            <h3 className="text-sm font-800 text-foreground">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
          </div>
        </div>
        {!complete && (
          <button type="button" onClick={onAction} disabled={actionDisabled || working} className="btn-secondary shrink-0 px-4 py-2.5 text-xs disabled:opacity-40">
            {working ? 'Saving…' : actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
