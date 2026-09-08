'use client';
import { useCallback, useEffect, useState } from 'react';
import { pillClassForStatus } from '@/lib/statusPill';
type ErrorRecord = { id: string; severity: string; message: string; resolved: boolean; created_at: string };
type DeadLetterRecord = { id: string; source: string; event_type: string; error_message: string | null; retry_count: number; max_retries: number; status: string; resolved_at: string | null; created_at: string };

function DeadLetterQueue() {
  const [rows, setRows] = useState<DeadLetterRecord[]>([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/webhook-dead-letters?page=' + page, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRows(data.events); setTotal(data.total);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Dead-lettered webhooks unavailable.'); }
    finally { setLoading(false); }
  }, [page]);
  useEffect(() => { void load(); }, [load]);
  async function resolve(id: string) {
    const response = await fetch('/api/admin/webhook-dead-letters', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => null);
    if (!response?.ok) return setError('Resolution could not be saved.');
    await load();
  }
  const openCount = rows.filter((row) => row.status !== 'resolved').length;
  return <div className="space-y-4">
    <h2 className="text-lg font-800">Dead-lettered webhooks</h2>
    <p className="text-sm text-muted-foreground">
      Razorpay and Shiprocket webhooks that exhausted their retries without processing successfully.
      A growing, recent queue here means live payment or shipment events are silently not being applied.
    </p>
    {error && <p role="alert" className="text-error">{error}</p>}
    <button onClick={() => void load()} disabled={loading} className="btn-secondary px-3 py-2">{loading ? 'Loading…' : 'Refresh'}</button>
    {!loading && rows.length > 0 && (
      <p className={`text-xs font-700 ${openCount > 0 ? 'text-error' : 'text-success'}`}>
        {openCount > 0 ? `${openCount} unresolved on this page` : 'All shown events are resolved'}
      </p>
    )}
    {rows.map(row => <article key={row.id} className="rounded-xl border border-border p-4">
      <p className="flex flex-wrap items-center gap-1.5 text-xs">
        {row.source} · {row.event_type} · {new Date(row.created_at).toLocaleString('en-IN')} · retries {row.retry_count}/{row.max_retries} ·
        <span className={pillClassForStatus(row.status)}>{row.status}</span>
      </p>
      {row.error_message && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.error_message}</p>}
      {row.status !== 'resolved' && <button onClick={() => void resolve(row.id)} className="mt-3 text-sm text-primary underline">Mark resolved</button>}
    </article>)}
    {!loading && !rows.length && !error && <p>No dead-lettered webhooks. Payment and shipment events are processing cleanly.</p>}
    <div className="flex items-center gap-4 text-sm"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>{total} records · Page {page}</span><button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Next</button></div>
  </div>;
}

export default function AdminErrorMonitor() {
  const [rows, setRows] = useState<ErrorRecord[]>([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/errors?page=' + page, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRows(data.errors); setTotal(data.total);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Error records unavailable.'); }
    finally { setLoading(false); }
  }, [page]);
  useEffect(() => { void load(); }, [load]);
  async function resolve(id: string) {
    const response = await fetch('/api/admin/errors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => null);
    if (!response?.ok) return setError('Resolution could not be saved.');
    await load();
  }
  return <div className="space-y-10"><div className="space-y-4"><h1 className="text-xl font-800">Platform errors</h1>
    <p className="text-sm text-muted-foreground">Recorded application errors. Provider failures may also require checking the provider’s logs.</p>
    {error && <p role="alert" className="text-error">{error}</p>}
    <button onClick={() => void load()} disabled={loading} className="btn-secondary px-3 py-2">{loading ? 'Loading…' : 'Refresh'}</button>
    {rows.map(row => <article key={row.id} className="rounded-xl border border-border p-4">
      <p className="flex flex-wrap items-center gap-1.5 text-xs"><span className={pillClassForStatus(row.severity === 'critical' || row.severity === 'error' ? 'critical' : row.severity)}>{row.severity}</span> · {new Date(row.created_at).toLocaleString('en-IN')} · <span className={pillClassForStatus(row.resolved ? 'resolved' : 'open')}>{row.resolved ? 'Resolved' : 'Open'}</span></p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.message}</p>
      {!row.resolved && <button onClick={() => void resolve(row.id)} className="mt-3 text-sm text-primary underline">Mark resolved</button>}
    </article>)}
    {!loading && !rows.length && !error && <p>No error records found.</p>}
    <div className="flex items-center gap-4 text-sm"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>{total} records · Page {page}</span><button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Next</button></div>
  </div>
  <DeadLetterQueue />
  </div>;
}
