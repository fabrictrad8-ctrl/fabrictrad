'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type Status = 'open' | 'under_review' | 'escalated' | 'resolved' | 'closed';
type Message = {
  id: string;
  sender_type: 'buyer' | 'seller' | 'admin';
  sender_name: string;
  message_text?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  created_at: string;
};
type Dispute = {
  id: string;
  order_id: string;
  product_name?: string | null;
  dispute_type: string;
  status: Status;
  description: string;
  requested_refund_amount?: number | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
  buyer?: {
    full_name?: string | null;
    business_name?: string | null;
    email?: string | null;
  } | null;
  seller?: {
    display_name?: string | null;
    legal_business_name?: string | null;
    gstin?: string | null;
  } | null;
  messages: Message[];
};

const statusOptions: Status[] = ['open', 'under_review', 'escalated', 'resolved', 'closed'];
const statusStyle: Record<Status, string> = {
  open: 'bg-primary/10 text-primary',
  under_review: 'bg-warning/10 text-warning',
  escalated: 'bg-error/10 text-error',
  resolved: 'bg-success/10 text-success',
  closed: 'bg-muted text-muted-foreground',
};
const money = (value: unknown) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
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

export default function AdminDisputes() {
  const supabase = useMemo(() => createClient(), []);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [nextStatus, setNextStatus] = useState<Status>('under_review');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/disputes', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const result = (await response.json().catch(() => ({}))) as {
        disputes?: Dispute[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || 'Disputes could not be loaded.');
      const rows = result.disputes || [];
      setDisputes(rows);
      setActiveId((current) =>
        current && rows.some((item) => item.id === current) ? current : rows[0]?.id || null
      );
    } catch (caught) {
      setDisputes([]);
      setError(caught instanceof Error ? caught.message : 'Disputes could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = disputes.find((item) => item.id === activeId) || null;
  useEffect(() => {
    if (!active) return;
    setNextStatus(active.status);
    setResolutionNotes(active.resolution_notes || '');
    setMessage('');
  }, [activeId, active]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return disputes.filter((item) => {
      const searchable = [
        item.order_id,
        item.product_name,
        item.dispute_type,
        item.status,
        item.buyer?.full_name,
        item.buyer?.business_name,
        item.buyer?.email,
        item.seller?.display_name,
        item.seller?.legal_business_name,
        item.seller?.gstin,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (
        (statusFilter === 'all' || item.status === statusFilter) &&
        (!normalized || searchable.includes(normalized))
      );
    });
  }, [disputes, query, statusFilter]);

  const storeStatus = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const response = await fetch('/api/admin/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'status',
          disputeId: active.id,
          status: nextStatus,
          resolutionNotes,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Resolution could not be saved.');
      toast.success('Dispute status and resolution saved.');
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Resolution could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!active || !message.trim()) return;
    setBusy(true);
    try {
      const response = await fetch('/api/admin/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'message', disputeId: active.id, message: message.trim() }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Message could not be sent.');
      setMessage('');
      toast.success('Administrator message stored.');
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Message could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const openEvidence = async (path: string) => {
    const { data, error: signedError } = await supabase.storage
      .from('dispute-evidence')
      .createSignedUrl(path, 600);
    if (signedError || !data?.signedUrl) {
      toast.error(signedError?.message || 'Evidence could not be opened.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const summary = useMemo(
    () => ({
      open: disputes.filter((item) => item.status === 'open').length,
      review: disputes.filter((item) => item.status === 'under_review').length,
      escalated: disputes.filter((item) => item.status === 'escalated').length,
      requestedRefund: disputes
        .filter((item) => !['resolved', 'closed'].includes(item.status))
        .reduce((sum, item) => sum + Number(item.requested_refund_amount || 0), 0),
    }),
    [disputes]
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-800 text-foreground">Returns, Refunds & Disputes</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Live order-linked conversations, private evidence and administrator-only resolution.
            Payment refunds are executed separately from the payment ledger.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-xs disabled:opacity-50">
          <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Open', summary.open, 'ChatBubbleLeftRightIcon', 'text-primary'],
          ['Under review', summary.review, 'ClockIcon', 'text-warning'],
          ['Escalated', summary.escalated, 'ExclamationTriangleIcon', 'text-error'],
          ['Requested refunds', money(summary.requestedRefund), 'ArrowUturnLeftIcon', 'text-warning'],
        ].map(([label, value, icon, color]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <Icon name={icon as 'ClockIcon'} size={18} className={String(color)} />
            <p className={`mt-2 text-lg font-800 ${String(color)}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative">
          <Icon name="MagnifyingGlassIcon" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Order, buyer, seller, GSTIN or issue" className="input-base w-full rounded-xl py-2.5 pl-9 pr-3 text-sm" />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | Status)} className="input-base rounded-xl px-3 py-2.5 text-sm">
          <option value="all">All statuses</option>
          {statusOptions.map((option) => <option key={option} value={option}>{human(option)}</option>)}
        </select>
      </div>

      {error && <div className="mb-4 rounded-xl border border-error/20 bg-error/5 p-3 text-sm text-error">{error}</div>}

      <div className="grid min-h-[38rem] overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="max-h-[38rem] overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
          {loading && !disputes.length && <div className="py-14 text-center"><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}
          {!loading && !filtered.length && <div className="p-8 text-center"><Icon name="ChatBubbleLeftRightIcon" size={30} className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-800">No matching disputes</p></div>}
          {filtered.map((item) => (
            <button key={item.id} type="button" onClick={() => setActiveId(item.id)} className={`w-full border-b border-border p-3 text-left transition hover:bg-muted/50 ${activeId === item.id ? 'bg-primary/5' : ''}`}>
              <div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[11px] font-800 text-primary">{item.order_id}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-800 ${statusStyle[item.status]}`}>{human(item.status)}</span></div>
              <p className="mt-1 truncate text-xs font-800">{item.product_name || human(item.dispute_type)}</p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.buyer?.business_name || item.buyer?.full_name || item.buyer?.email || 'Buyer'}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{dateTime(item.updated_at)}</p>
            </button>
          ))}
        </aside>

        <main className="min-w-0">
          {active ? (
            <div className="grid min-h-[38rem] lg:grid-rows-[auto_minmax(0,1fr)_auto]">
              <header className="border-b border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-mono text-xs font-800 text-primary">{active.order_id}</p><h2 className="mt-1 text-base font-800">{human(active.dispute_type)} · {active.product_name || 'Marketplace order'}</h2><p className="mt-1 text-xs text-muted-foreground">Buyer: {active.buyer?.business_name || active.buyer?.full_name || active.buyer?.email || 'Unknown'} · Seller: {active.seller?.display_name || active.seller?.legal_business_name || 'Unknown'}</p></div>
                  {active.requested_refund_amount ? <button type="button" onClick={() => { window.location.href = '/admin-portal?tab=payments'; }} className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-800 text-warning">Review refund {money(active.requested_refund_amount)}</button> : null}
                </div>
                <div className="mt-3 rounded-xl bg-muted/40 p-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Buyer statement:</strong> {active.description}</div>
              </header>

              <div className="max-h-[27rem] space-y-3 overflow-y-auto bg-muted/20 p-4">
                {active.messages.map((item) => (
                  <div key={item.id} className={`flex ${item.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-3 py-2.5 text-sm ${item.sender_type === 'admin' ? 'bg-secondary text-white' : 'border border-border bg-card'}`}><p className={`mb-1 text-[10px] font-800 ${item.sender_type === 'admin' ? 'text-white/75' : 'text-muted-foreground'}`}>{item.sender_name} · {human(item.sender_type)}</p>{item.message_text && <p className="whitespace-pre-line break-words">{item.message_text}</p>}{item.file_url && <button type="button" onClick={() => void openEvidence(item.file_url!)} className={`mt-2 rounded-lg border px-2.5 py-1.5 text-xs font-800 ${item.sender_type === 'admin' ? 'border-white/30 bg-white/10 text-white' : 'border-border bg-muted text-primary'}`}>Open private evidence · {item.file_name || human(item.file_type)}</button>}<p className={`mt-1.5 text-[10px] ${item.sender_type === 'admin' ? 'text-white/70' : 'text-muted-foreground'}`}>{dateTime(item.created_at)}</p></div></div>
                ))}
              </div>

              <footer className="border-t border-border p-4">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]">
                  <div><label className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Administrator message<textarea rows={3} maxLength={3000} value={message} onChange={(event) => setMessage(event.target.value)} disabled={!['open', 'under_review', 'escalated'].includes(active.status)} className="input-base mt-1.5 w-full resize-y rounded-xl px-3 py-2.5 text-sm" /></label><button type="button" onClick={() => void sendMessage()} disabled={busy || !message.trim() || !['open', 'under_review', 'escalated'].includes(active.status)} className="btn-primary mt-2 rounded-xl px-4 py-2 text-xs disabled:opacity-50">Send administrator message</button></div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3"><label className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Status<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as Status)} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm">{statusOptions.map((option) => <option key={option} value={option}>{human(option)}</option>)}</select></label><label className="mt-3 block text-xs font-800 uppercase tracking-wide text-muted-foreground">Resolution notes<textarea rows={3} maxLength={3000} value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} placeholder="Required when resolving or closing." className="input-base mt-1.5 w-full resize-y rounded-xl px-3 py-2.5 text-sm" /></label><button type="button" onClick={() => void storeStatus()} disabled={busy} className="mt-2 w-full rounded-xl bg-secondary px-4 py-2 text-xs font-800 text-white disabled:opacity-50">Save status & resolution</button></div>
                </div>
              </footer>
            </div>
          ) : <div className="grid min-h-[38rem] place-items-center text-center"><div><Icon name="ChatBubbleLeftRightIcon" size={36} className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-800">Select a dispute</p></div></div>}
        </main>
      </div>
    </div>
  );
}
