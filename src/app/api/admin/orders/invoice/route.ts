import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdministrator } from '@/lib/server/requireAdministrator';
import { ensureAutomaticInvoice } from '@/lib/server/automaticInvoice';

export async function POST(request: NextRequest) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!await requireAdministrator()) return json({ error: 'Administrator access required.' }, 403);
  const body = await request.json().catch(() => null);
  if (!body || !['catalog', 'bulk'].includes(body.kind) || typeof body.orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.orderId)) {
    return json({ error: 'Valid order reference required.' }, 400);
  }
  const admin = createAdminClient();
  const { data: order } = await admin.from(body.kind === 'catalog' ? 'catalog_order_requests' : 'bulk_orders')
    .select('id,payment_status').eq('id', body.orderId).maybeSingle();
  if (order?.payment_status !== 'paid') return json({ error: 'Only fully paid orders can issue a payment invoice.' }, 409);
  const { data: payment, error } = await admin.from(body.kind === 'catalog' ? 'catalog_order_payments' : 'bulk_order_payments')
    .select('razorpay_payment_id,captured_at').eq(body.kind === 'catalog' ? 'catalog_order_id' : 'bulk_order_id', body.orderId)
    .eq('status', 'captured').order('captured_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !payment?.razorpay_payment_id) return json({ error: 'Captured payment record is unavailable.' }, 409);
  const result = await ensureAutomaticInvoice({ admin, kind: body.kind, orderId: body.orderId,
    paymentId: payment.razorpay_payment_id, capturedAt: payment.captured_at });
  return json({ invoiceId: result.invoice?.id || null, emailed: result.emailed,
    message: result.emailed ? 'Invoice submitted to the email provider.' : 'Invoice email needs attention. Check the order details for its recorded error.' }, result.emailed ? 200 : 503);
}
