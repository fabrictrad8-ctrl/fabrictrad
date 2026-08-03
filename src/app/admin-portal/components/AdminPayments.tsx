'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

type PaymentKind = 'catalog' | 'bulk';
type Payment = {
  id: string;
  kind: PaymentKind;
  orderId: string;
  orderReference: string;
  orderStatus: string;
  orderPaymentStatus: string;
  buyer: { id?: string | null; name: string; email?: string | null };
  seller: { id?: string | null; name: string; gstin?: string | null };
  amount: number;
  capturedAmount: number;
  refundedAmount: number;
  refundableAmount: number;
  refundRequestedAmount: number;
  refundStatus: string;
  refundRequestId?: string | null;
  refundReason?: string | null;
  currency: string;
  status: string;
  paymentMethod?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  platformCommission: number;
  estimatedProcessingFee: number;
  actualProcessingFee: number;
  actualProcessingTax: number;
  gstOnCommission: number;
  sellerPayable: number;
  transferId?: string | null;
  transferStatus: string;
  failureReason?: string | null;
  capturedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  lastWebhookEvent?: string | null;
  lastWebhookAt?: string | null;
};

type RefundDraft = {
  payment: Payment;
  amount: string;
  reason: string;
};

const statusOptions = [
  'all',
  'captured',
  'authorized',
  'initiated',
  'failed',
  'partially_refunded',
  'refunded',
] as const;
const money = (value: unknown) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
const human = (value?: string | null) =>
  String(value || 'unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '—';

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<(typeof statusOptions)[number]>('all');
  const [kind, setKind] = useState<'all' | PaymentKind>('all');
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refundDraft, setRefundDraft] = useState<RefundDraft | null>(null);
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/payments', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const result = (await response.json().catch(() => ({}))) as {
        payments?: Payment[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || 'Payment ledger could not be loaded.');
      setPayments(result.payments || []);
    } catch (caught) {
      setPayments([]);
      setError(caught instanceof Error ? caught.message : 'Payment ledger could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    return payments.filter((payment) => {
      const created = new Date(payment.createdAt).getTime();
      const searchable = [
        payment.orderReference,
        payment.razorpayOrderId,
        payment.razorpayPaymentId,
        payment.buyer.name,
        payment.buyer.email,
        payment.seller.name,
        payment.seller.gstin,
        payment.paymentMethod,
        payment.status,
        payment.refundStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (
        (status === 'all' || payment.status === status) &&
        (kind === 'all' || payment.kind === kind) &&
        (!normalized || searchable.includes(normalized)) &&
        (from === null || created >= from) &&
        (to === null || created <= to)
      );
    });
  }, [dateFrom, dateTo, kind, payments, query, status]);

  const summary = useMemo(
    () => ({
      captured: filtered.reduce(
        (sum, payment) =>
          sum +
          (['captured', 'partially_refunded', 'refunded'].includes(payment.status)
            ? payment.capturedAmount
            : 0),
        0
      ),
      refunded: filtered.reduce((sum, payment) => sum + payment.refundedAmount, 0),
      commission: filtered.reduce((sum, payment) => sum + payment.platformCommission, 0),
      sellerPayable: filtered.reduce((sum, payment) => sum + payment.sellerPayable, 0),
      pendingRefunds: filtered.filter((payment) => payment.refundStatus === 'requested').length,
      failed: filtered.filter((payment) => payment.status === 'failed').length,
    }),
    [filtered]
  );

  const exportRows = () =>
    filtered.map((payment) => ({
      'Order reference': payment.orderReference,
      Type: human(payment.kind),
      Buyer: payment.buyer.name,
      'Buyer email': payment.buyer.email || '',
      Seller: payment.seller.name,
      'Seller GSTIN': payment.seller.gstin || '',
      'Razorpay order': payment.razorpayOrderId || '',
      'Razorpay payment': payment.razorpayPaymentId || '',
      'Payment method': human(payment.paymentMethod),
      Status: human(payment.status),
      'Captured amount': payment.capturedAmount,
      'Refunded amount': payment.refundedAmount,
      'Refund status': human(payment.refundStatus),
      'Platform commission': payment.platformCommission,
      'Commission GST': payment.gstOnCommission,
      'Actual gateway fee': payment.actualProcessingFee,
      'Actual gateway tax': payment.actualProcessingTax,
      'Seller payable': payment.sellerPayable,
      'Transfer status': human(payment.transferStatus),
      'Last webhook': payment.lastWebhookEvent || '',
      Created: payment.createdAt,
    }));

  const submitRefund = async () => {
    if (!refundDraft) return;
    const amount = Number(refundDraft.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > refundDraft.payment.refundableAmount) {
      toast.error(`Enter an amount from ₹1 to ${money(refundDraft.payment.refundableAmount)}.`);
      return;
    }
    if (refundDraft.reason.trim().length < 5) {
      toast.error('Enter a clear refund reason of at least 5 characters.');
      return;
    }
    if (
      !window.confirm(
        `Request a ${money(amount)} refund to the original payment method for ${refundDraft.payment.orderReference}?`
      )
    ) {
      return;
    }

    setSubmittingRefund(true);
    try {
      const response = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          kind: refundDraft.payment.kind,
          paymentId: refundDraft.payment.id,
          amount,
          reason: refundDraft.reason.trim(),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || 'Refund request failed.');
      toast.success(result.message || 'Refund request submitted.');
      setRefundDraft(null);
      await loadPayments();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Refund request failed.');
    } finally {
      setSubmittingRefund(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-800 text-foreground">Marketplace Payment Ledger</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Live catalogue and bulk payment attempts, captures, gateway fees, seller payable amounts,
            refunds, transfers and signed webhook reconciliation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadPayments()}
            disabled={loading}
            className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
          >
            <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            disabled={!filtered.length}
            onClick={() => exportToCSV(exportRows(), 'fabrictrad-payment-ledger')}
            className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
          >
            <Icon name="DocumentTextIcon" size={14} /> CSV
          </button>
          <button
            type="button"
            disabled={!filtered.length}
            onClick={() => exportToExcel(exportRows(), 'fabrictrad-payment-ledger')}
            className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
          >
            <Icon name="TableCellsIcon" size={14} /> Excel
          </button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ['Captured', money(summary.captured), 'CreditCardIcon', 'text-success'],
          ['Refunded', money(summary.refunded), 'ArrowUturnLeftIcon', 'text-warning'],
          ['Commission', money(summary.commission), 'ReceiptPercentIcon', 'text-primary'],
          ['Seller payable', money(summary.sellerPayable), 'BanknotesIcon', 'text-secondary'],
          ['Pending refunds', String(summary.pendingRefunds), 'ClockIcon', 'text-warning'],
          ['Failed payments', String(summary.failed), 'ExclamationTriangleIcon', 'text-error'],
        ].map(([label, value, icon, color]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <Icon name={icon as 'CreditCardIcon'} size={18} className={color} />
            <p className={`mt-2 text-lg font-800 ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 grid gap-2 rounded-2xl border border-border bg-card p-3 lg:grid-cols-[minmax(15rem,1fr)_auto_auto_auto_auto]">
        <label className="relative">
          <Icon
            name="MagnifyingGlassIcon"
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Order, buyer, seller, GSTIN or Razorpay ID"
            className="input-base w-full rounded-xl py-2.5 pl-9 pr-3 text-sm"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as (typeof statusOptions)[number])}
          className="input-base rounded-xl px-3 py-2.5 text-sm"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option === 'all' ? 'All payment statuses' : human(option)}
            </option>
          ))}
        </select>
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as 'all' | PaymentKind)}
          className="input-base rounded-xl px-3 py-2.5 text-sm"
        >
          <option value="all">All order types</option>
          <option value="catalog">Catalogue orders</option>
          <option value="bulk">Bulk orders</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          aria-label="Payments from date"
          className="input-base rounded-xl px-3 py-2.5 text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          aria-label="Payments to date"
          className="input-base rounded-xl px-3 py-2.5 text-sm"
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-error/20 bg-error/5 p-3 text-sm text-error">
          <span>{error}</span>
          <button type="button" onClick={() => void loadPayments()} className="font-800 underline">
            Retry
          </button>
        </div>
      )}

      <p className="mb-3 text-xs text-muted-foreground">
        {loading ? 'Loading live payments…' : `${filtered.length} of ${payments.length} payment records`}
      </p>

      <div className="space-y-3">
        {loading && !payments.length && (
          <div className="rounded-2xl border border-border bg-card py-14 text-center">
            <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {!loading && !error && !filtered.length && (
          <div className="rounded-2xl border border-dashed border-border bg-card py-14 text-center">
            <Icon name="CreditCardIcon" size={34} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-800">No matching payment records</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Captures, failures, refunds and transfers will appear after real marketplace activity.
            </p>
          </div>
        )}

        {filtered.map((payment) => {
          const expanded = expandedId === payment.id;
          const canRefund =
            ['captured', 'partially_refunded'].includes(payment.status) &&
            payment.refundableAmount >= 1 &&
            payment.refundStatus !== 'requested' &&
            Boolean(payment.razorpayPaymentId);
          return (
            <article key={`${payment.kind}-${payment.id}`} className="rounded-2xl border border-border bg-card shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : payment.id)}
                className="grid w-full gap-3 p-4 text-left sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] sm:items-center"
                aria-expanded={expanded}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-800 text-primary">{payment.orderReference}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-800 uppercase text-muted-foreground">
                      {payment.kind}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-800 uppercase ${
                        payment.status === 'captured'
                          ? 'bg-success/10 text-success'
                          : payment.status === 'failed'
                            ? 'bg-error/10 text-error'
                            : payment.status.includes('refund')
                              ? 'bg-warning/10 text-warning'
                              : 'bg-secondary/10 text-secondary'
                      }`}
                    >
                      {human(payment.status)}
                    </span>
                    {payment.refundStatus === 'requested' && (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-800 uppercase text-warning">
                        Refund pending
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-800 text-foreground">
                    {payment.buyer.name} → {payment.seller.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {payment.razorpayPaymentId || payment.razorpayOrderId || 'Razorpay reference pending'}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>{human(payment.paymentMethod)}</p>
                  <p>{dateTime(payment.capturedAt || payment.createdAt)}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-base font-800 text-foreground">{money(payment.capturedAmount || payment.amount)}</p>
                  {payment.refundedAmount > 0 && (
                    <p className="text-xs font-700 text-warning">Refunded {money(payment.refundedAmount)}</p>
                  )}
                </div>
                <Icon name={expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} />
              </button>

              {expanded && (
                <div className="border-t border-border p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Platform commission', money(payment.platformCommission)],
                      ['Commission GST', money(payment.gstOnCommission)],
                      ['Actual gateway fee + tax', money(payment.actualProcessingFee + payment.actualProcessingTax)],
                      ['Seller payable', money(payment.sellerPayable)],
                      ['Refundable now', money(payment.refundableAmount)],
                      ['Transfer status', human(payment.transferStatus)],
                      ['Order state', `${human(payment.orderStatus)} · ${human(payment.orderPaymentStatus)}`],
                      ['Last webhook', payment.lastWebhookEvent ? `${human(payment.lastWebhookEvent)} · ${dateTime(payment.lastWebhookAt)}` : 'Not received'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-border bg-muted/30 p-3">
                        <p className="text-[10px] font-800 uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="mt-1 break-words text-xs font-800 text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 grid gap-2 text-xs lg:grid-cols-2">
                    <div className="rounded-xl border border-border p-3">
                      <p className="font-800 text-foreground">Buyer</p>
                      <p className="mt-1 text-muted-foreground">{payment.buyer.name}</p>
                      <p className="break-all text-muted-foreground">{payment.buyer.email || 'Email unavailable'}</p>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <p className="font-800 text-foreground">Seller</p>
                      <p className="mt-1 text-muted-foreground">{payment.seller.name}</p>
                      <p className="text-muted-foreground">GSTIN {payment.seller.gstin || 'not available'}</p>
                    </div>
                  </div>

                  {(payment.failureReason || payment.refundReason) && (
                    <div className="mt-3 rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs text-muted-foreground">
                      {payment.failureReason && <p><strong className="text-error">Failure:</strong> {payment.failureReason}</p>}
                      {payment.refundReason && <p><strong className="text-foreground">Refund reason:</strong> {payment.refundReason}</p>}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canRefund}
                      onClick={() =>
                        setRefundDraft({
                          payment,
                          amount: payment.refundableAmount.toFixed(2),
                          reason: '',
                        })
                      }
                      className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2 text-xs font-800 text-warning disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Icon name="ArrowUturnLeftIcon" size={14} className="mr-1 inline" />
                      {payment.refundStatus === 'requested'
                        ? `Refund pending ${money(payment.refundRequestedAmount)}`
                        : payment.refundableAmount < 1
                          ? 'No refundable balance'
                          : 'Request refund'}
                    </button>
                    {payment.razorpayPaymentId && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(payment.razorpayPaymentId || '')}
                        className="btn-secondary rounded-xl px-4 py-2 text-xs"
                      >
                        Copy Razorpay payment ID
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {refundDraft && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Request payment refund">
          <button type="button" className="absolute inset-0" onClick={() => !submittingRefund && setRefundDraft(null)} aria-label="Close refund dialog" />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-800 uppercase tracking-wide text-warning">Razorpay refund</p>
                <h2 className="mt-1 text-lg font-800">{refundDraft.payment.orderReference}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Refunds return to the original payment method. Final status is reconciled only after the signed webhook.
                </p>
              </div>
              <button type="button" disabled={submittingRefund} onClick={() => setRefundDraft(null)} className="ft-icon-button" aria-label="Close refund dialog">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-muted p-3 text-xs">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Captured</span><strong>{money(refundDraft.payment.capturedAmount)}</strong></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-muted-foreground">Already refunded</span><strong>{money(refundDraft.payment.refundedAmount)}</strong></div>
              <div className="mt-1 flex justify-between gap-3 border-t border-border pt-2"><span className="text-muted-foreground">Refundable</span><strong className="text-warning">{money(refundDraft.payment.refundableAmount)}</strong></div>
            </div>

            <label className="mt-4 block text-sm font-700">
              Refund amount (₹)
              <input
                type="number"
                min="1"
                step="0.01"
                max={refundDraft.payment.refundableAmount}
                value={refundDraft.amount}
                onChange={(event) => setRefundDraft({ ...refundDraft, amount: event.target.value })}
                className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"
              />
            </label>
            <label className="mt-4 block text-sm font-700">
              Reason
              <textarea
                rows={4}
                maxLength={1000}
                value={refundDraft.reason}
                onChange={(event) => setRefundDraft({ ...refundDraft, reason: event.target.value })}
                placeholder="Explain why this refund is authorised."
                className="input-base mt-1.5 w-full resize-y rounded-xl px-3 py-2.5"
              />
            </label>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={submittingRefund} onClick={() => setRefundDraft(null)} className="btn-secondary rounded-xl px-4 py-2.5 text-sm">
                Cancel
              </button>
              <button type="button" disabled={submittingRefund} onClick={() => void submitRefund()} className="rounded-xl bg-warning px-4 py-2.5 text-sm font-800 text-white disabled:opacity-50">
                {submittingRefund ? 'Requesting refund…' : 'Confirm refund request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
