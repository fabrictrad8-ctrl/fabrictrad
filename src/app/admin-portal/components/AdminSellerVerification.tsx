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

const REQUIRED_DOCUMENT_TYPES = ['gst_certificate', 'pan_card', 'cancelled_cheque'] as const;

type ReviewAction =
  | 'confirm_gstin'
  | 'reject_gstin'
  | 'approve_document'
  | 'reject_document'
  | 'verify_bank'
  | 'reject_bank'
  | 'approve_seller'
  | 'reject_seller';

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
    gstin_verified: boolean;
    bank_verified: boolean;
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
  submissionBlockers: string[];
  reviewBlockers: string[];
  reviewChecks: {
    gstinConfirmed: boolean;
    requiredDocumentsApproved: boolean;
    bankVerified: boolean;
  };
  applicationSubmitted: boolean;
  readyForApproval: boolean;
};

type Filter = 'all' | 'needs_action' | 'ready' | 'approved' | 'incomplete';

type ActionOptions = {
  reason?: string;
  documentId?: string;
};

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
  if (application.applicationSubmitted) return 'Admin review in progress';
  return 'Application incomplete';
};

const actionMessage: Record<ReviewAction, string> = {
  confirm_gstin: 'GSTIN confirmed.',
  reject_gstin: 'GSTIN rejected and returned for correction.',
  approve_document: 'Document approved.',
  reject_document: 'Document rejected and returned for re-upload.',
  verify_bank: 'Settlement bank details verified.',
  reject_bank: 'Settlement bank details rejected.',
  approve_seller: 'Seller approved. Selling access is now active.',
  reject_seller: 'Seller application rejected.',
};

