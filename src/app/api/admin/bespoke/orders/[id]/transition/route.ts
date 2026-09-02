import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

type AdminAction =
  | 'confirm_appointment'
  | 'complete_appointment'
  | 'publish_quote'
  | 'start_stitching'
  | 'stitching_to_embroidery'
  | 'stitching_to_trial'
  | 'start_embroidery'
  | 'embroidery_to_trial'
  | 'trial_passed'
  | 'trial_needs_alteration'
  | 'alteration_completed'
  | 'mark_handed_over';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
const money = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : NaN;
};

async function requireAdmin() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!profile?.is_active || !['admin_staff', 'super_admin'].includes(String(profile.role || ''))) return null;
  return auth.user;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const adminUser = await requireAdmin();
  if (!adminUser) return json({ error: 'Admin access required.' }, 403);

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: AdminAction;
    appointmentId?: string;
    quotedAmount?: number;
    advanceAmount?: number;
    quoteNotes?: string;
  };
  const action = String(body.action || '') as AdminAction;
  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin.from('bespoke_orders').select('*').eq('id', id).maybeSingle();
  if (orderError) return json({ error: 'Custom order could not be loaded.' }, 503);
  if (!order) return json({ error: 'Custom order not found.' }, 404);

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  let followUp: Record<string, unknown> | null = null;
  const completedAppointmentExists = async (appointmentType: 'trial_fitting' | 'alteration') => {
    const { data, error } = await admin
      .from('bespoke_appointments')
      .select('id')
      .eq('bespoke_order_id', id)
      .eq('appointment_type', appointmentType)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data?.id);
  };

  if (action === 'confirm_appointment' || action === 'complete_appointment') {
    const appointmentId = String(body.appointmentId || '').trim();
    if (!appointmentId) return json({ error: 'Choose the appointment to update.' }, 400);
    const { data: appointment } = await admin
      .from('bespoke_appointments')
      .select('id,bespoke_order_id,appointment_type,status')
      .eq('id', appointmentId)
      .eq('bespoke_order_id', id)
      .maybeSingle();
    if (!appointment) return json({ error: 'Appointment not found for this custom order.' }, 404);
    if (!['requested', 'confirmed', 'reschedule_requested'].includes(String(appointment.status))) {
      return json({ error: 'That appointment is no longer active.' }, 409);
    }

    const expectedStage =
      appointment.appointment_type === 'trial_fitting'
        ? 'trial'
        : appointment.appointment_type === 'alteration'
          ? 'alteration'
          : 'appointment';
    if (String(order.stage) !== expectedStage) {
      return json(
        {
          error: `The order is no longer waiting at the ${String(appointment.appointment_type).replaceAll('_', ' ')} stage.`,
        },
        409
      );
    }

    const nextStatus = action === 'confirm_appointment' ? 'confirmed' : 'completed';
    const { error: appointmentError } = await admin
      .from('bespoke_appointments')
      .update({ status: nextStatus, updated_at: now })
      .eq('id', appointmentId);
    if (appointmentError) return json({ error: 'Appointment status could not be updated.' }, 500);

    if (action === 'complete_appointment') {
      await admin
        .from('bespoke_follow_up_jobs')
        .update({ status: 'cancelled', updated_at: now })
        .eq('bespoke_order_id', id)
        .in('job_type', ['appointment_reminder', 'trial_reminder'])
        .eq('status', 'pending');

      if (appointment.appointment_type === 'physical_measurement' || appointment.appointment_type === 'design_approval') {
        update.stage = 'quotation';
        update.human_action_required = false;
        update.human_action_reason = null;
      } else if (appointment.appointment_type === 'trial_fitting') {
        // Keep the order at trial. Staff explicitly records passed vs alteration
        // after the fitting result is known.
        update.human_action_required = true;
        update.human_action_reason = 'trial_fitting';
      } else if (appointment.appointment_type === 'alteration') {
        update.human_action_required = true;
        update.human_action_reason = 'alteration';
      }
    }
  } else if (action === 'publish_quote') {
    if (String(order.stage) !== 'quotation') {
      return json({ error: 'The order must complete measurement/design approval before payment can open.' }, 409);
    }
    const quotedAmount = money(body.quotedAmount);
    const advanceAmount = money(body.advanceAmount ?? 0);
    if (!Number.isFinite(quotedAmount) || quotedAmount <= 0) return json({ error: 'Enter a positive quotation amount.' }, 400);
    if (!Number.isFinite(advanceAmount) || advanceAmount < 0 || advanceAmount >= quotedAmount) {
      return json({ error: 'Advance must be zero or lower than the total quotation.' }, 400);
    }
    update.stage = 'advance_or_full_payment';
    update.quoted_amount = quotedAmount;
    update.advance_amount = advanceAmount;
    update.paid_amount = Math.max(0, Number(order.paid_amount || 0));
    update.balance_amount = Math.max(0, quotedAmount - Number(order.paid_amount || 0));
    update.payment_status = Number(order.paid_amount || 0) > 0 ? 'part_paid' : 'unpaid';
    update.quotation = {
      ...(order.quotation && typeof order.quotation === 'object' ? order.quotation : {}),
      notes: String(body.quoteNotes || '').trim().slice(0, 2000) || null,
      published_at: now,
      published_by: adminUser.id,
    };
    update.human_action_required = false;
    update.human_action_reason = null;
    followUp = {
      bespoke_order_id: id,
      user_id: order.user_id,
      whatsapp_phone: order.whatsapp_phone,
      job_type: 'payment_reminder',
      due_at: now,
      payload: { quoted_amount: quotedAmount, advance_amount: advanceAmount },
    };
  } else if (action === 'start_stitching') {
    if (String(order.stage) !== 'stitching') return json({ error: 'The order is not at stitching.' }, 409);
    if (String(order.stitching_status) === 'completed') {
      return json({ error: 'Stitching is already completed.' }, 409);
    }
    update.stitching_status = 'in_progress';
  } else if (action === 'stitching_to_embroidery') {
    if (String(order.stage) !== 'stitching') return json({ error: 'The order is not at stitching.' }, 409);
    if (String(order.stitching_status) !== 'in_progress') {
      return json({ error: 'Start stitching before marking it complete.' }, 409);
    }
    update.stitching_status = 'completed';
    update.embroidery_status = 'queued';
    update.stage = 'embroidery';
  } else if (action === 'stitching_to_trial') {
    if (String(order.stage) !== 'stitching') return json({ error: 'The order is not at stitching.' }, 409);
    if (String(order.stitching_status) !== 'in_progress') {
      return json({ error: 'Start stitching before marking it complete.' }, 409);
    }
    update.stitching_status = 'completed';
    update.embroidery_status = 'not_required';
    update.stage = 'trial';
    update.human_action_required = true;
    update.human_action_reason = 'trial_fitting';
  } else if (action === 'start_embroidery') {
    if (String(order.stage) !== 'embroidery') return json({ error: 'The order is not at embroidery.' }, 409);
    if (String(order.embroidery_status) === 'completed') {
      return json({ error: 'Embroidery is already completed.' }, 409);
    }
    update.embroidery_status = 'in_progress';
  } else if (action === 'embroidery_to_trial') {
    if (String(order.stage) !== 'embroidery') return json({ error: 'The order is not at embroidery.' }, 409);
    if (String(order.embroidery_status) !== 'in_progress') {
      return json({ error: 'Start embroidery before marking it complete.' }, 409);
    }
    update.embroidery_status = 'completed';
    update.stage = 'trial';
    update.human_action_required = true;
    update.human_action_reason = 'trial_fitting';
  } else if (action === 'trial_passed') {
    if (String(order.stage) !== 'trial') return json({ error: 'The order is not at trial.' }, 409);
    if (!(await completedAppointmentExists('trial_fitting'))) {
      return json({ error: 'Complete the trial fitting appointment before recording its result.' }, 409);
    }
    update.stage = 'final_approval';
    update.human_action_required = false;
    update.human_action_reason = null;
  } else if (action === 'trial_needs_alteration') {
    if (String(order.stage) !== 'trial') return json({ error: 'The order is not at trial.' }, 409);
    if (!(await completedAppointmentExists('trial_fitting'))) {
      return json({ error: 'Complete the trial fitting appointment before recording its result.' }, 409);
    }
    update.stage = 'alteration';
    update.human_action_required = true;
    update.human_action_reason = 'alteration';
  } else if (action === 'alteration_completed') {
    if (String(order.stage) !== 'alteration') return json({ error: 'The order is not at alteration.' }, 409);
    if (!(await completedAppointmentExists('alteration'))) {
      return json({ error: 'Complete the alteration appointment before approving the altered piece.' }, 409);
    }
    update.stage = 'final_approval';
    update.human_action_required = false;
    update.human_action_reason = null;
  } else if (action === 'mark_handed_over') {
    if (String(order.stage) !== 'delivery_or_pickup') {
      return json({ error: 'The order is not ready for delivery/pickup handover.' }, 409);
    }
    if (!order.delivery_mode) {
      return json({ error: 'The buyer must choose delivery or pickup before handover can be completed.' }, 409);
    }
    update.stage = 'review';
    update.delivery_details = {
      ...(order.delivery_details && typeof order.delivery_details === 'object' ? order.delivery_details : {}),
      handed_over_at: now,
      handed_over_by: adminUser.id,
    };
    update.human_action_required = false;
    update.human_action_reason = null;
    followUp = {
      bespoke_order_id: id,
      user_id: order.user_id,
      whatsapp_phone: order.whatsapp_phone,
      job_type: 'review_request',
      due_at: now,
      payload: { delivery_mode: order.delivery_mode },
    };
  } else {
    return json({ error: 'Unsupported admin transition.' }, 400);
  }

  if (
    !followUp &&
    ['stitching_to_embroidery', 'stitching_to_trial', 'embroidery_to_trial', 'trial_passed', 'trial_needs_alteration', 'alteration_completed'].includes(action)
  ) {
    followUp = {
      bespoke_order_id: id,
      user_id: order.user_id,
      whatsapp_phone: order.whatsapp_phone,
      job_type: 'delivery_update',
      due_at: now,
      payload: { action, expected_stage: update.stage },
    };
  }

  const { data: updated, error: updateError } = await admin
    .from('bespoke_orders')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (updateError) return json({ error: updateError.message || 'Custom order could not be updated.' }, 500);

  if (followUp) {
    await admin.from('bespoke_follow_up_jobs').insert(followUp);
  }

  return json({ updated: true, order: updated });
}
