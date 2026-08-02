export type PrintableOrderLine = {
  name: string;
  sku?: string | null;
  quantity: number | string;
  unit?: string | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  hsnCode?: string | null;
  gstRate?: number | null;
};

export type PrintableOrderDocument = {
  documentType: 'order_summary' | 'payment_receipt';
  orderReference: string;
  createdAt?: string | null;
  status?: string | null;
  buyerName?: string | null;
  buyerBusiness?: string | null;
  buyerEmail?: string | null;
  buyerGstin?: string | null;
  sellerName?: string | null;
  sellerGstin?: string | null;
  paymentReference?: string | null;
  paymentMethod?: string | null;
  currency?: string | null;
  subtotal: number;
  discount?: number | null;
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
  gst?: number | null;
  shipping?: number | null;
  total: number;
  lines: PrintableOrderLine[];
  note?: string | null;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>'"]/g, (character) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return map[character] || character;
  });

const money = (value: unknown, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const dateTime = (value?: string | null) => {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return escapeHtml(value);
  return parsed.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const totalRow = (label: string, value: number | null | undefined, strong = false) => {
  if (!value && value !== 0) return '';
  return `<tr>
    <td colspan="4" class="summary-label${strong ? ' strong' : ''}">${escapeHtml(label)}</td>
    <td class="summary-value${strong ? ' strong' : ''}">${money(value)}</td>
  </tr>`;
};

export function openPrintableOrderDocument(document: PrintableOrderDocument) {
  if (typeof window === 'undefined') return;

  const title =
    document.documentType === 'payment_receipt'
      ? 'FabricTrad payment receipt'
      : 'FabricTrad order summary';
  const legalNotice =
    document.documentType === 'payment_receipt'
      ? 'This receipt confirms payment recorded by FabricTrad. It is not the seller’s GST tax invoice. Download the seller-issued tax invoice from the order when it becomes available.'
      : 'This document is an order summary and is not a GST tax invoice. The seller issues the final tax invoice after the order reaches the applicable billing stage.';
  const currency = document.currency || 'INR';

  const lines = document.lines.length
    ? document.lines
        .map(
          (line, index) => `<tr>
            <td>${index + 1}</td>
            <td>
              <div class="item-name">${escapeHtml(line.name)}</div>
              ${line.sku ? `<div class="muted">SKU: ${escapeHtml(line.sku)}</div>` : ''}
              ${line.hsnCode ? `<div class="muted">HSN: ${escapeHtml(line.hsnCode)}</div>` : ''}
            </td>
            <td>${escapeHtml(line.quantity)} ${escapeHtml(line.unit || '')}</td>
            <td>${line.unitPrice != null ? money(line.unitPrice, currency) : '—'}${line.gstRate != null ? `<div class="muted">GST ${escapeHtml(line.gstRate)}%</div>` : ''}</td>
            <td>${line.lineTotal != null ? money(line.lineTotal, currency) : '—'}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="5" class="empty">Order item information is not available.</td></tr>`;

  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=980,height=820');
  if (!printWindow) {
    throw new Error('Pop-ups are blocked. Allow pop-ups for FabricTrad to print or save this document.');
  }

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)} · ${escapeHtml(document.orderReference)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef0f2; color: #202223; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .page { width: min(920px, calc(100% - 32px)); margin: 28px auto; background: white; border: 1px solid #dfe3e8; border-radius: 18px; box-shadow: 0 14px 40px rgba(32,34,35,.09); overflow: hidden; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 20px; background: #1a1a1a; color: white; }
    .toolbar p { margin: 0; font-size: 13px; }
    .toolbar button { border: 0; border-radius: 9px; background: #f36f21; color: white; padding: 10px 16px; font: inherit; font-weight: 750; cursor: pointer; }
    .document { padding: 34px; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #202223; padding-bottom: 24px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .mark { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: linear-gradient(135deg,#f59e0b,#c65330); color: white; font-weight: 900; font-size: 20px; }
    h1 { margin: 0; font-size: 25px; letter-spacing: -.02em; }
    .kicker { margin: 4px 0 0; color: #6d7175; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; font-weight: 750; }
    .document-title { text-align: right; }
    .document-title h2 { margin: 0; font-size: 20px; }
    .document-title p { margin: 5px 0 0; color: #6d7175; font-size: 12px; }
    .meta { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; margin: 24px 0; }
    .card { border: 1px solid #dfe3e8; border-radius: 12px; padding: 15px; }
    .label { color: #6d7175; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .value { margin-top: 5px; font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; margin-top: 22px; }
    th { padding: 11px 10px; background: #f6f6f7; border-bottom: 1px solid #c9cccf; color: #5c5f62; font-size: 10px; text-align: left; text-transform: uppercase; letter-spacing: .07em; }
    td { padding: 12px 10px; border-bottom: 1px solid #e8e9eb; font-size: 12px; vertical-align: top; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5), td:nth-child(3), td:nth-child(4), td:nth-child(5) { text-align: right; }
    .item-name { font-weight: 750; }
    .muted { margin-top: 3px; color: #6d7175; font-size: 10px; }
    .empty { text-align: center !important; color: #6d7175; padding: 28px; }
    .summary-label { text-align: right !important; color: #6d7175; border-bottom: 0; padding-top: 5px; padding-bottom: 5px; }
    .summary-value { text-align: right !important; border-bottom: 0; padding-top: 5px; padding-bottom: 5px; font-weight: 700; }
    .summary-label.strong, .summary-value.strong { color: #202223; border-top: 2px solid #202223; padding-top: 12px; font-size: 14px; font-weight: 850; }
    .notice { margin-top: 24px; border-left: 4px solid #f36f21; border-radius: 8px; background: #fff7ed; padding: 14px 16px; color: #5c5f62; font-size: 11px; line-height: 1.6; }
    .footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 28px; padding-top: 18px; border-top: 1px solid #dfe3e8; color: #6d7175; font-size: 10px; }
    @media print {
      body { background: white; }
      .page { width: 100%; margin: 0; border: 0; border-radius: 0; box-shadow: none; }
      .toolbar { display: none; }
      .document { padding: 20px; }
      @page { size: A4; margin: 12mm; }
    }
    @media (max-width: 620px) {
      .document { padding: 20px; }
      .header { display: block; }
      .document-title { margin-top: 20px; text-align: left; }
      .meta { grid-template-columns: 1fr; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="toolbar">
      <p>Use your browser’s print dialog to print or choose <strong>Save as PDF</strong>.</p>
      <button type="button" onclick="window.print()">Print / Save PDF</button>
    </div>
    <main class="document">
      <header class="header">
        <div class="brand">
          <div class="mark">FT</div>
          <div><h1>FabricTrad</h1><p class="kicker">Textile commerce platform</p></div>
        </div>
        <div class="document-title">
          <h2>${document.documentType === 'payment_receipt' ? 'Payment receipt' : 'Order summary'}</h2>
          <p>${escapeHtml(document.orderReference)}</p>
        </div>
      </header>

      <section class="meta">
        <div class="card"><div class="label">Order information</div><div class="value">Created: ${escapeHtml(dateTime(document.createdAt))}<br>Status: ${escapeHtml(document.status || 'Pending')} ${document.paymentReference ? `<br>Payment: ${escapeHtml(document.paymentReference)}` : ''}</div></div>
        <div class="card"><div class="label">Buyer</div><div class="value">${escapeHtml(document.buyerName || 'FabricTrad buyer')}${document.buyerBusiness ? `<br>${escapeHtml(document.buyerBusiness)}` : ''}${document.buyerEmail ? `<br>${escapeHtml(document.buyerEmail)}` : ''}${document.buyerGstin ? `<br>GSTIN: ${escapeHtml(document.buyerGstin)}` : ''}</div></div>
        <div class="card"><div class="label">Seller</div><div class="value">${escapeHtml(document.sellerName || 'Seller details pending')}${document.sellerGstin ? `<br>GSTIN: ${escapeHtml(document.sellerGstin)}` : ''}</div></div>
        <div class="card"><div class="label">Document</div><div class="value">${escapeHtml(document.documentType === 'payment_receipt' ? 'Platform payment receipt' : 'Platform order summary')}<br>Currency: ${escapeHtml(currency)}${document.paymentMethod ? `<br>Method: ${escapeHtml(document.paymentMethod)}` : ''}</div></div>
      </section>

      <table aria-label="Order items">
        <thead><tr><th>#</th><th>Item</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead>
        <tbody>
          ${lines}
          ${totalRow('Subtotal', document.subtotal)}
          ${totalRow('Discount', document.discount ? -Math.abs(document.discount) : null)}
          ${totalRow('CGST', document.cgst)}
          ${totalRow('SGST', document.sgst)}
          ${totalRow('IGST', document.igst)}
          ${document.cgst || document.sgst || document.igst ? '' : totalRow('GST', document.gst)}
          ${totalRow('Shipping', document.shipping)}
          ${totalRow('Total', document.total, true)}
        </tbody>
      </table>

      <div class="notice"><strong>Document notice:</strong> ${escapeHtml(legalNotice)}${document.note ? `<br><br>${escapeHtml(document.note)}` : ''}</div>
      <footer class="footer"><span>Generated securely from the signed-in FabricTrad account.</span><span>Generated ${escapeHtml(dateTime(new Date().toISOString()))}</span></footer>
    </main>
  </div>
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
}
