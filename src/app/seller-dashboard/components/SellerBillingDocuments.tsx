'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { formatMoney, formatOrderDate, useSellerBulkOrders } from '@/lib/hooks/useAccountOrders';

type AutomaticInvoice = {
  id: string;
  catalog_order_id: string | null;
  bulk_order_id: string | null;
  invoice_number: string;
  total_amount: number;
  total_tax: number;
  payment_reference: string;
  payment_captured_at: string | null;
  issued_at: string;
  generation_source: string;
  email_status: string;
  email_recipient: string | null;
  recipient: Record<string, unknown>;
};

type BillingDocument = {
  id: string;
  bulk_order_id: string | null;
  document_type: 'invoice' | 'eway_bill' | 'packing_list' | 'credit_note' | 'other';
  invoice_number: string | null;
  amount: number | null;
  file_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  status: 'uploaded' | 'verified' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
};

const documentLabels: Record<BillingDocument['document_type'], string> = {
  invoice: 'GST Invoice',
  eway_bill: 'E-Way Bill',
  packing_list: 'Packing List',
  credit_note: 'Credit Note',
  other: 'Other Document',
};

const safeFilename = (filename: string) =>
  filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');

const emailLabel = (status: string) => {
  if (status === 'sent') return 'Email sent';
  if (status === 'sending') return 'Sending email';
  if (status === 'failed') return 'Email retry needed';
  if (status === 'not_configured') return 'Email not configured';
  return 'Email queued';
};

