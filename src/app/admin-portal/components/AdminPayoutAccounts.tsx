'use client';
import { useCallback, useEffect, useState } from 'react';
import { pillClassForStatus, pillLabel } from '@/lib/statusPill';

type Seller = { sellerId: string; name: string; sellerStatus: string; account: null | { linked_account_id?: string; stakeholder_id?: string; product_id?: string; activation_status: string; setup_state: string; bank_last4?: string; bank_ifsc?: string; checked_at?: string; last_error_code?: string } };
export default function AdminPayoutAccounts() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const r = await fetch('/api/admin/seller-payouts', { cache: 'no-store' }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setSellers(d.sellers || []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Payout accounts unavailable.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const update = async (values: Record<string, unknown>) => {
    setBusy(true); setError('');
    try { const r = await fetch('/api/admin/seller-payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Payout verification failed.'); } finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-800">Seller payout verification</h2><p className="mt-2 text-sm text-muted-foreground">Seller bank activation is checked with Razorpay before every checkout. New payments allocate 90% to the seller and an all-inclusive 10% to FabricTrad.</p>
    {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
    <div className="mt-4 space-y-4">{sellers.map(s => <article key={s.sellerId} className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-700">{s.name}</h3><p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">Seller: <span className={pillClassForStatus(s.sellerStatus)}>{pillLabel(s.sellerStatus)}</span> · Payout: <span className={pillClassForStatus(s.account?.activation_status || 'pending')}>{pillLabel(s.account?.activation_status || 'not connected')}</span></p><p className="mt-1 text-sm text-muted-foreground">{s.account?.bank_last4 ? `Bank •••• ${s.account.bank_last4} · ${s.account.bank_ifsc}` : 'Seller needs to enter their full bank details in Earnings → Payout account.'}</p>{s.account?.linked_account_id && <p className="mt-1 break-all text-xs text-muted-foreground">{s.account.linked_account_id} · {s.account.product_id || 'Route product pending'}</p>}</div><button type="button" disabled={busy || !s.account?.product_id} onClick={() => void update({ sellerId: s.sellerId, action: 'refresh' })} className="min-h-11 rounded-xl border border-border px-3 text-sm disabled:opacity-40">Check Razorpay</button></div>
      {s.account && (s.account.setup_state.startsWith('creating_') || s.account.setup_state === 'needs_reconciliation') && <details className="mt-4"><summary className="cursor-pointer text-sm font-700">Recover interrupted provider setup</summary><p className="mt-3 text-sm text-muted-foreground">Copy the existing resource references from Razorpay. Ownership is verified with the provider; this does not approve the bank.</p><form className="mt-3 grid gap-3" onSubmit={e => { e.preventDefault(); void update({ ...Object.fromEntries(new FormData(e.currentTarget)), action: 'recover', sellerId: s.sellerId }); }}>{[['linkedAccountId', 'Linked account ID', s.account.linked_account_id], ['stakeholderId', 'Stakeholder ID', s.account.stakeholder_id], ['productId', 'Route product ID', s.account.product_id]].map(([name, label, value]) => <label key={name} className="text-sm">{label}<input name={name} defaultValue={value || ''} className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-background px-3" /></label>)}<button disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground">Verify references and resume setup</button></form></details>}
    </article>)}</div>
  </section>;
}
