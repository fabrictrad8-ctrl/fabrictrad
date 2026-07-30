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
      return NextResponse.json({ success: false, error: 'Payment order not found.' }, { status: 404 });
    }

    const orderTable = payment.kind === 'bulk' ? 'bulk_orders' : 'catalog_order_requests';
    const { data: fabrictradOrder, error: orderError } = await admin
      .from(orderTable)
      .select('buyer_id')
      .eq('id', payment.fabrictradOrderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!fabrictradOrder || fabrictradOrder.buyer_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Payment order not found.' }, { status: 404 });
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

    return NextResponse.json({
      success: true,
      paymentId,
      orderId,
      fabrictradOrderId: payment.fabrictradOrderId,
      orderKind: payment.kind,
    });
  } catch (error) {
    console.error('Razorpay verification failed:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to verify payment.' },
      { status: 500 }
    );
  }
}
