import { createClient as createPublicClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { accountDeletionBlockers } from '@/lib/accountDeletion';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const respond = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      ...headers,
    },
  });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return respond({ error: 'Authentication required.' }, 401);

  let body: { reason?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Reason is optional.
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : null;

  const admin = createAdminClient();
  const { blockers } = await accountDeletionBlockers(admin, user.id);
  if (blockers.length) {
    await admin.from('account_deletion_requests').insert({
      user_id: user.id,
      email: user.email.toLowerCase(),
      reason,
      status: 'blocked',
      blockers,
      updated_at: new Date().toISOString(),
    });
    return respond(
      {
        error: 'The account cannot be deleted while marketplace obligations are open.',
        code: 'ACCOUNT_DELETION_BLOCKED',
        blockers,
      },
      409
    );
  }

  const { data: latest } = await admin
    .from('account_deletion_requests')
    .select('requested_at')
    .eq('user_id', user.id)
    .eq('status', 'otp_requested')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.requested_at) {
    const elapsed = Date.now() - Date.parse(latest.requested_at);
    if (elapsed < 60_000) {
      const retryAfter = Math.max(1, Math.ceil((60_000 - elapsed) / 1000));
      return respond(
        { error: 'A deletion OTP was requested recently. Wait before requesting another.', retryAfter },
        429,
        { 'Retry-After': String(retryAfter) }
      );
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !publishableKey) {
    return respond({ error: 'Email OTP is not configured.' }, 503);
  }

  const publicAuth = createPublicClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: otpError } = await publicAuth.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });
  if (otpError) {
    const retryAfter = otpError.status === 429 ? 60 : undefined;
    return respond(
      {
        error:
          otpError.status === 429
            ? 'An OTP was requested recently. Wait one minute and try again.' :'The deletion OTP could not be sent. Check the email service and try again.',
        code: otpError.status === 429 ? 'OTP_RATE_LIMITED' : 'OTP_SEND_FAILED',
        ...(retryAfter ? { retryAfter } : {}),
      },
      otpError.status === 429 ? 429 : 503,
      retryAfter ? { 'Retry-After': String(retryAfter) } : {}
    );
  }

  const { data: deletionRequest, error: insertError } = await admin
    .from('account_deletion_requests')
    .insert({
      user_id: user.id,
      email: user.email.toLowerCase(),
      reason,
      status: 'otp_requested',
      blockers: [],
      updated_at: new Date().toISOString(),
    })
    .select('id,requested_at')
    .single();
  if (insertError) return respond({ error: 'The deletion request could not be recorded.' }, 503);

  return respond({
    sent: true,
    requestId: deletionRequest.id,
    expiresInSeconds: 3600,
    destination: user.email.replace(/^(.{2}).*(@.*)$/, '$1••••$2'),
    warnings: [
      'Deletion is irreversible and removes login access from buyer and seller workspaces.',
      'Active products are unpublished and personal profile data is anonymised.',
      'Completed orders, tax invoices, payment and dispute audit records may be retained where legally required.',
    ],
  });
}
