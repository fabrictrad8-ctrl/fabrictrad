import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

const esc = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const money = (value: unknown) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await context.params;
  if (!invoiceId) return NextResponse.json({ error: 'Invoice reference is required.' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/invoices/${invoiceId}`)}`, _request.url));

  const { data: invoice, error } = await supabase
    .from('seller_tax_invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle();
  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found or access is not permitted.' }, { status: 404 });

  const supplier = (invoice.supplier || {}) as Record<string, unknown>;
  const recipient = (invoice.recipient || {}) as Record<string, unknown>;
  const delivery = (invoice.delivery_address || {}) as Record<string, unknown>;
  const lines = (Array.isArray(invoice.lines) ? invoice.lines : []) as InvoiceLine[];
  const lineRows = lines
    .map(
      (line) => `<tr><td>${esc(line.description || 'Item')}<small>SKU ${esc(line.sku || '—')} · HSN ${esc(line.hsnCode || '—')}</small></td><td class="num">${esc(line.quantity || 0)} ${esc(line.unit || '')}</td><td class="num">${money(line.unitPrice || 0)}</td><td class="num">${esc(line.gstRate || 0)}%</td><td class="num">${money(line.lineTotal ?? line.taxableValue ?? 0)}</td></tr>`
    )
    .join('');
  const orderRef = invoice.catalog_order_id
    ? `FT-CAT-${String(invoice.catalog_order_id).slice(0, 8).toUpperCase()}`
    : `FT-BULK-${String(invoice.bulk_order_id || '').slice(0, 8).toUpperCase()}`;
  const issued = new Date(invoice.issued_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const captured = invoice.payment_captured_at
    ? new Date(invoice.payment_captured_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(invoice.invoice_number)} · FabricTrad</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f2f2f2;color:#20202b;font:14px/1.5 Arial,Helvetica,sans-serif}.page{max-width:980px;margin:32px auto;background:#fff;border:1px solid #ddd;border-radius:18px;padding:34px}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #c85c0b;padding-bottom:20px}.brand{font-weight:800;color:#c85c0b;letter-spacing:.08em}.title{font-size:30px;font-weight:800;margin:5px 0}.muted{color:#666}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:24px}.box{border:1px solid #e5e5e5;border-radius:12px;padding:16px}.box h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#777;margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:12px;border-bottom:1px solid #e8e8e8;text-align:left}th{font-size:11px;text-transform:uppercase;color:#777;background:#fafafa}.num{text-align:right}small{display:block;color:#777;margin-top:3px}.totals{width:min(420px,100%);margin:24px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:5px 0}.total{font-size:18px;font-weight:800;border-top:2px solid #222;margin-top:5px;padding-top:10px!important}.paid{display:inline-block;background:#eaf8ef;color:#16843d;border-radius:999px;padding:6px 10px;font-weight:700}.actions{display:flex;gap:10px;margin-top:28px}.actions button{border:0;border-radius:10px;padding:11px 16px;font-weight:700;cursor:pointer}.print{background:#c85c0b;color:#fff}.back{background:#eee;color:#222}@media(max-width:700px){.page{margin:0;border:0;border-radius:0;padding:20px}.top,.grid{display:block}.top>div+div,.grid>.box+ .box{margin-top:16px}th:nth-child(3),td:nth-child(3){display:none}}@media print{body{background:#fff}.page{margin:0;max-width:none;border:0;border-radius:0;padding:0}.actions{display:none}}
  </style></head><body><main class="page"><div class="top"><div><div class="brand">FABRICTRAD</div><div class="title">Tax Invoice</div><div class="muted">${esc(invoice.invoice_number)}</div></div><div><span class="paid">Payment captured</span><div class="muted" style="margin-top:10px">Issued ${esc(issued)}<br>Order ${esc(orderRef)}</div></div></div>
  <div class="grid"><section class="box"><h2>Supplier</h2><strong>${esc(supplier.tradeName || supplier.legalName || '')}</strong><br>${esc(supplier.legalName || '')}<br>GSTIN: ${esc(supplier.gstin || '—')}<br>${esc((supplier.address as Record<string, unknown> | undefined)?.addressLine1 || (supplier.address as Record<string, unknown> | undefined)?.line1 || '')}</section><section class="box"><h2>Bill to</h2><strong>${esc(recipient.businessName || recipient.name || '')}</strong><br>${esc(recipient.name || '')}<br>GSTIN: ${esc(recipient.gstin || '—')}<br>${esc(recipient.addressLine1 || '')} ${esc(recipient.addressLine2 || '')}<br>${esc(recipient.city || '')}, ${esc(recipient.state || '')} ${esc(recipient.pincode || '')}</section></div>
  <section class="box" style="margin-top:18px"><h2>Delivery & payment</h2>Place of supply: ${esc(invoice.place_of_supply || recipient.state || '—')}<br>Delivery: ${esc(delivery.addressLine1 || '')} ${esc(delivery.addressLine2 || '')}, ${esc(delivery.city || '')}, ${esc(delivery.state || '')} ${esc(delivery.pincode || '')}<br>Razorpay payment: ${esc(invoice.payment_reference)}<br>Captured: ${esc(captured)}</section>
  <table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">GST</th><th class="num">Amount</th></tr></thead><tbody>${lineRows}</tbody></table>
  <div class="totals"><div><span>Taxable value</span><strong>${money(invoice.taxable_value)}</strong></div><div><span>CGST</span><strong>${money(invoice.cgst_amount)}</strong></div><div><span>SGST</span><strong>${money(invoice.sgst_amount)}</strong></div><div><span>IGST</span><strong>${money(invoice.igst_amount)}</strong></div><div><span>Total tax</span><strong>${money(invoice.total_tax)}</strong></div><div class="total"><span>Total paid</span><span>${money(invoice.total_amount)}</span></div></div>
  <p class="muted" style="margin-top:24px">Generated automatically by FabricTrad after server-side confirmation that the Razorpay payment was captured. This invoice remains accessible to the buyer, seller and authorised FabricTrad administrators.</p>
  <div class="actions"><button class="print" onClick="window.print()">Print / Save PDF</button><button class="back" onClick="history.back()">Back</button></div></main></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'self'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
