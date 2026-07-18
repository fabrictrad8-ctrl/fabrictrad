'use client';
import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';
import { createClient } from '@/lib/supabase/client';

type AdminPayment = {
  id: string;
  orderId: string;
  buyer: string;
  seller: string;
  amount: number;
  commission: number;
  sellerNet: number;
  rzpId: string;
  status: string;
  transferStatus: string;
  date: string;
};

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
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const filters = ['All', 'Captured', 'Failed', 'Refunded'];

  useEffect(() => {
    let mounted = true;
    async function loadPayments() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('payments')
        .select('id,order_id,razorpay_payment_id,amount,status,created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!mounted) return;
      setPayments(
        (data || []).map((payment) => {
          const amount = Number(payment.amount || 0);
          const status =
            payment.status === 'succeeded' || payment.status === 'captured'
              ? 'Captured'
              : payment.status === 'failed'
                ? 'Failed'
                : payment.status === 'refunded'
                  ? 'Refunded'
                  : 'Pending';

          return {
            id: `FT-PAY-${String(payment.id).slice(0, 8).toUpperCase()}`,
            orderId: payment.order_id
              ? `FT-ORD-${String(payment.order_id).slice(0, 8).toUpperCase()}`
              : 'Not linked',
            buyer: 'Order buyer',
            seller: 'Order seller',
            amount,
            commission: Math.round(amount * 0.1),
            sellerNet: Math.round(amount * 0.9),
            rzpId: payment.razorpay_payment_id || 'Pending',
            status,
            transferStatus: status === 'Captured' ? 'Pending' : 'N/A',
            date: payment.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          };
        })
      );
      setLoading(false);
    }

    loadPayments();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = payments.filter((p) => {
    const matchStatus = filter === 'All' || p.status === filter;
    const d = new Date(p.date);
    const matchFrom = dateFrom ? d >= new Date(dateFrom) : true;
    const matchTo = dateTo ? d <= new Date(dateTo) : true;
    return matchStatus && matchFrom && matchTo;
  });
  const totalCollected = filtered.reduce((sum, payment) => sum + payment.amount, 0);
  const totalCommission = filtered.reduce((sum, payment) => sum + payment.commission, 0);
  const sellerNet = filtered.reduce((sum, payment) => sum + payment.sellerNet, 0);
  const failedCount = filtered.filter((payment) => payment.status === 'Failed').length;

  const getExportData = () =>
    filtered.map((p) => ({
      'Payment ID': p.id,
      'Order ID': p.orderId,
      Buyer: p.buyer,
      Seller: p.seller,
      'Amount (₹)': p.amount,
      'Commission (₹)': p.commission,
      'Seller Net (₹)': p.sellerNet,
      'Razorpay ID': p.rzpId,
      'Payment Status': p.status,
      'Transfer Status': p.transferStatus,
      Date: p.date,
    }));

  const handleExportCSV = () => {
    exportToCSV(getExportData(), `payments_${dateFrom || 'all'}_to_${dateTo || 'all'}`);
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    exportToExcel(getExportData(), `payments_${dateFrom || 'all'}_to_${dateTo || 'all'}`);
    setShowExportMenu(false);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Payment Ledger</h1>
          <p className="text-sm text-muted-foreground">Razorpay · All transactions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range */}
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2">
            <Icon name="CalendarIcon" size={14} className="text-muted-foreground" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-xs text-foreground outline-none w-28"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-xs text-foreground outline-none w-28"
            />
          </div>
          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-secondary px-3 py-2 text-xs rounded-xl flex items-center gap-1.5"
            >
              <Icon name="ArrowDownTrayIcon" size={14} />
              Export Ledger
              <Icon name="ChevronDownIcon" size={12} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-10 min-w-[140px]">
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-600 text-foreground hover:bg-muted transition-colors rounded-t-xl"
                >
                  <Icon name="DocumentTextIcon" size={14} className="text-success" />
                  Export CSV
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-600 text-foreground hover:bg-muted transition-colors rounded-b-xl border-t border-border"
                >
                  <Icon name="TableCellsIcon" size={14} className="text-primary" />
                  Export Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: 'Total Collected',
            value: `₹${totalCollected.toLocaleString('en-IN')}`,
            icon: 'CurrencyRupeeIcon',
            color: 'text-success',
            bg: 'bg-success/10 border-success/20',
          },
          {
            label: 'Commission Earned',
            value: `₹${totalCommission.toLocaleString('en-IN')}`,
            icon: 'ReceiptPercentIcon',
            color: 'text-secondary',
            bg: 'bg-secondary/10 border-secondary/20',
          },
          {
            label: 'Transferred to Sellers',
            value: `₹${sellerNet.toLocaleString('en-IN')}`,
            icon: 'BanknotesIcon',
            color: 'text-primary',
            bg: 'bg-primary/10 border-primary/20',
          },
          {
            label: 'Failed Payments',
            value: String(failedCount),
            icon: 'ExclamationCircleIcon',
            color: 'text-error',
            bg: 'bg-error/10 border-error/20',
          },
        ].map((card) => (
          <div key={card.label} className={`stat-card border ${card.bg}`}>
            <Icon
              name={card.icon as 'CurrencyRupeeIcon'}
              size={20}
              className={`${card.color} mb-2`}
            />
            <p className={`text-2xl font-800 ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground font-500 leading-tight mt-0.5">
              {card.label}
            </p>
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
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
          >
            Clear dates ×
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {loading
          ? 'Loading transactions...'
          : `Showing ${filtered.length} of ${payments.length} transactions`}
      </p>

      {/* Payments Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-700 text-muted-foreground">
                  Payment ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-700 text-muted-foreground">
                  Order / Parties
                </th>
                <th className="px-4 py-3 text-right text-xs font-700 text-muted-foreground">
                  Amount
                </th>
                <th className="px-4 py-3 text-right text-xs font-700 text-muted-foreground">
                  Commission
                </th>
                <th className="px-4 py-3 text-right text-xs font-700 text-muted-foreground">
                  Seller Net
                </th>
                <th className="px-4 py-3 text-center text-xs font-700 text-muted-foreground">
                  Payment
                </th>
                <th className="px-4 py-3 text-center text-xs font-700 text-muted-foreground">
                  Transfer
                </th>
                <th className="px-4 py-3 text-center text-xs font-700 text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Icon
                      name="CreditCardIcon"
                      size={34}
                      className="mx-auto mb-3 text-muted-foreground"
                    />
                    <p className="text-sm font-800 text-foreground">No payment records yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Razorpay captures, failures, refunds, and transfers will appear here from the
                      live payment table.
                    </p>
                  </td>
                </tr>
              )}
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
                    <p className="text-sm font-800 text-foreground">
                      ₹{payment.amount.toLocaleString('en-IN')}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-700 text-error">
                      ₹{payment.commission.toLocaleString('en-IN')}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-700 text-success">
                      ₹{payment.sellerNet.toLocaleString('en-IN')}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs font-600 border rounded-full px-2 py-0.5 ${statusColors[payment.status] || 'bg-muted text-muted-foreground border-border'}`}
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs font-600 border rounded-full px-2 py-0.5 ${transferColors[payment.transferStatus] || 'bg-muted text-muted-foreground border-border'}`}
                    >
                      {payment.transferStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Icon name="EyeIcon" size={14} className="text-muted-foreground" />
                      </button>
                      {payment.status === 'Captured' &&
                        payment.transferStatus !== 'Transferred' && (
                          <button
                            className="p-1.5 hover:bg-success/10 rounded-lg transition-colors"
                            title="Initiate Transfer"
                          >
                            <Icon name="ArrowRightCircleIcon" size={14} className="text-success" />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Loading payment records...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
