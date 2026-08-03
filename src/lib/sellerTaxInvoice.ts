export type InvoiceParty = {
  legalName?: string | null;
  tradeName?: string | null;
  name?: string | null;
  businessName?: string | null;
  gstin?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: Record<string, unknown> | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
};

export type SellerTaxInvoiceLine = {
  description?: string | null;
  sku?: string | null;
  hsnCode?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  taxableValue?: number | null;
  gstRate?: number | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  cessAmount?: number | null;
  lineTotal?: number | null;
};

export type SellerTaxInvoice = {
  id: string;
  invoice_number: string;
  issued_at: string;
  status: 'issued' | 'void';
  supplier: InvoiceParty;
  recipient: InvoiceParty;
  delivery_address: InvoiceParty;
  place_of_supply?: string | null;
  reverse_charge: boolean;
  lines: SellerTaxInvoiceLine[];
  subtotal: number;
  discount: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  total_tax: number;
  total_amount: number;
  currency: 'INR';
  payment_reference: string;
  payment_captured_at?: string | null;
  e_invoice_applicable: boolean;
  irn?: string | null;
  acknowledgement_number?: string | null;
  acknowledgement_date?: string | null;
  signed_qr_data?: string | null;
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
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '—';

function flattenAddress(party: InvoiceParty) {
  const nested = party.address || {};
  return [
    party.addressLine1 || nested.addressLine1 || nested.address_line1 || nested.line1,
    party.addressLine2 || nested.addressLine2 || nested.address_line2 || nested.line2,
    party.city || nested.city,
    party.state || nested.state,
    party.pincode || nested.pincode || nested.postalCode,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(', ');
}

export function openPrintableSellerTaxInvoice(invoice: SellerTaxInvoice) {
  if (typeof window === 'undefined') return;
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) throw new Error('Allow pop-ups to print or save the seller GST invoice.');

  const supplierName =
    invoice.supplier.legalName || invoice.supplier.tradeName || invoice.supplier.name || 'Seller';
  const recipientName =
    invoice.recipient.businessName || invoice.recipient.name || invoice.recipient.legalName || 'Buyer';
  const rows = (invoice.lines || [])
    .map(
      (line, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(line.description || 'Textile goods')}</strong><br/><small>${escapeHtml(
            line.sku ? `SKU ${line.sku}` : ''
          )}</small></td>
          <td>${escapeHtml(line.hsnCode || '—')}</td>
          <td class="num">${Number(line.quantity || 0).toLocaleString('en-IN')} ${escapeHtml(
            line.unit || ''
          )}</td>
          <td class="num">${money(line.unitPrice)}</td>
          <td class="num">${money(line.taxableValue)}</td>
          <td class="num">${Number(line.gstRate || 0).toLocaleString('en-IN')}%</td>
          <td class="num">${money(
            Number(line.cgstAmount || 0) +
              Number(line.sgstAmount || 0) +
              Number(line.igstAmount || 0) +
              Number(line.cessAmount || 0)
          )}</td>
          <td class="num">${money(line.lineTotal)}</td>
        </tr>`
    )
    .join('');

  popup.document.write(`<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(invoice.invoice_number)} · GST Tax Invoice</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1f2937; font: 12px/1.5 Arial, sans-serif; }
  h1,h2,p { margin: 0; }
  .top { display:flex; justify-content:space-between; gap:24px; border-bottom:3px solid #c8600a; padding-bottom:14px; }
  .brand { font-size:24px; font-weight:800; color:#c8600a; }
  .title { text-align:right; }
  .title h1 { font-size:22px; }
  .muted { color:#6b7280; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px; }
  .box { border:1px solid #d1d5db; border-radius:8px; padding:12px; min-height:120px; }
  .box h2 { margin-bottom:6px; font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6b7280; }
  table { width:100%; border-collapse:collapse; margin-top:14px; }
  th,td { border:1px solid #d1d5db; padding:7px; vertical-align:top; }
  th { background:#f3f4f6; text-align:left; font-size:10px; text-transform:uppercase; }
  .num { text-align:right; white-space:nowrap; }
  .totals { width:360px; margin:14px 0 0 auto; }
  .totals div { display:flex; justify-content:space-between; padding:4px 0; }
  .totals .grand { margin-top:5px; border-top:2px solid #111827; padding-top:8px; font-size:15px; font-weight:800; }
  .foot { margin-top:18px; display:grid; grid-template-columns:1.4fr .6fr; gap:18px; }
  .notice { border:1px solid #fed7aa; background:#fff7ed; border-radius:8px; padding:10px; }
  .signature { min-height:85px; border-top:1px solid #9ca3af; padding-top:7px; align-self:end; text-align:center; }
  .void { color:#b91c1c; font-weight:800; }
  @media print { .actions { display:none; } }
</style></head><body>
<div class="actions" style="margin-bottom:12px"><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="top">
  <div><div class="brand">FabricTrad</div><p class="muted">Seller-issued tax document</p></div>
  <div class="title"><h1>GST TAX INVOICE</h1><p><strong>${escapeHtml(
    invoice.invoice_number
  )}</strong></p><p>Date: ${date(invoice.issued_at)}</p>${
    invoice.status === 'void' ? '<p class="void">VOID</p>' : ''
  }</div>
</div>
<div class="grid">
  <section class="box"><h2>Supplier</h2><p><strong>${escapeHtml(supplierName)}</strong></p><p>${flattenAddress(
    invoice.supplier
  ) || 'Address not supplied'}</p><p>GSTIN: ${escapeHtml(invoice.supplier.gstin || '—')}</p><p>${escapeHtml(
    invoice.supplier.email || ''
  )}</p></section>
  <section class="box"><h2>Recipient / Bill to</h2><p><strong>${escapeHtml(recipientName)}</strong></p><p>${flattenAddress(
    invoice.recipient
  ) || 'Address not supplied'}</p><p>GSTIN: ${escapeHtml(invoice.recipient.gstin || 'Unregistered')}</p><p>${escapeHtml(
    invoice.recipient.email || ''
  )}</p></section>
  <section class="box"><h2>Ship to</h2><p>${flattenAddress(invoice.delivery_address) || 'Same as billing address'}</p></section>
  <section class="box"><h2>Supply details</h2><p>Place of supply: ${escapeHtml(
    invoice.place_of_supply || '—'
  )}</p><p>Reverse charge: ${invoice.reverse_charge ? 'Yes' : 'No'}</p><p>Payment reference: ${escapeHtml(
    invoice.payment_reference
  )}</p><p>Captured: ${date(invoice.payment_captured_at)}</p></section>
</div>
<table><thead><tr><th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Taxable</th><th>GST</th><th>Tax</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals">
  <div><span>Subtotal</span><strong>${money(invoice.subtotal)}</strong></div>
  <div><span>Discount</span><strong>${money(invoice.discount)}</strong></div>
  <div><span>Taxable value</span><strong>${money(invoice.taxable_value)}</strong></div>
  <div><span>CGST</span><strong>${money(invoice.cgst_amount)}</strong></div>
  <div><span>SGST / UTGST</span><strong>${money(invoice.sgst_amount)}</strong></div>
  <div><span>IGST</span><strong>${money(invoice.igst_amount)}</strong></div>
  <div><span>Cess</span><strong>${money(invoice.cess_amount)}</strong></div>
  <div class="grand"><span>Invoice total</span><span>${money(invoice.total_amount)}</span></div>
</div>
<div class="foot">
  <div class="notice"><strong>Invoice integrity</strong><br/>This invoice was issued from the authenticated seller account and stores an immutable order, tax and payment snapshot. ${
    invoice.e_invoice_applicable
      ? `IRN: ${escapeHtml(invoice.irn || '—')} · Acknowledgement: ${escapeHtml(
          invoice.acknowledgement_number || '—'
        )}`
      : 'Where e-invoicing becomes applicable, the seller must supply the IRN and signed QR data.'
  }</div>
  <div class="signature">For ${escapeHtml(supplierName)}<br/><br/><strong>Authorised signatory</strong></div>
</div>
</body></html>`);
  popup.document.close();
}
