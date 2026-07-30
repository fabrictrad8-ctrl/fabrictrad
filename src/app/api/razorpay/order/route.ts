import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const money = (value: number) => Math.round(value * 100) / 100;
type OrderKind = 'bulk' | 'catalog';

type PaymentOrder = {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  amount: number;
  gstAmount: number;
  kind: OrderKind;
};

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
        { success: false, error: 'A seller-confirmed FabricTrad order is required.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    let paymentOrder: PaymentOrder | null = null;

    const { data: bulkOrder, error: bulkError } = await admin
      .from('bulk_orders')
      .select('id,buyer_id,seller_id,status,net_total,gst_total')
      .eq('id', body.orderId)
      .eq('buyer_id', user.id)
      .maybeSingle();
    if (bulkError) throw bulkError;
    if (bulkOrder) {
      paymentOrder = {
        id: bulkOrder.id,
        buyer_id: bulkOrder.buyer_id,
        seller_id: bulkOrder.seller_id,
        status: bulkOrder.status,
        amount: money(Number(bulkOrder.net_total)),
        gstAmount: money(Number(bulkOrder.gst_total || 0)),
        kind: 'bulk',
      };
    }

    if (!paymentOrder) {
      const { data: catalogOrder, error: catalogError } = await admin
        .from('catalog_order_requests')
        .select('id,buyer_id,seller_id,status,total_amount,gst_amount')
        .eq('id', body.orderId)
        .eq('buyer_id', user.id)
        .maybeSingle();
      if (catalogError) throw catalogError;
      if (catalogOrder) {
        paymentOrder = {
          id: catalogOrder.id,
          buyer_id: catalogOrder.buyer_id,
          seller_id: catalogOrder.seller_id,
          status: catalogOrder.status,
          amount: money(Number(catalogOrder.total_amount)),
          gstAmount: money(Number(catalogOrder.gst_amount || 0)),
          kind: 'catalog',
        };
      }
    }

    if (!paymentOrder) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    const payableStatus = paymentOrder.kind === 'bulk' ? 'confirmed' : 'accepted';
    if (paymentOrder.status !== payableStatus) {
      return NextResponse.json(
        {
          success: false,
          error:
            paymentOrder.status === 'paid'
              ? 'This order is already paid.'
              : 'Only seller-accepted orders can be paid.',
        },
        { status: 409 }
      );
    }

    const amount = paymentOrder.amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Order total is invalid.' }, { status: 409 });
    }

    const paymentTable =
      paymentOrder.kind === 'bulk' ? 'bulk_order_payments' : 'catalog_order_payments';
    const orderColumn = paymentOrder.kind === 'bulk' ? 'bulk_order_id' : 'catalog_order_id';
    const { data: existing, error: existingError } = await admin
      .from(paymentTable)
      .select('razorpay_order_id,amount,currency,status')
      .eq(orderColumn, paymentOrder.id)
      .in('status', ['initiated', 'authorized'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      return NextResponse.json({
        success: true,
        orderId: existing.razorpay_order_id,
        fabrictradOrderId: paymentOrder.id,
        orderKind: paymentOrder.kind,
        amount: Math.round(Number(existing.amount) * 100),
        currency: existing.currency,
        keyId,
      });
    }

    const { data: seller, error: sellerError } = await admin
      .from('seller_profiles')
      .select('razorpay_linked_account_id,settlement_eligible')
      .eq('id', paymentOrder.seller_id)
      .maybeSingle();
    if (sellerError) throw sellerError;

    const commissionRate = Number(process.env.PLATFORM_COMMISSION_RATE || 0.1);
    const processingRate = Number(process.env.PAYMENT_PROCESSING_RATE || 0.02);
    const platformCommission = money(amount * commissionRate);
    const razorpayFee = money(amount * processingRate);
    const gstOnCommission = money(platformCommission * 0.18);
    const sellerPayable = money(
      Math.max(amount - platformCommission - razorpayFee - gstOnCommission, 0)
    );

    const notesKey =
      paymentOrder.kind === 'bulk' ? 'fabrictrad_bulk_order_id' : 'fabrictrad_catalog_order_id';
    const payload: Record<string, unknown> = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `${paymentOrder.kind === 'bulk' ? 'FTB' : 'FTC'}-${paymentOrder.id.replace(/-/g, '').slice(0, 24)}`,
      notes: { [notesKey]: paymentOrder.id, order_kind: paymentOrder.kind },
    };

    if (seller?.settlement_eligible && seller.razorpay_linked_account_id && sellerPayable > 0) {
      payload.transfers = [
        {
          account: seller.razorpay_linked_account_id,
          amount: Math.round(sellerPayable * 100),
          currency: 'INR',
          notes: { [notesKey]: paymentOrder.id },
          on_hold: 0,
        },
      ];
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const razorpayOrder = await razorpay.orders.create(
      payload as unknown as Parameters<typeof razorpay.orders.create>[0]
    );

    const paymentValues = {
      [orderColumn]: paymentOrder.id,
      razorpay_order_id: razorpayOrder.id,
      amount,
      currency: 'INR',
      status: 'initiated',
      platform_commission: platformCommission,
      razorpay_fee: razorpayFee,
      gst_on_commission: gstOnCommission,
      seller_payable: sellerPayable,
    };
    const { error: paymentError } = await admin.from(paymentTable).insert(paymentValues);

    if (paymentError) {
      console.error('Failed to persist Razorpay order:', paymentError.message);
      return NextResponse.json(
        { success: false, error: 'Unable to initialize payment safely.' },
        { status: 500 }
      );
    }

    if (paymentOrder.kind === 'catalog') {
      await admin
        .from('catalog_order_requests')
        .update({ payment_due_at: new Date().toISOString() })
        .eq('id', paymentOrder.id)
        .eq('status', 'accepted');
    }

    return NextResponse.json({
      success: true,
      orderId: razorpayOrder.id,
      fabrictradOrderId: paymentOrder.id,
      orderKind: paymentOrder.kind,
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