export default function SellerBillingDocuments() {
  const { user } = useAuth();
  const { orders } = useSellerBulkOrders();
  const [automaticInvoices, setAutomaticInvoices] = useState<AutomaticInvoice[]>([]);
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [form, setForm] = useState({
    bulk_order_id: '',
    document_type: 'invoice' as BillingDocument['document_type'],
    invoice_number: '',
    amount: '',
    file: null as File | null,
  });

  const eligibleOrders = useMemo(
    () =>
      orders.filter((order) =>
        ['confirmed', 'paid', 'shipped', 'delivered'].includes(order.status || '')
      ),
    [orders]
  );

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!user?.id) {
      setAutomaticInvoices([]);
      setDocuments([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: seller, error: sellerError } = await supabase
      .from('seller_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sellerError || !seller?.id) {
      setError(sellerError?.message || 'Seller profile is not available.');
      setLoading(false);
      return;
    }
    setSellerId(seller.id);

    const [invoiceResult, manualResult] = await Promise.all([
      supabase
        .from('seller_tax_invoices')
        .select(
          'id,catalog_order_id,bulk_order_id,invoice_number,total_amount,total_tax,payment_reference,payment_captured_at,issued_at,generation_source,email_status,email_recipient,recipient'
        )
        .eq('seller_id', seller.id)
        .order('issued_at', { ascending: false }),
      supabase
        .from('seller_billing_documents')
        .select('*')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false }),
    ]);

    const loadError = invoiceResult.error || manualResult.error;
    if (loadError) setError(loadError.message);
    setAutomaticInvoices((invoiceResult.data || []) as AutomaticInvoice[]);
    setDocuments((manualResult.data || []) as BillingDocument[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const uploadDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.file) return toast.error('Choose a PDF, PNG or JPEG file.');
    if (!sellerId || !user?.id) return toast.error('Seller profile is not available.');
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(form.file.type))
      return toast.error('Only PDF, PNG and JPEG files are accepted.');
    if (form.file.size > 10 * 1024 * 1024)
      return toast.error('The file must be 10 MB or smaller.');
    if (form.document_type === 'invoice' && !form.invoice_number.trim())
      return toast.error('Invoice number is required for manually uploaded GST invoices.');

    setUploading(true);
    const supabase = createClient();
    const path = `${user.id}/${Date.now()}-${safeFilename(form.file.name)}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from('seller-billing')
        .upload(path, form.file, { upsert: false, contentType: form.file.type });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('seller_billing_documents').insert({
        seller_id: sellerId,
        bulk_order_id: form.bulk_order_id || null,
        document_type: form.document_type,
        invoice_number: form.invoice_number.trim() || null,
        amount: form.amount ? Number(form.amount) : null,
        file_path: path,
        original_filename: form.file.name,
        mime_type: form.file.type,
        file_size: form.file.size,
        status: 'uploaded',
      });
      if (insertError) {
        await supabase.storage.from('seller-billing').remove([path]);
        throw insertError;
      }

      setForm({
        bulk_order_id: '',
        document_type: 'invoice',
        invoice_number: '',
        amount: '',
        file: null,
      });
      const input = document.getElementById('seller-billing-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await loadDocuments();
      toast.success('Manual billing document uploaded.');
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const openManualDocument = async (document: BillingDocument) => {
    const supabase = createClient();
    const { data, error: signedError } = await supabase.storage
      .from('seller-billing')
      .createSignedUrl(document.file_path, 60);
    if (signedError || !data?.signedUrl)
      return toast.error(signedError?.message || 'Could not open document.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const deleteDocument = async (document: BillingDocument) => {
    if (document.status !== 'uploaded') return toast.error('Reviewed documents cannot be deleted.');
    if (!window.confirm(`Delete ${document.original_filename}?`)) return;
    const supabase = createClient();
    try {
      const { error: deleteRowError } = await supabase
        .from('seller_billing_documents')
        .delete()
        .eq('id', document.id)
        .eq('seller_id', sellerId);
      if (deleteRowError) throw deleteRowError;
      await supabase.storage.from('seller-billing').remove([document.file_path]);
      await loadDocuments();
      toast.success('Document deleted.');
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Could not delete document.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="ft-route-kicker">Billing</p>
        <h1 className="mt-1 text-2xl font-800 text-foreground">Invoices & billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Final invoices are generated automatically after FabricTrad receives server-side confirmation that the buyer&apos;s Razorpay payment was captured.
        </p>
      </div>

      <section className="rounded-2xl border border-success/20 bg-success/5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
            <Icon name="BoltIcon" size={20} />
          </span>
          <div>
            <h2 className="text-sm font-800 text-foreground">Automatic billing is the primary workflow</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Accepted order → buyer pays → Razorpay capture is verified → seller earnings are recognised → invoice is generated → invoice email is sent to the buyer. An authorised or initiated payment does not create earnings or a final invoice.
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error">
          <span className="flex items-center gap-2"><Icon name="ExclamationTriangleIcon" size={15} />{error}</span>
          <button type="button" onClick={() => void loadDocuments()} className="font-800 underline">Retry</button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-800 text-foreground">Automatically generated invoices</h2>
            <p className="text-xs text-muted-foreground">{automaticInvoices.length} captured-payment invoice{automaticInvoices.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" onClick={() => void loadDocuments()} disabled={loading} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Refresh invoices">
            <Icon name="ArrowPathIcon" size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="divide-y divide-border">
          {loading && <div className="py-12 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-success border-t-transparent" /></div>}
          {!loading && automaticInvoices.length === 0 && (
            <div className="px-5 py-12 text-center">
              <Icon name="DocumentCheckIcon" size={34} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-800 text-foreground">No captured-payment invoices yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Invoices will appear here automatically only after a buyer payment is actually captured by Razorpay.</p>
            </div>
          )}
          {!loading && automaticInvoices.map((invoice) => {
            const recipient = invoice.recipient || {};
            const orderId = invoice.catalog_order_id || invoice.bulk_order_id || '';
            const orderPrefix = invoice.catalog_order_id ? 'FT-CAT' : 'FT-BULK';
            const emailOk = invoice.email_status === 'sent';
            return (
              <div key={invoice.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success"><Icon name="DocumentCheckIcon" size={20} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-800 text-foreground">{invoice.invoice_number}</p>
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-800 text-success">Automatic</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-800 ${emailOk ? 'bg-success/10 text-success' : invoice.email_status === 'failed' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'}`}>{emailLabel(invoice.email_status)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {String(recipient.businessName || recipient.name || invoice.email_recipient || 'Buyer')} · {formatMoney(invoice.total_amount)} · GST {formatMoney(invoice.total_tax)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {orderPrefix}-{orderId.slice(0, 8).toUpperCase()} · Razorpay {invoice.payment_reference || 'capture recorded'}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Issued {formatOrderDate(invoice.issued_at)}{invoice.email_recipient ? ` · ${invoice.email_recipient}` : ''}</p>
                </div>
                <button type="button" onClick={() => window.open(`/api/invoices/${invoice.id}`, '_blank', 'noopener,noreferrer')} className="btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs">
                  <Icon name="PrinterIcon" size={14} /> Open / Print
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <button type="button" onClick={() => setShowManual((value) => !value)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
          <div>
            <h2 className="text-sm font-800 text-foreground">Manual billing & dispatch documents</h2>
            <p className="mt-1 text-xs text-muted-foreground">Secondary workflow for e-way bills, packing lists, credit notes, corrections or exceptional manual invoices.</p>
          </div>
          <Icon name={showManual ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={18} className="text-muted-foreground" />
        </button>

        {showManual && (
          <div className="border-t border-border p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <Icon name="ShieldCheckIcon" size={17} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs leading-5 text-muted-foreground">Manual billing files are private. They do not replace the automatic captured-payment invoice unless an authorised correction is genuinely required.</p>
            </div>
            <form onSubmit={uploadDocument}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-700 text-foreground">Related Order
                  <select value={form.bulk_order_id} onChange={(event) => setForm({ ...form, bulk_order_id: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-3 text-sm">
                    <option value="">Not linked to an order</option>
                    {eligibleOrders.map((order) => <option key={order.id} value={order.id}>FT-BULK-{order.id.slice(0, 8).toUpperCase()} · {formatMoney(order.net_total)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-700 text-foreground">Document Type
                  <select value={form.document_type} onChange={(event) => setForm({ ...form, document_type: event.target.value as BillingDocument['document_type'] })} className="input-base mt-1.5 w-full rounded-xl px-3 py-3 text-sm">
                    {Object.entries(documentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-700 text-foreground">Invoice / Reference Number{form.document_type === 'invoice' && ' *'}
                  <input value={form.invoice_number} onChange={(event) => setForm({ ...form, invoice_number: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-3 text-sm" placeholder="INV-2026-001" />
                </label>
                <label className="text-sm font-700 text-foreground">Document Amount (₹)
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-3 text-sm" placeholder="0.00" />
                </label>
              </div>
              <label className="mt-4 block text-sm font-700 text-foreground">File *
                <input id="seller-billing-file" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} className="mt-1.5 block w-full rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-700 file:text-white" />
              </label>
              <p className="mt-1 text-xs text-muted-foreground">PDF, PNG or JPEG · maximum 10 MB</p>
              <button type="submit" disabled={uploading} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm disabled:opacity-50 sm:w-auto sm:px-6">
                {uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon name="ArrowUpTrayIcon" size={16} />}
                {uploading ? 'Uploading…' : 'Upload Manual Document'}
              </button>
            </form>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4"><h2 className="text-sm font-800 text-foreground">Manual uploads</h2><p className="text-xs text-muted-foreground">{documents.length} manual document{documents.length === 1 ? '' : 's'}</p></div>
        <div className="divide-y divide-border">
          {!loading && documents.length === 0 && <div className="px-5 py-9 text-center"><p className="text-sm font-800 text-foreground">No manual billing documents</p><p className="mt-1 text-xs text-muted-foreground">That is normal when automatic billing covers the order.</p></div>}
          {!loading && documents.map((document) => (
            <div key={document.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary"><Icon name={document.mime_type === 'application/pdf' ? 'DocumentTextIcon' : 'PhotoIcon'} size={20} /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-800 text-foreground">{document.original_filename}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-800 ${document.status === 'verified' ? 'bg-success/10 text-success' : document.status === 'rejected' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'}`}>{document.status === 'verified' ? 'Verified' : document.status === 'rejected' ? 'Rejected' : 'Awaiting review'}</span></div><p className="mt-0.5 text-xs text-muted-foreground">{documentLabels[document.document_type]}{document.invoice_number ? ` · ${document.invoice_number}` : ''}{document.amount !== null ? ` · ${formatMoney(document.amount)}` : ''} · {formatOrderDate(document.created_at)}</p>{document.rejection_reason && <p className="mt-1 text-xs text-error">{document.rejection_reason}</p>}</div>
              <div className="flex items-center gap-2"><button type="button" onClick={() => void openManualDocument(document)} className="btn-secondary flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs"><Icon name="ArrowDownTrayIcon" size={14} />Open</button>{document.status === 'uploaded' && <button type="button" onClick={() => void deleteDocument(document)} className="rounded-xl border border-error/20 bg-error/10 p-2 text-error hover:bg-error/20" aria-label={`Delete ${document.original_filename}`}><Icon name="TrashIcon" size={15} /></button>}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
