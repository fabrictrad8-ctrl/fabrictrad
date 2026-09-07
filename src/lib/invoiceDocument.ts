import QRCode from 'qrcode';
import type { InvoiceParty, SellerTaxInvoice } from '@/lib/sellerTaxInvoice';

export const escapeInvoiceHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const esc = escapeInvoiceHtml;
const money = (value: unknown) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(value || 0));
const date = (value?: string | null) => value && Number.isFinite(new Date(value).getTime())
  ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value)) + ' IST' : '—';

export function invoiceDocumentTitle(invoice: Pick<SellerTaxInvoice, 'document_type'>) {
  return invoice.document_type === 'payment_receipt' ? 'Payment receipt'
    : invoice.document_type === 'bill_of_supply' ? 'Bill of supply' : 'Tax invoice';
}

function address(party: InvoiceParty) {
  const nested = party.address || {};
  return [party.addressLine1 || nested.addressLine1 || nested.address_line1 || nested.line1,
    party.addressLine2 || nested.addressLine2 || nested.address_line2 || nested.line2,
    party.city || nested.city, party.state || nested.state,
    party.pincode || nested.pincode || nested.postalCode || nested.postal_code]
    .filter(Boolean).map(esc).join(', ');
}
function partyBlock(title: string, party: InvoiceParty) {
  return `<section class="box"><h2>${title}</h2><strong>${esc(party.legalName || party.businessName || party.name || party.tradeName || '—')}</strong>
    ${party.tradeName && party.tradeName !== party.legalName ? `<div>${esc(party.tradeName)}</div>` : ''}
    <div>${address(party) || 'Address not supplied'}</div><div>GSTIN: ${esc(party.gstin || 'Unregistered')}</div>
    <div>${esc(party.email || '')}</div><div>${esc(party.phone || '')}</div></section>`;
}

