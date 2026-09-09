import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdministrator } from '@/lib/server/requireAdministrator';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const clean = (value: unknown, max = 300) =>
  (typeof value === 'string' ? value.trim() : '').replace(/\s+/g, ' ').slice(0, max);

/* SitewideAnnouncementTicker.tsx reads the newest row by `updated_at`, so
   the admin panel must edit that same row — ordering by `created_at` here
   meant that with more than one stored row the operator could edit a row
   the public was not showing. `nullsFirst: false` keeps legacy rows with a
   null `updated_at` from sorting to the top of a DESC ordering. */
const NEWEST_FIRST = [
  { column: 'updated_at', options: { ascending: false, nullsFirst: false } },
  { column: 'created_at', options: { ascending: false, nullsFirst: false } },
] as const;

/* The admin form collects calendar days, not instants, and FabricTrad runs
   on IST. A day is therefore stored as the whole IST day: a start of
   "12 Oct" is 12 Oct 00:00 IST and an end of "12 Oct" is 12 Oct 23:59:59.999
   IST. Storing an end date as plain midnight (the previous behaviour) made
   the public bar disappear at the START of its end day, a full day earlier
   than the operator asked for, because the RLS policy tests
   `ends_at >= now()`. AdminAnnouncementSettings.tsx applies the same
   convention when it renders the stored timestamps back into the inputs. */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

const boundaryIso = (value: unknown, edge: 'start' | 'end'): string | null | undefined => {
  const raw = typeof value === 'string' ? value.trim() : value ? String(value) : '';
  if (!raw) return null;
  const parsed = CALENDAR_DAY.test(raw)
    ? new Date(`${raw}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}+05:30`)
    : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

export async function GET() {
  if (!await requireAdministrator()) return json({ error: 'Administrator access required.' }, 403);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('site_announcements')
    .select('*')
    .order(NEWEST_FIRST[0].column, NEWEST_FIRST[0].options)
    .order(NEWEST_FIRST[1].column, NEWEST_FIRST[1].options)
    .limit(1)
    .maybeSingle();
  if (error) return json({ error: 'The current announcement could not be loaded.' }, 500);

  // Surfaced in the panel so the operator is told when more than one stored
  // row exists and this one may not be the row the public bar resolves to.
  const { count } = await admin
    .from('site_announcements')
    .select('id', { count: 'exact', head: true });

  return json({ announcement: data || null, count: count ?? (data ? 1 : 0) });
}

export async function PUT(request: NextRequest) {
  if (!await requireAdministrator()) return json({ error: 'Administrator access required.' }, 403);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: 'Invalid announcement details.' }, 400);

  const message = clean(body.message, 220);
  const linkUrl = clean(body.linkUrl, 500);
  const linkLabel = clean(body.linkLabel, 60);
  const isActive = Boolean(body.isActive);
  const startsAt = boundaryIso(body.startsAt, 'start');
  const endsAt = boundaryIso(body.endsAt, 'end');

  if (startsAt === undefined || endsAt === undefined) {
    return json({ error: 'Enter the schedule dates as valid calendar dates.' }, 400);
  }
  if (isActive && !message) return json({ error: 'Enter the announcement text before activating it.' }, 400);
  if (linkUrl && !/^https?:\/\//i.test(linkUrl) && !linkUrl.startsWith('/')) {
    return json({ error: 'Link must be a full URL or start with /.' }, 400);
  }
  if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
    return json({ error: 'Start date must be before the end date.' }, 400);
  }

  const admin = createAdminClient();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: existing } = await admin
    .from('site_announcements')
    .select('id')
    .order(NEWEST_FIRST[0].column, NEWEST_FIRST[0].options)
    .order(NEWEST_FIRST[1].column, NEWEST_FIRST[1].options)
    .limit(1)
    .maybeSingle();

  const payload = {
    message,
    link_url: linkUrl || null,
    link_label: linkLabel || null,
    is_active: isActive,
    starts_at: startsAt,
    ends_at: endsAt,
    updated_at: new Date().toISOString(),
  };

  const result = existing?.id
    ? await admin.from('site_announcements').update(payload).eq('id', existing.id).select('*').single()
    : await admin.from('site_announcements').insert({ ...payload, created_by: user?.id || null }).select('*').single();

  if (result.error || !result.data) return json({ error: 'The announcement could not be saved.' }, 500);
  return json({ announcement: result.data });
}
