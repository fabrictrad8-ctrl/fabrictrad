'use client';
import AdminPayments from './AdminPayments';
export default function AdminReconciliation() {
  return <div className="space-y-4"><p className="rounded-xl border border-border p-4 text-sm">Reconcile captured payments, refunds and seller transfers using the live ledger below. Bank settlement must be matched against the payment provider’s settlement report.</p><AdminPayments /></div>;
}
