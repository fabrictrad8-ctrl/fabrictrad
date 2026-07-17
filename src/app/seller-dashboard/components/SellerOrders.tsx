'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

const orders = [
  {
    id: 'FT-ORD-005892', buyer: 'Mehta Garments, Mumbai', buyerType: 'Wholesaler',
    product: 'Pure Dyeable Soft Nett Fabric', qty: 300, unit: 'mtrs', price: 840,
    amount: '₹2,52,000', status: 'pending', expiresIn: '08:45', date: '17 Jul 2026 10:00 AM',
    city: 'Mumbai, Maharashtra', stock: 2400,
  },
  {
    id: 'FT-ORD-005901', buyer: 'Patel Textiles, Ahmedabad', buyerType: 'Retailer',
    product: 'Organza Sequence Fabric', qty: 100, unit: 'mtrs', price: 980,
    amount: '₹98,000', status: 'pending', expiresIn: '03:12', date: '17 Jul 2026 11:30 AM',
    city: 'Ahmedabad, Gujarat', stock: 450,
  },
  {
    id: 'FT-ORD-005855', buyer: 'Sharma Brothers, Delhi', buyerType: 'Distributor',
    product: 'Georgette Embroidered Fabric', qty: 75, unit: 'mtrs', price: 1250,
    amount: '₹93,750', status: 'accepted', expiresIn: null, date: '16 Jul 2026 02:00 PM',
    city: 'New Delhi', stock: 800,
  },
  {
    id: 'FT-ORD-005802', buyer: 'Verma Fashions, Jaipur', buyerType: 'Manufacturer',
    product: 'Pure Dyeable Soft Nett Fabric', qty: 150, unit: 'mtrs', price: 790,
    amount: '₹1,18,500', status: 'paid', expiresIn: null, date: '15 Jul 2026 09:00 AM',
    city: 'Jaipur, Rajasthan', stock: 2400,
  },
  {
    id: 'FT-ORD-005721', buyer: 'Kapoor Export House', buyerType: 'Exporter',
    product: 'Organza Sequence Fabric', qty: 200, unit: 'mtrs', price: 960,
    amount: '₹1,92,000', status: 'shipped', expiresIn: null, date: '12 Jul 2026 03:00 PM',
    city: 'Surat, Gujarat', stock: 450,
  },
];

const statusMap: Record<string, { label: string; class: string }> = {
  pending: { label: 'Awaiting Response', class: 'order-status-pending' },
  accepted: { label: 'Accepted', class: 'order-status-confirmed' },
  paid: { label: 'Payment Received', class: 'order-status-paid' },
  shipped: { label: 'Shipped', class: 'order-status-shipped' },
  delivered: { label: 'Delivered', class: 'order-status-delivered' },
  rejected: { label: 'Rejected', class: 'order-status-rejected' },
};

