import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

type AppointmentType = 'physical_measurement' | 'design_approval' | 'trial_fitting' | 'alteration';
type LocationType = 'store' | 'customer_address' | 'video_call' | 'other';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const allowedTypeForStage = (stage: string, currentReason: unknown): AppointmentType | null => {
  if (stage === 'trial') return 'trial_fitting';
  if (stage === 'alteration') return 'alteration';
  if (stage === 'appointment') {
    return currentReason === 'physical_measurement' ? 'physical_measurement' : 'design_approval';
  }
  return null;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Authentication required.' }, 401);

  const admin = createAdminClient();
  const [{ data: profile }, { data: order, error: orderError }] = await Promise.all([
    admin.from('user_profiles').select('role,is_active,can_buy').eq('id', auth.user.id).maybeSingle(),
    admin.from('bespoke_orders').select('*').eq('id', id).maybeSingle(),
  ]);
  if (!profile?.is_active) return json({ error: 'Active account required.' }, 403);
  const isAdmin = ['admin_staff', 'super_admin'].includes(String(profile.role || ''));
  if (!order || orderError) return json({ error: 'Custom order not found.' }, orderError ? 503 : 404);
  if (!isAdmin && (profile.can_buy === false || order.user_id !== auth.user.id)) {
    return json({ error: 'This custom order does not belong to your buyer account.' }, 403);
  }

  const requiredType = allowedTypeForStage(String(order.stage || ''), order.human_action_reason);
  if (!requiredType) {
    return json(
      { error: `Appointments are not required while this order is at “${String(order.stage || '').replaceAll('_', ' ')}”.` },
      409
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    requestedAt?: string;
    locationType?: LocationType;
    locationDetails?: Record<string, unknown>;
  };
  const requestedAt = new Date(String(body.requestedAt || ''));
  if (!Number.isFinite(requestedAt.getTime()) || requestedAt.getTime() < Date.now() - 60_000) {
    return json({ error: 'Choose a valid future appointment time.' }, 400);
  }
  const locationType: LocationType = ['store', 'customer_address', 'video_call', 'other'].includes(
    String(body.locationType || '')
  )
    ? (body.locationType as LocationType)
    : 'store';
  const locationDetails =
    body.locationDetails && typeof body.locationDetails === 'object' && !Array.isArray(body.locationDetails)
      ? body.locationDetails
      : {};

  const { data: existing } = await admin
    .from('bespoke_appointments')
    .select('id,appointment_type,requested_at,status')
    .eq('bespoke_order_id', id)
    .eq('appointment_type', requiredType)
    .in('status', ['requested', 'confirmed', 'reschedule_requested'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    return json(
      {
        error: `A ${requiredType.replaceAll('_', ' ')} appointment is already active. Request a reschedule instead of creating a duplicate.`,
        code: 'APPOINTMENT_ALREADY_ACTIVE',
        appointment: existing,
      },
      409
    );
  }

  const { data: appointment, error: appointmentError } = await admin
    .from('bespoke_appointments')
    .insert({
      bespoke_order_id: id,
      user_id: order.user_id,
      appointment_type: requiredType,
      requested_at: requestedAt.toISOString(),
      location_type: locationType,
      location_details: locationDetails,
      status: 'requested',
    })
    .select('*')
    .single();
  if (appointmentError || !appointment) {
    return json({ error: appointmentError?.message || 'Appointment could not be requested.' }, 500);
  }

  const now = new Date().toISOString();
  await admin
    .from('bespoke_orders')
    .update({
      human_action_required: true,
      human_action_reason: requiredType,
      updated_at: now,
    })
    .eq('id', id);

  await admin.from('bespoke_follow_up_jobs').insert({
    bespoke_order_id: id,
    user_id: order.user_id,
    whatsapp_phone: order.whatsapp_phone,
    job_type: requiredType === 'trial_fitting' ? 'trial_reminder' : 'appointment_reminder',
    due_at: new Date(Math.max(Date.now(), requestedAt.getTime() - 24 * 60 * 60 * 1000)).toISOString(),
    payload: { appointment_id: appointment.id, appointment_type: requiredType },
  });

  return json({ created: true, appointment, appointmentType: requiredType }, 201);
}
