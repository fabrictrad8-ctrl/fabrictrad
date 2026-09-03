import { createAdminClient } from '@/lib/supabase/admin';
import { sendGupshupTemplate, sendGupshupText } from '@/lib/gupshupWhatsApp';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://fabrictrad.com').replace(/\/$/, '');
const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;

type FollowUpJob = {
  id: string;
  bespoke_order_id: string;
  user_id: string;
  whatsapp_phone: string | null;
  job_type:
    | 'appointment_reminder'
    | 'payment_reminder'
    | 'trial_reminder'
    | 'delivery_update'
    | 'review_request'
    | 'post_delivery_follow_up';
  due_at: string;
  payload: Record<string, unknown> | null;
  attempts: number;
};

type TemplateConfig = {
  name: string;
  parameters: string[];
};

const normalizeDestination = (value: unknown) => {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  if (!digits) return '';
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  return digits.slice(-15);
};

const firstName = (value: unknown) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.split(/\s+/)[0] || 'Customer';
};

const money = (value: unknown) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const templateEnvByJob: Record<FollowUpJob['job_type'], string> = {
  appointment_reminder: 'WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER',
  payment_reminder: 'WHATSAPP_TEMPLATE_PAYMENT_REMINDER',
  trial_reminder: 'WHATSAPP_TEMPLATE_TRIAL_REMINDER',
  delivery_update: 'WHATSAPP_TEMPLATE_DELIVERY_UPDATE',
  review_request: 'WHATSAPP_TEMPLATE_REVIEW_REQUEST',
  post_delivery_follow_up: 'WHATSAPP_TEMPLATE_POST_DELIVERY_FOLLOW_UP',
};

type OutboundPayload =
  | { kind: 'text'; text: string }
  | { kind: 'template'; templateId: string; parameters: string[] };

async function sendWhatsAppPayload(
  to: string,
  payload: OutboundPayload,
  context: { userId: string; orderId: string; fallbackText: string }
) {
  const result =
    payload.kind === 'template'
      ? await sendGupshupTemplate(to, payload.templateId, payload.parameters)
      : await sendGupshupText(to, payload.text, true);
  const outboundId = String(result.messageId || '').trim();
  const admin = createAdminClient();
  await admin.from('whatsapp_buyer_messages').insert({
    wa_message_id: outboundId,
    whatsapp_phone: normalizeDestination(to).slice(-10),
    user_id: context.userId,
    bespoke_order_id: context.orderId,
    direction: 'outbound',
    message_type: payload.kind === 'template' ? 'template' : 'text',
    message_text: context.fallbackText.slice(0, 12_000),
    processing_status: 'processed',
  });
  return outboundId;
}

const freeFormPayload = (text: string): OutboundPayload => ({
  kind: 'text',
  text: text.slice(0, 4000),
});

const templatePayload = (config: TemplateConfig): OutboundPayload => ({
  kind: 'template',
  templateId: config.name,
  parameters: config.parameters,
});

function messageForJob(input: {
  job: FollowUpJob;
  name: string;
  order: Record<string, unknown>;
  appointment: Record<string, unknown> | null;
}) {
  const orderCode = String(input.order.id || '').slice(0, 8).toUpperCase();
  const link = `${SITE_URL}/custom-order?order=${encodeURIComponent(String(input.order.id || ''))}`;
  const customer = firstName(input.name);
  const appointmentTime = input.appointment?.requested_at
    ? new Date(String(input.appointment.requested_at)).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'your scheduled time';
  const balance = Math.max(
    0,
    Number(input.order.quoted_amount || 0) - Number(input.order.paid_amount || 0)
  );
  const stage = String(input.order.stage || 'order update').replaceAll('_', ' ');

  switch (input.job.job_type) {
    case 'appointment_reminder':
      return {
        text: `Hi ${customer}, reminder for FabricTrad custom order ${orderCode}: your ${String(input.appointment?.appointment_type || 'appointment').replaceAll('_', ' ')} is scheduled for ${appointmentTime}. Manage it here: ${link}`,
        parameters: [customer, orderCode, appointmentTime, link],
      };
    case 'trial_reminder':
      return {
        text: `Hi ${customer}, your FabricTrad trial/fitting for custom order ${orderCode} is scheduled for ${appointmentTime}. Your design and measurement brief is already attached: ${link}`,
        parameters: [customer, orderCode, appointmentTime, link],
      };
    case 'payment_reminder':
      return {
        text: `Hi ${customer}, FabricTrad custom order ${orderCode} has ${money(balance)} remaining. Pay securely only through FabricTrad/Razorpay: ${link}`,
        parameters: [customer, orderCode, money(balance), link],
      };
    case 'delivery_update':
      return {
        text: `Hi ${customer}, FabricTrad custom order ${orderCode} has an update: ${stage}. Track delivery/pickup here: ${link}`,
        parameters: [customer, orderCode, stage, link],
      };
    case 'review_request':
      return {
        text: `Hi ${customer}, your FabricTrad custom order ${orderCode} has been handed over. Please rate the completed order here: ${link}`,
        parameters: [customer, orderCode, link],
      };
    case 'post_delivery_follow_up':
      return {
        text: `Hi ${customer}, checking in after FabricTrad custom order ${orderCode}. If you need help, open the order and request human support; otherwise no action is needed: ${link}`,
        parameters: [customer, orderCode, link],
      };
  }
}

