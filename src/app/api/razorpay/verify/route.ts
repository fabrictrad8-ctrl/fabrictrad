import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: 'Payment service is not configured.' },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const orderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : '';
    const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
    const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : '';

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { success: false, error: 'Missing payment details.' },
        { status: 400 }
      );
    }

    const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, 'hex');
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid signature.' }, { status: 400 });
    }

    if (supplied.length !== expected.length || !crypto.timingSafeEqual(expected, supplied)) {
      return NextResponse.json({ success: false, error: 'Invalid signature.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: payment } = await admin
      .from('bulk_order_payments')
      .select('id,bulk_order_id,status')
      .eq('razorpay_order_id', orderId)
      .maybeSingle();
    if (!payment) {
      return NextResponse.json({ success: false, error: 'Payment order not found.' }, { status: 404 });
    }

    const { data: order } = await admin
      .from('bulk_orders')
      .select('buyer_id')
      .eq('id', payment.bulk_order_id)
      .maybeSingle();
    if (!order || order.buyer_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Payment order not found.' }, { status: 404 });
    }

    if (payment.status !== 'captured') {
      const { error } = await admin
        .from('bulk_order_payments')
        .update({
          razorpay_payment_id: paymentId,
          status: 'authorized',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, paymentId, orderId });
  } catch (error) {
    console.error('Razorpay verification failed:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to verify payment.' },
      { status: 500 }
    );
  }
}
