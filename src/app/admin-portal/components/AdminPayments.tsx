'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

const payments = [
  { id: 'FT-PAY-009821', orderId: 'FT-ORD-005892', buyer: 'Mehta Garments', seller: 'Surat Textile Mills', amount: 264600, commission: 26460, sellerNet: 238140, rzpId: 'pay_QX8K2mN4pL9', status: 'Captured', transferStatus: 'Transferred', date: '17 Jul 2026, 14:32' },
  { id: 'FT-PAY-009820', orderId: 'FT-ORD-005891', buyer: 'Patel Textiles', seller: 'Bharat Fabrics', amount: 102900, commission: 10290, sellerNet: 92610, rzpId: 'pay_QX7J1kM3oK8', status: 'Captured', transferStatus: 'Pending', date: '17 Jul 2026, 12:18' },
  { id: 'FT-PAY-009819', orderId: 'FT-ORD-005890', buyer: 'Sharma Creations', seller: 'Laxmi Textiles', amount: 78750, commission: 7875, sellerNet: 70875, rzpId: 'pay_QX6I0jL2nJ7', status: 'Failed', transferStatus: 'N/A', date: '17 Jul 2026, 10:05' },
  { id: 'FT-PAY-009818', orderId: 'FT-ORD-005889', buyer: 'Gupta Garments', seller: 'Surat Textile Mills', amount: 315000, commission: 31500, sellerNet: 283500, rzpId: 'pay_QW9L4nP5qM2', status: 'Captured', transferStatus: 'On Hold', date: '16 Jul 2026, 18:44' },
  { id: 'FT-PAY-009817', orderId: 'FT-ORD-005888', buyer: 'Jain Fabrics', seller: 'Mehta Fabrics', amount: 183750, commission: 18375, sellerNet: 165375, rzpId: 'pay_QW8K3mN4pL1', status: 'Refunded', transferStatus: 'Reversed', date: '16 Jul 2026, 15:22' },
];

const statusColors: Record<string, string> = {
  Captured: 'bg-success/10 text-success border-success/20',
  Failed: 'bg-error/10 text-error border-error/20',
  Refunded: 'bg-amber-50 text-amber-700 border-amber-200',
  Pending: 'bg-blue-50 text-blue-700 border-blue-200',
};

const transferColors: Record<string, string> = {
  Transferred: 'bg-success/10 text-success border-success/20',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  'On Hold': 'bg-purple-50 text-purple-700 border-purple-200',
  Reversed: 'bg-error/10 text-error border-error/20',
  'N/A': 'bg-muted text-muted-foreground border-border',
};

export default function AdminPayments() {
  const [filter, setFilter] = useState('All');

  const filters = ['All', 'Captured', 'Failed', 'Refunded'];
  const filtered = filter === 'All' ? payments : payments.filter((p) => p.status === filter);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Payment Ledger</h1>
          <p className="text-sm text-muted-foreground">Razorpay · All transactions</p>
        </div>
        <button className="btn-secondary px-3 py-2 text-xs rounded-xl flex items-center gap-1.5 self-start">
          <Icon name="ArrowDownTrayIcon" size={14} />
          Export Ledger
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Collected', value: '₹84.2L', icon: 'CurrencyRupeeIcon', color: 'text-success', bg: 'bg-success/10 border-success/20' },
          { label: 'Commission Earned', value: '₹8.42L', icon: 'ReceiptPercentIcon', color: 'text-secondary', bg: 'bg-secondary/10 border-secondary/20' },
          { label: 'Transferred to Sellers', value: '₹71.4L', icon: 'BanknotesIcon', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
          { label: 'Failed Payments', value: '3', icon: 'ExclamationCircleIcon', color: 'text-error', bg: 'bg-error/10 border-error/20' },
        ].map((card) => (
          <div key={card.label} className={`stat-card border ${card.bg}`}>
            <Icon name={card.icon as 'CurrencyRupeeIcon'} size={20} className={`${card.color} mb-2`} />
            <p className={`text-2xl font-800 ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground font-500 leading-tight mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1 overflow-x-auto scrollbar-thin mb-5">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${filter === f ? 'bg-secondary text-white' : 'bg-card border border-border text-muted-foreground hover:border-secondary'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Payments Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-700 text-muted-foreground">Payment ID</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-muted-foreground">Order / Parties</th>
                <th className="px-4 py-3 text-right text-xs font-700 text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-700 text-muted-foreground">Commission</th>
                <th className="px-4 py-3 text-right text-xs font-700 text-muted-foreground">Seller Net</th>
                <th className="px-4 py-3 text-center text-xs font-700 text-muted-foreground">Payment</th>
                <th className="px-4 py-3 text-center text-xs font-700 text-muted-foreground">Transfer</th>
                <th className="px-4 py-3 text-center text-xs font-700 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((payment) => (
                <tr key={payment.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="mono-id">{payment.id}</p>
                    <p className="text-xs font-mono text-muted-foreground">{payment.rzpId}</p>
                    <p className="text-xs text-muted-foreground">{payment.date}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="mono-id">{payment.orderId}</p>
                    <p className="text-xs text-foreground font-600">{payment.buyer}</p>
                    <p className="text-xs text-muted-foreground">→ {payment.seller}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-800 text-foreground">₹{payment.amount.toLocaleString('en-IN')}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-700 text-error">₹{payment.commission.toLocaleString('en-IN')}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-700 text-success">₹{payment.sellerNet.toLocaleString('en-IN')}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-600 border rounded-full px-2 py-0.5 ${statusColors[payment.status] || 'bg-muted text-muted-foreground border-border'}`}>{payment.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-600 border rounded-full px-2 py-0.5 ${transferColors[payment.transferStatus] || 'bg-muted text-muted-foreground border-border'}`}>{payment.transferStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 hover:bg-muted rounded-lg transition-colors" title="View Details">
                        <Icon name="EyeIcon" size={14} className="text-muted-foreground" />
                      </button>
                      {payment.status === 'Captured' && payment.transferStatus !== 'Transferred' && (
                        <button className="p-1.5 hover:bg-success/10 rounded-lg transition-colors" title="Initiate Transfer">
                          <Icon name="ArrowRightCircleIcon" size={14} className="text-success" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
