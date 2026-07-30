import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type PaymentKind = 'bulk' | 'catalog';

type PaymentRecord = {
  id: string;
  fabrictradOrderId: string;
  status: string;
  kind: PaymentKind;
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return json({ success: false, error: 'Authentication required.' }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ success: false, error: 'A valid JSON request is required.' }, 400);
    }

    const orderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : '';
    const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
    const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : '';

    if (!orderId || !paymentId || !signature) {
      return json({ success: false, error: 'Missing payment details.' }, 400);
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return json(
        {
          success: false,
          error: 'Online payment verification is temporarily unavailable.',
          code: 'PAYMENT_SERVICE_UNAVAILABLE',
        },
        503
      );
    }

    const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
    const supplied = Buffer.from(signature, 'hex');

    if (supplied.length !== expected.length || !crypto.timingSafeEqual(expected, supplied)) {
      return json({ success: false, error: 'Invalid signature.' }, 400);
    }

    const admin = createAdminClient();
    let payment: PaymentRecord | null = null;

    const { data: bulkPayment, error: bulkPaymentError } = await admin
      .from('bulk_order_payments')
      .select('id,bulk_order_id,status')
      .eq('razorpay_order_id', orderId)
      .maybeSingle();
    if (bulkPaymentError) throw bulkPaymentError;
    if (bulkPayment) {
      payment = {
        id: bulkPayment.id,
        fabrictradOrderId: bulkPayment.bulk_order_id,
        status: bulkPayment.status,
        kind: 'bulk',
      };
    }

    if (!payment) {
      const { data: catalogPayment, error: catalogPaymentError } = await admin
        .from('catalog_order_payments')
        .select('id,catalog_order_id,status')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();
      if (catalogPaymentError) throw catalogPaymentError;
      if (catalogPayment) {
        payment = {
          id: catalogPayment.id,
          fabrictradOrderId: catalogPayment.catalog_order_id,
          status: catalogPayment.status,
          kind: 'catalog',
        };
      }
    }

    if (!payment) {
      return json({ success: false, error: 'Payment order not found.' }, 404);
    }

    const orderTable = payment.kind === 'bulk' ? 'bulk_orders' : 'catalog_order_requests';
    const { data: fabrictradOrder, error: orderError } = await admin
      .from(orderTable)
      .select('buyer_id')
      .eq('id', payment.fabrictradOrderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!fabrictradOrder || fabrictradOrder.buyer_id !== user.id) {
      return json({ success: false, error: 'Payment order not found.' }, 404);
    }

    if (payment.status !== 'captured') {
      const paymentTable =
        payment.kind === 'bulk' ? 'bulk_order_payments' : 'catalog_order_payments';
      const { error } = await admin
        .from(paymentTable)
        .update({
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          status: 'authorized',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);
      if (error) throw error;
    }

    return json({
      success: true,
      paymentId,
      orderId,
      fabrictradOrderId: payment.fabrictradOrderId,
      orderKind: payment.kind,
    });
  } catch (error) {
    console.error('Razorpay verification failed:', error);
    return json({ success: false, error: 'Unable to verify payment.' }, 500);
  }
}
