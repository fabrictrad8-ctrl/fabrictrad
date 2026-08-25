import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const body = await req.json();
    const { type, to, orderRef, buyerName, sellerName, status, amount } = body;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    let subject = "";
    let html = "";
    let text = "";

    if (type === "buyer_order_status") {
      const statusLabels: Record<string, string> = {
        confirmed: "✅ Order Confirmed",
        shipped: "🚚 Order Shipped",
        delivered: "📦 Order Delivered",
      };
      const statusMessages: Record<string, string> = {
        confirmed: `Your order <strong>${orderRef}</strong> has been confirmed by the seller. We'll notify you when it ships.`,
        shipped: `Great news! Your order <strong>${orderRef}</strong> is on its way. Track your shipment in the Buyer Dashboard.`,
        delivered: `Your order <strong>${orderRef}</strong> has been delivered. We hope you love your fabric! Leave a review to help other buyers.`,
      };
      subject = `FabricTrad: ${statusLabels[status] || "Order Update"} — ${orderRef}`;
      const message = statusMessages[status] || `Your order ${orderRef} has been updated.`;
      html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
          <div style="margin-bottom:20px;">
            <img src="https://fabrictrad4892.builtwithrocket.new/assets/images/app_logo.png" alt="FabricTrad" style="height:36px;" />
          </div>
          <h2 style="color:#111827;font-size:18px;margin:0 0 8px;">${statusLabels[status] || "Order Update"}</h2>
          <p style="color:#6b7280;font-size:14px;margin:0 0 16px;">Hi ${buyerName || "there"},</p>
          <p style="color:#374151;font-size:14px;margin:0 0 20px;">${message}</p>
          ${amount ? `<div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:20px;"><p style="margin:0;font-size:13px;color:#6b7280;">Order Value</p><p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#111827;">₹${Number(amount).toLocaleString('en-IN')}</p></div>` : ""}
          <a href="https://fabrictrad4892.builtwithrocket.new/buyer-dashboard" style="display:inline-block;background:#008060;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">View Order</a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;">FabricTrad · India's Textile Commerce Platform</p>
        </div>
      `;
      text = `${statusLabels[status] || "Order Update"} — ${orderRef}\n\n${message}\n\nView your order: https://fabrictrad4892.builtwithrocket.new/buyer-dashboard`;
    } else if (type === "seller_new_order") {
      subject = `FabricTrad: 🛒 New Order Received — ${orderRef}`;
      html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
          <div style="margin-bottom:20px;">
            <img src="https://fabrictrad4892.builtwithrocket.new/assets/images/app_logo.png" alt="FabricTrad" style="height:36px;" />
          </div>
          <h2 style="color:#111827;font-size:18px;margin:0 0 8px;">🛒 New Order Arrived!</h2>
          <p style="color:#6b7280;font-size:14px;margin:0 0 16px;">Hi ${sellerName || "there"},</p>
          <p style="color:#374151;font-size:14px;margin:0 0 20px;">You have received a new order <strong>${orderRef}</strong>. Please review and confirm it within 24 hours to avoid auto-cancellation.</p>
          ${amount ? `<div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;margin-bottom:20px;border:1px solid #bbf7d0;"><p style="margin:0;font-size:13px;color:#166534;">Order Value</p><p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#111827;">₹${Number(amount).toLocaleString('en-IN')}</p></div>` : ""}
          <a href="https://fabrictrad4892.builtwithrocket.new/seller-dashboard" style="display:inline-block;background:#008060;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">Manage Order</a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;">FabricTrad · India's Textile Commerce Platform</p>
        </div>
      `;
      text = `New Order Received — ${orderRef}\n\nYou have a new order. Please confirm it within 24 hours.\n\nManage orders: https://fabrictrad4892.builtwithrocket.new/seller-dashboard`;
    } else {
      throw new Error(`Unknown notification type: ${type}`);
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`);
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
