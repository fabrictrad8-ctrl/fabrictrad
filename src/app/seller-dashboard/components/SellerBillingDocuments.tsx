'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { formatMoney, formatOrderDate, useSellerBulkOrders } from '@/lib/hooks/useAccountOrders';

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

function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

export default function SellerBillingDocuments() {
  const { user, isDemoAccount } = useAuth();
  const { orders } = useSellerBulkOrders();
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    bulk_order_id: '',
    document_type: 'invoice' as BillingDocument['document_type'],
    invoice_number: '',
    amount: '',
    file: null as File | null,
  });

  const eligibleOrders = useMemo(
    () => orders.filter((order) => ['confirmed', 'paid', 'shipped', 'delivered'].includes(order.status || '')),
    [orders]
  );

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (isDemoAccount) {
      setSellerId('demo-seller');
      setDocuments([]);
      setLoading(false);
      return;
    }
    if (!user?.id) {
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
    const { data, error: documentError } = await supabase
      .from('seller_billing_documents')
      .select('*')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false });
    if (documentError) {
      setError(documentError.message);
      setDocuments([]);
    } else {
      setDocuments((data || []) as BillingDocument[]);
    }
    setLoading(false);
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const uploadDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.file) return toast.error('Choose a PDF, PNG or JPEG file.');
    if (!sellerId || !user?.id) return toast.error('Seller profile is not available.');
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(form.file.type)) return toast.error('Only PDF, PNG and JPEG files are accepted.');
    if (form.file.size > 10 * 1024 * 1024) return toast.error('The file must be 10 MB or smaller.');
    if (form.document_type === 'invoice' && !form.invoice_number.trim()) return toast.error('Invoice number is required for GST invoices.');

    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}-${safeFilename(form.file.name)}`;
      if (isDemoAccount) {
        setDocuments((current) => [{
          id: `demo-${Date.now()}`,
          bulk_order_id: form.bulk_order_id || null,
          document_type: form.document_type,
          invoice_number: form.invoice_number.trim() || null,
          amount: form.amount ? Number(form.amount) : null,
          file_path: path,
          original_filename: form.file!.name,
          mime_type: form.file!.type,
          file_size: form.file!.size,
          status: 'uploaded',
          rejection_reason: null,
          created_at: new Date().toISOString(),
        }, ...current]);
      } else {
        const supabase = createClient();
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
        await loadDocuments();
      }
      setForm({ bulk_order_id: '', document_type: 'invoice', invoice_number: '', amount: '', file: null });
      const fileInput = document.getElementById('seller-billing-file') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      toast.success('Billing document uploaded.');
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (document: BillingDocument) => {
    if (isDemoAccount) return toast.success('Demo file download is not available.');
    const supabase = createClient();
    const { data, error: signedError } = await supabase.storage
      .from('seller-billing')
      .createSignedUrl(document.file_path, 60);
    if (signedError || !data?.signedUrl) return toast.error(signedError?.message || 'Could not open document.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const deleteDocument = async (document: BillingDocument) => {
    if (document.status !== 'uploaded') return toast.error('Reviewed documents cannot be deleted.');
    if (!window.confirm(`Delete ${document.original_filename}?`)) return;
    try {
      if (isDemoAccount) {
        setDocuments((current) => current.filter((item) => item.id !== document.id));
      } else {
        const supabase = createClient();
        const { error: deleteRowError } = await supabase
          .from('seller_billing_documents')
          .delete()
          .eq('id', document.id)
          .eq('seller_id', sellerId);
        if (deleteRowError) throw deleteRowError;
        await supabase.storage.from('seller-billing').remove([document.file_path]);
        await loadDocuments();
      }
      toast.success('Document deleted.');
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Could not delete document.');
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-800 text-foreground">Billing Uploads</h1><p className="mt-1 text-xs text-muted-foreground">Upload GST invoices, e-way bills and packing lists against seller orders.</p></div>
      <form onSubmit={uploadDocument} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3"><Icon name="ShieldCheckIcon" size={17} className="mt-0.5 shrink-0 text-primary" /><p className="text-xs leading-5 text-muted-foreground">Billing files are private. Only this seller account and authorised FabricTrad administrators can access them.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-700 text-foreground">Related Order<select value={form.bulk_order_id} onChange={(event) => setForm({ ...form, bulk_order_id: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-3 text-sm"><option value="">Not linked to an order</option>{eligibleOrders.map((order) => <option key={order.id} value={order.id}>FT-BULK-{order.id.slice(0, 8).toUpperCase()} · {formatMoney(order.net_total)}</option>)}</select></label>
          <label className="text-sm font-700 text-foreground">Document Type<select value={form.document_type} onChange={(event) => setForm({ ...form, document_type: event.target.value as BillingDocument['document_type'] })} className="input-base mt-1.5 w-full rounded-xl px-3 py-3 text-sm">{Object.entries(documentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm font-700 text-foreground">Invoice / Reference Number{form.document_type === 'invoice' && ' *'}<input value={form.invoice_number} onChange={(event) => setForm({ ...form, invoice_number: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-3 text-sm" placeholder="INV-2026-001" /></label>
          <label className="text-sm font-700 text-foreground">Document Amount (₹)<input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-3 text-sm" placeholder="0.00" /></label>
        </div>
        <label className="mt-4 block text-sm font-700 text-foreground">File *<input id="seller-billing-file" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} className="mt-1.5 block w-full rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-700 file:text-white" /></label>
        <p className="mt-1 text-xs text-muted-foreground">PDF, PNG or JPEG · maximum 10 MB</p>
        <button type="submit" disabled={uploading} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm disabled:opacity-50 sm:w-auto sm:px-6">{uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon name="ArrowUpTrayIcon" size={16} />}{uploading ? 'Uploading…' : 'Upload Billing Document'}</button>
      </form>
      {error && <div className="flex items-center justify-between gap-3 rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error"><span className="flex items-center gap-2"><Icon name="ExclamationTriangleIcon" size={15} />{error}</span><button type="button" onClick={() => void loadDocuments()} className="font-800 underline">Retry</button></div>}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-800 text-foreground">Uploaded Documents</h2><p className="text-xs text-muted-foreground">{documents.length} document{documents.length === 1 ? '' : 's'}</p></div><button type="button" onClick={() => void loadDocuments()} disabled={loading} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Refresh billing documents"><Icon name="ArrowPathIcon" size={16} className={loading ? 'animate-spin' : ''} /></button></div>
        <div className="divide-y divide-border">
          {loading && <div className="py-12 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-secondary border-t-transparent" /></div>}
          {!loading && documents.length === 0 && <div className="px-5 py-12 text-center"><Icon name="DocumentArrowUpIcon" size={32} className="mx-auto mb-2 text-muted-foreground" /><p className="text-sm font-800 text-foreground">No billing documents uploaded</p><p className="mt-1 text-xs text-muted-foreground">Use the form above when an order needs an invoice or dispatch document.</p></div>}
          {!loading && documents.map((document) => (
            <div key={document.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary"><Icon name={document.mime_type === 'application/pdf' ? 'DocumentTextIcon' : 'PhotoIcon'} size={20} /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-800 text-foreground">{document.original_filename}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-800 ${document.status === 'verified' ? 'bg-success/10 text-success' : document.status === 'rejected' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'}`}>{document.status === 'verified' ? 'Verified' : document.status === 'rejected' ? 'Rejected' : 'Awaiting review'}</span></div><p className="mt-0.5 text-xs text-muted-foreground">{documentLabels[document.document_type]}{document.invoice_number ? ` · ${document.invoice_number}` : ''}{document.amount !== null ? ` · ${formatMoney(document.amount)}` : ''} · {formatOrderDate(document.created_at)}</p>{document.bulk_order_id && <p className="mt-1 font-mono text-[11px] text-muted-foreground">Order FT-BULK-{document.bulk_order_id.slice(0, 8).toUpperCase()}</p>}{document.rejection_reason && <p className="mt-1 text-xs text-error">{document.rejection_reason}</p>}</div>
              <div className="flex items-center gap-2"><button type="button" onClick={() => void downloadDocument(document)} className="btn-secondary flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs"><Icon name="ArrowDownTrayIcon" size={14} />Open</button>{document.status === 'uploaded' && <button type="button" onClick={() => void deleteDocument(document)} className="rounded-xl border border-error/20 bg-error/10 p-2 text-error hover:bg-error/20" aria-label={`Delete ${document.original_filename}`}><Icon name="TrashIcon" size={15} /></button>}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
