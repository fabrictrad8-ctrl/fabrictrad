'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';

type Announcement = {
  id: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
};

const toDateInputValue = (value: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '');

export default function AdminAnnouncementSettings() {
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [message, setMessage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/announcement', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as { announcement?: Announcement; error?: string };
      if (!response.ok) throw new Error(payload.error || 'The current announcement could not be loaded.');
      setCurrent(payload.announcement || null);
      setMessage(payload.announcement?.message || '');
      setLinkUrl(payload.announcement?.link_url || '');
      setLinkLabel(payload.announcement?.link_label || '');
      setIsActive(payload.announcement?.is_active || false);
      setStartsAt(toDateInputValue(payload.announcement?.starts_at || null));
      setEndsAt(toDateInputValue(payload.announcement?.ends_at || null));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The current announcement could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (nextActive: boolean) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/announcement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          linkUrl,
          linkLabel,
          isActive: nextActive,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { announcement?: Announcement; error?: string };
      if (!response.ok) throw new Error(payload.error || 'The announcement could not be saved.');
      setCurrent(payload.announcement || null);
      setIsActive(nextActive);
      setSuccess(nextActive ? 'Ticker is live across the site.' : 'Ticker turned off.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The announcement could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <section className="rounded-2xl border border-border bg-card p-6"><div className="h-40 animate-pulse rounded-xl bg-muted" /></section>;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-800">Sitewide promotion ticker</h2>
          <p className="mt-1 text-sm text-muted-foreground">A scrolling banner shown across the top of every page, including the public landing page.</p>
        </div>
        {current && <span className={`ft-badge ${isActive ? 'ft-badge--success' : ''}`}>{isActive ? 'Live now' : 'Off'}</span>}
      </div>

      {error && <div role="alert" className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">{error}</div>}
      {success && <div role="status" className="mt-4 rounded-xl border border-success/20 bg-success/10 p-3 text-sm text-success">{success}</div>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-700 md:col-span-2">
          Message *
          <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={220} placeholder="Festive sale: flat 10% off on silk & georgette this week" className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" />
          <span className="mt-1 block text-right text-xs text-muted-foreground">{message.length}/220</span>
        </label>
        <label className="text-sm font-700">
          Link (optional)
          <input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="/marketplace?category=Silk" className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" />
        </label>
        <label className="text-sm font-700">
          Link label (optional)
          <input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} maxLength={60} placeholder="Shop now" className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" />
        </label>
        <label className="text-sm font-700">
          Starts (optional)
          <input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" />
        </label>
        <label className="text-sm font-700">
          Ends (optional)
          <input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {isActive ? (
          <button type="button" onClick={() => void save(false)} disabled={saving} className="btn-secondary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50">
            <Icon name="PauseCircleIcon" size={16} className="mr-1 inline" /> Turn off ticker
          </button>
        ) : (
          <button type="button" onClick={() => void save(true)} disabled={saving || !message.trim()} className="btn-primary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50">
            <Icon name="PlayCircleIcon" size={16} className="mr-1 inline" /> {saving ? 'Saving…' : 'Save & go live'}
          </button>
        )}
        <button type="button" onClick={() => void save(isActive)} disabled={saving} className="rounded-xl border border-border bg-muted px-4 py-2.5 text-sm disabled:opacity-50">
          Save without changing status
        </button>
      </div>
    </section>
  );
}
