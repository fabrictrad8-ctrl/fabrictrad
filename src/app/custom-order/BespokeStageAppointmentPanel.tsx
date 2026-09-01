'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type StageAppointment = {
  id: string;
  appointment_type: string;
  requested_at: string;
  status: string;
};

type StageOrder = {
  id: string;
  stage: string;
};

type LocationType = 'store' | 'customer_address' | 'video_call';

export default function BespokeStageAppointmentPanel() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order') || '';
  const [order, setOrder] = useState<StageOrder | null>(null);
  const [appointments, setAppointments] = useState<StageAppointment[]>([]);
  const [requestedAt, setRequestedAt] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('store');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      setAppointments([]);
      return;
    }
    const response = await fetch(`/api/bespoke/orders/${encodeURIComponent(orderId)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      setOrder(null);
      setAppointments([]);
      return;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Appointment stage could not be loaded.');
    setOrder(payload.order || null);
    setAppointments(payload.appointments || []);
  }, [orderId]);

  useEffect(() => {
    load().catch((caught) => setError(caught instanceof Error ? caught.message : 'Appointment stage could not be loaded.'));
  }, [load]);

  if (!order || !['trial', 'alteration'].includes(order.stage)) return null;

  const appointmentType = order.stage === 'trial' ? 'trial_fitting' : 'alteration';
  const title = order.stage === 'trial' ? 'Book your fitting / trial' : 'Book your alteration appointment';
  const description = order.stage === 'trial'
    ? 'Choose a fitting slot. Your measurements, design brief, payments and production history stay attached to the same order.'
    : 'Choose an alteration slot. Staff will receive the fitting notes and full order context automatically.';

  const submit = async () => {
    if (!requestedAt) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const date = new Date(requestedAt);
      if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
        throw new Error('Choose a future appointment date and time.');
      }
      const response = await fetch(`/api/bespoke/orders/${encodeURIComponent(order.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'appointment',
          appointmentType,
          requestedAt: date.toISOString(),
          locationType,
          locationDetails: { source: 'website_stage_panel' },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Appointment could not be requested.');
      setNotice(order.stage === 'trial' ? 'Fitting appointment requested.' : 'Alteration appointment requested.');
      setRequestedAt('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Appointment could not be requested.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="appointment" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-8">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <p className="text-xs font-800 uppercase tracking-widest text-primary">Physical handoff</p>
        <h2 className="mt-1 text-xl font-900 text-foreground">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>

        {error && <div role="alert" className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">{error}</div>}
        {notice && <div role="status" className="mt-4 rounded-xl border border-success/20 bg-success/10 p-3 text-sm text-success">{notice}</div>}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-700 text-foreground">
            Date & time
            <input
              type="datetime-local"
              value={requestedAt}
              onChange={(event) => setRequestedAt(event.target.value)}
              className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"
            />
          </label>
          <label className="text-sm font-700 text-foreground">
            Location
            <select
              value={locationType}
              onChange={(event) => setLocationType(event.target.value as LocationType)}
              className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"
            >
              <option value="store">FabricTrad/store</option>
              <option value="customer_address">Customer address</option>
              <option value="video_call">Video call</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          disabled={busy || !requestedAt}
          onClick={() => void submit()}
          className="btn-primary mt-4 px-4 py-2.5 text-sm"
        >
          {busy ? 'Requesting…' : order.stage === 'trial' ? 'Request fitting appointment' : 'Request alteration appointment'}
        </button>

        {appointments.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-800 uppercase tracking-widest text-muted-foreground">Appointments</p>
            {appointments.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-foreground">
                <strong>{item.appointment_type.replaceAll('_', ' ')}</strong> · {new Date(item.requested_at).toLocaleString('en-IN')} · {item.status.replaceAll('_', ' ')}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
