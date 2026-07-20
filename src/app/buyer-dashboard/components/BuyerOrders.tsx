'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV } from '@/lib/exportUtils';
import {
  firstOrderItem,
  formatMoney,
  formatOrderDate,
  useBuyerBulkOrders,
  type AccountBulkOrder,
} from '@/lib/hooks/useAccountOrders';

type Filter = 'All' | 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled';
const statusFilters: Filter[] = ['All', 'Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
const statusLabels: Record<string, string> = { draft: 'Pending assignment', quote_sent: 'Pending seller response', confirmed: 'Confirmed — payment due', paid: 'Paid', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

function statusGroup(status: string): Exclude<Filter, 'All'> {
  if (['draft', 'quote_sent'].includes(status)) return 'Pending';
  if (['confirmed', 'paid'].includes(status)) return 'Confirmed';
  if (status === 'shipped') return 'Shipped';
  if (status === 'delivered') return 'Delivered';
  return 'Cancelled';
}

function downloadOrderReceipt(order: AccountBulkOrder) {
  const item = firstOrderItem(order);
  const content = ['FABRICTRAD ORDER SUMMARY', `Order: FT-BULK-${order.id.slice(0, 8).toUpperCase()}`, `Created: ${formatOrderDate(order.created_at)}`, `Status: ${statusLabels[order.status || 'draft'] || order.status}`, `Product: ${item?.product_name || 'Bulk fabric order'}`, `Quantity: ${item?.quantity_mtrs || 0} metres`, `Subtotal: ${formatMoney(order.gross_total)}`, `GST: ${formatMoney(order.gst_total)}`, `Total: ${formatMoney(order.net_total)}`, '', ['paid', 'shipped', 'delivered'].includes(order.status || '') ? 'This is an order receipt. The seller billing document will appear when uploaded.' : 'This is an order summary, not a tax invoice.'].join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `FabricTrad-${order.id.slice(0, 8)}-summary.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BuyerOrders() {
  const router = useRouter();
  const { orders, loading, error, refresh, cancelOrder } = useBuyerBulkOrders();
  const [filter, setFilter] = useState<Filter>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const filtered = useMemo(() => filter === 'All' ? orders : orders.filter((order) => statusGroup(order.status || 'draft') === filter), [filter, orders]);

  const exportOrders = () => {
    if (!filtered.length) return toast.error('There are no orders to export.');
    exportToCSV(filtered.map((order) => { const item = firstOrderItem(order); return { 'Order ID': `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`, Product: item?.product_name || 'Bulk fabric order', Quantity: item?.quantity_mtrs || '', Status: statusLabels[order.status || 'draft'] || order.status || 'Pending', Date: formatOrderDate(order.created_at), Subtotal: Number(order.gross_total || 0), GST: Number(order.gst_total || 0), Total: Number(order.net_total || 0) }; }), `fabrictrad-orders-${filter.toLowerCase()}`);
  };

  return <div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-800 text-foreground">My Orders</h1><p className="mt-1 text-xs text-muted-foreground">Pending requests, confirmed orders and shipment progress.</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => void refresh()} disabled={loading} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs"><Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} />Refresh</button><button type="button" onClick={exportOrders} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs"><Icon name="ArrowDownTrayIcon" size={14} />Export</button></div></div>
    <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-2" role="tablist">{statusFilters.map((item) => <button key={item} type="button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)} className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-600 ${filter === item ? 'bg-primary text-white' : 'border border-border bg-card text-muted-foreground'}`}>{item}{item !== 'All' && <span className="ml-1 opacity-75">({orders.filter((order) => statusGroup(order.status || 'draft') === item).length})</span>}</button>)}</div>
    {error && <div className="mb-4 flex items-center justify-between rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error"><span>{error}</span><button type="button" onClick={() => void refresh()} className="font-800 underline">Retry</button></div>}
    <div className="space-y-3">
      {loading && <div className="rounded-2xl border border-border bg-card py-12 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}
      {!loading && !error && filtered.length === 0 && <div className="rounded-2xl border border-border bg-card py-12 text-center"><Icon name="ShoppingBagIcon" size={34} className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm font-800">No {filter === 'All' ? '' : filter.toLowerCase()} orders</p><button type="button" onClick={() => router.push('/marketplace')} className="btn-primary mt-4 rounded-xl px-4 py-2 text-xs">Browse Fabrics</button></div>}
      {filtered.map((order) => { const item = firstOrderItem(order); const status = order.status || 'draft'; const expanded = expandedId === order.id; const canCancel = ['draft', 'quote_sent', 'confirmed'].includes(status); const paid = ['paid', 'shipped', 'delivered'].includes(status); return <article key={order.id} className="overflow-hidden rounded-2xl border border-border bg-card"><button type="button" onClick={() => setExpandedId(expanded ? null : order.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/30" aria-expanded={expanded}><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="mono-id">FT-BULK-{order.id.slice(0, 8).toUpperCase()}</span><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-600 order-status-${status}`}>{statusLabels[status] || status.replace(/_/g, ' ')}</span><span className={`rounded-full px-2 py-0.5 text-xs font-600 ${paid ? 'bg-success/10 text-success' : status === 'cancelled' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'}`}>{paid ? 'Paid' : status === 'cancelled' ? 'Closed' : 'Payment pending'}</span></div><p className="truncate text-sm font-700">{item?.product_name || 'Bulk fabric order'}</p><p className="text-xs text-muted-foreground">{item?.quantity_mtrs ? `${item.quantity_mtrs} mtrs` : 'Quantity pending'} · {formatOrderDate(order.created_at)}</p></div><div className="shrink-0 text-right"><p className="text-base font-800">{formatMoney(order.net_total)}</p><p className="text-xs text-muted-foreground">incl. GST</p></div><Icon name={expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} /></button>{expanded && <div className="border-t border-border px-5 pb-5 pt-4"><div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Unit Price', item?.price_per_mtr ? `${formatMoney(item.price_per_mtr)}/mtr` : 'Quote pending'], ['Subtotal', formatMoney(order.gross_total)], ['GST', formatMoney(order.gst_total)], ['Next Step', status === 'draft' ? 'Seller assignment' : status === 'quote_sent' ? 'Seller response' : status === 'confirmed' ? 'Complete payment' : status === 'shipped' ? 'Track shipment' : status === 'delivered' ? 'Order complete' : 'No action']].map(([label,value]) => <div key={label} className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-700">{value}</p></div>)}</div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => downloadOrderReceipt(order)} className="btn-secondary rounded-xl px-3 py-2 text-xs"><Icon name="DocumentArrowDownIcon" size={14} className="mr-1 inline" />{paid ? 'Download Receipt' : 'Download Summary'}</button>{canCancel && <button type="button" disabled={cancellingId === order.id} onClick={async () => { if (!window.confirm('Cancel this order request?')) return; setCancellingId(order.id); try { await cancelOrder(order.id); toast.success('Order cancelled.'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not cancel order.'); } finally { setCancellingId(null); } }} className="rounded-xl border border-error/20 bg-error/10 px-3 py-2 text-xs text-error disabled:opacity-50"><Icon name="XMarkIcon" size={14} className="mr-1 inline" />{cancellingId === order.id ? 'Cancelling…' : 'Cancel Order'}</button>}<button type="button" onClick={() => router.push('/buyer-dashboard?tab=disputes')} className="rounded-xl border border-border bg-muted px-3 py-2 text-xs"><Icon name="ChatBubbleLeftIcon" size={14} className="mr-1 inline" />Contact Support</button></div></div>}</article>; })}
    </div>
  </div>;
}
