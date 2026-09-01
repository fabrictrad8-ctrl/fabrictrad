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
    gstin_verified: boolean;
    bank_verified: boolean;
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
  reviewBlockers: string[];
  applicationSubmitted: boolean;
  readyForApproval: boolean;
};

type Filter = 'all' | 'needs_action' | 'approved' | 'incomplete';
type ReviewAction =
  | 'confirm_gstin'
  | 'reject_gstin'
  | 'approve_document'
  | 'reject_document'
  | 'verify_bank'
  | 'reject_bank'
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
  if (application.applicationSubmitted) return 'bg-violet-100 text-violet-900';
  return 'bg-amber-100 text-amber-900';
};

const statusLabel = (application: SellerApplication) => {
  if (application.seller.verification_status === 'verified') return 'Approved';
  if (application.seller.verification_status === 'rejected') return 'Rejected';
  if (application.readyForApproval) return 'Ready for final approval';
  if (application.applicationSubmitted) return 'Review in progress';
  return 'Incomplete';
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
        return next.find((item) => item.applicationSubmitted && item.seller.verification_status !== 'verified')?.sellerId || next[0]?.sellerId || null;
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

  const filtered = useMemo(() => {
    return applications.filter((application) => {
      if (filter === 'all') return true;
      if (filter === 'approved') return application.seller.verification_status === 'verified';
      if (filter === 'incomplete') return !application.applicationSubmitted && application.seller.verification_status !== 'verified';
      return application.applicationSubmitted && application.seller.verification_status !== 'verified';
    });
  }, [applications, filter]);

  const selected = applications.find((item) => item.sellerId === selectedId) || null;

  const act = async (action: ReviewAction, options?: { documentId?: string; reason?: string }) => {
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
          documentId: options?.documentId,
          reason: options?.reason,
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
      const messages: Partial<Record<ReviewAction, string>> = {
        confirm_gstin: 'GSTIN review confirmed.',
        reject_gstin: 'GSTIN review rejected.',
        approve_document: 'Document approved.',
        reject_document: 'Document rejected.',
        verify_bank: 'Settlement bank details verified.',
        reject_bank: 'Settlement bank review rejected.',
        approve_seller: 'Seller approved and selling activated.',
        reject_seller: 'Seller application rejected.',
      };
      setMessage(messages[action] || 'Seller review saved.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Seller review action failed.');
    } finally {
      setWorking(false);
    }
  };

  const rejectWithReason = (action: Extract<ReviewAction, 'reject_gstin' | 'reject_document' | 'reject_bank' | 'reject_seller'>, documentId?: string) => {
    const labels: Record<typeof action, string> = {
      reject_gstin: 'Reason for rejecting the GSTIN review:',
      reject_document: 'Reason for rejecting this document:',
      reject_bank: 'Reason for rejecting the settlement bank review:',
      reject_seller: 'Reason for rejecting this seller application:',
    };
    const reason = window.prompt(labels[action]);
    if (reason?.trim() && reason.trim().length >= 5) {
      void act(action, { documentId, reason: reason.trim() });
    }
  };

  const approveSeller = () => {
    if (!selected?.readyForApproval) return;
    if (window.confirm('All staged checks are complete. Approve this seller and activate selling?')) {
      void act('approve_seller');
    }
  };

  const counts = {
    review: applications.filter((item) => item.applicationSubmitted && item.seller.verification_status !== 'verified').length,
    approved: applications.filter((item) => item.seller.verification_status === 'verified').length,
    incomplete: applications.filter((item) => !item.applicationSubmitted && item.seller.verification_status !== 'verified').length,
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
            <h1 className="mt-1 text-2xl font-800 text-foreground">Seller approval</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Review GSTIN, each required document and the settlement bank account as separate checkpoints. Final seller approval unlocks only after every staged check is complete.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
            <Icon name="ArrowPathIcon" size={17} /> Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <SummaryCard label="In review" value={counts.review} />
          <SummaryCard label="Incomplete" value={counts.incomplete} />
          <SummaryCard label="Approved" value={counts.approved} />
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-error/20 bg-error/10 p-4 text-sm text-error">{error}</div>}
      {message && <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success">{message}</div>}

      <div className="flex flex-wrap gap-2">
        {([
          ['needs_action', 'In review'],
          ['incomplete', 'Incomplete'],
          ['approved', 'Approved'],
          ['all', 'All'],
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

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.7fr)]">
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-4">
            <h2 className="font-800 text-foreground">Applications</h2>
            <p className="text-xs text-muted-foreground">{filtered.length} shown</p>
          </div>
          <div className="max-h-[720px] divide-y divide-border overflow-y-auto">
            {filtered.map((application) => (
              <button
                key={application.sellerId}
                type="button"
                onClick={() => setSelectedId(application.sellerId)}
                className={`w-full p-4 text-left transition hover:bg-muted/30 ${selectedId === application.sellerId ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-800 text-foreground">{application.seller.legal_business_name || application.seller.display_name || 'Unnamed seller'}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{application.user?.full_name || application.user?.email || 'Account details unavailable'}</p>
                  </div>
                  <Icon name="ChevronRightIcon" size={16} className="shrink-0 text-muted-foreground" />
                </div>
                <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-800 ${statusClass(application)}`}>{statusLabel(application)}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No seller applications in this view.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          {!selected ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Select a seller application.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-800 text-foreground">{selected.seller.legal_business_name || selected.seller.display_name || 'Seller application'}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{selected.user?.full_name || 'No contact name'} · {selected.user?.email || 'No email'} · {selected.user?.phone || 'No phone'}</p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-800 ${statusClass(selected)}`}>{statusLabel(selected)}</span>
              </div>

              {selected.blockers.length > 0 && selected.seller.verification_status !== 'verified' && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-800">Seller must complete these before review:</p>
                  <p className="mt-1">{selected.blockers.join(' ')}</p>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <ReviewSection
                  title="1 · GSTIN review"
                  status={selected.seller.gstin_verified && selected.registration?.gstin_verified ? 'Verified' : 'Pending'}
                  complete={Boolean(selected.seller.gstin_verified && selected.registration?.gstin_verified && selected.seller.gstin_status === 'active')}
                >
                  <p className="text-sm font-800 text-foreground">{selected.seller.gstin || 'GSTIN not submitted'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Provider status: {humanStatus(selected.seller.gstin_status)}</p>
                  {selected.applicationSubmitted && selected.seller.verification_status !== 'verified' && !selected.seller.gstin_verified && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button disabled={working || !selected.seller.gstin} onClick={() => void act('confirm_gstin')} className="btn-primary px-3 py-2 text-xs">Confirm GSTIN</button>
                      <button disabled={working || !selected.seller.gstin} onClick={() => rejectWithReason('reject_gstin')} className="rounded-lg border border-error/30 px-3 py-2 text-xs font-800 text-error">Reject GSTIN</button>
                    </div>
                  )}
                </ReviewSection>

                <ReviewSection
                  title="3 · Settlement bank review"
                  status={selected.bank?.is_verified && selected.registration?.bank_verified ? 'Verified' : 'Pending'}
                  complete={Boolean(selected.bank?.is_verified && selected.registration?.bank_verified)}
                >
                  <p className="text-sm font-800 text-foreground">{selected.bank?.account_holder_name || 'Settlement account'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.bank ? `${selected.bank.account_number_masked || 'Account'} · ${selected.bank.ifsc_code || 'No IFSC'}` : 'Bank details not submitted'}</p>
                  {selected.applicationSubmitted && selected.seller.verification_status !== 'verified' && selected.bank && !selected.bank.is_verified && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button disabled={working} onClick={() => void act('verify_bank')} className="btn-primary px-3 py-2 text-xs">Verify bank</button>
                      <button disabled={working} onClick={() => rejectWithReason('reject_bank')} className="rounded-lg border border-error/30 px-3 py-2 text-xs font-800 text-error">Reject bank</button>
                    </div>
                  )}
                </ReviewSection>
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-800 text-foreground">2 · Required document review</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Open and approve each document individually. A rejected document returns the seller to the correction flow.</p>
                  </div>
                  <span className="text-xs font-700 text-muted-foreground">{REQUIRED_DOCUMENT_TYPES.filter((type) => selected.documents.some((document) => document.document_type === type && document.upload_status === 'approved')).length}/3 approved</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {REQUIRED_DOCUMENT_TYPES.map((type) => {
                    const document = selected.documents.find((item) => item.document_type === type);
                    const approved = document?.upload_status === 'approved';
                    return (
                      <div key={type} className={`rounded-xl border p-3 ${approved ? 'border-success/25 bg-success/5' : 'border-border bg-muted/20'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-800 text-foreground">{DOCUMENT_LABELS[type]}</p>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-800 ${approved ? 'bg-success/10 text-success' : document?.upload_status === 'rejected' ? 'bg-error/10 text-error' : 'bg-amber-100 text-amber-900'}`}>{humanStatus(document?.upload_status || 'missing')}</span>
                        </div>
                        <p className="mt-2 truncate text-xs text-muted-foreground">{document?.file_name || 'Not uploaded'}</p>
                        {document?.rejection_reason && <p className="mt-2 text-xs text-error">{document.rejection_reason}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {document?.signedUrl && <a href={document.signedUrl} target="_blank" rel="noreferrer" className="text-xs font-800 text-primary">View file</a>}
                          {selected.applicationSubmitted && document && !approved && selected.seller.verification_status !== 'verified' && (
                            <>
                              <button disabled={working} onClick={() => void act('approve_document', { documentId: document.id })} className="text-xs font-800 text-success">Approve</button>
                              <button disabled={working} onClick={() => rejectWithReason('reject_document', document.id)} className="text-xs font-800 text-error">Reject</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selected.reviewBlockers.length > 0 && selected.applicationSubmitted && selected.seller.verification_status !== 'verified' && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                  <p className="font-800">Final approval is locked until these reviews are complete:</p>
                  <p className="mt-1">{selected.reviewBlockers.join(' ')}</p>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                {selected.seller.verification_status !== 'verified' && (
                  <button type="button" onClick={() => rejectWithReason('reject_seller')} disabled={working} className="rounded-xl border border-error/30 px-5 py-3 text-sm font-800 text-error disabled:opacity-50">Reject seller</button>
                )}
                <button
                  type="button"
                  onClick={approveSeller}
                  disabled={!selected.readyForApproval || working || selected.seller.verification_status === 'verified'}
                  className="btn-primary min-w-44 px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {working ? 'Saving…' : selected.seller.verification_status === 'verified' ? 'Seller approved' : 'Approve seller'}
                </button>
              </div>

              {selected.readyForApproval && selected.seller.verification_status !== 'verified' && (
                <p className="text-right text-xs text-muted-foreground">GSTIN, all required documents and settlement bank verification are complete. Final approval can now activate seller access.</p>
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

function ReviewSection({ title, status, complete, children }: { title: string; status: string; complete: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${complete ? 'bg-success text-white' : 'bg-amber-100 text-amber-900'}`}>
          <Icon name={complete ? 'CheckIcon' : 'ClockIcon'} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-800 text-foreground">{title}</p>
            <span className={`rounded-full px-2 py-1 text-[10px] font-800 ${complete ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-900'}`}>{status}</span>
          </div>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
