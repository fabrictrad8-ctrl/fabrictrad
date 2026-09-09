'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

/* The public bar is read by SitewideAnnouncementTicker.tsx under an RLS
   policy that only exposes rows where
     is_active = true
     AND (starts_at is null or starts_at <= now())
     AND (ends_at   is null or ends_at   >= now())
   Everything this panel claims about visibility is derived from exactly
   that rule against the SAVED row, never against the unsaved draft. */
type Visibility =
  | { state: 'off'; headline: string; detail: string }
  | { state: 'live'; headline: string; detail: string }
  | { state: 'scheduled'; headline: string; detail: string }
  | { state: 'expired'; headline: string; detail: string };

/* FabricTrad operates on IST, and the date inputs collect calendar days,
   not instants. A day is therefore stored as the full IST day: a start of
   "12 Oct" means 12 Oct 00:00 IST and an end of "12 Oct" means 12 Oct
   23:59:59.999 IST — so an end date includes its own day. The same
   convention is applied on the server in /api/admin/announcement. */
const IST_OFFSET_MINUTES = 330;

const toIstDateInput = (value: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Date(parsed.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
};

const istDayTime = (day: string, edge: 'start' | 'end') =>
  new Date(`${day}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}+05:30`);

const formatStamp = (value: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} IST`;
};

const isValidLink = (value: string) =>
  !value || /^https?:\/\//i.test(value) || value.startsWith('/');

function describeVisibility(row: Announcement | null): Visibility {
  if (!row || !row.is_active) {
    return {
      state: 'off',
      headline: 'Not visible to the public',
      detail: row
        ? 'The bar is switched off. Nothing is shown at the top of any page.'
        : 'No announcement has been saved yet, so no bar is shown anywhere.',
    };
  }

  const now = Date.now();
  const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : null;
  const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null;

  if (startsAt !== null && Number.isFinite(startsAt) && now < startsAt) {
    return {
      state: 'scheduled',
      headline: 'Switched on, but not visible yet',
      detail: `It is scheduled to start at ${formatStamp(row.starts_at)} and is hidden until then.`,
    };
  }

  if (endsAt !== null && Number.isFinite(endsAt) && now > endsAt) {
    return {
      state: 'expired',
      headline: 'Switched on, but its schedule has ended',
      detail: `It stopped showing at ${formatStamp(row.ends_at)}. Clear or extend the end date to show it again.`,
    };
  }

  const window = [
    row.starts_at ? `from ${formatStamp(row.starts_at)}` : null,
    row.ends_at ? `until ${formatStamp(row.ends_at)}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    state: 'live',
    headline: 'Visible to everyone right now',
    detail: window
      ? `Showing at the top of every page ${window}.`
      : 'Showing at the top of every page, with no end date set.',
  };
}

