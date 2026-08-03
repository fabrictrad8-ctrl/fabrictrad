'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';

type Blocker = { code: string; title: string; detail: string; count: number };
type Props = { accountAccess: string; email: string };

const PHRASE = 'DELETE MY FABRICTRAD ACCOUNT';

export default function DeleteAccountPanel({ accountAccess, email }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [irreversible, setIrreversible] = useState(false);
  const [records, setRecords] = useState(false);
  const [obligations, setObligations] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const readyForOtp = irreversible && records && obligations && phrase === PHRASE;

  const requestOtp = async () => {
    if (!readyForOtp || busy || cooldown > 0) return;
    setBusy(true);
    setError('');
    setBlockers([]);
    try {
      const response = await fetch('/api/account/delete/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ reason }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        requestId?: string;
        destination?: string;
        blockers?: Blocker[];
        retryAfter?: number;
      };
      if (!response.ok) {
        setBlockers(payload.blockers || []);
        if (payload.retryAfter) setCooldown(payload.retryAfter);
        throw new Error(payload.error || 'The deletion OTP could not be sent.');
      }
      setRequestId(payload.requestId || '');
      setDestination(payload.destination || email);
      setCooldown(60);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The deletion OTP could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDeletion = async () => {
    if (!requestId || !/^\d{6,8}$/.test(otp) || busy) return;
    setBusy(true);
    setError('');
    setBlockers([]);
    try {
      const response = await fetch('/api/account/delete/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          requestId,
          otp,
          confirmationPhrase: phrase,
          understandsIrreversible: irreversible,
          understandsRecordsRetained: records,
          confirmsNoOpenObligations: obligations,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        deleted?: boolean;
        accessDisabled?: boolean;
        error?: string;
        blockers?: Blocker[];
      };
      if (!response.ok && response.status !== 202) {
        setBlockers(payload.blockers || []);
        throw new Error(payload.error || 'The account could not be deleted.');
      }
      window.location.replace(
        payload.deleted
          ? '/login?account_deleted=1'
          : '/login?account_disabled=1'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The account could not be deleted.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-error/25 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center gap-3 px-5 py-4 text-left hover:bg-error/5"
        aria-expanded={open}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error">
          <Icon name="ExclamationTriangleIcon" size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-800 text-error">Danger zone · delete account</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Permanently close {accountAccess.toLowerCase()} access after email OTP verification.
          </span>
        </span>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={18} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="border-t border-error/20 p-5 sm:p-6">
          <div className="rounded-2xl border border-error/25 bg-error/5 p-4">
            <h3 className="text-base font-800 text-error">This action is irreversible</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground">
              <li className="flex gap-2"><Icon name="XCircleIcon" size={17} className="mt-1 shrink-0 text-error" />Your buyer and seller login access will be removed.</li>
              <li className="flex gap-2"><Icon name="XCircleIcon" size={17} className="mt-1 shrink-0 text-error" />Active seller products will be unpublished and private profile data anonymised.</li>
              <li className="flex gap-2"><Icon name="InformationCircleIcon" size={17} className="mt-1 shrink-0 text-warning" />Completed orders, payment records and tax invoices may be retained where law, taxation or dispute handling requires them.</li>
              <li className="flex gap-2"><Icon name="ShieldExclamationIcon" size={17} className="mt-1 shrink-0 text-warning" />Deletion is blocked while orders, refunds, disputes or seller settlements remain open.</li>
            </ul>
          </div>

          {blockers.length > 0 && (
            <div className="mt-4 space-y-2" role="alert">
              {blockers.map((blocker) => (
                <div key={blocker.code} className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
                  <p className="font-800 text-warning">{blocker.title} ({blocker.count})</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{blocker.detail}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 space-y-3">
            {[
              [irreversible, setIrreversible, 'I understand that account deletion cannot be undone.'],
              [records, setRecords, 'I understand that legally required transaction and tax records may be retained.'],
              [obligations, setObligations, 'I confirm that I must resolve open orders, refunds, disputes and payouts first.'],
            ].map(([checked, setter, label]) => (
              <label key={String(label)} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(checked)}
                  onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-red-600"
                />
                <span>{String(label)}</span>
              </label>
            ))}
          </div>

          <label className="mt-4 block text-sm font-700">
            Optional reason
            <textarea
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Tell us what went wrong so FabricTrad can improve."
              className="input-base mt-1.5 w-full resize-y rounded-xl px-3 py-2.5"
            />
          </label>

          <label className="mt-4 block text-sm font-700">
            Type <span className="font-mono text-error">{PHRASE}</span>
            <input
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              autoComplete="off"
              className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 font-mono"
            />
          </label>

          {!requestId ? (
            <button
              type="button"
              onClick={() => void requestOtp()}
              disabled={!readyForOtp || busy || cooldown > 0}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-error px-4 py-3 text-sm font-800 text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Icon name="EnvelopeIcon" size={17} />
              {busy ? 'Checking account…' : cooldown > 0 ? `Request another OTP in ${cooldown}s` : 'Send deletion OTP'}
            </button>
          ) : (
            <div className="mt-5 rounded-2xl border border-error/25 bg-error/5 p-4">
              <p className="text-sm font-800 text-foreground">Enter the OTP sent to {destination}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">The code expires after one hour. Never share it with a buyer, seller or FabricTrad representative.</p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="6-digit OTP"
                className="input-base mt-3 w-full rounded-xl px-3 py-3 text-center font-mono text-lg tracking-[0.35em]"
              />
              <button
                type="button"
                onClick={() => void confirmDeletion()}
                disabled={busy || !/^\d{6,8}$/.test(otp)}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-error px-4 py-3 text-sm font-800 text-white disabled:opacity-45"
              >
                <Icon name="TrashIcon" size={17} /> {busy ? 'Deleting account…' : 'Permanently delete my account'}
              </button>
              <button
                type="button"
                disabled={busy || cooldown > 0}
                onClick={() => void requestOtp()}
                className="mt-2 w-full py-2 text-xs font-800 text-error disabled:opacity-45"
              >
                {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Send a new OTP'}
              </button>
            </div>
          )}

          {error && <p role="alert" className="mt-4 rounded-xl border border-error/25 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</p>}
        </div>
      )}
    </section>
  );
}
