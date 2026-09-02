import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isBespokeStage, type BespokeStage } from '@/lib/bespokeWorkflow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

type BuyerAction =
  | 'select_product'
  | 'reference_image'
  | 'fabric'
  | 'customization'
  | 'measurement'
  | 'appointment'
  | 'final_approval'
  | 'delivery'
  | 'review'
  | 'customer_service';

type AppointmentType = 'physical_measurement' | 'design_approval' | 'trial_fitting' | 'alteration';

type PatchBody = {
  action?: BuyerAction | 'admin_update';
  productId?: string | null;
  referenceImagePath?: string | null;
  referenceImageMeta?: Record<string, unknown>;
  fabricSelection?: Record<string, unknown>;
  customization?: Record<string, unknown>;
  measurement?: Record<string, unknown>;
  appointmentType?: AppointmentType;
  requestedAt?: string;
  locationType?: 'store' | 'customer_address' | 'video_call' | 'other';
  locationDetails?: Record<string, unknown>;
  deliveryMode?: 'delivery' | 'pickup';
  deliveryDetails?: Record<string, unknown>;
  reviewRating?: number;
  reviewText?: string;
  reason?: string;
  stage?: BespokeStage;
  quotation?: Record<string, unknown>;
  quotedAmount?: number;
  advanceAmount?: number;
  paidAmount?: number;
  balanceAmount?: number;
  paymentChoice?: 'advance' | 'full';
  paymentStatus?: 'unpaid' | 'payment_link_created' | 'part_paid' | 'paid' | 'failed' | 'refunded';
  stitchingStatus?: 'not_started' | 'queued' | 'in_progress' | 'completed';
  embroideryStatus?: 'not_required' | 'queued' | 'in_progress' | 'completed';
  humanActionRequired?: boolean;
  humanActionReason?: AppointmentType | 'customer_service' | null;
};

const BUYER_ACTION_BY_STAGE: Partial<Record<BespokeStage, BuyerAction[]>> = {
  catalogue: ['select_product'],
  product: ['select_product'],
  reference_image: ['reference_image'],
  fabric: ['fabric'],
  customization: ['customization'],
  measurement: ['measurement'],
  appointment: ['appointment'],
  trial: ['appointment'],
  alteration: ['appointment'],
  final_approval: ['final_approval'],
  delivery_or_pickup: ['delivery'],
  review: ['review'],
};

const APPOINTMENT_TYPES_BY_STAGE: Partial<Record<BespokeStage, AppointmentType[]>> = {
  appointment: ['physical_measurement', 'design_approval'],
  trial: ['trial_fitting'],
  alteration: ['alteration'],
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { user: null, profile: null };
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role,is_active,can_buy')
    .eq('id', data.user.id)
    .maybeSingle();
  return { user: data.user, profile };
}

