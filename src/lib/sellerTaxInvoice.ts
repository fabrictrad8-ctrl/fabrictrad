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
  catalog_order_id?: string | null;
  bulk_order_id?: string | null;
  bespoke_order_id?: string | null;
  document_type?: 'tax_invoice' | 'bill_of_supply' | 'payment_receipt';
  document_metadata?: { paymentPurpose?: string; quotedAmount?: number; capturedToDate?: number; balanceAtIssue?: number; supplyType?: string; taxOnAdvance?: boolean; paymentReferences?: string[] };
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

/** Navigate to the authenticated document so async callers work on mobile too. */
export function openPrintableSellerTaxInvoice(invoice: SellerTaxInvoice) {
  if (typeof window !== 'undefined') window.location.assign(`/api/invoices/${encodeURIComponent(invoice.id)}`);
}
