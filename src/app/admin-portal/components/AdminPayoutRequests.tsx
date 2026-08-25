'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type PayoutStatus = 'pending' | 'approved' | 'completed' | 'rejected';

type PayoutRequest = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  sellerGstin: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  status: PayoutStatus;
  submittedAt: string;
  processedAt: string | null;
  adminNote: string | null;
  razorpayPayoutId: string | null;
};

const money = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const statusConfig: Record<PayoutStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Pending Review', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: 'ClockIcon' },
  approved: { label: 'Approved', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: 'CheckIcon' },
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: 'CheckCircleIcon' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: 'XCircleIcon' },
};

export default function AdminPayoutRequests() {
  const supabase = createClient();
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | PayoutStatus>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionTarget, setActionTarget] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('seller_payout_requests')
        .select(`
          id, seller_id, amount, bank_name, account_number, ifsc_code,
          account_holder_name, status, submitted_at, processed_at, admin_note, razorpay_payout_id,
          seller_profiles(business_name, gstin),
          user_profiles(email)
        `)
        .order('submitted_at', { ascending: false })
        .limit(100);

      if (data) {
        const mapped: PayoutRequest[] = (data as unknown as Record<string, unknown>[]).map((r) => {
          const seller = (r.seller_profiles as Record<string, unknown> | null) || {};
          const userProfile = (r.user_profiles as Record<string, unknown> | null) || {};
          return {
            id: String(r.id),
            sellerId: String(r.seller_id),
            sellerName: String(seller.business_name || 'Unknown Seller'),
            sellerEmail: String(userProfile.email || ''),
            sellerGstin: String(seller.gstin || '—'),
            amount: Number(r.amount || 0),
            bankName: String(r.bank_name || ''),
            accountNumber: String(r.account_number || ''),
            ifscCode: String(r.ifsc_code || ''),
            accountHolderName: String(r.account_holder_name || ''),
            status: (r.status as PayoutStatus) || 'pending',
            submittedAt: String(r.submitted_at || ''),
            processedAt: r.processed_at ? String(r.processed_at) : null,
            adminNote: r.admin_note ? String(r.admin_note) : null,
            razorpayPayoutId: r.razorpay_payout_id ? String(r.razorpay_payout_id) : null,
          };
        });
        setRequests(mapped);
      }
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessingId(id);
    try {
      const newStatus: PayoutStatus = action === 'approve' ? 'approved' : 'rejected';
      const { error } = await supabase
        .from('seller_payout_requests')
        .update({
          status: newStatus,
          processed_at: new Date().toISOString(),
          admin_note: adminNote.trim() || null,
        })
        .eq('id', id);

      if (error) throw error;

      // If approving, attempt Razorpay payout (non-blocking)
      if (action === 'approve') {
        const request = requests.find((r) => r.id === id);
        if (request) {
          try {
            await fetch('/api/razorpay/payout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({
                payoutRequestId: id,
                amount: request.amount,
                accountNumber: request.accountNumber,
                ifscCode: request.ifscCode,
                accountHolderName: request.accountHolderName,
              }),
            });
          } catch {
            // Payout API call is best-effort; status update already succeeded
          }
        }
      }

      setActionTarget(null);
      setAdminNote('');
      void load();
    } catch {
      // silently fail, reload
      void load();
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = filterStatus === 'all' ? requests : requests.filter((r) => r.status === filterStatus);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const dateStr = (v: string) => {
    try {
      return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v));
    } catch { return v; }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-800 text-foreground">Seller Payout Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and approve seller withdrawal requests · synced to Razorpay Payouts API
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-700 text-amber-800">
            <Icon name="ClockIcon" size={14} />
            {pendingCount} pending review
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(['pending', 'approved', 'completed', 'rejected'] as PayoutStatus[]).map((s) => {
          const count = requests.filter((r) => r.status === s).length;
          const total = requests.filter((r) => r.status === s).reduce((sum, r) => sum + r.amount, 0);
          const cfg = statusConfig[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`rounded-xl border p-4 text-left transition hover:shadow-md ${filterStatus === s ? cfg.bg + ' ' + cfg.color.replace('text-', 'border-') : 'border-gray-100 bg-white'}`}
            >
              <p className="text-xs font-500 text-gray-500 capitalize">{cfg.label}</p>
              <p className="mt-1 text-xl font-700 text-gray-900">{count}</p>
              <p className="mt-0.5 text-xs text-gray-400">{money(total)}</p>
            </button>
          );
        })}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 overflow-x-auto">
        {(['all', 'pending', 'approved', 'completed', 'rejected'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`flex-1 min-w-max rounded-lg py-2 px-3 text-xs font-600 capitalize transition ${
              filterStatus === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === 'all' ? 'All Requests' : statusConfig[s].label}
            {s !== 'all' && (
              <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px]">
                {requests.filter((r) => r.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#008060] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
          <Icon name="BanknotesIcon" size={36} className="text-gray-300 mb-3" />
          <p className="text-sm font-600 text-gray-500">No {filterStatus === 'all' ? '' : filterStatus} payout requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => {
            const cfg = statusConfig[req.status];
            const isActioning = actionTarget?.id === req.id;
            return (
              <div key={req.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-700 text-gray-900">{req.sellerName}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-600 ${cfg.bg} ${cfg.color}`}>
                          <Icon name={cfg.icon as 'ClockIcon'} size={10} />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{req.sellerEmail}</p>
                      {req.sellerGstin !== '—' && (
                        <p className="mt-0.5 text-xs text-gray-400">GSTIN: {req.sellerGstin}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-700 text-gray-900">{money(req.amount)}</p>
                      <p className="text-xs text-gray-400">{dateStr(req.submittedAt)}</p>
                    </div>
                  </div>

                  {/* Bank Details */}
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 lg:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-600 uppercase tracking-wide text-gray-400">Bank</p>
                      <p className="mt-0.5 text-sm font-600 text-gray-800">{req.bankName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-600 uppercase tracking-wide text-gray-400">Account</p>
                      <p className="mt-0.5 text-sm font-600 text-gray-800">
                        ••••{req.accountNumber.slice(-4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-600 uppercase tracking-wide text-gray-400">IFSC</p>
                      <p className="mt-0.5 text-sm font-600 text-gray-800">{req.ifscCode}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-600 uppercase tracking-wide text-gray-400">Account Holder</p>
                      <p className="mt-0.5 text-sm font-600 text-gray-800">{req.accountHolderName}</p>
                    </div>
                  </div>

                  {req.adminNote && (
                    <p className="mt-3 text-xs text-gray-500 italic">Admin note: {req.adminNote}</p>
                  )}
                  {req.razorpayPayoutId && (
                    <p className="mt-1 text-xs text-gray-400">Razorpay Payout ID: {req.razorpayPayoutId}</p>
                  )}

                  {/* Actions for pending */}
                  {req.status === 'pending' && (
                    <div className="mt-4">
                      {!isActioning ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setActionTarget({ id: req.id, action: 'approve' })}
                            className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-600 text-white hover:bg-emerald-700 transition"
                          >
                            Approve & Pay
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionTarget({ id: req.id, action: 'reject' })}
                            className="flex-1 rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-600 text-red-700 hover:bg-red-100 transition"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-600 text-gray-600 mb-1">
                              Admin note (optional)
                            </label>
                            <input
                              type="text"
                              value={adminNote}
                              onChange={(e) => setAdminNote(e.target.value)}
                              placeholder={actionTarget.action === 'approve' ? 'e.g. Verified bank details' : 'e.g. Insufficient balance'}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#008060] focus:outline-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void handleAction(req.id, actionTarget.action)}
                              disabled={processingId === req.id}
                              className={`flex-1 rounded-lg py-2 text-sm font-600 text-white transition disabled:opacity-60 ${
                                actionTarget.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                              }`}
                            >
                              {processingId === req.id ? (
                                <span className="flex items-center justify-center gap-1.5">
                                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                  Processing…
                                </span>
                              ) : (
                                `Confirm ${actionTarget.action === 'approve' ? 'Approval' : 'Rejection'}`
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActionTarget(null); setAdminNote(''); }}
                              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-600 text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {req.status === 'approved' && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => void handleAction(req.id, 'approve')}
                        disabled={processingId === req.id}
                        className="w-full rounded-lg bg-blue-600 py-2 text-sm font-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
                      >
                        {processingId === req.id ? 'Processing…' : 'Mark as Completed'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