export default function SellerOrders() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [showCounterModal, setShowCounterModal] = useState<string | null>(null);
  const [counterQty, setCounterQty] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  const filters = ['All', 'Pending', 'Accepted', 'Paid', 'Shipped'];
  const filtered = activeFilter === 'All' ? orders : orders.filter((o) => o.status === activeFilter.toLowerCase());

  const rejectionReasons = [
    'Insufficient stock', 'Sold offline', 'Production delay',
    'Incorrect inventory', 'Quality issue', 'Delivery location not serviceable',
    'Temporarily unavailable', 'Other',
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-800 text-foreground">Order Queue</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Live updates
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-2 mb-5">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${
              activeFilter === f ? 'bg-secondary text-white' : 'bg-card border border-border text-muted-foreground hover:border-secondary'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div className="space-y-4">
        {filtered.map((order) => (
          <div key={order.id} className={`bg-card rounded-2xl border overflow-hidden ${order.status === 'pending' ? 'border-primary/30' : 'border-border'}`}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-border bg-muted/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="mono-id">{order.id}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-600 ${statusMap[order.status]?.class}`}>
                    {statusMap[order.status]?.label}
                  </span>
                  {order.expiresIn && (
                    <span className="flex items-center gap-1 text-xs font-700 text-error bg-error/10 px-2 py-0.5 rounded-full">
                      <Icon name="ClockIcon" size={11} />
                      {order.expiresIn} left
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{order.date}</span>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Buyer</p>
                  <p className="text-sm font-700 text-foreground">{order.buyer}</p>
                  <p className="text-xs text-muted-foreground">{order.buyerType} · {order.city}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Product</p>
                  <p className="text-sm font-700 text-foreground">{order.product}</p>
                  <p className="text-xs text-muted-foreground">Requested: {order.qty} {order.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Your Stock</p>
                  <p className="text-sm font-700 text-foreground">{order.stock.toLocaleString('en-IN')} {order.unit}</p>
                  <p className="text-xs text-success">Sufficient stock available</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Order Value</p>
                  <p className="text-base font-800 text-primary">{order.amount}</p>
                  <p className="text-xs text-muted-foreground">₹{order.price}/mtr × {order.qty}</p>
                </div>
              </div>

              {/* Actions */}
              {order.status === 'pending' && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                  <button className="flex items-center gap-1.5 bg-success text-white text-xs font-700 px-4 py-2 rounded-xl hover:bg-green-700 transition-colors">
                    <Icon name="CheckIcon" size={14} />
                    Accept Full Qty ({order.qty} mtrs)
                  </button>
                  <button
                    onClick={() => setShowCounterModal(order.id)}
                    className="flex items-center gap-1.5 bg-amber-500 text-white text-xs font-700 px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors"
                  >
                    <Icon name="ArrowsRightLeftIcon" size={14} />
                    Counter Offer
                  </button>
                  <button
                    onClick={() => setShowRejectModal(order.id)}
                    className="flex items-center gap-1.5 bg-error/10 border border-error/30 text-error text-xs font-700 px-4 py-2 rounded-xl hover:bg-error hover:text-white transition-all"
                  >
                    <Icon name="XMarkIcon" size={14} />
                    Reject
                  </button>
                </div>
              )}

              {order.status === 'paid' && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                  <button className="flex items-center gap-1.5 btn-primary px-4 py-2 text-xs rounded-xl">
                    <Icon name="TruckIcon" size={14} />
                    Mark Ready for Pickup
                  </button>
                  <button className="flex items-center gap-1.5 btn-secondary px-4 py-2 text-xs rounded-xl">
                    <Icon name="DocumentArrowDownIcon" size={14} />
                    Download Label
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Counter Modal */}
      {showCounterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md">
            <h3 className="font-800 text-foreground mb-4">Counter Offer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Available Quantity (mtrs) *</label>
                <input
                  type="number"
                  value={counterQty}
                  onChange={(e) => setCounterQty(e.target.value)}
                  placeholder="Enter available quantity"
                  className="input-base w-full px-4 py-3 text-sm rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Explanation (optional)</label>
                <textarea
                  rows={3}
                  placeholder="E.g., Only 200 mtrs available, remaining 100 mtrs on production..."
                  className="input-base w-full px-4 py-3 text-sm rounded-xl resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCounterModal(null)} className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">Cancel</button>
              <button onClick={() => setShowCounterModal(null)} className="btn-primary flex-1 py-2.5 text-sm rounded-xl">Send Counter</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md">
            <h3 className="font-800 text-foreground mb-4">Reject Order Request</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-700 text-foreground mb-2">Rejection Reason *</label>
                <div className="space-y-2">
                  {rejectionReasons.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setRejectReason(reason)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                        rejectReason === reason ? 'bg-error/10 border border-error/30 text-error font-600' : 'bg-muted hover:bg-muted/80 text-foreground'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-700 text-foreground mb-1.5">Actual Available Stock (mtrs) *</label>
                <input
                  type="number"
                  placeholder="Current available quantity"
                  className="input-base w-full px-4 py-3 text-sm rounded-xl"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowRejectModal(null)} className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">Cancel</button>
              <button
                onClick={() => setShowRejectModal(null)}
                disabled={!rejectReason}
                className="flex-1 py-2.5 text-sm rounded-xl bg-error text-white font-600 disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}