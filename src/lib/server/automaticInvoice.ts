import type { SupabaseClient } from '@supabase/supabase-js';

type InvoiceKind = 'catalog' | 'bulk';

type InvoiceLine = {
  description?: string;
  sku?: string;
  hsnCode?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  taxableValue?: number;
  gstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  lineTotal?: number;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  catalog_order_id: string | null;
  bulk_order_id: string | null;
  supplier: Record<string, unknown>;
  recipient: Record<string, unknown>;
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  total_tax: number;
  total_amount: number;
  payment_reference: string;
  payment_captured_at: string | null;
  email_status: string;
  email_recipient: string | null;
};

type AutomaticInvoiceInput = {
  admin: SupabaseClient;
  kind: InvoiceKind;
  orderId: string;
  paymentId: string;
  capturedAt?: string | null;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const money = (value: unknown) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const invoiceUrl = (invoiceId: string) => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://fabrictrad.com').replace(/\/$/, '');
  return `${base}/api/invoices/${invoiceId}`;
};

const emailApiKey = () => {
  const direct = process.env.RESEND_API_KEY?.trim();
  if (direct) return direct;
  const smtpPassword = process.env.SMTP_PASSWORD?.trim();
  return smtpPassword?.startsWith('re_') ? smtpPassword : '';
};

