'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';

type Appointment = {
  id: string;
  appointment_type: string;
  requested_at: string;
  location_type: string;
  status: string;
};

type Order = {
  id: string;
  user_id: string;
  stage: string;
  source: string;
  whatsapp_phone?: string | null;
  quoted_amount?: number | null;
  advance_amount?: number | null;
  paid_amount?: number | null;
  balance_amount?: number | null;
  payment_status?: string;
  stitching_status?: string;
  embroidery_status?: string;
  human_action_required?: boolean;
  human_action_reason?: string | null;
  delivery_mode?: string | null;
  delivery_details?: Record<string, unknown> | null;
  fabric_selection?: Record<string, unknown> | null;
  customization?: Record<string, unknown> | null;
  measurement?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  customer?: { full_name?: string | null; phone?: string | null; email?: string | null } | null;
  store?: { store_name?: string | null; store_handle?: string | null } | null;
  product?: { name?: string | null; sku?: string | null; category?: string | null; fabric_name?: string | null } | null;
  appointments?: Appointment[];
};

type QuoteDraft = { total: string; advance: string; notes: string };

const money = (value: unknown) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const humanLabel = (value: unknown) => String(value || '').replaceAll('_', ' ');
const detailText = (value: Record<string, unknown> | null | undefined) => {
  if (!value) return '';
  const description = value.description;
  if (typeof description === 'string' && description.trim()) return description.trim();
  return Object.entries(value)
    .filter(([, item]) => item !== null && item !== undefined && typeof item !== 'object')
    .map(([key, item]) => `${key.replaceAll('_', ' ')}: ${String(item)}`)
    .join(' · ');
};

