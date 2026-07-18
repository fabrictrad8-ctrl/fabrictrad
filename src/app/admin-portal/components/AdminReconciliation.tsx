'use client';
import React, { useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReconciliationRow {
  id: string;
  orderId: string;
  buyer: string;
  seller: string;
  rzpPaymentId: string;
  rzpAmount: number;
  ledgerAmount: number;
  discrepancy: number;
  rzpStatus: string;
  ledgerStatus: string;
  transferStatus: string;
  settlementDelay: number; // hours
  date: string;
  flagged: boolean;
  flagReason?: string;
}

interface WebhookRetry {
  id: string;
  source: 'razorpay' | 'shiprocket';
  eventType: string;
  attempts: number;
  lastAttempt: string;
  nextRetry: string;
  errorMessage: string;
  status: 'pending' | 'retrying' | 'dead';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const reconciliationData: ReconciliationRow[] = [
  {
    id: 'REC-001',
    orderId: 'FT-ORD-005892',
    buyer: 'Mehta Garments',
    seller: 'Surat Textile Mills',
    rzpPaymentId: 'pay_QX8K2mN4pL9',
    rzpAmount: 264600,
    ledgerAmount: 264600,
    discrepancy: 0,
    rzpStatus: 'Captured',
    ledgerStatus: 'Recorded',
    transferStatus: 'Transferred',
    settlementDelay: 2,
    date: '17 Jul 2026, 14:32',
    flagged: false,
  },
  {
    id: 'REC-002',
    orderId: 'FT-ORD-005891',
    buyer: 'Patel Textiles',
    seller: 'Bharat Fabrics',
    rzpPaymentId: 'pay_QX7J1kM3oK8',
    rzpAmount: 102900,
    ledgerAmount: 102900,
    discrepancy: 0,
    rzpStatus: 'Captured',
    ledgerStatus: 'Recorded',
    transferStatus: 'Pending',
    settlementDelay: 28,
    date: '17 Jul 2026, 12:18',
    flagged: true,
    flagReason: 'Settlement delayed >24h',
  },
  {
    id: 'REC-003',
    orderId: 'FT-ORD-005890',
    buyer: 'Sharma Creations',
    seller: 'Laxmi Textiles',
    rzpPaymentId: 'pay_QX6I0jL2nJ7',
    rzpAmount: 78750,
    ledgerAmount: 0,
    discrepancy: 78750,
    rzpStatus: 'Failed',
    ledgerStatus: 'Missing',
    transferStatus: 'N/A',
    settlementDelay: 0,
    date: '17 Jul 2026, 10:05',
    flagged: true,
    flagReason: 'Payment failed — ledger entry missing',
  },
  {
    id: 'REC-004',
    orderId: 'FT-ORD-005889',
    buyer: 'Gupta Garments',
    seller: 'Surat Textile Mills',
    rzpPaymentId: 'pay_QW9L4nP5qM2',
    rzpAmount: 315000,
    ledgerAmount: 315000,
    discrepancy: 0,
    rzpStatus: 'Captured',
    ledgerStatus: 'Recorded',
    transferStatus: 'On Hold',
    settlementDelay: 36,
    date: '16 Jul 2026, 18:44',
    flagged: true,
    flagReason: 'Transfer on hold — compliance review',
  },
  {
    id: 'REC-005',
    orderId: 'FT-ORD-005888',
    buyer: 'Jain Fabrics',
    seller: 'Mehta Fabrics',
    rzpPaymentId: 'pay_QW8K3mN4pL1',
    rzpAmount: 183750,
    ledgerAmount: 183750,
    discrepancy: 0,
    rzpStatus: 'Refunded',
    ledgerStatus: 'Recorded',
    transferStatus: 'Reversed',
    settlementDelay: 0,
    date: '16 Jul 2026, 15:22',
    flagged: false,
  },
  {
    id: 'REC-006',
    orderId: 'FT-ORD-005887',
    buyer: 'Kapoor Exports',
    seller: 'Bharat Fabrics',
    rzpPaymentId: 'pay_QW7J2lM5oK0',
    rzpAmount: 421500,
    ledgerAmount: 420000,
    discrepancy: 1500,
    rzpStatus: 'Captured',
    ledgerStatus: 'Mismatch',
    transferStatus: 'Pending',
    settlementDelay: 18,
    date: '16 Jul 2026, 11:10',
    flagged: true,
    flagReason: 'Amount mismatch ₹1,500 — investigate',
  },
  {
    id: 'REC-007',
    orderId: 'FT-ORD-005886',
    buyer: 'Singh Textiles',
    seller: 'Laxmi Textiles',
    rzpPaymentId: 'pay_QV6I1kL4nJ9',
    rzpAmount: 94500,
    ledgerAmount: 94500,
    discrepancy: 0,
    rzpStatus: 'Captured',
    ledgerStatus: 'Recorded',
    transferStatus: 'Transferred',
    settlementDelay: 4,
    date: '15 Jul 2026, 16:55',
    flagged: false,
  },
];

const webhookRetries: WebhookRetry[] = [
  {
    id: 'WH-001',
    source: 'razorpay',
    eventType: 'payment.captured',
    attempts: 3,
    lastAttempt: '17 Jul 2026, 14:45',
    nextRetry: '17 Jul 2026, 15:15',
    errorMessage: 'Supabase connection timeout',
    status: 'retrying',
  },
  {
    id: 'WH-002',
    source: 'shiprocket',
    eventType: 'IN TRANSIT',
    attempts: 2,
    lastAttempt: '17 Jul 2026, 13:22',
    nextRetry: '17 Jul 2026, 13:52',
    errorMessage: 'AWB not found in shipments table',
    status: 'retrying',
  },
  {
    id: 'WH-003',
    source: 'razorpay',
    eventType: 'transfer.processed',
    attempts: 5,
    lastAttempt: '17 Jul 2026, 11:00',
    nextRetry: '—',
    errorMessage: 'Linked account ID mismatch — max retries exceeded',
    status: 'dead',
  },
  {
    id: 'WH-004',
    source: 'shiprocket',
    eventType: 'DELIVERED',
    attempts: 1,
    lastAttempt: '16 Jul 2026, 18:30',
    nextRetry: '16 Jul 2026, 18:35',
    errorMessage: 'Email notification service unavailable',
    status: 'pending',
  },
];

const settlementTrend = [
  { day: 'Mon', avgDelay: 3.2, flagged: 1 },
  { day: 'Tue', avgDelay: 2.8, flagged: 0 },
  { day: 'Wed', avgDelay: 5.1, flagged: 2 },
  { day: 'Thu', avgDelay: 4.4, flagged: 1 },
  { day: 'Fri', avgDelay: 28.5, flagged: 3 },
  { day: 'Sat', avgDelay: 18.2, flagged: 2 },
  { day: 'Sun', avgDelay: 6.7, flagged: 1 },
];

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportToCSV(rows: ReconciliationRow[]) {
  const headers = [
    'Rec ID',
    'Order ID',
    'Buyer',
    'Seller',
    'Razorpay Payment ID',
    'Razorpay Amount',
    'Ledger Amount',
    'Discrepancy',
    'Razorpay Status',
    'Ledger Status',
    'Transfer Status',
    'Settlement Delay (hrs)',
    'Date',
    'Flagged',
    'Flag Reason',
  ];
  const csvRows = rows.map((r) => [
    r.id,
    r.orderId,
    r.buyer,
    r.seller,
    r.rzpPaymentId,
    r.rzpAmount,
    r.ledgerAmount,
    r.discrepancy,
    r.rzpStatus,
    r.ledgerStatus,
    r.transferStatus,
    r.settlementDelay,
    r.date,
    r.flagged ? 'Yes' : 'No',
    r.flagReason || '',
  ]);
  const csvContent = [headers, ...csvRows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fabrictrad_reconciliation_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  icon,
  color,
  bg,
  sub,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  bg: string;
  sub?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <Icon name={icon as 'CurrencyRupeeIcon'} size={20} className={`${color} mb-2`} />
      <p className={`text-2xl font-800 ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground font-500 leading-tight mt-0.5">{label}</p>
      {sub && <p className="text-xs font-600 text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminReconciliation() {
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'webhooks' | 'delays'>(
    'reconciliation'
  );
  const [filter, setFilter] = useState<'All' | 'Flagged' | 'Mismatch' | 'Delayed'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRows = reconciliationData.filter((row) => {
    const matchesFilter =
      filter === 'All'
        ? true
        : filter === 'Flagged'
          ? row.flagged
          : filter === 'Mismatch'
            ? row.discrepancy > 0
            : filter === 'Delayed'
              ? row.settlementDelay > 24
              : false;
    const matchesSearch =
      searchQuery === '' ||
      [row.orderId, row.buyer, row.seller, row.rzpPaymentId].some((v) =>
        v.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesFilter && matchesSearch;
  });

  const totalDiscrepancy = reconciliationData.reduce((s, r) => s + r.discrepancy, 0);
  const flaggedCount = reconciliationData.filter((r) => r.flagged).length;
  const delayedCount = reconciliationData.filter((r) => r.settlementDelay > 24).length;
  const deadLetterCount = webhookRetries.filter((w) => w.status === 'dead').length;

  const handleExport = useCallback(() => exportToCSV(filteredRows), [filteredRows]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Payment Reconciliation</h1>
          <p className="text-sm text-muted-foreground">Razorpay vs FabricTrad Ledger · Real-time</p>
        </div>
        <button
          onClick={handleExport}
          className="btn-secondary px-4 py-2 text-xs rounded-xl flex items-center gap-1.5 self-start"
        >
          <Icon name="ArrowDownTrayIcon" size={14} />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          label="Total Discrepancy"
          value={`₹${totalDiscrepancy.toLocaleString('en-IN')}`}
          icon="ExclamationTriangleIcon"
          color="text-error"
          bg="bg-error/10 border-error/20"
          sub={`${flaggedCount} flagged`}
        />
        <SummaryCard
          label="Flagged for Review"
          value={String(flaggedCount)}
          icon="FlagIcon"
          color="text-warning"
          bg="bg-amber-50 border-amber-200"
          sub="Needs investigation"
        />
        <SummaryCard
          label="Settlement Delays"
          value={String(delayedCount)}
          icon="ClockIcon"
          color="text-purple-600"
          bg="bg-purple-50 border-purple-200"
          sub=">24h pending"
        />
        <SummaryCard
          label="Dead-Letter Events"
          value={String(deadLetterCount)}
          icon="XCircleIcon"
          color="text-error"
          bg="bg-error/10 border-error/20"
          sub="Max retries hit"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {(['reconciliation', 'webhooks', 'delays'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-600 border-b-2 transition-all capitalize ${
              activeTab === tab
                ? 'border-secondary text-secondary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'reconciliation'
              ? 'Reconciliation'
              : tab === 'webhooks'
                ? 'Failed Webhooks'
                : 'Settlement Delays'}
          </button>
        ))}
      </div>

      {/* ── Tab: Reconciliation ── */}
      {activeTab === 'reconciliation' && (
        <div>
          {/* Filters + Search */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex gap-1 overflow-x-auto scrollbar-thin">
              {(['All', 'Flagged', 'Mismatch', 'Delayed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${filter === f ? 'bg-secondary text-white' : 'bg-card border border-border text-muted-foreground hover:border-secondary'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="relative flex-1 sm:max-w-xs">
              <Icon
                name="MagnifyingGlassIcon"
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order, buyer, payment ID…"
                className="input-base w-full pl-8 pr-4 py-2 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    {[
                      'Order / Payment',
                      'Parties',
                      'Razorpay',
                      'Ledger',
                      'Discrepancy',
                      'Transfer',
                      'Delay',
                      'Flag',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-700 text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-muted/30 transition-colors ${row.flagged ? 'bg-error/3' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="mono-id">{row.orderId}</p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {row.rzpPaymentId}
                        </p>
                        <p className="text-xs text-muted-foreground">{row.date}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-600 text-foreground">{row.buyer}</p>
                        <p className="text-xs text-muted-foreground">→ {row.seller}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-800 text-foreground">
                          ₹{row.rzpAmount.toLocaleString('en-IN')}
                        </p>
                        <span
                          className={`text-xs font-600 border rounded-full px-2 py-0.5 ${
                            row.rzpStatus === 'Captured'
                              ? 'bg-success/10 text-success border-success/20'
                              : row.rzpStatus === 'Failed'
                                ? 'bg-error/10 text-error border-error/20'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {row.rzpStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-800 text-foreground">
                          ₹{row.ledgerAmount.toLocaleString('en-IN')}
                        </p>
                        <span
                          className={`text-xs font-600 border rounded-full px-2 py-0.5 ${
                            row.ledgerStatus === 'Recorded'
                              ? 'bg-success/10 text-success border-success/20'
                              : row.ledgerStatus === 'Missing' || row.ledgerStatus === 'Mismatch'
                                ? 'bg-error/10 text-error border-error/20'
                                : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {row.ledgerStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className={`text-sm font-800 ${row.discrepancy > 0 ? 'text-error' : 'text-success'}`}
                        >
                          {row.discrepancy > 0
                            ? `₹${row.discrepancy.toLocaleString('en-IN')}`
                            : '✓ Match'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-600 border rounded-full px-2 py-0.5 ${
                            row.transferStatus === 'Transferred'
                              ? 'bg-success/10 text-success border-success/20'
                              : row.transferStatus === 'Pending'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : row.transferStatus === 'On Hold'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {row.transferStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-700 ${row.settlementDelay > 24 ? 'text-error' : row.settlementDelay > 8 ? 'text-warning' : 'text-success'}`}
                        >
                          {row.settlementDelay > 0 ? `${row.settlementDelay}h` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.flagged ? (
                          <div className="flex items-start gap-1">
                            <Icon
                              name="FlagIcon"
                              size={14}
                              className="text-error shrink-0 mt-0.5"
                            />
                            <p className="text-xs text-error font-500 leading-tight">
                              {row.flagReason}
                            </p>
                          </div>
                        ) : (
                          <Icon name="CheckCircleIcon" size={14} className="text-success" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{filteredRows.length} records</p>
              <button
                onClick={handleExport}
                className="text-xs text-secondary font-600 hover:underline flex items-center gap-1"
              >
                <Icon name="ArrowDownTrayIcon" size={12} /> Export filtered rows
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Failed Webhooks ── */}
      {activeTab === 'webhooks' && (
        <div className="space-y-3">
          {webhookRetries.map((wh) => (
            <div
              key={wh.id}
              className={`bg-card rounded-2xl border p-4 ${wh.status === 'dead' ? 'border-error/30 bg-error/3' : wh.status === 'retrying' ? 'border-warning/30' : 'border-border'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-700 px-2 py-0.5 rounded-full border ${
                        wh.source === 'razorpay'
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-secondary/10 text-secondary border-secondary/20'
                      }`}
                    >
                      {wh.source === 'razorpay' ? 'Razorpay' : 'Shiprocket'}
                    </span>
                    <span className="text-sm font-700 text-foreground font-mono">
                      {wh.eventType}
                    </span>
                    <span
                      className={`text-xs font-600 px-2 py-0.5 rounded-full border ${
                        wh.status === 'dead'
                          ? 'bg-error/10 text-error border-error/20'
                          : wh.status === 'retrying'
                            ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {wh.status === 'dead'
                        ? 'Dead Letter'
                        : wh.status === 'retrying'
                          ? 'Retrying'
                          : 'Queued'}
                    </span>
                  </div>
                  <p className="text-xs text-error mb-2">{wh.errorMessage}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>
                      Attempts: <span className="font-700 text-foreground">{wh.attempts}</span>
                    </span>
                    <span>
                      Last: <span className="font-600 text-foreground">{wh.lastAttempt}</span>
                    </span>
                    <span>
                      Next retry:{' '}
                      <span
                        className={`font-600 ${wh.status === 'dead' ? 'text-error' : 'text-foreground'}`}
                      >
                        {wh.nextRetry}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {wh.status !== 'dead' && (
                    <button
                      className="p-2 hover:bg-success/10 rounded-lg transition-colors"
                      title="Retry now"
                    >
                      <Icon name="ArrowPathIcon" size={14} className="text-success" />
                    </button>
                  )}
                  <button
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="View payload"
                  >
                    <Icon name="EyeIcon" size={14} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className="p-4 bg-muted/50 rounded-xl border border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-700 text-foreground">Retry logic:</span> Exponential backoff —
              200ms → 400ms → 800ms → 1.6s. After 4 failed attempts, events are moved to the
              dead-letter queue for manual investigation.
            </p>
          </div>
        </div>
      )}

      {/* ── Tab: Settlement Delays ── */}
      {activeTab === 'delays' && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <div className="bg-card rounded-2xl border border-border p-5">
              <h3 className="font-800 text-foreground text-sm mb-4">
                Avg Settlement Delay (hours)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={settlementTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgDelay"
                    stroke="var(--secondary)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--secondary)', r: 4 }}
                    name="Avg Delay (h)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5">
              <h3 className="font-800 text-foreground text-sm mb-4">
                Flagged Transactions per Day
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={settlementTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="flagged"
                    fill="var(--error)"
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                    name="Flagged"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Delayed settlements list */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-800 text-foreground text-sm">Settlements Delayed &gt;24h</h3>
            </div>
            <div className="divide-y divide-border">
              {reconciliationData
                .filter((r) => r.settlementDelay > 24)
                .map((row) => (
                  <div key={row.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="mono-id">{row.orderId}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.buyer} → {row.seller}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-800 text-foreground">
                        ₹{row.rzpAmount.toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-error font-700">{row.settlementDelay}h delayed</p>
                    </div>
                    <span
                      className={`text-xs font-600 border rounded-full px-2 py-0.5 shrink-0 ${
                        row.transferStatus === 'On Hold'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {row.transferStatus}
                    </span>
                    <button className="p-2 hover:bg-muted rounded-lg transition-colors shrink-0">
                      <Icon name="ArrowRightCircleIcon" size={16} className="text-secondary" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