function buildInvoiceEmail(invoice: InvoiceRow) {
  const supplier = invoice.supplier || {};
  const recipient = invoice.recipient || {};
  const rows = (Array.isArray(invoice.lines) ? invoice.lines : [])
    .map(
      (line) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #ececec;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#222222;">${escapeHtml(line.description || 'Item')}<br><span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;color:#777777;">SKU ${escapeHtml(line.sku || '—')} · HSN ${escapeHtml(line.hsnCode || '—')}</span></td>
          <td style="padding:10px;border-bottom:1px solid #ececec;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#222222;">${escapeHtml(line.quantity || 0)} ${escapeHtml(line.unit || '')}</td>
          <td style="padding:10px;border-bottom:1px solid #ececec;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#222222;">${money(line.lineTotal ?? line.taxableValue ?? 0)}</td>
        </tr>`
    )
    .join('');
  const openUrl = invoiceUrl(invoice.id);
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head>
<body style="margin:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f4"><tr><td align="center" style="padding-top:24px;padding-right:12px;padding-bottom:24px;padding-left:12px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td bgcolor="#c85c0b" style="background-color:#c85c0b;padding-top:22px;padding-right:24px;padding-bottom:22px;padding-left:24px;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#ffffff;font-weight:bold;letter-spacing:1px;">FABRICTRAD</p><p style="margin-top:6px;margin-right:0;margin-bottom:0;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:32px;color:#ffffff;font-weight:bold;">Payment captured · invoice issued</p></td></tr>
<tr><td style="padding-top:24px;padding-right:24px;padding-bottom:24px;padding-left:24px;">
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#333333;">Hi ${escapeHtml(recipient.name || recipient.businessName || 'Buyer')},</p>
<p style="margin-top:10px;margin-right:0;margin-bottom:18px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#555555;">Razorpay has confirmed capture of your payment. Your final FabricTrad invoice has been generated automatically.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#faf7f4" style="background-color:#faf7f4;border-radius:12px;"><tr><td style="padding-top:16px;padding-right:16px;padding-bottom:16px;padding-left:16px;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#777777;">Invoice</p><p style="margin-top:2px;margin-right:0;margin-bottom:8px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;color:#222222;font-weight:bold;">${escapeHtml(invoice.invoice_number)}</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#777777;">Seller: ${escapeHtml(supplier.tradeName || supplier.legalName || 'FabricTrad seller')}</p><p style="margin-top:3px;margin-right:0;margin-bottom:0;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#777777;">Razorpay payment: ${escapeHtml(invoice.payment_reference)}</p></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;"><tr><td style="padding:10px;border-bottom:1px solid #dddddd;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#777777;font-weight:bold;">Item</td><td style="padding:10px;border-bottom:1px solid #dddddd;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#777777;font-weight:bold;">Qty</td><td style="padding:10px;border-bottom:1px solid #dddddd;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#777777;font-weight:bold;">Amount</td></tr>${rows}</table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;"><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#666666;">Taxable value</td><td style="text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#333333;">${money(invoice.taxable_value)}</td></tr><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#666666;">CGST</td><td style="text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#333333;">${money(invoice.cgst_amount)}</td></tr><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#666666;">SGST</td><td style="text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#333333;">${money(invoice.sgst_amount)}</td></tr><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#666666;">IGST</td><td style="text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#333333;">${money(invoice.igst_amount)}</td></tr><tr><td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;color:#222222;font-weight:bold;">Total paid</td><td style="padding-top:8px;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;color:#16843d;font-weight:bold;">${money(invoice.total_amount)}</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr><td align="center" bgcolor="#c85c0b" style="background-color:#c85c0b;border-radius:10px;"><a href="${escapeHtml(openUrl)}" style="display:block;padding-top:12px;padding-right:16px;padding-bottom:12px;padding-left:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:bold;">Open printable invoice</a></td></tr></table>
<p style="margin-top:18px;margin-right:0;margin-bottom:0;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#888888;">This invoice was generated from FabricTrad order and Razorpay capture records. Please keep it for your records.</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    `FabricTrad invoice ${invoice.invoice_number}`,
    `Seller: ${String(supplier.tradeName || supplier.legalName || 'FabricTrad seller')}`,
    `Razorpay payment: ${invoice.payment_reference}`,
    `Total paid: ${money(invoice.total_amount)}`,
    `Open invoice: ${openUrl}`,
  ].join('\n');
  return { html, text, openUrl };
}

export async function ensureAutomaticInvoice(input: AutomaticInvoiceInput) {
  const rpc =
    input.kind === 'catalog'
      ? 'issue_paid_catalog_tax_invoice_system'
      : 'issue_paid_bulk_tax_invoice_system';
  const args =
    input.kind === 'catalog'
      ? {
          p_catalog_order_id: input.orderId,
          p_payment_reference: input.paymentId,
          p_payment_captured_at: input.capturedAt || new Date().toISOString(),
        }
      : {
          p_bulk_order_id: input.orderId,
          p_payment_reference: input.paymentId,
          p_payment_captured_at: input.capturedAt || new Date().toISOString(),
        };

  const { data, error } = await input.admin.rpc(rpc, args);
  if (error) {
    console.error('Automatic invoice generation skipped', {
      kind: input.kind,
      orderId: input.orderId,
      code: error.code,
      message: error.message,
    });
    return { invoice: null, emailed: false, error: error.message };
  }

  const invoice = data as InvoiceRow;
  if (!invoice?.id) return { invoice: null, emailed: false, error: 'Invoice generation returned no record.' };
  if (invoice.email_status === 'sent') return { invoice, emailed: true, error: null };

  const recipient = String(invoice.email_recipient || invoice.recipient?.email || '').trim();
  const apiKey = emailApiKey();
  if (!recipient || !apiKey) {
    await input.admin
      .from('seller_tax_invoices')
      .update({
        email_status: 'not_configured',
        email_last_error: !recipient ? 'Buyer email address is unavailable.' : 'Resend API key is not configured in the server runtime.',
        email_attempted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)
      .neq('email_status', 'sent');
    return { invoice, emailed: false, error: !recipient ? 'Buyer email unavailable.' : 'Email service not configured.' };
  }

  const attemptedAt = new Date().toISOString();
  const { data: claim, error: claimError } = await input.admin
    .from('seller_tax_invoices')
    .update({ email_status: 'sending', email_attempted_at: attemptedAt, email_last_error: null, updated_at: attemptedAt })
    .eq('id', invoice.id)
    .neq('email_status', 'sent')
    .or(`email_status.neq.sending,email_attempted_at.lt.${new Date(Date.now() - 180_000).toISOString()}`)
    .select('id').maybeSingle();
  if (claimError || !claim) return { invoice, emailed: false, error: 'Invoice delivery is already in progress or could not be reserved.' };

  const body = buildInvoiceEmail(invoice);
  const from = (process.env.INVOICE_FROM_EMAIL || 'billing@fabrictrad.com').trim();
  const replyTo = process.env.INVOICE_REPLY_TO?.trim();
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `fabrictrad-invoice/${invoice.id}`,
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `FabricTrad invoice ${invoice.invoice_number} · payment received`,
        html: body.html,
        text: body.text,
        ...(replyTo ? { reply_to: [replyTo] } : {}),
        tags: [
          { name: 'type', value: 'invoice' },
          { name: 'invoice_id', value: invoice.id },
        ],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const result = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
    if (!response.ok || !result.id) throw new Error(result.message || result.error || `Resend returned HTTP ${response.status}`);

    const sentAt = new Date().toISOString();
    const { error: receiptError } = await input.admin
      .from('seller_tax_invoices')
      .update({
        email_status: 'sent',
        email_provider_id: result.id,
        email_recipient: recipient,
        email_sent_at: sentAt,
        email_last_error: null,
        updated_at: sentAt,
      })
      .eq('id', invoice.id);
    if (receiptError) throw new Error('Email provider accepted the invoice, but its receipt could not be saved. Retry uses the same invoice identifier.');
    return { invoice: { ...invoice, email_status: 'sent', email_provider_id: result.id }, emailed: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invoice email delivery failed.';
    await input.admin
      .from('seller_tax_invoices')
      .update({ email_status: 'failed', email_last_error: message.slice(0, 1000), updated_at: new Date().toISOString() })
      .eq('id', invoice.id)
      .neq('email_status', 'sent');
    console.error('Automatic invoice email failed', { invoiceId: invoice.id, message });
    return { invoice, emailed: false, error: message };
  }
}
