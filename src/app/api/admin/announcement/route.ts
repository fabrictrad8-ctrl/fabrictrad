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

export async function GET() {
  if (!await requireAdministrator()) return json({ error: 'Administrator access required.' }, 403);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('site_announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return json({ error: 'The current announcement could not be loaded.' }, 500);
  return json({ announcement: data || null });
}

export async function PUT(request: NextRequest) {
  if (!await requireAdministrator()) return json({ error: 'Administrator access required.' }, 403);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: 'Invalid announcement details.' }, 400);

  const message = clean(body.message, 220);
  const linkUrl = clean(body.linkUrl, 500);
  const linkLabel = clean(body.linkLabel, 60);
  const isActive = Boolean(body.isActive);
  const startsAt = body.startsAt ? new Date(String(body.startsAt)).toISOString() : null;
  const endsAt = body.endsAt ? new Date(String(body.endsAt)).toISOString() : null;

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
    .order('created_at', { ascending: false })
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
