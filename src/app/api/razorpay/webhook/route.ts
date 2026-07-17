import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    // Verify webhook signature
    if (webhookSecret) {
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      if (
        !crypto.timingSafeEqual(
          Buffer.from(expectedSig),
          Buffer.from(signature)
        )
      ) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    }

    const event = JSON.parse(body);
    const eventType = event.event;
    const paymentEntity = event?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;

    // Idempotent processing — log event type
    console.log(`[Razorpay Webhook] Event: ${eventType}, Order: ${orderId}, Payment: ${paymentId}`);

    switch (eventType) {
      case 'payment.captured': // TODO: Update order status to'paid' in Supabase
        // TODO: Trigger Shiprocket order creation
        // TODO: Record in payment_ledger
        console.log(`[Webhook] Payment captured: ${paymentId} for order ${orderId}`);
        break;

      case 'payment.failed': // TODO: Update order status to'awaiting_payment' with failure reason
        console.log(`[Webhook] Payment failed: ${paymentId} for order ${orderId}`);
        break;

      case 'refund.processed':
        // TODO: Update refund record in Supabase
        console.log(`[Webhook] Refund processed for payment: ${paymentId}`);
        break;

      case 'transfer.processed':
        // TODO: Update seller_transfers / payment_ledger transfer_status
        console.log(`[Webhook] Transfer processed`);
        break;

      default:
        console.log(`[Webhook] Unhandled event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('[Webhook] Processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