export default function AdminSellerVerification() {
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<Filter>('needs_action');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      const response = await fetch('/api/admin/sellers/verification', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const payload = (await response.json().catch(() => ({}))) as {
        applications?: SellerApplication[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Seller applications could not be loaded.');
      const next = payload.applications || [];
      setApplications(next);
      setSelectedId((current) => {
        if (current && next.some((item) => item.sellerId === current)) return current;
        return (
          next.find((item) => item.applicationSubmitted && item.seller.verification_status !== 'verified')
            ?.sellerId ||
          next[0]?.sellerId ||
          null
        );
      });
    } catch (caught) {
      setError(
        caught instanceof DOMException && caught.name === 'AbortError'
          ? 'The seller queue took too long to load. Please refresh once.'
          : caught instanceof Error
            ? caught.message
            : 'Seller applications could not be loaded.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      applications.filter((application) => {
        if (filter === 'all') return true;
        if (filter === 'approved') return application.seller.verification_status === 'verified';
        if (filter === 'ready') return application.readyForApproval;
        if (filter === 'incomplete') return !application.applicationSubmitted;
        return (
          application.applicationSubmitted &&
          application.seller.verification_status !== 'verified' &&
          application.seller.verification_status !== 'rejected'
        );
      }),
    [applications, filter]
  );

  const selected = applications.find((item) => item.sellerId === selectedId) || null;
  const locked = selected?.seller.verification_status === 'verified';

  const act = async (action: ReviewAction, options: ActionOptions = {}) => {
    if (!selected || working) return;
    setWorking(true);
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
          reason: options.reason,
          documentId: options.documentId,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        blockers?: string[];
      };
      if (!response.ok) {
        const blockerText = payload.blockers?.length ? ` ${payload.blockers.join(' ')}` : '';
        throw new Error(`${payload.error || 'Seller review action failed.'}${blockerText}`);
      }
      setMessage(actionMessage[action]);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Seller review action failed.');
    } finally {
      setWorking(false);
    }
  };

  const askReason = (label: string) => {
    const reason = window.prompt(label)?.trim() || '';
    if (reason.length < 5) {
      setError('Please enter a clear reason of at least 5 characters.');
      return null;
    }
    return reason;
  };

  const confirmGstin = () => {
    if (!selected?.seller.gstin || locked) return;
    if (window.confirm(`Confirm GSTIN ${selected.seller.gstin} after reviewing the submitted evidence?`)) {
      void act('confirm_gstin');
    }
  };

  const rejectGstin = () => {
    if (locked) return;
    const reason = askReason('Reason for rejecting the submitted GSTIN:');
    if (reason) void act('reject_gstin', { reason });
  };

  const approveDocument = (document: ReviewDocument) => {
    if (locked || !document.signedUrl) return;
    if (window.confirm(`Approve ${DOCUMENT_LABELS[document.document_type] || document.document_type}?`)) {
      void act('approve_document', { documentId: document.id });
    }
  };

  const rejectDocument = (document: ReviewDocument) => {
    if (locked) return;
    const reason = askReason(
      `Reason for rejecting ${DOCUMENT_LABELS[document.document_type] || document.document_type}:`
    );
    if (reason) void act('reject_document', { documentId: document.id, reason });
  };

  const verifyBank = () => {
    if (!selected?.bank || locked) return;
    if (window.confirm('Confirm the submitted settlement bank details after reviewing the account proof?')) {
      void act('verify_bank');
    }
  };

  const rejectBank = () => {
    if (locked) return;
    const reason = askReason('Reason for rejecting the settlement bank details:');
    if (reason) void act('reject_bank', { reason });
  };

  const approveSeller = () => {
    if (!selected?.readyForApproval || locked) return;
    if (
      window.confirm(
        'Final approval will activate selling. GSTIN, all required documents and settlement bank details have already been reviewed individually. Continue?'
      )
    ) {
      void act('approve_seller');
    }
  };

  const rejectSeller = () => {
    if (!selected || locked) return;
    const reason = askReason('Reason for rejecting this seller application:');
    if (reason) void act('reject_seller', { reason });
  };

  const counts = {
    needsReview: applications.filter(
      (item) => item.applicationSubmitted && item.seller.verification_status !== 'verified'
    ).length,
    ready: applications.filter((item) => item.readyForApproval).length,
    approved: applications.filter((item) => item.seller.verification_status === 'verified').length,
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading seller applications…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-800 uppercase tracking-[0.14em] text-primary">Seller operations</p>
            <h1 className="mt-1 text-2xl font-800 text-foreground">Seller verification</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Review GSTIN, each required document and settlement bank details separately. Final seller approval stays locked until every required check has passed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
          >
            <Icon name="ArrowPathIcon" size={17} /> Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Needs review" value={counts.needsReview} />
          <SummaryCard label="Ready for final approval" value={counts.ready} />
          <SummaryCard label="Approved" value={counts.approved} />
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-error/20 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success">
          {message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {([
          ['needs_action', 'Needs review'],
          ['ready', 'Ready'],
          ['incomplete', 'Incomplete'],
          ['approved', 'Approved'],
          ['all', 'All'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-2 text-xs font-800 ${
              filter === key
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.7fr)]">
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
                className={`w-full p-4 text-left transition hover:bg-muted/30 ${
                  selectedId === application.sellerId ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-800 text-foreground">
                      {application.seller.legal_business_name ||
                        application.seller.display_name ||
                        'Unnamed seller'}
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
              <p className="p-6 text-center text-sm text-muted-foreground">No seller applications in this view.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          {!selected ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Select a seller application.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-800 text-foreground">
                    {selected.seller.legal_business_name || selected.seller.display_name || 'Seller application'}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected.user?.full_name || 'No contact name'} · {selected.user?.email || 'No email'} · {selected.user?.phone || 'No phone'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Application: {humanStatus(selected.registration?.registration_status)} · Seller: {humanStatus(selected.seller.verification_status)}
                  </p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-800 ${statusClass(selected)}`}>
                  {statusLabel(selected)}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <CheckCard
                  title="GSTIN review"
                  complete={selected.reviewChecks.gstinConfirmed}
                  detail={selected.seller.gstin || 'Not submitted'}
                />
                <CheckCard
                  title="Required documents"
                  complete={selected.reviewChecks.requiredDocumentsApproved}
                  detail={`${REQUIRED_DOCUMENT_TYPES.filter((type) => selected.documents.some((document) => document.document_type === type && document.upload_status === 'approved')).length}/3 approved`}
                />
                <CheckCard
                  title="Settlement review"
                  complete={selected.reviewChecks.bankVerified}
                  detail={
                    selected.bank
                      ? `${selected.bank.account_number_masked || 'Account'} · ${selected.bank.ifsc_code || 'No IFSC'}`
                      : 'Not submitted'
                  }
                />
              </div>

              <section className="rounded-xl border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-800 text-foreground">1. GSTIN verification</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Confirm only after checking the submitted GST evidence. Final approval cannot set this flag automatically.
                    </p>
                  </div>
                  <StatusPill complete={selected.reviewChecks.gstinConfirmed} />
                </div>
                {!locked && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={confirmGstin}
                      disabled={working || !selected.seller.gstin || selected.reviewChecks.gstinConfirmed}
                      className="btn-primary px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Confirm GSTIN
                    </button>
                    <button
                      type="button"
                      onClick={rejectGstin}
                      disabled={working || !selected.seller.gstin}
                      className="rounded-lg border border-error/30 px-4 py-2 text-xs font-800 text-error disabled:opacity-40"
                    >
                      Reject GSTIN
                    </button>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-800 text-foreground">2. Required documents</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Each required file is reviewed independently. Rejected files must be corrected or re-uploaded before final approval.
                    </p>
                  </div>
                  <StatusPill complete={selected.reviewChecks.requiredDocumentsApproved} />
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {REQUIRED_DOCUMENT_TYPES.map((type) => {
                    const document = selected.documents.find((item) => item.document_type === type);
                    const approved = document?.upload_status === 'approved';
                    return (
                      <div key={type} className="rounded-xl border border-border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-800 text-foreground">{DOCUMENT_LABELS[type]}</p>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-800 ${approved ? 'bg-success/10 text-success' : document?.upload_status === 'rejected' ? 'bg-error/10 text-error' : 'bg-amber-100 text-amber-900'}`}>
                            {humanStatus(document?.upload_status || 'missing')}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-xs text-muted-foreground">{document?.file_name || 'Not uploaded'}</p>
                        {document?.rejection_reason && (
                          <p className="mt-2 text-xs leading-5 text-error">{document.rejection_reason}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {document?.signedUrl && (
                            <a
                              href={document.signedUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-border px-3 py-2 text-xs font-800 text-primary"
                            >
                              View file
                            </a>
                          )}
                          {!locked && document && (
                            <>
                              <button
                                type="button"
                                onClick={() => approveDocument(document)}
                                disabled={working || approved || !document.signedUrl}
                                className="rounded-lg bg-success px-3 py-2 text-xs font-800 text-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => rejectDocument(document)}
                                disabled={working}
                                className="rounded-lg border border-error/30 px-3 py-2 text-xs font-800 text-error disabled:opacity-40"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-xl border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-800 text-foreground">3. Settlement bank verification</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Review the bank proof and masked settlement details before marking the account verified.
                    </p>
                    {selected.bank && (
                      <p className="mt-2 text-xs font-700 text-foreground">
                        {selected.bank.account_holder_name || 'Account holder'} · {selected.bank.bank_name || 'Bank'} · {selected.bank.account_number_masked || 'No account'} · {selected.bank.ifsc_code || 'No IFSC'}
                      </p>
                    )}
                  </div>
                  <StatusPill complete={selected.reviewChecks.bankVerified} />
                </div>
                {!locked && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={verifyBank}
                      disabled={working || !selected.bank || selected.reviewChecks.bankVerified}
                      className="btn-primary px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Verify bank
                    </button>
                    <button
                      type="button"
                      onClick={rejectBank}
                      disabled={working || !selected.bank}
                      className="rounded-lg border border-error/30 px-4 py-2 text-xs font-800 text-error disabled:opacity-40"
                    >
                      Reject bank
                    </button>
                  </div>
                )}
              </section>

              {selected.blockers.length > 0 && !locked && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-800">Final approval is locked:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {selected.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                {!locked && (
                  <button
                    type="button"
                    onClick={rejectSeller}
                    disabled={working}
                    className="rounded-xl border border-error/30 px-5 py-3 text-sm font-800 text-error disabled:opacity-50"
                  >
                    Reject seller
                  </button>
                )}
                <button
                  type="button"
                  onClick={approveSeller}
                  disabled={!selected.readyForApproval || working || locked}
                  className="btn-primary min-w-48 px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {working ? 'Saving…' : locked ? 'Seller approved' : 'Final approve seller'}
                </button>
              </div>

              {selected.readyForApproval && !locked && (
                <p className="text-right text-xs text-success">
                  All three review stages are complete. Final approval can now activate selling access.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-xs font-700 text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-800 text-foreground">{value}</p>
    </div>
  );
}

function StatusPill({ complete }: { complete: boolean }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-800 ${
        complete ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-900'
      }`}
    >
      {complete ? 'Verified' : 'Pending review'}
    </span>
  );
}

function CheckCard({ title, detail, complete }: { title: string; detail: string; complete: boolean }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            complete ? 'bg-success text-white' : 'bg-amber-100 text-amber-900'
          }`}
        >
          <Icon name={complete ? 'CheckIcon' : 'ClockIcon'} size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-800 text-foreground">{title}</p>
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}
