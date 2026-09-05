'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { exportToCSV } from '@/lib/exportUtils';
import { validTrackingUrl } from '@/lib/shippingValidation';

type Order = {
  id: string; kind: string; reference: string; buyer: string; buyer_email: string;
  seller: string; seller_email: string; product: string; variant: string; qty: string;
  amount: number; commission: number; status: string; payment_status: string; created_at: string;
  details: {
    paid: number; refunded: number; notes?: string;
    shipment: null | { provider: string; awb: string; trackingUrl: string; status: string; estimatedDelivery?: string };
    invoices: Array<{ id: string; number: string; emailStatus: string; emailRecipient: string; emailError?: string }>;
    payments: Array<{ id: string; status: string; amount: number; refunded: number; sellerPayable: number; transferId?: string; transferStatus?: string }>;
  };
};
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
const label = (value: string) => String(value || '').replaceAll('_', ' ');

export default function AdminOrders({ fulfillmentOnly = false }: { fulfillmentOnly?: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), kind, search, from, to, shipment: fulfillmentOnly ? '1' : '0' });
      const response = await fetch('/api/admin/orders?' + params, { cache: 'no-store', signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load orders.');
      if (signal?.aborted) return;
      setOrders(body.orders); setTotal(body.total);
    } catch (caught) {
      if (signal?.aborted) return;
      setOrders([]); setError(caught instanceof Error ? caught.message : 'Unable to load orders.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [page, kind, search, from, to, fulfillmentOnly]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => void load(controller.signal), 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [load]);

  async function retryInvoice(order: Order) {
    setSending(order.id); setNotice('');
    try {
      const response = await fetch('/api/admin/orders/invoice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, kind: order.kind }),
      });
      const body = await response.json();
      setNotice(body.message || body.error || 'Invoice request completed.');
      await load();
    } catch { setNotice('Invoice request could not be completed. Please retry.'); }
    finally { setSending(null); }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-800">{fulfillmentOnly ? 'Shipment operations' : 'Order management'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live marketplace orders with payment, invoice and courier records.</p></div>
      <div className="flex gap-3 text-sm">
        <Link href="/admin-portal?tab=bespoke" className="text-primary underline">Custom orders</Link>
        <button onClick={() => exportToCSV(orders.map(o => ({ Order: o.reference, Buyer: o.buyer, Seller: o.seller, Product: o.product, Quantity: o.qty, Amount: o.amount, Status: o.status, Payment: o.payment_status, Courier: o.details.shipment?.provider || '', AWB: o.details.shipment?.awb || '' })), 'marketplace-orders-page-' + page)} disabled={!orders.length} className="text-primary underline disabled:opacity-50">Export this page</button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-4">
      <label className="text-xs">Search orders, people or products<input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="input-field mt-1 w-full" /></label>
      <label className="text-xs">Order type<select value={kind} onChange={e => { setKind(e.target.value); setPage(1); }} className="input-field mt-1 w-full"><option value="all">All marketplace orders</option><option value="catalog">Catalogue</option><option value="bulk">Bulk</option></select></label>
      <label className="text-xs">From<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className="input-field mt-1 w-full" /></label>
      <label className="text-xs">Through<input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className="input-field mt-1 w-full" /></label>
    </div>
    {error && <p role="alert" className="rounded-xl bg-error/10 p-3 text-error">{error} <button className="underline" onClick={() => void load()}>Retry</button></p>}
    {notice && <p role="status" className="rounded-xl bg-primary/10 p-3 text-sm">{notice}</p>}
    <div className="space-y-3" aria-busy={loading}>
      {orders.map(order => <article key={order.id} className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="font-mono text-xs">{order.reference}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString('en-IN')}</p><p className="mt-2 text-sm">{order.product} {order.variant && '· ' + order.variant}</p><p className="text-xs text-muted-foreground">{order.qty}</p></div>
          <div className="text-sm"><p>Buyer: {order.buyer}</p><p className="break-all text-xs text-muted-foreground">{order.buyer_email}</p><p className="mt-2">Seller: {order.seller}</p><p className="break-all text-xs text-muted-foreground">{order.seller_email}</p></div>
          <div><p className="font-bold">{money(order.amount)}</p><p className="mt-1 text-xs">Payment: {label(order.payment_status)}</p><p className="text-xs text-muted-foreground">Recorded commission: {money(order.commission)}</p></div>
          <div><p className="text-sm capitalize">{label(order.status)}</p><p className="mt-1 text-xs text-muted-foreground">{order.details.shipment ? order.details.shipment.provider + ' · ' + label(order.details.shipment.status) : 'Shipment not booked'}</p><button aria-expanded={expanded === order.id} onClick={() => setExpanded(expanded === order.id ? null : order.id)} className="btn-secondary mt-3 px-3 py-2 text-xs">{expanded === order.id ? 'Hide details' : 'View order details'}</button></div>
        </div>
        {expanded === order.id && <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
          <p>Captured: {money(order.details.paid)} · Refunded: {money(order.details.refunded)}</p>
          {order.details.shipment && <div className="rounded-xl bg-muted/40 p-3">
            <p className="font-semibold">Courier: {order.details.shipment.provider}</p><p>AWB: {order.details.shipment.awb || 'Pending'}</p>
            <p>Status: {label(order.details.shipment.status)}{order.details.shipment.estimatedDelivery ? ' · Expected ' + order.details.shipment.estimatedDelivery : ''}</p>
            {validTrackingUrl(order.details.shipment.trackingUrl) && <a href={order.details.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Open shipment tracking</a>}
          </div>}
          <div className="space-y-2"><p className="font-semibold">Payment and seller transfer records</p>
            {!order.details.payments.length && <p className="text-muted-foreground">No payment attempt recorded.</p>}
            {order.details.payments.map((payment, index) => <div key={payment.id || index} className="rounded-xl border border-border p-3 text-xs">
              <p>{payment.id || 'Payment attempt'} · {label(payment.status)} · {money(payment.amount)}</p>
              <p>Refunded: {money(payment.refunded)} · Seller payable: {money(payment.sellerPayable)}</p>
              <p>Transfer: {payment.transferId || 'No transfer recorded'} · {label(payment.transferStatus || 'pending')}</p>
            </div>)}
            <p className="text-xs text-muted-foreground">Capture, seller transfer and bank settlement are separate stages. Confirm bank settlement in payment reconciliation.</p>
          </div>
          <div className="space-y-2"><p className="font-semibold">Invoices</p>
            {!order.details.invoices.length && <p className="text-muted-foreground">No invoice issued yet.</p>}
            {order.details.invoices.map(invoice => <div key={invoice.id} className="rounded-xl border border-border p-3 text-xs">
              <a className="text-primary underline" href={'/api/invoices/' + invoice.id} target="_blank" rel="noopener noreferrer">{invoice.number} · Open printable invoice</a>
              <p className="mt-1">Email: {invoice.emailStatus === 'sent' ? 'Submitted to email provider' : label(invoice.emailStatus)} · {invoice.emailRecipient}</p>
              {invoice.emailError && <p className="mt-1 text-error">{invoice.emailError}</p>}
            </div>)}
            {order.payment_status === 'paid' && (!order.details.invoices.length || order.details.invoices.some(i => i.emailStatus !== 'sent')) && <button disabled={sending === order.id} onClick={() => void retryInvoice(order)} className="btn-secondary px-3 py-2 text-xs">{sending === order.id ? 'Sending…' : 'Issue / retry invoice email'}</button>}
          </div>
          {order.details.notes && <p className="whitespace-pre-wrap">Order notes: {order.details.notes}</p>}
        </div>}
      </article>)}
      {!orders.length && !error && <p className="rounded-xl border border-border p-8 text-center text-muted-foreground">{loading ? 'Loading orders…' : 'No matching orders.'}</p>}
    </div>
    <div className="flex items-center justify-between text-sm"><p>{total} matching orders · Page {page} of {Math.max(1, Math.ceil(total / 30))}</p>
      <div className="flex gap-3"><button disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)} className="btn-secondary px-3 py-2 disabled:opacity-40">Previous</button><button disabled={page * 30 >= total || loading} onClick={() => setPage(p => p + 1)} className="btn-secondary px-3 py-2 disabled:opacity-40">Next</button></div>
    </div>
  </div>;
}