export default function AdminBespokeOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [humanOnly, setHumanOnly] = useState(false);
  const [stageFilter, setStageFilter] = useState('');
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, QuoteDraft>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (humanOnly) params.set('human', '1');
      if (stageFilter) params.set('stage', stageFilter);
      const response = await fetch(`/api/admin/bespoke/orders?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Custom-order operations could not be loaded.');
      const next = (payload.orders || []) as Order[];
      setOrders(next);
      setQuoteDrafts((current) => {
        const drafts = { ...current };
        for (const order of next) {
          if (!drafts[order.id]) {
            drafts[order.id] = {
              total: order.quoted_amount ? String(order.quoted_amount) : '',
              advance: order.advance_amount ? String(order.advance_amount) : '0',
              notes: '',
            };
          }
        }
        return drafts;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Custom-order operations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [humanOnly, stageFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const transition = async (
    orderId: string,
    action: string,
    extra: Record<string, unknown> = {},
    success = 'Order updated.'
  ) => {
    setBusyId(orderId);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/bespoke/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action, ...extra }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Order could not be updated.');
      setNotice(success);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Order could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  const stats = useMemo(() => {
    const human = orders.filter((order) => order.human_action_required).length;
    const payment = orders.filter((order) => ['advance_or_full_payment', 'balance_payment'].includes(order.stage)).length;
    const production = orders.filter((order) => ['stitching', 'embroidery'].includes(order.stage)).length;
    const fulfilment = orders.filter((order) => order.stage === 'delivery_or_pickup').length;
    return { human, payment, production, fulfilment };
  }, [orders]);

  const updateDraft = (id: string, patch: Partial<QuoteDraft>) =>
    setQuoteDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? { total: '', advance: '0', notes: '' }), ...patch },
    }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-800 uppercase tracking-[0.14em] text-primary">WhatsApp-first tailoring operations</p>
          <h1 className="mt-1 text-2xl font-900 text-foreground">Custom orders</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Human attention is surfaced only where the order needs measurement, design approval, fitting/trial, alteration or customer service. Controlled actions drive every later digital state.
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm">
          <Icon name="ArrowPathIcon" size={17} /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-success/20 bg-success/10 p-3 text-sm text-success">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Human checkpoints" value={stats.human} icon="HandRaisedIcon" />
        <Metric label="Awaiting payment" value={stats.payment} icon="CreditCardIcon" />
        <Metric label="In production" value={stats.production} icon="WrenchScrewdriverIcon" />
        <Metric label="Ready for handover" value={stats.fulfilment} icon="TruckIcon" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <button
          type="button"
          onClick={() => setHumanOnly((current) => !current)}
          className={`rounded-xl px-3 py-2 text-xs font-800 ${humanOnly ? 'bg-primary text-white' : 'bg-muted text-foreground'}`}
        >
          {humanOnly ? 'Human queue only' : 'Show human queue'}
        </button>
        <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className="input-base rounded-xl px-3 py-2 text-xs">
          <option value="">All stages</option>
          {[
            'appointment','quotation','advance_or_full_payment','stitching','embroidery','trial','alteration','final_approval','balance_payment','delivery_or_pickup','review','follow_up','completed',
          ].map((stage) => <option key={stage} value={stage}>{stage.replaceAll('_', ' ')}</option>)}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{orders.length} order{orders.length === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-border bg-card">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No custom orders match this filter.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const activeAppointments = (order.appointments || []).filter((item) => ['requested', 'confirmed', 'reschedule_requested'].includes(item.status));
            const draft = quoteDrafts[order.id] || { total: '', advance: '0', notes: '' };
            const isBusy = busyId === order.id;
            return (
              <article key={order.id} className={`rounded-3xl border bg-card p-4 shadow-sm sm:p-5 ${order.human_action_required ? 'border-amber-300/60' : 'border-border'}`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-800 uppercase tracking-wide text-primary">{order.stage.replaceAll('_', ' ')}</span>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-700 text-muted-foreground">{order.source}</span>
                      {order.human_action_required && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-800 text-amber-900">Human · {humanLabel(order.human_action_reason)}</span>}
                    </div>
                    <h2 className="mt-3 text-lg font-900 text-foreground">
                      {order.store?.store_name || order.customer?.full_name || 'Buyer'} · {order.id.slice(0, 8).toUpperCase()}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {order.customer?.full_name || 'Customer'}{order.customer?.phone ? ` · ${order.customer.phone}` : ''}{order.customer?.email ? ` · ${order.customer.email}` : ''}
                    </p>
                    {order.store?.store_handle && <p className="mt-1 text-xs font-700 text-primary">@{order.store.store_handle}</p>}
                    {order.product && <p className="mt-2 text-sm font-700 text-foreground">{order.product.name} · {order.product.sku}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[470px]">
                    <MiniMetric label="Quote" value={order.quoted_amount ? money(order.quoted_amount) : 'Pending'} />
                    <MiniMetric label="Paid" value={money(order.paid_amount)} />
                    <MiniMetric label="Balance" value={money(Math.max(0, Number(order.quoted_amount || 0) - Number(order.paid_amount || 0)))} />
                    <MiniMetric label="Payment" value={order.payment_status || 'unpaid'} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <Brief title="Fabric" text={detailText(order.fabric_selection)} />
                  <Brief title="Customization" text={detailText(order.customization)} />
                  <Brief title="Measurement" text={detailText(order.measurement)} />
                </div>

                {activeAppointments.length > 0 && (
                  <div className="mt-4 space-y-2 rounded-2xl border border-border bg-muted/30 p-3">
                    <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Active appointments</p>
                    {activeAppointments.map((appointment) => (
                      <div key={appointment.id} className="flex flex-col gap-2 rounded-xl bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-foreground">
                          <strong>{appointment.appointment_type.replaceAll('_', ' ')}</strong> · {new Date(appointment.requested_at).toLocaleString('en-IN')} · {appointment.location_type.replaceAll('_', ' ')} · {appointment.status}
                        </div>
                        <div className="flex gap-2">
                          {appointment.status !== 'confirmed' && <Action disabled={isBusy} onClick={() => transition(order.id, 'confirm_appointment', { appointmentId: appointment.id }, 'Appointment confirmed.')} label="Confirm" />}
                          <Action primary disabled={isBusy} onClick={() => transition(order.id, 'complete_appointment', { appointmentId: appointment.id }, 'Appointment checkpoint completed.')} label="Complete checkpoint" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {order.stage === 'quotation' && (
                  <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-900 text-foreground">Publish quotation</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="text-xs font-700 text-muted-foreground">Total quotation<input inputMode="decimal" value={draft.total} onChange={(event) => updateDraft(order.id, { total: event.target.value })} className="input-base mt-1 w-full rounded-xl px-3 py-2 text-sm text-foreground" placeholder="25000" /></label>
                      <label className="text-xs font-700 text-muted-foreground">Optional advance<input inputMode="decimal" value={draft.advance} onChange={(event) => updateDraft(order.id, { advance: event.target.value })} className="input-base mt-1 w-full rounded-xl px-3 py-2 text-sm text-foreground" placeholder="10000" /></label>
                      <label className="text-xs font-700 text-muted-foreground sm:col-span-2">Quote notes<input value={draft.notes} onChange={(event) => updateDraft(order.id, { notes: event.target.value })} className="input-base mt-1 w-full rounded-xl px-3 py-2 text-sm text-foreground" placeholder="Included work, exclusions, delivery estimate…" /></label>
                    </div>
                    <button disabled={isBusy || Number(draft.total) <= 0} onClick={() => transition(order.id, 'publish_quote', { quotedAmount: Number(draft.total), advanceAmount: Number(draft.advance || 0), quoteNotes: draft.notes }, 'Quotation published and payment opened.')} className="btn-primary mt-3 px-4 py-2.5 text-sm disabled:opacity-50">Publish quote & open payment</button>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {order.stage === 'stitching' && <><Action primary disabled={isBusy} onClick={() => transition(order.id, 'start_stitching', {}, 'Stitching marked in progress.')} label="Start stitching" /><Action disabled={isBusy} onClick={() => transition(order.id, 'stitching_to_embroidery', {}, 'Stitching complete; embroidery queued.')} label="Complete → embroidery" /><Action disabled={isBusy} onClick={() => transition(order.id, 'stitching_to_trial', {}, 'Stitching complete; trial/fitting required.')} label="Complete → trial" /></>}
                  {order.stage === 'embroidery' && <><Action primary disabled={isBusy} onClick={() => transition(order.id, 'start_embroidery', {}, 'Embroidery marked in progress.')} label="Start embroidery" /><Action disabled={isBusy} onClick={() => transition(order.id, 'embroidery_to_trial', {}, 'Embroidery complete; trial/fitting required.')} label="Complete → trial" /></>}
                  {order.stage === 'trial' && <><Action primary disabled={isBusy} onClick={() => transition(order.id, 'trial_passed', {}, 'Trial passed; awaiting buyer final approval.')} label="Trial passed" /><Action disabled={isBusy} onClick={() => transition(order.id, 'trial_needs_alteration', {}, 'Alteration checkpoint opened.')} label="Needs alteration" /></>}
                  {order.stage === 'alteration' && <Action primary disabled={isBusy} onClick={() => transition(order.id, 'alteration_completed', {}, 'Alteration completed; awaiting final approval.')} label="Alteration complete" />}
                  {order.stage === 'delivery_or_pickup' && <Action primary disabled={isBusy || !order.delivery_mode} onClick={() => transition(order.id, 'mark_handed_over', {}, 'Handover recorded; review request queued.')} label={order.delivery_mode ? `Mark ${order.delivery_mode} handed over` : 'Waiting for buyer delivery choice'} />}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <span>Stitching: <strong className="text-foreground">{humanLabel(order.stitching_status || 'not started')}</strong></span>
                  <span>Embroidery: <strong className="text-foreground">{humanLabel(order.embroidery_status || 'not required')}</strong></span>
                  <span>Delivery: <strong className="text-foreground">{humanLabel(order.delivery_mode || 'not chosen')}</strong></span>
                  <span>Updated: <strong className="text-foreground">{order.updated_at ? new Date(order.updated_at).toLocaleString('en-IN') : '—'}</strong></span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: 'HandRaisedIcon' | 'CreditCardIcon' | 'WrenchScrewdriverIcon' | 'TruckIcon' }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-700 text-muted-foreground">{label}</p><Icon name={icon} size={18} className="text-primary" /></div><p className="mt-2 text-2xl font-900 text-foreground">{value}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-[10px] font-700 uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 truncate text-xs font-900 text-foreground" title={value}>{humanLabel(value)}</p></div>;
}

function Brief({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-[10px] font-800 uppercase tracking-wide text-muted-foreground">{title}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-foreground">{text || 'Not provided yet'}</p></div>;
}

function Action({ label, onClick, disabled, primary = false }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`${primary ? 'btn-primary' : 'btn-secondary'} px-3 py-2 text-xs disabled:opacity-50`}>{label}</button>;
}