/** Single renderer for emailed links and every buyer, seller and admin print action. */
export async function renderInvoiceDocument(invoice: SellerTaxInvoice) {
  const title = invoiceDocumentTitle(invoice);
  const receipt = invoice.document_type === 'payment_receipt';
  const meta = invoice.document_metadata || {};
  const orderId = invoice.catalog_order_id || invoice.bulk_order_id || invoice.bespoke_order_id || '';
  const orderPrefix = invoice.catalog_order_id ? 'FT-CAT' : invoice.bulk_order_id ? 'FT-BULK' : 'FT-CUSTOM';
  const references = meta.paymentReferences?.length ? meta.paymentReferences : [invoice.payment_reference];
  const rows = (invoice.lines || []).map((line, i) => `<tr><td>${i + 1}</td><td><strong>${esc(line.description || 'Item')}</strong>
    <small>HSN/SAC: ${esc(line.hsnCode || '—')}${line.sku ? ` · SKU: ${esc(line.sku)}` : ''}</small></td>
    <td class="num">${esc(line.quantity || 0)} ${esc(line.unit || '')}</td><td class="num">${money(line.unitPrice)}</td>
    <td class="num">${receipt && !meta.taxOnAdvance ? '—' : money(line.taxableValue)}</td>
    <td class="num">${receipt && !meta.taxOnAdvance ? '—' : `${esc(line.gstRate || 0)}%`}
    <small>CGST ${money(line.cgstAmount)}<br>SGST ${money(line.sgstAmount)}<br>IGST ${money(line.igstAmount)}${Number(line.cessAmount) ? `<br>Cess ${money(line.cessAmount)}` : ''}</small></td>
    <td class="num">${money(line.lineTotal ?? line.taxableValue)}</td></tr>`).join('');
  let qr = '';
  if (invoice.e_invoice_applicable && invoice.signed_qr_data) {
    try { qr = await QRCode.toString(invoice.signed_qr_data, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 180 }); }
    catch { qr = '<p>Signed QR could not be rendered. Obtain the original registered invoice from the seller.</p>'; }
  }
  const totalRows = (receipt && !meta.taxOnAdvance ? [] : [
    ['Subtotal', invoice.subtotal], ['Discount', invoice.discount], ['Taxable value', invoice.taxable_value],
    ['CGST', invoice.cgst_amount], ['SGST / UTGST', invoice.sgst_amount], ['IGST', invoice.igst_amount],
    ['Cess', invoice.cess_amount], ['Total tax', invoice.total_tax],
  ]).map(([label, value]) => `<div><span>${label}</span><strong>${money(value)}</strong></div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(invoice.invoice_number)} · ${title} · FabricTrad</title><style>
  @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#f7f5ef;color:#172b3a;font:13px/1.5 Arial,sans-serif}.page{max-width:1000px;margin:24px auto;background:white;padding:30px;border:1px solid #ddd;border-radius:14px}h1,p{margin:0}h1{font-size:28px}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #bc581b;padding-bottom:18px}.brand{font-weight:800;letter-spacing:.12em;color:#9d4314}.muted,small{color:#52616b}small{display:block;font-size:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}.box{border:1px solid #d7dcdf;padding:14px;border-radius:8px;overflow-wrap:anywhere}.box h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:9px 6px;border:1px solid #d7dcdf;vertical-align:top}th{background:#f3f5f5;text-align:left}.num{text-align:right}.totals{max-width:360px;margin:18px 0 18px auto}.totals div{display:flex;justify-content:space-between;gap:16px;padding:4px 0}.grand{font-weight:800;font-size:17px;border-top:2px solid #172b3a;padding-top:9px!important}.notice{background:#fff6e7;border-left:3px solid #bc581b;padding:12px;margin-top:16px}.void{color:#b42318;font-size:20px;font-weight:800}.actions{display:flex;gap:10px;margin-top:20px}button{cursor:pointer;border:0;border-radius:8px;padding:12px 18px;background:#172b3a;color:white;font-weight:700}.qr svg{max-width:180px;height:auto}.references{overflow-wrap:anywhere}.signature{margin-top:20px;border-top:1px solid #d7dcdf;padding-top:12px}.box,.totals,.notice{break-inside:avoid}
  @media(max-width:650px){.page{margin:0;padding:16px;border:0;border-radius:0}.grid{grid-template-columns:1fr}.top{display:block}.top>div+div{margin-top:12px}table{min-width:650px}}
  @media print{body{background:white}.page{padding:0;margin:0;border:0;max-width:none}.actions{display:none}.grid{grid-template-columns:1fr 1fr}.top{display:flex}.table-wrap{overflow:visible}table{min-width:0;font-size:9px}th,td{padding:5px}thead{display:table-header-group}tr{break-inside:avoid}small{font-size:8px}}
  </style></head><body><main class="page"><header class="top"><div><div class="brand">FABRICTRAD</div><h1>${title}</h1><strong>${esc(invoice.invoice_number)}</strong>${invoice.status === 'void' ? '<div class="void">VOID — do not use this document</div>' : ''}</div>
  <div>Issued: ${date(invoice.issued_at)}<br>Order: ${orderPrefix}-${esc(orderId.slice(0, 8).toUpperCase())}<br>Currency: INR</div></header>
  <div class="grid">${partyBlock('Supplier', invoice.supplier || {})}${partyBlock('Recipient / Bill to', invoice.recipient || {})}
  <section class="box"><h2>Ship to</h2>${address(invoice.delivery_address || {}) || address(invoice.recipient || {}) || 'See delivery instructions'}<br>Place of supply: ${esc(invoice.place_of_supply || '—')}</section>
  <section class="box"><h2>Payment & supply</h2>Reverse charge: ${invoice.reverse_charge ? 'Yes' : 'No'}<br>Captured: ${date(invoice.payment_captured_at)}<br><span class="references">Razorpay: ${references.map(esc).join(', ')}</span></section></div>
  <div class="table-wrap"><table><thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Taxable</th><th class="num">GST</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="totals">${totalRows}<div class="grand"><span>${receipt ? 'Payment received' : 'Invoice total'}</span><span>${money(invoice.total_amount)}</span></div>
  ${receipt ? `<div><span>Order quotation</span><strong>${money(meta.quotedAmount)}</strong></div><div><span>Balance at issue</span><strong>${money(meta.balanceAtIssue)}</strong></div>` : ''}</div>
  <div class="notice">${receipt
    ? `This ${esc(meta.paymentPurpose || '')} payment receipt records one captured payment. ${meta.taxOnAdvance ? 'Service advance GST is shown above and must be adjusted against the final invoice.' : 'Any applicable GST is accounted for on the final invoice.'} The final order invoice includes all advances and balance payments; it is not an additional charge.`
    : 'This document records the full seller order value. The FabricTrad commission is settled separately with the seller and does not reduce your invoice value. Refunds and credit notes are recorded separately; this issued document remains unchanged.'}</div>
  ${invoice.e_invoice_applicable ? `<section class="box" style="margin-top:16px"><h2>Registered e-invoice</h2><div class="references">IRN: ${esc(invoice.irn || 'Required')}<br>Acknowledgement: ${esc(invoice.acknowledgement_number || '—')}<br>Date: ${date(invoice.acknowledgement_date)}</div><div class="qr">${qr}</div></section>` : ''}
  <p class="signature">For ${esc(invoice.supplier?.legalName || invoice.supplier?.tradeName || 'the supplier')}<br><span class="muted">Computer-generated document from the seller order and verified payment record. No handwritten signature is displayed.</span></p>
  <div class="actions"><button onclick="window.print()">Print / Save PDF</button><button onclick="history.back()">Back</button></div></main></body></html>`;
}
