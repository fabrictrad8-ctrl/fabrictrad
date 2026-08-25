'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { RazorpayCheckout } from '@/components/RazorpayCheckout';
import OrderLifecyclePanel from '@/components/commerce/OrderLifecyclePanel';
import BuyerCatalogOrders from '@/app/buyer-dashboard/components/BuyerCatalogOrders';
import { exportToCSV } from '@/lib/exportUtils';
import { openPrintableOrderDocument } from '@/lib/orderDocuments';
import { useAuth } from '@/contexts/AuthContext';
import {
  firstOrderItem,
  formatMoney,
  formatOrderDate,
  useBuyerBulkOrders,
  type AccountBulkOrder,
} from '@/lib/hooks/useAccountOrders';

type Filter = 'All' | 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled';
const statusFilters: Filter[] = ['All', 'Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
const statusLabels: Record<string, string> = {
  draft: 'Pending assignment',
  quote_sent: 'Pending seller response',
  confirmed: 'Confirmed',
  paid: 'Paid — seller fulfilling',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const paymentLabels: Record<string, string> = {
  unpaid: 'Payment due',
  partial: 'Part paid — balance due',
  paid: 'Fully paid',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
  failed: 'Payment failed',
};

function statusGroup(status: string): Exclude<Filter, 'All'> {
  if (['draft', 'quote_sent'].includes(status)) return 'Pending';
  if (['confirmed', 'paid'].includes(status)) return 'Confirmed';
  if (status === 'shipped') return 'Shipped';
  if (status === 'delivered') return 'Delivered';
  return 'Cancelled';
}

export default function BuyerOrders() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { orders, loading, error, refresh, cancelOrder } = useBuyerBulkOrders();
  const [filter, setFilter] = useState<Filter>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const filtered = useMemo(
    () =>
      filter === 'All'
        ? orders
        : orders.filter((order) => statusGroup(order.status || 'draft') === filter),
    [filter, orders]
  );

  const exportOrders = () => {
    if (!filtered.length) return toast.error('There are no bulk orders to export.');
    exportToCSV(
      filtered.map((order) => {
        const item = firstOrderItem(order);
        return {
          'Order ID': `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`,
          Product: item?.product_name || 'Bulk fabric order',
          Quantity: item?.quantity_mtrs || '',
          Status: statusLabels[order.status || 'draft'] || order.status || 'Pending',
          'Payment status': paymentLabels[order.payment_status || 'unpaid'] || order.payment_status,
          'Amount paid': Number(order.amount_paid || 0),
          'Amount refunded': Number(order.amount_refunded || 0),
          Date: formatOrderDate(order.created_at),
          Subtotal: Number(order.gross_total || 0),
          GST: Number(order.gst_total || 0),
          Total: Number(order.net_total || 0),
        };
      }),
      `fabrictrad-orders-${filter.toLowerCase()}`
    );
  };

  const printOrderDocument = (order: AccountBulkOrder) => {
    const paid = order.payment_status === 'paid';
    try {
      openPrintableOrderDocument({
        documentType: paid ? 'payment_receipt' : 'order_summary',
        orderReference: `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`,
        createdAt: order.created_at,
        status: statusLabels[order.status || 'draft'] || order.status || 'Pending',
        buyerName: order.buyer_name || profile?.full_name || null,
        buyerBusiness: order.buyer_company || profile?.business_name || null,
        buyerEmail: order.buyer_email || user?.email || null,
        buyerGstin: profile?.gstin || null,
        sellerName: order.seller_id ? `FabricTrad seller ${order.seller_id.slice(0, 8)}` : null,
        subtotal: Number(order.gross_total || 0),
        gst: Number(order.gst_total || 0),
        total: Number(order.net_total || 0),
        lines: (order.bulk_order_items || []).map((item) => ({
          name: item.product_name || 'Bulk fabric order',
          sku: item.sku || null,
          quantity: Number(item.quantity_mtrs || 0),
          unit: 'metres',
          unitPrice: item.price_per_mtr == null ? null : Number(item.price_per_mtr),
          lineTotal:
            item.price_per_mtr == null
              ? null
              : Number(item.price_per_mtr || 0) * Number(item.quantity_mtrs || 0),
        })),
        note: order.notes || null,
      });
    } catch (documentError) {
      toast.error(
        documentError instanceof Error
          ? documentError.message
          : 'The printable order document could not be opened.'
      );
    }
  };

  return (
    <div>
      <BuyerCatalogOrders />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-800 uppercase tracking-[0.14em] text-secondary">Bulk sourcing</p>
            <h1 className="mt-1 text-xl font-800 text-foreground">Bulk orders</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Quotes, seller confirmation, captured payment, documents, refunds and shipment progress.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs"
            >
              <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportOrders}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs"
            >
              <Icon name="ArrowDownTrayIcon" size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-2" role="tablist">
          {statusFilters.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={filter === item}
              onClick={() => setFilter(item)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-600 ${
                filter === item
                  ? 'bg-primary text-white' :'border border-border bg-card text-muted-foreground'
              }`}
            >
              {item}
              {item !== 'All' && (
                <span className="ml-1 opacity-75">
                  ({orders.filter((order) => statusGroup(order.status || 'draft') === item).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error">
            <span>{error}</span>
            <button type="button" onClick={() => void refresh()} className="font-800 underline">
              Retry
            </button>
          </div>
        )}

        <div className="space-y-3">
          {loading && (
            <div className="rounded-2xl border border-border bg-card py-12 text-center">
              <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="rounded-2xl border border-border bg-card py-12 text-center">
              <Icon name="ShoppingBagIcon" size={34} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-800">No {filter === 'All' ? '' : filter.toLowerCase()} bulk orders</p>
              <button
                type="button"
                onClick={() => router.push('/marketplace')}
                className="btn-primary mt-4 rounded-xl px-4 py-2 text-xs"
              >
                Browse fabrics
              </button>
            </div>
          )}

          {filtered.map((order) => {
            const item = firstOrderItem(order);
            const status = order.status || 'draft';
            const paymentStatus = order.payment_status || 'unpaid';
            const expanded = expandedId === order.id;
            const captured = Number(order.amount_paid || 0);
            const refunded = Number(order.amount_refunded || 0);
            const netPaid = Math.max(0, captured - refunded);
            const remaining = Math.max(0, Number(order.net_total || 0) - netPaid);
            const canCancel =
              captured === 0 && ['draft', 'quote_sent', 'confirmed'].includes(status);
            const paid = paymentStatus === 'paid';
            return (
              <article key={order.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/30"
                  aria-expanded={expanded}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="mono-id">FT-BULK-{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-600 order-status-${status}`}>
                        {statusLabels[status] || status.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-600 ${
                          paid
                            ? 'bg-success/10 text-success' : paymentStatus.includes('refund')
                              ? 'bg-warning/10 text-warning'
                              : status === 'cancelled' ?'bg-error/10 text-error' :'bg-warning/10 text-warning'
                        }`}
                      >
                        {paymentLabels[paymentStatus] || paymentStatus.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className="truncate text-sm font-700">{item?.product_name || 'Bulk fabric order'}</p>
                    <p className="text-xs text-muted-foreground">
                      {item?.quantity_mtrs ? `${item.quantity_mtrs} mtrs` : 'Quantity pending'} ·{' '}
                      {formatOrderDate(order.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-800">{formatMoney(order.net_total)}</p>
                    {remaining > 0 && netPaid > 0 ? (
                      <p className="text-xs font-700 text-warning">Balance {formatMoney(remaining)}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">including GST</p>
                    )}
                  </div>
                  <Icon name={expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} />
                </button>

                {expanded && (
                  <div className="border-t border-border px-5 pb-5 pt-4">
                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ['Unit price', item?.price_per_mtr ? `${formatMoney(item.price_per_mtr)}/mtr` : 'Quote pending'],
                        ['Subtotal', formatMoney(order.gross_total)],
                        ['GST', formatMoney(order.gst_total)],
                        ['Amount due', formatMoney(remaining)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-muted p-3">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-700">{value}</p>
                        </div>
                      ))}
                    </div>

                    {status === 'confirmed' && remaining > 0 && (
                      <div className="mb-4 max-w-sm">
                        <RazorpayCheckout
                          amount={remaining}
                          orderId={order.id}
                          orderType="bulk"
                          buttonText={netPaid > 0 ? 'Pay remaining balance' : 'Pay confirmed order'}
                          onSuccess={({ status: resultStatus }) => {
                            toast.success(
                              resultStatus === 'captured' ?'Payment captured and the order was updated.' :'Payment authorised. Waiting for capture confirmation.'
                            );
                            window.setTimeout(() => void refresh(), 1200);
                          }}
                          onError={(paymentError) => toast.error(paymentError.message)}
                        />
                      </div>
                    )}

                    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
                      <strong className="text-foreground">Documents:</strong> FabricTrad provides a printable platform order summary or payment receipt. The legally operative GST tax invoice is issued by the seller and appears separately after verification or generation.
                    </div>

                    <OrderLifecyclePanel
                      orderKind="bulk"
                      orderId={order.id}
                      viewerRole="buyer"
                      orderStatus={order.status}
                      paymentStatus={order.payment_status}
                      amountPaid={order.amount_paid}
                      amountRefunded={order.amount_refunded}
                      buyerId={order.buyer_id}
                      sellerId={order.seller_id}
                      onChanged={refresh}
                    />

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => printOrderDocument(order)}
                        className="btn-secondary rounded-xl px-3 py-2 text-xs"
                      >
                        <Icon name="PrinterIcon" size={14} className="mr-1 inline" />
                        {paid ? 'Print / save payment receipt' : 'Print / save order summary'}
                      </button>
                      {canCancel && (
                        <button
                          type="button"
                          disabled={cancellingId === order.id}
                          onClick={async () => {
                            if (!window.confirm('Cancel this unpaid order request?')) return;
                            setCancellingId(order.id);
                            try {
                              await cancelOrder(order.id);
                              toast.success('Order cancelled.');
                            } catch (cancelError) {
                              toast.error(
                                cancelError instanceof Error ? cancelError.message : 'Could not cancel order.'
                              );
                            } finally {
                              setCancellingId(null);
                            }
                          }}
                          className="rounded-xl border border-error/20 bg-error/10 px-3 py-2 text-xs text-error disabled:opacity-50"
                        >
                          <Icon name="XMarkIcon" size={14} className="mr-1 inline" />
                          {cancellingId === order.id ? 'Cancelling…' : 'Cancel unpaid order'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => router.push('/buyer-dashboard?tab=disputes')}
                        className="rounded-xl border border-border bg-muted px-3 py-2 text-xs"
                      >
                        <Icon name="ChatBubbleLeftIcon" size={14} className="mr-1 inline" />
                        Contact support
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
