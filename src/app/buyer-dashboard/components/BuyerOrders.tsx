'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import {
  firstOrderItem,
  formatMoney,
  formatOrderDate,
  useBuyerBulkOrders,
} from '@/lib/hooks/useAccountOrders';

type BuyerOrder = {
  id: string;
  groupId: string;
  product: string;
  seller: string;
  qty: string;
  unitPrice: string;
  amount: string;
  gst: string;
  total: string;
  status: string;
  statusLabel: string;
  date: string;
  dispatchETA: string;
  paymentStatus: string;
  canCancel: boolean;
};

const statusFilters = ['All', 'Pending', 'Confirmed', 'Shipped', 'Delivered', 'Rejected'];

export default function BuyerOrders() {
  const { orders: accountOrders, loading } = useBuyerBulkOrders();
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const orders: BuyerOrder[] = accountOrders.map((order) => {
    const item = firstOrderItem(order);
    const status = order.status || 'draft';
    return {
      id: `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`,
      groupId: order.id,
      product: item?.product_name || 'Bulk fabric order',
      seller: order.seller_id ? `Seller ${order.seller_id.slice(0, 6).toUpperCase()}` : 'Seller',
      qty: item?.quantity_mtrs ? `${item.quantity_mtrs} mtrs` : 'Quantity pending',
      unitPrice: item?.price_per_mtr ? `${formatMoney(item.price_per_mtr)}/mtr` : 'Quote pending',
      amount: formatMoney(order.gross_total),
      gst: formatMoney(order.gst_total),
      total: formatMoney(order.net_total),
      status,
      statusLabel: status.replace(/_/g, ' '),
      date: formatOrderDate(order.created_at),
      dispatchETA: status === 'shipped' ? 'In transit' : 'After seller confirmation',
      paymentStatus: ['paid', 'shipped', 'delivered'].includes(status) ? 'Paid' : 'Pending',
      canCancel: ['draft', 'quote_sent'].includes(status),
    };
  });

  const filtered =
    filter === 'All'
      ? orders
      : orders?.filter((o) => o?.statusLabel?.toLowerCase()?.includes(filter?.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-800 text-foreground">My Orders</h1>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-xl px-3 py-2">
          <Icon name="ArrowDownTrayIcon" size={14} />
          Export
        </button>
      </div>
      {/* Status Filters */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-2 mb-5">
        {statusFilters?.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-muted-foreground hover:border-primary'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {/* Orders List */}
      <div className="space-y-3">
        {loading && (
          <div className="bg-card rounded-2xl border border-border px-5 py-12 text-center">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="bg-card rounded-2xl border border-border px-5 py-12 text-center">
            <Icon name="ShoppingBagIcon" size={34} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-800 text-foreground">No orders found for this account</p>
            <p className="text-xs text-muted-foreground mt-1">
              Buyer orders will appear here after this signed-in account places an order.
            </p>
          </div>
        )}
        {filtered?.map((order) => (
          <div key={order?.id} className="bg-card rounded-2xl border border-border overflow-hidden">
            {/* Order Header */}
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedId(expandedId === order?.id ? null : order?.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="mono-id">{order?.id}</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-600 order-status-${order?.status}`}
                  >
                    {order?.statusLabel}
                  </span>
                  <span
                    className={`text-xs font-600 px-2 py-0.5 rounded-full ${order?.paymentStatus === 'Paid' ? 'bg-green-50 text-success' : order?.paymentStatus === 'Refunded' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-warning'}`}
                  >
                    {order?.paymentStatus}
                  </span>
                </div>
                <p className="text-sm font-700 text-foreground truncate">{order?.product}</p>
                <p className="text-xs text-muted-foreground">
                  {order?.seller} · {order?.qty} · {order?.date}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-800 text-foreground">{order?.total}</p>
                <p className="text-xs text-muted-foreground">incl. GST</p>
              </div>
              <Icon
                name={expandedId === order?.id ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                size={16}
                className="text-muted-foreground shrink-0"
              />
            </div>

            {/* Expanded Details */}
            {expandedId === order?.id && (
              <div className="px-5 pb-5 border-t border-border pt-4 animate-fade-in">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Unit Price', value: order?.unitPrice },
                    { label: 'Subtotal', value: order?.amount },
                    { label: 'GST (5%)', value: order?.gst },
                    { label: 'Dispatch ETA', value: order?.dispatchETA },
                  ]?.map((item) => (
                    <div key={item?.label} className="bg-muted rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">{item?.label}</p>
                      <p className="text-sm font-700 text-foreground">{item?.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      alert('Invoice download will be available once the order is processed.')
                    }
                    className="flex items-center gap-1.5 btn-secondary px-3 py-2 text-xs rounded-xl"
                  >
                    <Icon name="DocumentArrowDownIcon" size={14} />
                    Download Invoice
                  </button>
                  {order?.status === 'delivered' && (
                    <button
                      onClick={() => {
                        const msg =
                          'Exchange Policy: Exchanges are only accepted for damaged goods. You must provide an unboxing video as proof of damage. No returns are accepted. Please open a Dispute in the Disputes & Messages tab with your unboxing video to request an exchange.';
                        alert(msg);
                      }}
                      className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 text-xs rounded-xl font-600 hover:bg-amber-100 transition-colors"
                    >
                      <Icon name="ArrowPathIcon" size={14} />
                      Request Exchange (Damage Only)
                    </button>
                  )}
                  {order?.canCancel && (
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to cancel this order?')) {
                          alert(
                            'Cancellation request submitted. You will be notified once confirmed.'
                          );
                        }
                      }}
                      className="flex items-center gap-1.5 bg-error/10 border border-error/20 text-error px-3 py-2 text-xs rounded-xl font-600 hover:bg-error/20 transition-colors"
                    >
                      <Icon name="XMarkIcon" size={14} />
                      Cancel Order
                    </button>
                  )}
                  <button
                    onClick={() =>
                      alert('Please use the Disputes & Messages tab to contact support directly.')
                    }
                    className="flex items-center gap-1.5 bg-muted border border-border px-3 py-2 text-xs rounded-xl font-600 hover:border-primary transition-colors"
                  >
                    <Icon name="ChatBubbleLeftIcon" size={14} />
                    Contact Support
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
