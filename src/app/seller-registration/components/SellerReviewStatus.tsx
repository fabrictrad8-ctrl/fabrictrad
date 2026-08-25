'use client';

import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export type SellerReviewStatusData = {
  verificationStatus?: string;
  registrationStatus?: string;
  profileComplete?: boolean;
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
  application?: {
    businessName?: string | null;
    gstin?: string | null;
    submittedAt?: string | null;
    approvedAt?: string | null;
    rejectionReason?: string | null;
  };
};

const humanStatus = (value?: string | null) =>
  String(value || 'pending review')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function SellerReviewStatus({
  status,
  refreshError,
}: {
  status: SellerReviewStatusData;
  refreshError?: string;
}) {
  const approved =
    status.verificationStatus === 'verified' &&
    status.settlementEligible === true;
  const rejected =
    status.verificationStatus === 'rejected' ||
    status.registrationStatus === 'rejected';
  const documentsUploaded = status.requiredDocumentsUploaded || 0;
  const documentsApproved = status.requiredDocumentsApproved || 0;
  const requiredTotal = status.requiredDocumentsTotal || 3;

  return (
    <section className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">
                Seller verification
              </p>
              <h1 className="mt-2 text-2xl font-800 text-foreground sm:text-3xl">
                {approved
                  ? 'Your seller account is approved'
                  : rejected
                    ? 'Your seller application needs attention' :'Your seller application is under review'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {approved
                  ? 'Selling, product publishing and settlement eligibility are now active.'
                  : rejected
                    ? 'FabricTrad could not approve the current submission. Review the reason below and update the application.' :'Everything you submitted is saved. You can leave this page and come back later without restarting the application.'}
              </p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-800 ${
                approved
                  ? 'bg-success/10 text-success'
                  : rejected
                    ? 'bg-error/10 text-error' :'bg-amber-100 text-amber-900'
              }`}
            >
              {approved ? 'Approved' : rejected ? 'Needs attention' : 'Under review'}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Stage
              title="Business profile"
              detail={status.application?.businessName || 'Business identity saved'}
              complete={status.profileComplete === true}
            />
            <Stage
              title="Settlement account"
              detail={status.bankVerified ? 'Verified' : status.bankDetailsPresent ? 'Submitted · review pending' : 'Not submitted'}
              complete={status.bankDetailsPresent === true}
            />
            <Stage
              title="Required documents"
              detail={`${documentsUploaded}/${requiredTotal} uploaded${documentsApproved ? ` · ${documentsApproved} approved` : ''}`}
              complete={documentsUploaded >= requiredTotal}
            />
            <Stage
              title="FabricTrad approval"
              detail={approved ? 'Seller access active' : rejected ? 'Action required' : 'Final review in progress'}
              complete={approved}
              pending={!approved && !rejected}
            />
          </div>
        </header>

        {refreshError && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950">
            Showing your last saved status. Live refresh will retry automatically.
          </div>
        )}

        {rejected ? (
          <div className="rounded-3xl border border-error/25 bg-error/10 p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-800 text-error">Application requires an update</h2>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {status.application?.rejectionReason || 'Please review your seller details and submit the corrected information.'}
            </p>
            <Link href="/seller-registration?edit=1" className="btn-primary mt-5 inline-flex px-5 py-3 text-sm">
              Update seller application
            </Link>
          </div>
        ) : approved ? (
          <div className="rounded-3xl border border-success/30 bg-success/10 p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <Icon name="CheckIcon" size={20} />
              </span>
              <div>
                <h2 className="text-lg font-800 text-success">Seller account approved</h2>
                <p className="mt-1 text-sm leading-6 text-foreground">
                  Your GSTIN, required documents and settlement account have been approved.
                </p>
              </div>
            </div>
            <Link href="/seller-dashboard" className="btn-primary mt-5 inline-flex px-5 py-3 text-sm">
              Open seller dashboard
            </Link>
          </div>
        ) : (
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-sm sm:p-8">
            <h2 className="text-lg font-800">Review is in progress</h2>
            <p className="mt-2 text-sm leading-6">
              GSTIN: <strong>{humanStatus(status.gstinStatus)}</strong> · Documents: <strong>{documentsUploaded}/{requiredTotal} submitted</strong> · Bank: <strong>{status.bankVerified ? 'Verified' : 'Submitted'}</strong>.
            </p>
            <p className="mt-2 text-sm leading-6">
              No further action is needed unless FabricTrad asks you to update something. This page remembers your saved state when you return.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Stage({
  title,
  detail,
  complete,
  pending = false,
}: {
  title: string;
  detail: string;
  complete: boolean;
  pending?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            complete
              ? 'bg-success text-white'
              : pending
                ? 'bg-amber-100 text-amber-900' :'bg-muted text-muted-foreground'
          }`}
        >
          <Icon name={complete ? 'CheckIcon' : 'ClockIcon'} size={18} />
        </span>
        <div>
          <p className="text-sm font-800 text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}
