import { test, expect } from '@playwright/test';
import { renderInvoiceDocument } from '../../src/lib/invoiceDocument';
import type { SellerTaxInvoice } from '../../src/lib/sellerTaxInvoice';

const invoice: SellerTaxInvoice = {
  id: '10000000-0000-0000-0000-000000000001', invoice_number: 'FT/26-27/000001',
  catalog_order_id: '20000000-0000-0000-0000-000000000001', issued_at: '2026-09-07T05:30:00Z', status: 'issued',
  supplier: { legalName: 'Sample Textile Seller', gstin: '27AAAAA0000A1Z5', address: { line1: '10 Supplier Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400002' } },
  recipient: { name: 'Sample Buyer', address: { address_line1: '12 Buyer Road', city: 'Surat', state: 'Gujarat', postal_code: '395001' } },
  delivery_address: { addressLine1: '12 Buyer Road', city: 'Surat', state: 'Gujarat', pincode: '395001' },
  place_of_supply: 'Gujarat', reverse_charge: false, subtotal: 1000, discount: 0, taxable_value: 1000,
  cgst_amount: 0, sgst_amount: 0, igst_amount: 180, cess_amount: 0, total_tax: 180, total_amount: 1180,
  currency: 'INR', payment_reference: 'pay_sample', payment_captured_at: '2026-09-07T05:29:00Z', e_invoice_applicable: false,
  lines: [{ description: 'Sample textile', hsnCode: '5208', quantity: 10, unit: 'mtr', unitPrice: 100, taxableValue: 1000, gstRate: 18, cgstAmount: 0, sgstAmount: 0, igstAmount: 180, lineTotal: 1180 }],
};

test('invoice shows complete addresses and taxes, fits mobile and prints all columns', async ({ page }, testInfo) => {
  await page.setContent(await renderInvoiceDocument(invoice));
  await expect(page.getByRole('heading', { name: 'Tax invoice', exact: true })).toBeVisible();
  await expect(page.getByText('10 Supplier Road, Mumbai, Maharashtra, 400002')).toBeVisible();
  await expect(page.getByText('12 Buyer Road, Surat, Gujarat, 395001').first()).toBeVisible();
  await expect(page.locator('.totals')).toContainText('₹1,180.00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('columnheader', { name: 'Unit price' })).toBeVisible();
  await expect(page.locator('.actions')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('invoice-print.png'), fullPage: true });
  await page.pdf({ path: testInfo.outputPath('invoice-print.pdf'), format: 'A4', printBackground: true });
});

test('advance receipt is distinct from final invoice and void documents remain clearly marked', async ({ page }) => {
  await page.setContent(await renderInvoiceDocument({ ...invoice, document_type: 'payment_receipt', total_amount: 590,
    document_metadata: { paymentPurpose: 'advance', quotedAmount: 1180, balanceAtIssue: 590, supplyType: 'services', taxOnAdvance: true } }));
  await expect(page.getByRole('heading', { name: 'Payment receipt', exact: true })).toBeVisible();
  await expect(page.locator('.totals')).toContainText('Balance at issue');
  await expect(page.locator('.notice')).toContainText('not an additional charge');
  await page.setContent(await renderInvoiceDocument({ ...invoice, status: 'void' }));
  await expect(page.getByText('VOID — do not use this document')).toBeVisible();
});

test('registered e-invoice includes a local signed QR and escapes supplier content', async ({ page }) => {
  await page.setContent(await renderInvoiceDocument({ ...invoice, supplier: { ...invoice.supplier, legalName: '<script>window.invoiceAttack=true</script>' },
    e_invoice_applicable: true, irn: 'sample-irn', acknowledgement_number: 'sample-ack', acknowledgement_date: invoice.issued_at, signed_qr_data: 'sample-signed-qr-data' }));
  await expect(page.locator('.qr svg')).toBeVisible();
  await expect(page.getByText('IRN: sample-irn', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => 'invoiceAttack' in window)).toBe(false);
});
