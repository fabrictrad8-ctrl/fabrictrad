'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

const orders = [
  {
    id: 'FT-ORD-004521', groupId: 'FT-GRP-002341',
    product: 'Pure Dyeable Soft Nett Fabric', seller: 'Surat Textile Mills Pvt Ltd',
    qty: '200 mtrs', unitPrice: '₹840/mtr', amount: '₹1,68,000', gst: '₹8,400',
    total: '₹1,76,400', status: 'confirmed', statusLabel: 'Seller Confirmed',
    date: '16 Jul 2026', dispatchETA: '18 Jul 2026', paymentStatus: 'Paid',
    canCancel: false,
  },
  {
    id: 'FT-ORD-004489', groupId: 'FT-GRP-002310',
    product: 'Georgette Embroidered Fabric', seller: 'Jaipur Crafts Emporium',
    qty: '50 mtrs', unitPrice: '₹1,250/mtr', amount: '₹62,500', gst: '₹3,125',
    total: '₹65,625', status: 'shipped', statusLabel: 'In Transit',
    date: '14 Jul 2026', dispatchETA: '19 Jul 2026', paymentStatus: 'Paid',
    canCancel: false,
  },
  {
    id: 'FT-ORD-004401', groupId: 'FT-GRP-002280',
    product: 'Cotton Cambric Fabric', seller: 'Bhiwandi Weave House',
    qty: '300 mtrs', unitPrice: '₹185/mtr', amount: '₹55,500', gst: '₹2,775',
    total: '₹58,275', status: 'pending', statusLabel: 'Awaiting Seller',
    date: '13 Jul 2026', dispatchETA: 'TBD', paymentStatus: 'Pending',
    canCancel: true,
  },
  {
    id: 'FT-ORD-004320', groupId: 'FT-GRP-002210',
    product: 'Banarasi Silk Brocade', seller: 'Varanasi Silk Traders',
    qty: '20 mtrs', unitPrice: '₹3,200/mtr', amount: '₹64,000', gst: '₹3,200',
    total: '₹67,200', status: 'delivered', statusLabel: 'Delivered',
    date: '05 Jul 2026', dispatchETA: '10 Jul 2026', paymentStatus: 'Paid',
    canCancel: false,
  },
  {
    id: 'FT-ORD-004198', groupId: 'FT-GRP-002100',
    product: 'Polyester Crepe Fabric', seller: 'Mumbai Fabric Zone',
    qty: '500 mtrs', unitPrice: '₹320/mtr', amount: '₹1,60,000', gst: '₹8,000',
    total: '₹1,68,000', status: 'rejected', statusLabel: 'Seller Rejected',
    date: '01 Jul 2026', dispatchETA: 'N/A', paymentStatus: 'Refunded',
    canCancel: false,
  },
];

const statusFilters = ['All', 'Pending', 'Confirmed', 'Shipped', 'Delivered', 'Rejected'];

export default function BuyerOrders() {
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter === 'All' ? orders : orders?.filter((o) => o?.statusLabel?.toLowerCase()?.includes(filter?.toLowerCase()));

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
              filter === f ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:border-primary'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {/* Orders List */}
      <div className="space-y-3">
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
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-600 order-status-${order?.status}`}>
                    {order?.statusLabel}
                  </span>
                  <span className={`text-xs font-600 px-2 py-0.5 rounded-full ${order?.paymentStatus === 'Paid' ? 'bg-green-50 text-success' : order?.paymentStatus === 'Refunded' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-warning'}`}>
                    {order?.paymentStatus}
                  </span>
                </div>
                <p className="text-sm font-700 text-foreground truncate">{order?.product}</p>
                <p className="text-xs text-muted-foreground">{order?.seller} · {order?.qty} · {order?.date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-800 text-foreground">{order?.total}</p>
                <p className="text-xs text-muted-foreground">incl. GST</p>
              </div>
              <Icon name={expandedId === order?.id ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-muted-foreground shrink-0" />
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
                    onClick={() => alert('Invoice download will be available once the order is processed.')}
                    className="flex items-center gap-1.5 btn-secondary px-3 py-2 text-xs rounded-xl"
                  >
                    <Icon name="DocumentArrowDownIcon" size={14} />
                    Download Invoice
                  </button>
                  {order?.status === 'delivered' && (
                    <button
                      onClick={() => {
                        const msg = 'Exchange Policy: Exchanges are only accepted for damaged goods. You must provide an unboxing video as proof of damage. No returns are accepted. Please open a Dispute in the Disputes & Messages tab with your unboxing video to request an exchange.';
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
                          alert('Cancellation request submitted. You will be notified once confirmed.');
                        }
                      }}
                      className="flex items-center gap-1.5 bg-error/10 border border-error/20 text-error px-3 py-2 text-xs rounded-xl font-600 hover:bg-error/20 transition-colors"
                    >
                      <Icon name="XMarkIcon" size={14} />
                      Cancel Order
                    </button>
                  )}
                  <button
                    onClick={() => alert('Please use the Disputes & Messages tab to contact support directly.')}
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