import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, orderId, orderRef, status, amount, buyerEmail, buyerName, sellerEmail, sellerName } = body;

    if (!type || !orderId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    // Insert in-app notification
    if (type === 'buyer_order_status' && buyerEmail) {
      // Get buyer user_id from email
      const { data: profile } = await supabase
        .from('accounts')
        .select('id')
        .eq('email', buyerEmail)
        .single();

      if (profile?.id) {
        const statusMessages: Record<string, string> = {
          confirmed: `Your order ${orderRef} has been confirmed by the seller.`,
          shipped: `Your order ${orderRef} is on its way! Track it in your dashboard.`,
          delivered: `Your order ${orderRef} has been delivered. Leave a review!`,
        };
        await supabase.from('commerce_notifications').insert({
          user_id: profile.id,
          audience: 'buyer',
          type: 'order_status',
          title: `Order ${status === 'confirmed' ? 'Confirmed' : status === 'shipped' ? 'Shipped' : 'Delivered'}`,
          body: statusMessages[status] || `Order ${orderRef} updated.`,
          metadata: { orderId, orderRef, status },
          is_read: false,
        });
      }
    }

    if (type === 'seller_new_order' && sellerEmail) {
      const { data: profile } = await supabase
        .from('accounts')
        .select('id')
        .eq('email', sellerEmail)
        .single();

      if (profile?.id) {
        await supabase.from('commerce_notifications').insert({
          user_id: profile.id,
          audience: 'seller',
          type: 'new_order',
          title: 'New Order Received',
          body: `You have a new order ${orderRef}. Confirm within 24 hours.`,
          metadata: { orderId, orderRef, amount },
          is_read: false,
        });
      }
    }

    // Send email via Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const emailPayload =
        type === 'buyer_order_status'
          ? { type, to: buyerEmail, orderRef, buyerName, status, amount }
          : { type, to: sellerEmail, orderRef, sellerName, amount };

      await fetch(`${supabaseUrl}/functions/v1/order-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(emailPayload),
      }).catch(() => {
        // Email failure is non-blocking
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
