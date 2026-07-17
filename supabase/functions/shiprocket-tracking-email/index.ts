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
    const { event, order, tracking } = body;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    // Build email content based on tracking event type
    const eventTemplates: Record<string, { subject: string; headline: string; color: string; icon: string }> = {
      picked_up: {
        subject: `📦 Your order ${order?.id} has been picked up`,
        headline: "Your order has been picked up!",
        color: "#1B2B5E",
        icon: "📦",
      },
      in_transit: {
        subject: `🚚 Your order ${order?.id} is on its way`,
        headline: "Your order is in transit",
        color: "#C8600A",
        icon: "🚚",
      },
      out_for_delivery: {
        subject: `🏃 Your order ${order?.id} is out for delivery today`,
        headline: "Out for delivery today!",
        color: "#16a34a",
        icon: "🏃",
      },
      delivered: {
        subject: `✅ Your order ${order?.id} has been delivered`,
        headline: "Order delivered successfully!",
        color: "#16a34a",
        icon: "✅",
      },
      delayed: {
        subject: `⚠️ Your order ${order?.id} is delayed`,
        headline: "Your order has been delayed",
        color: "#d97706",
        icon: "⚠️",
      },
      exception: {
        subject: `❗ Delivery issue with your order ${order?.id}`,
        headline: "There's an issue with your delivery",
        color: "#dc2626",
        icon: "❗",
      },
      delivery_failed: {
        subject: `❌ Delivery attempt failed for order ${order?.id}`,
        headline: "Delivery attempt was unsuccessful",
        color: "#dc2626",
        icon: "❌",
      },
      rto: {
        subject: `↩️ Your order ${order?.id} is being returned`,
        headline: "Order is being returned to origin",
        color: "#7c3aed",
        icon: "↩️",
      },
    };

    const template = eventTemplates[event] || {
      subject: `Update on your order ${order?.id}`,
      headline: "Shipment status update",
      color: "#1B2B5E",
      icon: "📋",
    };

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:${template.color};padding:24px 32px;text-align:center;">
              <p style="margin:0;font-size:28px;">${template.icon}</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:800;">FabricTrad</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">B2B Textile Marketplace</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#111827;font-size:18px;font-weight:800;">${template.headline}</h2>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Hi ${order?.buyerName || "Valued Customer"},</p>

              <!-- Order Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="color:#6b7280;font-size:12px;">Order ID</span><br>
                          <span style="color:#111827;font-size:14px;font-weight:700;">${order?.id || "—"}</span>
                        </td>
                        <td style="padding:4px 0;text-align:right;">
                          <span style="color:#6b7280;font-size:12px;">AWB Number</span><br>
                          <span style="color:#111827;font-size:14px;font-weight:700;">${tracking?.awb || "—"}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="color:#6b7280;font-size:12px;">Courier</span><br>
                          <span style="color:#111827;font-size:14px;font-weight:700;">${tracking?.courier || "Shiprocket"}</span>
                        </td>
                        <td style="padding:4px 0;text-align:right;">
                          <span style="color:#6b7280;font-size:12px;">Status</span><br>
                          <span style="color:${template.color};font-size:14px;font-weight:700;">${tracking?.status || event}</span>
                        </td>
                      </tr>
                      ${tracking?.location ? `
                      <tr>
                        <td colspan="2" style="padding:4px 0;">
                          <span style="color:#6b7280;font-size:12px;">Last Location</span><br>
                          <span style="color:#111827;font-size:14px;font-weight:700;">${tracking.location}</span>
                        </td>
                      </tr>` : ""}
                      ${tracking?.eta ? `
                      <tr>
                        <td colspan="2" style="padding:4px 0;">
                          <span style="color:#6b7280;font-size:12px;">Estimated Delivery</span><br>
                          <span style="color:#16a34a;font-size:14px;font-weight:700;">${tracking.eta}</span>
                        </td>
                      </tr>` : ""}
                    </table>
                  </td>
                </tr>
              </table>

              ${tracking?.message ? `<p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px;">${tracking.message}</p>` : ""}

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://fabrictrad4892.builtwithrocket.new/buyer-dashboard" style="display:inline-block;background:${template.color};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;">Track Your Order</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">FabricTrad · B2B Textile Marketplace</p>
              <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">No returns. Exchange within 24hrs with unboxing video. No COD.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [order?.buyerEmail || "buyer@example.com"],
        subject: template.subject,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(emailResult)}`);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id, event }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