export default function AdminAnnouncementSettings() {
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [message, setMessage] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/announcement', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as {
        announcement?: Announcement | null;
        count?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'The current announcement could not be loaded.');
      const row = payload.announcement || null;
      setCurrent(row);
      setRowCount(Number(payload.count || (row ? 1 : 0)));
      setMessage(row?.message || '');
      setLinkUrl(row?.link_url || '');
      setLinkLabel(row?.link_label || '');
      setStartsAt(toIstDateInput(row?.starts_at || null));
      setEndsAt(toIstDateInput(row?.ends_at || null));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The current announcement could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isActive = current?.is_active === true;
  const visibility = useMemo(() => describeVisibility(current), [current]);

  const dirty = useMemo(() => {
    if (!current) return Boolean(message || linkUrl || linkLabel || startsAt || endsAt);
    return (
      message !== (current.message || '') ||
      linkUrl !== (current.link_url || '') ||
      linkLabel !== (current.link_label || '') ||
      startsAt !== toIstDateInput(current.starts_at) ||
      endsAt !== toIstDateInput(current.ends_at)
    );
  }, [current, endsAt, linkLabel, linkUrl, message, startsAt]);

  const linkError = isValidLink(linkUrl.trim())
    ? ''
    : 'Use a full https:// address or a path that starts with /.';
  const scheduleError =
    startsAt && endsAt && istDayTime(startsAt, 'start') > istDayTime(endsAt, 'end')
      ? 'The start date must not be after the end date.'
      : '';
  const messageError = message.trim() ? '' : 'The bar needs text before it can be switched on.';
  const blockingError = linkError || scheduleError;

  const save = async (nextActive: boolean) => {
    if (blockingError) {
      setSuccess('');
      setError(blockingError);
      return;
    }
    if (nextActive && !message.trim()) {
      setSuccess('');
      setError(messageError);
      return;
    }

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
      const payload = (await response.json().catch(() => ({}))) as {
        announcement?: Announcement;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'The announcement could not be saved.');

      const saved = payload.announcement || null;
      setCurrent(saved);
      if (saved) {
        setMessage(saved.message || '');
        setLinkUrl(saved.link_url || '');
        setLinkLabel(saved.link_label || '');
        setStartsAt(toIstDateInput(saved.starts_at));
        setEndsAt(toIstDateInput(saved.ends_at));
        setRowCount((count) => Math.max(count, 1));
      }

      const savedVisibility = describeVisibility(saved);
      setSuccess(
        savedVisibility.state === 'live'
          ? 'Saved. The bar is live across the site now.'
          : savedVisibility.state === 'scheduled'
            ? 'Saved. The bar is switched on and will appear when its start date is reached.'
            : savedVisibility.state === 'expired'
              ? 'Saved. The bar is switched on but its end date has already passed, so nothing is shown.'
              : 'Saved. The bar stays switched off.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The announcement could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="ft-admin-skeleton h-6 w-56" />
        <div className="ft-admin-skeleton mt-4 h-16 w-full" />
        <div className="ft-admin-skeleton mt-4 h-9 w-full" />
        <span className="sr-only">Loading the announcement bar settings…</span>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-800">Sitewide announcement bar</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The scrolling advertisement bar pinned above the header on every page, including the
            public landing page. You control its text, link, schedule and whether it runs at all.
          </p>
        </div>
        <span className={`ft-pill ${isActive ? 'ft-pill-success' : 'ft-pill-neutral'}`}>
          {isActive ? 'Switched on' : 'Switched off'}
        </span>
      </div>

      <div className="ft-admin-ann-state mt-4" data-state={visibility.state} role="status">
        <span className="ft-admin-ann-dot" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-800">{visibility.headline}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{visibility.detail}</p>
          {current && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Last saved {formatStamp(current.updated_at) || 'recently'}.
            </p>
          )}
        </div>
      </div>

      {rowCount > 1 && (
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-foreground">
          {rowCount} announcement rows exist in the database. This panel edits the most recently
          updated one, which is also the one the public bar prefers — but older rows are still
          stored. Ask for the unused rows to be removed if the wrong text ever appears.
        </p>
      )}

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="mt-4 rounded-xl border border-success/20 bg-success/10 p-3 text-sm text-success">
          {success}
        </div>
      )}

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-800 uppercase tracking-[0.12em] text-muted-foreground">
            Preview
          </p>
          <p className="text-[11px] text-muted-foreground">
            {dirty ? 'Showing your unsaved draft' : 'Showing what is saved'}
            {!isActive && ' · dimmed because the bar is switched off'}
          </p>
        </div>
        <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
          <div className="ft-admin-ann-preview" data-muted={!isActive || visibility.state !== 'live'}>
            <span className="ft-admin-ann-preview-badge" aria-hidden="true">
              <Icon name="BoltIcon" size={13} />
            </span>
            <div className="ft-admin-ann-preview-track">
              <span className="ft-admin-ann-preview-content">
                <span className="ft-admin-ann-preview-message">
                  {message.trim() || 'Your announcement text will appear here'}
                </span>
                {linkUrl.trim() && (
                  <span className="ft-admin-ann-preview-cta">{linkLabel.trim() || 'Shop now'}</span>
                )}
              </span>
            </div>
            <span className="ft-admin-ann-preview-close" aria-hidden="true">
              <Icon name="XMarkIcon" size={13} />
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            The bar scrolls its message, shows the link as a button when one is set, and a visitor
            can dismiss it for the rest of their browsing session.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-700 md:col-span-2">
          Announcement text <span className="text-error">*</span>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={220}
            placeholder="Type the message the whole site should show"
            aria-describedby="ft-ann-message-hint"
            className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"
          />
          <span id="ft-ann-message-hint" className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
            <span>{isActive && !message.trim() ? messageError : 'Keep it short — the bar is one line tall.'}</span>
            <span className="ft-admin-num">{message.length}/220</span>
          </span>
        </label>

        <label className="text-sm font-700">
          Link (optional)
          <input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="/marketplace?category=Silk"
            aria-invalid={linkError ? true : undefined}
            className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"
          />
          <span className={`mt-1 block text-xs ${linkError ? 'text-error' : 'text-muted-foreground'}`}>
            {linkError || 'A path on this site, or a full https:// address.'}
          </span>
        </label>

        <label className="text-sm font-700">
          Link button label (optional)
          <input
            value={linkLabel}
            onChange={(event) => setLinkLabel(event.target.value)}
            maxLength={60}
            placeholder="Shop now"
            className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Defaults to “Shop now” when a link is set without a label.
          </span>
        </label>

        <label className="text-sm font-700">
          Start date (optional, IST)
          <input
            type="date"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {startsAt ? 'Appears from 00:00 IST on this day.' : 'Leave empty to start as soon as it is switched on.'}
          </span>
        </label>

        <label className="text-sm font-700">
          End date (optional, IST)
          <input
            type="date"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            aria-invalid={scheduleError ? true : undefined}
            className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"
          />
          <span className={`mt-1 block text-xs ${scheduleError ? 'text-error' : 'text-muted-foreground'}`}>
            {scheduleError || (endsAt ? 'Shows all through this day and stops at 23:59 IST.' : 'Leave empty to run until you switch it off.')}
          </span>
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {dirty ? 'You have unsaved changes.' : 'No unsaved changes.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={saving}
            className="ft-secondary-action inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-700 disabled:opacity-50"
          >
            <Icon name="ArrowPathIcon" size={16} />
            Discard changes
          </button>
          <button
            type="button"
            onClick={() => void save(isActive)}
            disabled={saving || Boolean(blockingError) || !dirty}
            className="rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isActive ? 'Save changes (stay on)' : 'Save changes (stay off)'}
          </button>
          {isActive ? (
            <button
              type="button"
              onClick={() => void save(false)}
              disabled={saving}
              className="btn-secondary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
            >
              <Icon name="PauseCircleIcon" size={16} className="mr-1 inline" />
              Switch off
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={saving || Boolean(blockingError) || !message.trim()}
              className="btn-primary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
            >
              <Icon name="PlayCircleIcon" size={16} className="mr-1 inline" />
              {saving ? 'Saving…' : 'Save & switch on'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
