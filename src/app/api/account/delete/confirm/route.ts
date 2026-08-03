import { createClient as createPublicClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { accountDeletionBlockers, removeUserPrefixedStorage } from '@/lib/accountDeletion';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONFIRMATION_PHRASE = 'DELETE MY FABRICTRAD ACCOUNT';
const respond = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return respond({ error: 'Authentication required.' }, 401);

  let body: {
    requestId?: unknown;
    otp?: unknown;
    confirmationPhrase?: unknown;
    understandsIrreversible?: unknown;
    understandsRecordsRetained?: unknown;
    confirmsNoOpenObligations?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return respond({ error: 'Invalid deletion confirmation.' }, 400);
  }

  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
  const otp = typeof body.otp === 'string' ? body.otp.replace(/\D/g, '').slice(0, 8) : '';
  const phrase = typeof body.confirmationPhrase === 'string' ? body.confirmationPhrase.trim() : '';
  if (!requestId || !/^\d{6,8}$/.test(otp)) {
    return respond({ error: 'Enter the OTP sent to your registered email.' }, 400);
  }
  if (phrase !== CONFIRMATION_PHRASE) {
    return respond({ error: `Type ${CONFIRMATION_PHRASE} exactly to continue.` }, 400);
  }
  if (
    body.understandsIrreversible !== true ||
    body.understandsRecordsRetained !== true ||
    body.confirmsNoOpenObligations !== true
  ) {
    return respond({ error: 'All deletion warnings must be acknowledged.' }, 400);
  }

  const admin = createAdminClient();
  const { data: deletionRequest, error: requestError } = await admin
    .from('account_deletion_requests')
    .select('id,email,status,requested_at')
    .eq('id', requestId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (requestError || !deletionRequest) return respond({ error: 'Deletion request not found.' }, 404);
  if (deletionRequest.status !== 'otp_requested') {
    return respond({ error: 'This deletion request is no longer active.' }, 409);
  }
  if (Date.now() - Date.parse(deletionRequest.requested_at) > 60 * 60 * 1000) {
    return respond({ error: 'The deletion OTP expired. Request a new code.' }, 410);
  }

  const { blockers } = await accountDeletionBlockers(admin, user.id);
  if (blockers.length) {
    await admin
      .from('account_deletion_requests')
      .update({ status: 'blocked', blockers, updated_at: new Date().toISOString() })
      .eq('id', requestId);
    return respond(
      {
        error: 'New marketplace obligations were found. Resolve them before deleting the account.',
        code: 'ACCOUNT_DELETION_BLOCKED',
        blockers,
      },
      409
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !publishableKey) return respond({ error: 'Email OTP is not configured.' }, 503);

  const publicAuth = createPublicClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: verified, error: verifyError } = await publicAuth.auth.verifyOtp({
    email: deletionRequest.email,
    token: otp,
    type: 'email',
  });
  if (verifyError || verified.user?.id !== user.id) {
    return respond({ error: 'The deletion OTP is invalid or expired.' }, 400);
  }

  await admin
    .from('account_deletion_requests')
    .update({ status: 'otp_verified', otp_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', requestId);

  await removeUserPrefixedStorage(admin, user.id);

  const { error: anonymizeError } = await admin.rpc('anonymize_account_for_deletion', {
    p_user_id: user.id,
  });
  if (anonymizeError) {
    await admin
      .from('account_deletion_requests')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', requestId);
    return respond({ error: 'The account could not be anonymised safely. No Auth deletion was performed.' }, 503);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, true);
  if (deleteError) {
    await admin
      .from('account_deletion_requests')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', requestId);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return respond(
      {
        deleted: false,
        accessDisabled: true,
        error: 'Account access and personal profile data were removed, but final Auth cleanup requires administrator review.',
      },
      202
    );
  }

  try {
    await admin
      .from('account_deletion_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', requestId);
  } catch {
    // Auth deletion has already succeeded and remains the source of truth.
  }
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

  return respond({
    deleted: true,
    message: 'Your FabricTrad login has been deleted and personal account data has been anonymised.',
    retainedRecords: 'Completed orders, payment records and tax invoices may remain as legally required.',
  });
}
