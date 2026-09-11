import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Re-delivers dead-lettered Razorpay webhooks.
 *
 * webhook_dead_letter_queue has always carried retry_count, max_retries and
 * next_retry_at, but nothing ever read them: the Worker's scheduled() handler
 * did not touch the table and the only pg_cron job is expire-catalog-reservations.
 * Rows sat pending forever with next_retry_at long past and retry_count stuck at
 * zero, and the admin screen could only dismiss them, never reprocess. A webhook
 * that failed for a real order was therefore lost permanently.
 *
 * Replay re-posts the stored payload to the live webhook route with a freshly
 * computed signature rather than calling the processing code directly. That path
 * is deliberately identical to how Razorpay itself retries, and it means this
 * file changes no part of the payment handling it is recovering -- which matters,
 * because that route has no unit tests and moves real money. The signature does
 * not need to reproduce Razorpay's original bytes: the HMAC is computed over the
 * exact body sent here, and the route verifies that same body.
 *
 * Scope is Razorpay only. Shiprocket dead letters authenticate with a shared
 * token on a different route, so they are left alone rather than guessed at.
 */

// Spacing between attempts, indexed by how many have already been made. Slow
// enough that a dependency still being provisioned is not hammered, and the
// final gap outlives a typical deploy.
const BACKOFF_MINUTES = [2, 10, 60, 240];

type DeadLetterRow = {
  id: string;
  idempotency_key: string;
  event_type: string;
  payload: unknown;
  retry_count: number | null;
  max_retries: number | null;
};

const nextRetryAt = (attemptsMade: number) => {
  const minutes = BACKOFF_MINUTES[Math.min(attemptsMade, BACKOFF_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60_000).toISOString();
};

export async function retryWebhookDeadLetters(limit = 5) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!secret || !siteUrl) return { skipped: 'not_configured' as const, due: 0, replayed: 0, resolved: 0, failed: 0 };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('webhook_dead_letter_queue')
    .select('id,idempotency_key,event_type,payload,retry_count,max_retries')
    .eq('status', 'pending')
    .eq('source', 'razorpay')
    .lte('next_retry_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit * 8);
  if (error) throw error;

  // Razorpay redelivers a failing event on its own schedule and each attempt
  // recorded its own row, so one stuck payment can hold dozens of them -- 32 for
  // a single ₹101 charge before this existed. Replaying per row would multiply
  // that, so collapse to one attempt per event and let the oldest row stand for
  // the group.
  const canonical = new Map<string, DeadLetterRow>();
  for (const row of (data || []) as DeadLetterRow[]) {
    if (!canonical.has(row.idempotency_key)) canonical.set(row.idempotency_key, row);
  }
  const due = [...canonical.values()].slice(0, limit);

  let resolved = 0;
  let failed = 0;
  for (const row of due) {
    const attemptsMade = (row.retry_count ?? 0) + 1;
    const ceiling = row.max_retries ?? BACKOFF_MINUTES.length;
    const startedAt = new Date().toISOString();
    let delivered = false;
    let reason = '';

    try {
      const body = JSON.stringify(row.payload);
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
      const response = await fetch(`${siteUrl.replace(/\/$/, '')}/api/razorpay/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
        body,
      });
      delivered = response.ok;
      if (!delivered) reason = `replay returned HTTP ${response.status}`;
    } catch (replayError) {
      reason = replayError instanceof Error ? replayError.message : 'replay request failed';
    }

    if (delivered) {
      // Clear the whole group: every row for this event described the same
      // failure, and the event has now been processed once.
      const { error: resolveError } = await admin
        .from('webhook_dead_letter_queue')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('idempotency_key', row.idempotency_key)
        .eq('status', 'pending');
      if (resolveError) throw resolveError;
      resolved += 1;
      continue;
    }

    // A failed replay makes the route dead-letter the event again, so delete the
    // row this attempt just created instead of letting retries grow the backlog
    // the way Razorpay's own redelivery already did.
    const { error: pruneError } = await admin
      .from('webhook_dead_letter_queue')
      .delete()
      .eq('idempotency_key', row.idempotency_key)
      .eq('status', 'pending')
      .gte('created_at', startedAt);
    if (pruneError) throw pruneError;

    const exhausted = attemptsMade >= ceiling;
    const { error: bumpError } = await admin
      .from('webhook_dead_letter_queue')
      .update({
        retry_count: attemptsMade,
        // 'dead', not 'failed': webhook_dead_letter_queue_status_check allows only
        // pending / retrying / dead / resolved, so the invented value threw 23514 on
        // the fourth failed attempt -- a path tsc cannot see, because status is plain
        // text in the generated types and the constraint lives only in Postgres.
        status: exhausted ? 'dead' : 'pending',
        next_retry_at: exhausted ? null : nextRetryAt(attemptsMade),
        error_message: `${row.event_type}: ${reason}`.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq('idempotency_key', row.idempotency_key)
      .eq('status', 'pending');
    if (bumpError) throw bumpError;
    failed += 1;
    console.error('Razorpay dead-letter replay did not succeed', {
      eventType: row.event_type,
      attemptsMade,
      exhausted,
      reason,
    });
  }

  return { due: due.length, replayed: due.length, resolved, failed };
}