async function processOne(job: FollowUpJob) {
  const admin = createAdminClient();
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from('bespoke_follow_up_jobs')
    .update({
      status: 'processing',
      attempts: Number(job.attempts || 0) + 1,
      updated_at: claimedAt,
    })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (claimError || !claimed?.id) return { processed: false, skipped: true } as const;

  try {
    const [{ data: order }, { data: profile }, { data: session }] = await Promise.all([
      admin.from('bespoke_orders').select('*').eq('id', job.bespoke_order_id).maybeSingle(),
      admin.from('user_profiles').select('full_name,phone').eq('id', job.user_id).maybeSingle(),
      admin.from('whatsapp_buyer_sessions').select('last_inbound_at').eq('user_id', job.user_id).order('last_inbound_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!order) throw new Error('bespoke_order_missing');

    const appointmentId = String(job.payload?.appointment_id || '');
    const { data: appointment } = appointmentId
      ? await admin.from('bespoke_appointments').select('*').eq('id', appointmentId).maybeSingle()
      : { data: null };

    // Do not send stale reminders after the underlying state has already moved on.
    if (
      (job.job_type === 'payment_reminder' && !['advance_or_full_payment', 'balance_payment'].includes(String(order.stage))) ||
      (job.job_type === 'review_request' && String(order.stage) !== 'review') ||
      (job.job_type === 'post_delivery_follow_up' && !['follow_up', 'completed'].includes(String(order.stage))) ||
      (job.job_type === 'delivery_update' &&
        job.payload?.expected_stage &&
        String(order.stage) !== String(job.payload.expected_stage)) ||
      (['appointment_reminder', 'trial_reminder'].includes(job.job_type) && appointment && ['completed', 'cancelled', 'no_show'].includes(String(appointment.status)))
    ) {
      await admin.from('bespoke_follow_up_jobs').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', job.id);
      return { processed: false, cancelled: true } as const;
    }

    const destination = normalizeDestination(job.whatsapp_phone || order.whatsapp_phone || profile?.phone);
    if (!destination) throw new Error('whatsapp_destination_missing');

    const message = messageForJob({
      job,
      name: String(profile?.full_name || ''),
      order: order as Record<string, unknown>,
      appointment: (appointment || null) as Record<string, unknown> | null,
    });
    const lastInbound = session?.last_inbound_at ? new Date(session.last_inbound_at).getTime() : 0;
    const customerWindowOpen = lastInbound > 0 && Date.now() - lastInbound < CUSTOMER_WINDOW_MS;
    const templateName = process.env[templateEnvByJob[job.job_type]]?.trim() || '';

    if (customerWindowOpen) {
      await sendWhatsAppPayload(destination, freeFormPayload(message.text), {
        userId: job.user_id,
        orderId: job.bespoke_order_id,
        fallbackText: message.text,
      });
    } else {
      if (!templateName) {
        throw new Error(`whatsapp_template_missing:${templateEnvByJob[job.job_type]}`);
      }
      await sendWhatsAppPayload(
        destination,
        templatePayload({ name: templateName, parameters: message.parameters }),
        {
          userId: job.user_id,
          orderId: job.bespoke_order_id,
          fallbackText: message.text,
        }
      );
    }

    const sentAt = new Date().toISOString();
    await admin
      .from('bespoke_follow_up_jobs')
      .update({ status: 'sent', sent_at: sentAt, last_error: null, updated_at: sentAt })
      .eq('id', job.id);

    if (job.job_type === 'post_delivery_follow_up' && String(order.stage) === 'follow_up') {
      await admin
        .from('bespoke_orders')
        .update({ stage: 'completed', completed_at: sentAt, updated_at: sentAt })
        .eq('id', job.bespoke_order_id)
        .eq('stage', 'follow_up');
    }
    return { processed: true } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'follow_up_failed';
    const retryable = Number(job.attempts || 0) + 1 < 5;
    await admin
      .from('bespoke_follow_up_jobs')
      .update({
        status: retryable ? 'pending' : 'failed',
        last_error: message.slice(0, 1000),
        due_at: retryable
          ? new Date(Date.now() + Math.min(24, 2 ** Number(job.attempts || 0)) * 60 * 60 * 1000).toISOString()
          : job.due_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return { processed: false, error: message } as const;
  }
}

export async function processDueBespokeFollowUps(limit = 40) {
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const recoveredAt = new Date().toISOString();
  // A Worker can be terminated after claiming a job. Reclaim stale work so a
  // transient runtime failure cannot leave an automated message stuck forever.
  const { error: recoveryError } = await admin
    .from('bespoke_follow_up_jobs')
    .update({
      status: 'pending',
      due_at: recoveredAt,
      last_error: 'stale_processing_claim_recovered',
      updated_at: recoveredAt,
    })
    .eq('status', 'processing')
    .lt('updated_at', staleBefore)
    .lt('attempts', 5);
  if (recoveryError) throw recoveryError;
  const { error: exhaustedRecoveryError } = await admin
    .from('bespoke_follow_up_jobs')
    .update({
      status: 'failed',
      last_error: 'stale_processing_claim_exhausted',
      updated_at: recoveredAt,
    })
    .eq('status', 'processing')
    .lt('updated_at', staleBefore)
    .gte('attempts', 5);
  if (exhaustedRecoveryError) throw exhaustedRecoveryError;

  const { data, error } = await admin
    .from('bespoke_follow_up_jobs')
    .select('id,bespoke_order_id,user_id,whatsapp_phone,job_type,due_at,payload,attempts')
    .eq('status', 'pending')
    .lte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true })
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) throw error;

  const results = [];
  for (const row of (data || []) as FollowUpJob[]) {
    results.push(await processOne(row));
  }
  return {
    due: data?.length || 0,
    sent: results.filter((item) => item.processed).length,
    failed: results.filter((item) => 'error' in item).length,
    cancelled: results.filter((item) => 'cancelled' in item).length,
  };
}