const safeObject = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const safeMoney = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const access = await currentUser();
  if (!access.user) return json({ error: 'Authentication required.' }, 401);
  const isAdmin = ['admin_staff', 'super_admin'].includes(String(access.profile?.role || ''));
  const admin = createAdminClient();
  let query = admin.from('bespoke_orders').select('*').eq('id', id);
  if (!isAdmin) query = query.eq('user_id', access.user.id);
  const { data, error } = await query.maybeSingle();
  if (error) return json({ error: 'Custom order could not be loaded.' }, 503);
  if (!data) return json({ error: 'Custom order not found.' }, 404);
  const { data: appointments } = await admin
    .from('bespoke_appointments')
    .select('id,appointment_type,requested_at,duration_minutes,location_type,location_details,status,created_at,updated_at')
    .eq('bespoke_order_id', id)
    .order('requested_at', { ascending: false });
  return json({ order: data, appointments: appointments || [] });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const access = await currentUser();
  if (!access.user) return json({ error: 'Authentication required.' }, 401);
  if (!access.profile?.is_active) return json({ error: 'Active account required.' }, 403);
  const isAdmin = ['admin_staff', 'super_admin'].includes(String(access.profile.role || ''));
  if (!isAdmin && access.profile.can_buy === false) return json({ error: 'Buyer access required.' }, 403);

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const admin = createAdminClient();
  let orderQuery = admin.from('bespoke_orders').select('*').eq('id', id);
  if (!isAdmin) orderQuery = orderQuery.eq('user_id', access.user.id);
  const { data: order, error: orderError } = await orderQuery.maybeSingle();
  if (orderError) return json({ error: 'Custom order could not be loaded.' }, 503);
  if (!order) return json({ error: 'Custom order not found.' }, 404);

  const currentStage = String(order.stage) as BespokeStage;
  if (!isAdmin && body.action !== 'customer_service') {
    const allowed = BUYER_ACTION_BY_STAGE[currentStage] || [];
    if (!body.action || !allowed.includes(body.action as BuyerAction)) {
      return json(
        {
          error: `This action is not available while the order is at “${currentStage.replaceAll('_', ' ')}”. Refresh the order status first.`,
          code: 'INVALID_STAGE_ACTION',
        },
        409
      );
    }
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };
  let appointment: Record<string, unknown> | null = null;

  if (body.action === 'admin_update') {
    if (!isAdmin) return json({ error: 'Admin access required.' }, 403);
    if (body.stage && isBespokeStage(body.stage)) {
      if (body.stage === 'advance_or_full_payment' && safeMoney(body.quotedAmount ?? order.quoted_amount) <= 0) {
        return json({ error: 'Set a positive quotation before opening payment.' }, 400);
      }
      updates.stage = body.stage;
    }
    if (body.quotation) updates.quotation = safeObject(body.quotation);
    if (body.quotedAmount !== undefined) updates.quoted_amount = safeMoney(body.quotedAmount);
    if (body.advanceAmount !== undefined) updates.advance_amount = safeMoney(body.advanceAmount);
    if (body.paidAmount !== undefined) updates.paid_amount = safeMoney(body.paidAmount);
    if (body.balanceAmount !== undefined) updates.balance_amount = safeMoney(body.balanceAmount);
    if (body.paymentChoice) updates.payment_choice = body.paymentChoice;
    if (body.paymentStatus) updates.payment_status = body.paymentStatus;
    if (body.stitchingStatus) updates.stitching_status = body.stitchingStatus;
    if (body.embroideryStatus) updates.embroidery_status = body.embroideryStatus;
    if (typeof body.humanActionRequired === 'boolean') updates.human_action_required = body.humanActionRequired;
    if (body.humanActionReason !== undefined) updates.human_action_reason = body.humanActionReason;
    if (body.stage === 'final_approval') updates.final_approved_at = null;
    if (body.stage === 'completed') updates.completed_at = now;
  } else if (body.action === 'select_product') {
    if (!body.productId) return json({ error: 'Choose a catalogue product.' }, 400);
    const { data: product } = await admin
      .from('seller_products')
      .select('id,status,approval_status')
      .eq('id', body.productId)
      .eq('status', 'active')
      .eq('approval_status', 'approved')
      .maybeSingle();
    if (!product?.id) return json({ error: 'That catalogue product is not available.' }, 400);
    updates.product_id = product.id;
    updates.stage = 'reference_image';
  } else if (body.action === 'reference_image') {
    if (!body.referenceImagePath) {
      updates.reference_image_path = null;
      updates.reference_image_meta = safeObject(body.referenceImageMeta);
    } else {
      const path = String(body.referenceImagePath);
      if (!path.startsWith(`${access.user.id}/`)) return json({ error: 'Reference image path is invalid.' }, 400);
      updates.reference_image_path = path;
      updates.reference_image_meta = safeObject(body.referenceImageMeta);
    }
    updates.stage = 'fabric';
  } else if (body.action === 'fabric') {
    if (!Object.keys(safeObject(body.fabricSelection)).length) return json({ error: 'Choose or describe the fabric.' }, 400);
    updates.fabric_selection = safeObject(body.fabricSelection);
    updates.stage = 'customization';
  } else if (body.action === 'customization') {
    if (!Object.keys(safeObject(body.customization)).length) return json({ error: 'Add at least one customization detail.' }, 400);
    updates.customization = safeObject(body.customization);
    updates.stage = 'measurement';
  } else if (body.action === 'measurement') {
    const measurement = safeObject(body.measurement);
    if (!Object.keys(measurement).length) return json({ error: 'Choose a measurement method or enter saved measurements.' }, 400);
    updates.measurement = measurement;
    updates.stage = 'appointment';
    const mode = String((measurement as Record<string, unknown>).mode || '');
    if (mode === 'physical') {
      updates.human_action_required = true;
      updates.human_action_reason = 'physical_measurement';
    }
  } else if (body.action === 'appointment') {
    const requestedAt = new Date(String(body.requestedAt || ''));
    if (!Number.isFinite(requestedAt.getTime()) || requestedAt.getTime() < Date.now() - 60_000) {
      return json({ error: 'Choose a valid future appointment time.' }, 400);
    }

    const allowedAppointmentTypes = APPOINTMENT_TYPES_BY_STAGE[currentStage] || [];
    const defaultType: AppointmentType =
      currentStage === 'trial'
        ? 'trial_fitting'
        : currentStage === 'alteration'
          ? 'alteration'
          : String((safeObject(order.measurement) as Record<string, unknown>).mode || '') === 'physical'
            ? 'physical_measurement'
            : 'design_approval';
    const appointmentType = body.appointmentType || defaultType;
    if (!allowedAppointmentTypes.includes(appointmentType)) {
      return json(
        {
          error: `A ${appointmentType.replaceAll('_', ' ')} appointment is not valid during the ${currentStage.replaceAll('_', ' ')} stage.`,
          code: 'INVALID_APPOINTMENT_TYPE',
        },
        409
      );
    }

    const { data: activeAppointment, error: activeAppointmentError } = await admin
      .from('bespoke_appointments')
      .select('id,appointment_type,requested_at,status')
      .eq('bespoke_order_id', id)
      .eq('appointment_type', appointmentType)
      .in('status', ['requested', 'confirmed', 'reschedule_requested'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeAppointmentError) {
      return json({ error: 'Existing appointments could not be checked.' }, 503);
    }
    if (activeAppointment?.id) {
      return json(
        {
          error: `A ${appointmentType.replaceAll('_', ' ')} appointment is already active. Request a reschedule instead of creating a duplicate.`,
          code: 'APPOINTMENT_ALREADY_ACTIVE',
          appointment: activeAppointment,
        },
        409
      );
    }

    const { data: createdAppointment, error: appointmentError } = await admin
      .from('bespoke_appointments')
      .insert({
        bespoke_order_id: id,
        user_id: order.user_id,
        appointment_type: appointmentType,
        requested_at: requestedAt.toISOString(),
        location_type: body.locationType || 'store',
        location_details: safeObject(body.locationDetails),
      })
      .select('*')
      .single();
    if (appointmentError) {
      if (appointmentError.code === '23505') {
        return json(
          {
            error: `A ${appointmentType.replaceAll('_', ' ')} appointment is already active.`,
            code: 'APPOINTMENT_ALREADY_ACTIVE',
          },
          409
        );
      }
      return json({ error: appointmentError.message }, 500);
    }
    appointment = createdAppointment;
    // Initial measurement/design appointment, trial fitting and alteration are
    // separate human checkpoints. Preserve the corresponding stage so the
    // staff completion action advances the state machine correctly.
    updates.stage = currentStage;
    updates.human_action_required = true;
    updates.human_action_reason = appointmentType;
    await admin.from('bespoke_follow_up_jobs').insert({
      bespoke_order_id: id,
      user_id: order.user_id,
      whatsapp_phone: order.whatsapp_phone,
      job_type: appointmentType === 'trial_fitting' ? 'trial_reminder' : 'appointment_reminder',
      due_at: new Date(Math.max(Date.now(), requestedAt.getTime() - 24 * 60 * 60 * 1000)).toISOString(),
      payload: { appointment_id: createdAppointment.id, appointment_type: appointmentType },
    });
  } else if (body.action === 'final_approval') {
    const quoted = safeMoney(order.quoted_amount);
    const paid = safeMoney(order.paid_amount);
    const balance = Math.max(0, Math.round((quoted - paid) * 100) / 100);
    updates.final_approved_at = now;
    updates.human_action_required = false;
    updates.human_action_reason = null;
    updates.balance_amount = balance;
    updates.stage = balance >= 0.01 ? 'balance_payment' : 'delivery_or_pickup';
  } else if (body.action === 'delivery') {
    if (!body.deliveryMode) return json({ error: 'Choose delivery or pickup.' }, 400);
    updates.delivery_mode = body.deliveryMode;
    updates.delivery_details = safeObject(body.deliveryDetails);
    // Selecting fulfilment does not mean the item has been delivered. Staff or
    // the shipping webhook moves the order to review after actual handover.
    updates.stage = 'delivery_or_pickup';
  } else if (body.action === 'review') {
    const rating = Math.round(Number(body.reviewRating));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: 'Review rating must be from 1 to 5.' }, 400);
    updates.review_rating = rating;
    updates.review_text = String(body.reviewText || '').trim().slice(0, 2000) || null;
    updates.stage = 'follow_up';
    updates.follow_up_due_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from('bespoke_follow_up_jobs').insert({
      bespoke_order_id: id,
      user_id: order.user_id,
      whatsapp_phone: order.whatsapp_phone,
      job_type: 'post_delivery_follow_up',
      due_at: updates.follow_up_due_at,
      payload: { review_rating: rating },
    });
  } else if (body.action === 'customer_service') {
    updates.human_action_required = true;
    updates.human_action_reason = 'customer_service';
    updates.customization = {
      ...(safeObject(order.customization) as Record<string, unknown>),
      customer_service_note: String(body.reason || '').trim().slice(0, 2000),
    };
  } else {
    return json({ error: 'Unsupported custom-order action.' }, 400);
  }

  const { data: updated, error: updateError } = await admin
    .from('bespoke_orders')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (updateError) return json({ error: updateError.message }, 500);
  return json({ updated: true, order: updated, appointment });
}
