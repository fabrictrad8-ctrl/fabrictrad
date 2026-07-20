import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const money = (value: number) => Math.round(value * 100) / 100;

export async function POST(request: NextRequest) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
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

    const body = (await request.json()) as { orderId?: string };
    if (!body.orderId) {
      return NextResponse.json(
        { success: false, error: 'A confirmed FabricTrad order is required.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin
      .from('bulk_orders')
      .select('id,buyer_id,seller_id,status,net_total')
      .eq('id', body.orderId)
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }
    if (order.status !== 'confirmed') {
      return NextResponse.json(
        { success: false, error: 'Only seller-confirmed orders can be paid.' },
        { status: 409 }
      );
    }

    const amount = money(Number(order.net_total));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Order total is invalid.' }, { status: 409 });
    }

    const { data: existing } = await admin
      .from('bulk_order_payments')
      .select('razorpay_order_id,amount,currency,status')
      .eq('bulk_order_id', order.id)
      .in('status', ['initiated', 'authorized'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        orderId: existing.razorpay_order_id,
        amount: Math.round(Number(existing.amount) * 100),
        currency: existing.currency,
        keyId,
      });
    }

    const { data: seller } = await admin
      .from('seller_profiles')
      .select('razorpay_linked_account_id,settlement_eligible')
      .eq('id', order.seller_id)
      .maybeSingle();

    const commissionRate = Number(process.env.PLATFORM_COMMISSION_RATE || 0.1);
    const processingRate = Number(process.env.PAYMENT_PROCESSING_RATE || 0.02);
    const platformCommission = money(amount * commissionRate);
    const razorpayFee = money(amount * processingRate);
    const gstOnCommission = money(platformCommission * 0.18);
    const sellerPayable = money(
      Math.max(amount - platformCommission - razorpayFee - gstOnCommission, 0)
    );

    const payload: Record<string, unknown> = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `FTB-${order.id.replace(/-/g, '').slice(0, 24)}`,
      notes: { fabrictrad_bulk_order_id: order.id },
    };

    if (seller?.settlement_eligible && seller.razorpay_linked_account_id && sellerPayable > 0) {
      payload.transfers = [
        {
          account: seller.razorpay_linked_account_id,
          amount: Math.round(sellerPayable * 100),
          currency: 'INR',
          notes: { fabrictrad_bulk_order_id: order.id },
          on_hold: 0,
        },
      ];
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const razorpayOrder = await razorpay.orders.create(
      payload as unknown as Parameters<typeof razorpay.orders.create>[0]
    );

    const { error: paymentError } = await admin.from('bulk_order_payments').insert({
      bulk_order_id: order.id,
      razorpay_order_id: razorpayOrder.id,
      amount,
      currency: 'INR',
      status: 'initiated',
      platform_commission: platformCommission,
      razorpay_fee: razorpayFee,
      gst_on_commission: gstOnCommission,
      seller_payable: sellerPayable,
    });

    if (paymentError) {
      console.error('Failed to persist Razorpay order:', paymentError.message);
      return NextResponse.json(
        { success: false, error: 'Unable to initialize payment safely.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId,
    });
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to create payment order.' },
      { status: 500 }
    );
  }
}
