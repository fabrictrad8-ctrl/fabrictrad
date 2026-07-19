import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const {
      amount,
      currency = 'INR',
      receipt,
      orderId,
      sellerLinkedAccountId,
      sellerAmount,
      demoAccount,
    } = await request.json();

    if (demoAccount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Demo accounts cannot create real Razorpay orders.',
        },
        { status: 403 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }

    // Build transfers for Razorpay Route if seller linked account exists
    const transfers =
      sellerLinkedAccountId && sellerAmount
        ? [
            {
              account: sellerLinkedAccountId,
              amount: Math.round(sellerAmount * 100), // in paisa
              currency: 'INR',
              notes: {
                order_id: orderId || receipt || '',
                description: 'Seller payout after commission deduction',
              },
              on_hold: 0,
            },
          ]
        : undefined;

    const orderPayload: Record<string, unknown> = {
      amount: Math.round(amount * 100), // in paisa
      currency,
      receipt: receipt || `FT-ORD-${Date.now()}`,
    };

    if (transfers) {
      orderPayload.transfers = transfers;
    }

    const order = await razorpay.orders.create(
      orderPayload as unknown as Parameters<typeof razorpay.orders.create>[0]
    );

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: unknown) {
    console.error('Razorpay order creation failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to create order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
