import type { SupabaseClient } from '@supabase/supabase-js';
import { rupeesToPaise } from '@/lib/razorpayIntegrity';

export type BespokePaymentLedger = {
  id: string;
  bespoke_order_id: string;
  user_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  payment_purpose: 'advance' | 'full' | 'balance';
  amount: number;
  currency: string;
  status: string;
  refunded_amount?: number | null;
  refund_status?: string | null;
  last_refund_id?: string | null;
};

export type RazorpayPaymentEntity = Record<string, unknown> & {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  captured?: boolean;
  method?: string;
};

const LEDGER_COLUMNS =
  'id,bespoke_order_id,user_id,razorpay_order_id,razorpay_payment_id,payment_purpose,amount,currency,status,refunded_amount,refund_status,last_refund_id';

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export async function findBespokePaymentByOrder(
  admin: SupabaseClient,
  razorpayOrderId: string
): Promise<BespokePaymentLedger | null> {
  const { data, error } = await admin
    .from('bespoke_payments')
    .select(LEDGER_COLUMNS)
    .eq('razorpay_order_id', razorpayOrderId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as BespokePaymentLedger | null;
}

export async function findBespokePaymentByPaymentId(
  admin: SupabaseClient,
  paymentId: string
): Promise<BespokePaymentLedger | null> {
  const { data, error } = await admin
    .from('bespoke_payments')
    .select(LEDGER_COLUMNS)
    .eq('razorpay_payment_id', paymentId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as BespokePaymentLedger | null;
}

export function assertBespokePaymentIdentity(
  ledger: BespokePaymentLedger,
  entity: RazorpayPaymentEntity
) {
  if (
    String(entity.id || '') === '' ||
    String(entity.order_id || '') !== ledger.razorpay_order_id
  ) {
    throw new Error('Razorpay payment identity does not match the bespoke payment session.');
  }
  if (String(entity.currency || '') !== ledger.currency) {
    throw new Error('Razorpay payment currency does not match the bespoke payment session.');
  }
  if (Number(entity.amount || 0) !== rupeesToPaise(Number(ledger.amount || 0))) {
    throw new Error('Razorpay payment amount does not match the bespoke payment session.');
  }
}

async function queuePaymentUpdate(
  admin: SupabaseClient,
  input: {
    order: Record<string, unknown>;
    paymentId: string;
    stage: string;
  }
) {
  const { data: existing } = await admin
    .from('bespoke_follow_up_jobs')
    .select('id')
    .eq('bespoke_order_id', String(input.order.id))
    .eq('job_type', 'delivery_update')
    .contains('payload', { razorpay_payment_id: input.paymentId })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return;

  const { error } = await admin.from('bespoke_follow_up_jobs').insert({
    bespoke_order_id: input.order.id,
    user_id: input.order.user_id,
    whatsapp_phone: input.order.whatsapp_phone,
    job_type: 'delivery_update',
    due_at: new Date().toISOString(),
    payload: {
      source: 'razorpay',
      razorpay_payment_id: input.paymentId,
      expected_stage: input.stage,
    },
  });
  if (error) throw error;
}

export async function reconcileBespokeOrderPayments(
  admin: SupabaseClient,
  input: {
    orderId: string;
    latestPaymentId?: string | null;
    notifyStageChange?: boolean;
  }
) {
  const [{ data: order, error: orderError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      admin.from('bespoke_orders').select('*').eq('id', input.orderId).maybeSingle(),
      admin
        .from('bespoke_payments')
        .select('amount,refunded_amount,status')
        .eq('bespoke_order_id', input.orderId),
    ]);
  if (orderError || paymentsError || !order) {
    throw orderError || paymentsError || new Error('Bespoke order was not found during payment reconciliation.');
  }

  const captured = roundMoney(
    (payments || [])
      .filter((payment) =>
        ['captured', 'partially_refunded', 'refunded'].includes(String(payment.status))
      )
      .reduce((total, payment) => total + Number(payment.amount || 0), 0)
  );
  const refunded = roundMoney(
    (payments || []).reduce(
      (total, payment) => total + Number(payment.refunded_amount || 0),
      0
    )
  );
  const netPaid = Math.max(0, roundMoney(captured - refunded));
  const quoted = roundMoney(Number(order.quoted_amount || 0));
  const paid = quoted > 0 ? Math.min(quoted, netPaid) : netPaid;
  const remaining = quoted > 0 ? Math.max(0, roundMoney(quoted - paid)) : 0;
  const fullyPaid = quoted > 0 && remaining < 0.01;
  const currentStage = String(order.stage || '');
  let nextStage = currentStage;
  if (currentStage === 'advance_or_full_payment' && paid > 0) nextStage = 'stitching';
  if (currentStage === 'balance_payment' && fullyPaid) nextStage = 'delivery_or_pickup';

  const paymentStatus =
    paid > 0
      ? fullyPaid
        ? 'paid'
        : 'part_paid'
      : refunded > 0
        ? 'refunded'
        : 'unpaid';
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    paid_amount: paid,
    balance_amount: remaining,
    payment_status: paymentStatus,
    updated_at: now,
  };
  if (input.latestPaymentId) patch.razorpay_payment_id = input.latestPaymentId;
  if (nextStage !== currentStage) {
    patch.stage = nextStage;
    patch.human_action_required = false;
    patch.human_action_reason = null;
    if (nextStage === 'stitching') patch.stitching_status = 'queued';
  } else if (refunded > 0 && !['advance_or_full_payment', 'balance_payment'].includes(currentStage)) {
    // A refund after production starts needs a person to resolve fulfilment and
    // any replacement payment; never silently rewind the physical workflow.
    patch.human_action_required = true;
    patch.human_action_reason = 'customer_service';
  }

  const { data: updated, error: updateError } = await admin
    .from('bespoke_orders')
    .update(patch)
    .eq('id', input.orderId)
    .select('*')
    .single();
  if (updateError) throw updateError;

  if (nextStage !== currentStage) {
    await admin
      .from('bespoke_follow_up_jobs')
      .update({ status: 'cancelled', updated_at: now })
      .eq('bespoke_order_id', input.orderId)
      .eq('job_type', 'payment_reminder')
      .eq('status', 'pending');
    if (input.notifyStageChange !== false && input.latestPaymentId) {
      await queuePaymentUpdate(admin, {
        order: updated as Record<string, unknown>,
        paymentId: input.latestPaymentId,
        stage: nextStage,
      });
    }
  }

  return {
    order: updated as Record<string, unknown>,
    paidAmount: paid,
    balanceAmount: remaining,
    fullyPaid,
    capturedAmount: captured,
    refundedAmount: refunded,
  };
}

export async function recordBespokePaymentCapture(
  admin: SupabaseClient,
  input: {
    ledger: BespokePaymentLedger;
    entity: RazorpayPaymentEntity;
    eventType: string;
  }
) {
  assertBespokePaymentIdentity(input.ledger, input.entity);
  const paymentId = String(input.entity.id);
  const timestamp = new Date().toISOString();
  const protectedStatus = ['partially_refunded', 'refunded'].includes(input.ledger.status);
  const { error } = await admin
    .from('bespoke_payments')
    .update({
      razorpay_payment_id: paymentId,
      status: protectedStatus ? input.ledger.status : 'captured',
      provider_status: String(input.entity.status || 'captured'),
      provider_payload: input.entity,
      payment_method: input.entity.method ? String(input.entity.method) : null,
      captured_at: timestamp,
      failure_reason: null,
      last_webhook_event: input.eventType,
      last_webhook_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', input.ledger.id);
  if (error) throw error;

  return reconcileBespokeOrderPayments(admin, {
    orderId: input.ledger.bespoke_order_id,
    latestPaymentId: paymentId,
  });
}

export async function recordBespokePaymentAuthorization(
  admin: SupabaseClient,
  input: {
    ledger: BespokePaymentLedger;
    entity: RazorpayPaymentEntity;
    eventType: string;
  }
) {
  assertBespokePaymentIdentity(input.ledger, input.entity);
  if (['captured', 'partially_refunded', 'refunded'].includes(input.ledger.status)) return;
  const timestamp = new Date().toISOString();
  const { error } = await admin
    .from('bespoke_payments')
    .update({
      razorpay_payment_id: String(input.entity.id),
      status: 'authorized',
      provider_status: String(input.entity.status || 'authorized'),
      provider_payload: input.entity,
      payment_method: input.entity.method ? String(input.entity.method) : null,
      failure_reason: null,
      last_webhook_event: input.eventType,
      last_webhook_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', input.ledger.id);
  if (error) throw error;
}

export async function recordBespokePaymentFailure(
  admin: SupabaseClient,
  input: {
    ledger: BespokePaymentLedger;
    entity: RazorpayPaymentEntity;
    eventType: string;
  }
) {
  assertBespokePaymentIdentity(input.ledger, input.entity);
  if (['captured', 'partially_refunded', 'refunded'].includes(input.ledger.status)) return;
  const timestamp = new Date().toISOString();
  const reason = String(
    input.entity.error_description || input.entity.error_reason || 'Payment failed'
  ).slice(0, 1000);
  const { error } = await admin
    .from('bespoke_payments')
    .update({
      razorpay_payment_id: String(input.entity.id || '') || null,
      status: 'failed',
      provider_status: String(input.entity.status || 'failed'),
      provider_payload: input.entity,
      payment_method: input.entity.method ? String(input.entity.method) : null,
      failure_reason: reason,
      failed_at: timestamp,
      last_webhook_event: input.eventType,
      last_webhook_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', input.ledger.id);
  if (error) throw error;

  await admin
    .from('bespoke_orders')
    .update({ payment_status: 'failed', updated_at: timestamp })
    .eq('id', input.ledger.bespoke_order_id)
    .eq('paid_amount', 0);
}

export async function recordBespokeRefund(
  admin: SupabaseClient,
  input: {
    ledger: BespokePaymentLedger;
    entity: Record<string, unknown>;
    eventType: 'refund.created' | 'refund.processed' | 'refund.failed';
  }
) {
  const refundId = String(input.entity.id || '');
  const providerPaymentId = String(input.entity.payment_id || '');
  const amount = roundMoney(Number(input.entity.amount || 0) / 100);
  if (!refundId || !providerPaymentId || providerPaymentId !== input.ledger.razorpay_payment_id) {
    throw new Error('Razorpay refund identity does not match the bespoke payment.');
  }
  if (!(amount > 0) || amount > roundMoney(Number(input.ledger.amount || 0))) {
    throw new Error('Razorpay refund amount is invalid for the bespoke payment.');
  }

  const status =
    input.eventType === 'refund.processed'
      ? 'processed'
      : input.eventType === 'refund.failed'
        ? 'failed'
        : 'requested';
  const now = new Date().toISOString();
  const { data: existingRefund, error: existingRefundError } = await admin
    .from('bespoke_refunds')
    .select('status,processed_at,failed_at')
    .eq('razorpay_refund_id', refundId)
    .maybeSingle();
  if (existingRefundError) throw existingRefundError;
  // Processed is terminal. A delayed refund.created/refund.failed webhook must
  // never resurrect or reverse an already-accounted refund.
  const effectiveStatus = existingRefund?.status === 'processed' ? 'processed' : status;
  const { error: refundError } = await admin.from('bespoke_refunds').upsert(
    {
      bespoke_payment_id: input.ledger.id,
      bespoke_order_id: input.ledger.bespoke_order_id,
      user_id: input.ledger.user_id,
      razorpay_refund_id: refundId,
      razorpay_payment_id: providerPaymentId,
      amount,
      status: effectiveStatus,
      provider_payload: input.entity,
      processed_at:
        effectiveStatus === 'processed' ? existingRefund?.processed_at || now : null,
      failed_at: effectiveStatus === 'failed' ? existingRefund?.failed_at || now : null,
      updated_at: now,
    },
    { onConflict: 'razorpay_refund_id' }
  );
  if (refundError) throw refundError;

  const { data: refunds, error: refundsError } = await admin
    .from('bespoke_refunds')
    .select('amount,status')
    .eq('bespoke_payment_id', input.ledger.id);
  if (refundsError) throw refundsError;
  const refundedAmount = roundMoney(
    (refunds || [])
      .filter((refund) => refund.status === 'processed')
      .reduce((total, refund) => total + Number(refund.amount || 0), 0)
  );
  if (refundedAmount > roundMoney(Number(input.ledger.amount || 0))) {
    throw new Error('Processed refunds exceed the bespoke payment amount.');
  }
  const paymentStatus =
    refundedAmount <= 0
      ? input.ledger.status
      : refundedAmount + 0.01 >= Number(input.ledger.amount || 0)
        ? 'refunded'
        : 'partially_refunded';
  const refundStatus = effectiveStatus === 'failed' ? 'failed' : effectiveStatus;
  const { error: paymentError } = await admin
    .from('bespoke_payments')
    .update({
      status: paymentStatus,
      refunded_amount: refundedAmount,
      refund_status: refundStatus,
      last_refund_id: refundId,
      provider_payload: input.entity,
      last_webhook_event: input.eventType,
      last_webhook_at: now,
      updated_at: now,
    })
    .eq('id', input.ledger.id);
  if (paymentError) throw paymentError;

  if (effectiveStatus === 'processed') {
    return reconcileBespokeOrderPayments(admin, {
      orderId: input.ledger.bespoke_order_id,
      latestPaymentId: providerPaymentId,
      notifyStageChange: false,
    });
  }
  return null;
}
