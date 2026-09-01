import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Authentication required.' }, 401);

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (profileError || !profile?.is_active || !['admin_staff', 'super_admin'].includes(String(profile.role || ''))) {
    return json({ error: 'Admin access required.' }, 403);
  }

  const stage = (request.nextUrl.searchParams.get('stage') || '').trim();
  const humanOnly = request.nextUrl.searchParams.get('human') === '1';
  let query = admin
    .from('bespoke_orders')
    .select('*')
    .order('human_action_required', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(200);
  if (stage) query = query.eq('stage', stage);
  if (humanOnly) query = query.eq('human_action_required', true);

  const { data: orders, error: ordersError } = await query;
  if (ordersError) return json({ error: 'Custom-order operations could not be loaded.' }, 503);
  const rows = orders || [];

  const userIds = [...new Set(rows.map((row) => String(row.user_id || '')).filter(Boolean))];
  const storeIds = [...new Set(rows.map((row) => String(row.buyer_store_id || '')).filter(Boolean))];
  const productIds = [...new Set(rows.map((row) => String(row.product_id || '')).filter(Boolean))];
  const orderIds = rows.map((row) => String(row.id));

  const [usersResult, storesResult, productsResult, appointmentsResult] = await Promise.all([
    userIds.length
      ? admin.from('user_profiles').select('id,full_name,phone,email').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    storeIds.length
      ? admin.from('buyer_stores').select('id,store_name,store_handle').in('id', storeIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? admin.from('seller_products').select('id,name,sku,category,fabric_name').in('id', productIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? admin
          .from('bespoke_appointments')
          .select('id,bespoke_order_id,appointment_type,requested_at,location_type,status,staff_notes,updated_at')
          .in('bespoke_order_id', orderIds)
          .order('requested_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (usersResult.error || storesResult.error || productsResult.error || appointmentsResult.error) {
    return json({ error: 'Custom-order related records could not be loaded.' }, 503);
  }

  const users = new Map((usersResult.data || []).map((item) => [item.id, item]));
  const stores = new Map((storesResult.data || []).map((item) => [item.id, item]));
  const products = new Map((productsResult.data || []).map((item) => [item.id, item]));
  const appointmentsByOrder = new Map<string, typeof appointmentsResult.data>();
  for (const appointment of appointmentsResult.data || []) {
    const key = String(appointment.bespoke_order_id);
    const list = appointmentsByOrder.get(key) || [];
    list.push(appointment);
    appointmentsByOrder.set(key, list);
  }

  return json({
    orders: rows.map((order) => ({
      ...order,
      customer: users.get(order.user_id) || null,
      store: order.buyer_store_id ? stores.get(order.buyer_store_id) || null : null,
      product: order.product_id ? products.get(order.product_id) || null : null,
      appointments: appointmentsByOrder.get(order.id) || [],
    })),
  });
}
