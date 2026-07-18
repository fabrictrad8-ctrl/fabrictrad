'use client';
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '@/components/ui/AppIcon';
import { formatMoney, useSellerBulkOrders } from '@/lib/hooks/useAccountOrders';

const earningsData: { month: string; gross: number; commission: number; net: number }[] = [];

const pendingPayouts: {
  id: string;
  buyer: string;
  amount: number;
  commission: number;
  net: number;
  status: string;
  date: string;
  eta: string;
}[] = [];

const payoutHistory: {
  id: string;
  period: string;
  orders: number;
  gross: number;
  commission: number;
  razorpayFee: number;
  net: number;
  status: string;
  date: string;
  utr: string;
}[] = [];

const formatINR = (v: number) => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
};

const statusColors: Record<string, string> = {
  Settled: 'bg-success/10 text-success border-success/20',
  Processing: 'bg-amber-50 text-amber-700 border-amber-200',
  Pending: 'bg-blue-50 text-blue-700 border-blue-200',
  Failed: 'bg-error/10 text-error border-error/20',
};

export default function SellerEarnings() {
  const { orders } = useSellerBulkOrders();
  const [activeSection, setActiveSection] = useState<
    'overview' | 'pending' | 'history' | 'reconcile'
  >('overview');
  const gross = orders.reduce((sum, order) => sum + Number(order.net_total || 0), 0);
  const commission = Math.round(gross * 0.1);
  const net = gross - commission;
  const pending = orders
    .filter((order) => ['paid', 'confirmed', 'shipped'].includes(order.status || ''))
    .reduce((sum, order) => sum + Number(order.net_total || 0) * 0.9, 0);
  const razorpayFee = Math.round(gross * 0.02);
  const gstOnCommission = Math.round(commission * 0.18);
  const netAfterDeductions = Math.max(gross - commission - razorpayFee - gstOnCommission, 0);
  const reconciliationRows = orders.map((order) => {
    const collected = Number(order.net_total || 0);
    const rowCommission = Math.round(collected * 0.1);
    const status = ['paid', 'shipped', 'delivered'].includes(order.status || '')
      ? 'Pending'
      : 'On Hold';

    return {
      order: `FT-ORD-${order.id.slice(0, 8).toUpperCase()}`,
      rzpId: 'Recorded after payment capture',
      collected,
      commission: rowCommission,
      transferred: status === 'Pending' ? Math.round(collected * 0.9) : 0,
      status,
    };
  });

  const tabs = [
    { key: 'overview', label: 'Earnings Overview', icon: 'ChartBarIcon' },
    { key: 'pending', label: 'Pending Payouts', icon: 'ClockIcon' },
    { key: 'history', label: 'Payout History', icon: 'DocumentTextIcon' },
    { key: 'reconcile', label: 'Reconciliation', icon: 'ArrowsRightLeftIcon' },
  ] as const;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-800 text-foreground">Seller Earnings</h1>
        <p className="text-sm text-muted-foreground">
          Razorpay Route · Settlement Account: HDFC ****4521
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: 'This Month Gross',
            value: formatMoney(gross),
            sub: 'Before deductions',
            icon: 'CurrencyRupeeIcon',
            color: 'text-primary',
            bg: 'bg-primary/10 border-primary/20',
          },
          {
            label: 'Platform Commission',
            value: formatMoney(commission),
            sub: '10% of gross',
            icon: 'ReceiptPercentIcon',
            color: 'text-error',
            bg: 'bg-error/10 border-error/20',
          },
          {
            label: 'Net Earnings',
            value: formatMoney(net),
            sub: 'After commission',
            icon: 'BanknotesIcon',
            color: 'text-success',
            bg: 'bg-success/10 border-success/20',
          },
          {
            label: 'Pending Payout',
            value: formatMoney(pending),
            sub: `${orders.length} account orders`,
            icon: 'ClockIcon',
            color: 'text-amber-600',
            bg: 'bg-amber-50 border-amber-200',
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
            <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto scrollbar-thin mb-6 bg-muted p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-600 whitespace-nowrap transition-all ${
              activeSection === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as 'ChartBarIcon'} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Earnings Overview */}
      {activeSection === 'overview' && (
        <div className="space-y-5">
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-800 text-foreground text-sm mb-4">Monthly Earnings Breakdown</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={earningsData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatINR}
                />
                <Tooltip
                  formatter={(val: number, name: string) => [
                    formatINR(val),
                    name === 'gross'
                      ? 'Gross Sales'
                      : name === 'commission'
                        ? 'Commission'
                        : 'Net Earnings',
                  ]}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="gross"
                  fill="var(--secondary)"
                  radius={[4, 4, 0, 0]}
                  barSize={12}
                  name="gross"
                />
                <Bar
                  dataKey="commission"
                  fill="var(--error)"
                  radius={[4, 4, 0, 0]}
                  barSize={12}
                  name="commission"
                />
                <Bar
                  dataKey="net"
                  fill="var(--success)"
                  radius={[4, 4, 0, 0]}
                  barSize={12}
                  name="net"
                />
              </BarChart>
            </ResponsiveContainer>
            {earningsData.length === 0 && (
              <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
                <p className="text-sm font-700 text-foreground">No earnings trend yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Monthly charts will populate from paid orders for this seller account.
                </p>
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 justify-center">
              {[
                { color: 'bg-secondary', label: 'Gross Sales' },
                { color: 'bg-error', label: 'Commission' },
                { color: 'bg-success', label: 'Net Earnings' },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                  <span className="text-xs text-muted-foreground">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Commission Breakdown */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-800 text-foreground text-sm mb-4">
              Commission & Deduction Breakdown (This Month)
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Gross Sales Value', amount: gross, type: 'credit' },
                { label: 'Platform Commission (10%)', amount: -commission, type: 'debit' },
                {
                  label: 'Razorpay Payment Gateway Fee (2%)',
                  amount: -razorpayFee,
                  type: 'debit',
                },
                {
                  label: 'GST on Commission (18%)',
                  amount: -gstOnCommission,
                  type: 'debit',
                },
                { label: 'Net Payable to Seller', amount: netAfterDeductions, type: 'total' },
              ].map((row) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${row.type === 'total' ? 'bg-success/10 border border-success/20' : row.type === 'debit' ? 'bg-error/5' : 'bg-muted'}`}
                >
                  <span
                    className={`text-sm ${row.type === 'total' ? 'font-800 text-success' : 'font-500 text-foreground'}`}
                  >
                    {row.label}
                  </span>
                  <span
                    className={`text-sm font-800 ${row.type === 'total' ? 'text-success' : row.type === 'debit' ? 'text-error' : 'text-foreground'}`}
                  >
                    {row.amount < 0 ? '-' : ''}₹{Math.abs(row.amount).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pending Payouts */}
      {activeSection === 'pending' && (
        <div className="bg-card rounded-2xl border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-800 text-foreground text-sm">Pending Payouts</h2>
            <span className="text-xs text-muted-foreground">
              {orders.length} orders · {formatMoney(pending)} pending
            </span>
          </div>
          <div className="divide-y divide-border">
            {pendingPayouts.map((payout) => (
              <div key={payout.id} className="px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="mono-id">{payout.id}</span>
                      <span
                        className={`text-xs font-600 border rounded-full px-2 py-0.5 ${statusColors[payout.status]}`}
                      >
                        {payout.status}
                      </span>
                    </div>
                    <p className="text-sm font-700 text-foreground">{payout.buyer}</p>
                    <p className="text-xs text-muted-foreground">
                      Order Date: {payout.date} · ETA: {payout.eta}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      Gross: ₹{payout.amount.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-error">
                      Commission: -₹{payout.commission.toLocaleString('en-IN')}
                    </p>
                    <p className="text-base font-800 text-success">
                      Net: ₹{payout.net.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {pendingPayouts.length === 0 && (
              <div className="px-5 py-10 text-center">
                <Icon name="ClockIcon" size={30} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-700 text-foreground">No pending payout records</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Settlement records will appear after real payments are captured.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payout History */}
      {activeSection === 'history' && (
        <div className="bg-card rounded-2xl border border-border">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-800 text-foreground text-sm">Payout History</h2>
            <button className="flex items-center gap-1.5 text-xs font-600 text-primary hover:underline">
              <Icon name="ArrowDownTrayIcon" size={14} />
              Export CSV
            </button>
          </div>
          <div className="divide-y divide-border">
            {payoutHistory.map((payout) => (
              <div key={payout.id} className="px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="mono-id">{payout.id}</span>
                      <span
                        className={`text-xs font-600 border rounded-full px-2 py-0.5 ${statusColors[payout.status]}`}
                      >
                        {payout.status}
                      </span>
                    </div>
                    <p className="text-sm font-700 text-foreground">{payout.period}</p>
                    <p className="text-xs text-muted-foreground">
                      {payout.orders} orders · Settled: {payout.date}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      UTR: {payout.utr}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      Gross: ₹{payout.gross.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-error">
                      Commission: -₹{payout.commission.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-error">
                      Razorpay Fee: -₹{payout.razorpayFee.toLocaleString('en-IN')}
                    </p>
                    <p className="text-base font-800 text-success">
                      ₹{payout.net.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {payoutHistory.length === 0 && (
              <div className="px-5 py-10 text-center">
                <Icon
                  name="DocumentTextIcon"
                  size={30}
                  className="mx-auto mb-2 text-muted-foreground"
                />
                <p className="text-sm font-700 text-foreground">No payout history yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Completed seller settlements will be listed here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reconciliation */}
      {activeSection === 'reconcile' && (
        <div className="space-y-5">
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-800 text-foreground text-sm mb-4 flex items-center gap-2">
              <Icon name="ArrowsRightLeftIcon" size={16} className="text-secondary" />
              Razorpay Route Transaction Reconciliation
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left px-3 py-2.5 text-xs font-700 text-muted-foreground rounded-l-lg">
                      Order ID
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-700 text-muted-foreground">
                      Razorpay Payment ID
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-700 text-muted-foreground">
                      Collected
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-700 text-muted-foreground">
                      Commission
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-700 text-muted-foreground">
                      Transferred
                    </th>
                    <th className="text-center px-3 py-2.5 text-xs font-700 text-muted-foreground rounded-r-lg">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reconciliationRows.map((row) => (
                    <tr key={row.order} className="hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-3 mono-id text-xs">{row.order}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                        {row.rzpId}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-700 text-foreground">
                        ₹{row.collected.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-700 text-error">
                        -₹{row.commission.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-700 text-success">
                        ₹{row.transferred.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`text-xs font-600 border rounded-full px-2 py-0.5 ${statusColors[row.status] || 'bg-muted text-muted-foreground border-border'}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {reconciliationRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-10 text-center text-sm text-muted-foreground"
                      >
                        No account orders to reconcile yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reconciliation Summary */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-800 text-foreground text-sm mb-4">Reconciliation Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                {
                  label: 'Total Collected by Razorpay',
                  value: formatMoney(gross),
                  color: 'text-foreground',
                },
                {
                  label: 'Total Commission Deducted',
                  value: formatMoney(commission),
                  color: 'text-error',
                },
                {
                  label: 'Total Transferred to You',
                  value: formatMoney(net),
                  color: 'text-success',
                },
                {
                  label: 'Pending Transfer',
                  value: formatMoney(pending),
                  color: 'text-amber-600',
                },
                { label: 'On Hold', value: formatMoney(0), color: 'text-warning' },
                { label: 'Discrepancies', value: formatMoney(0), color: 'text-success' },
              ].map((item) => (
                <div key={item.label} className="bg-muted rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className={`text-base font-800 ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
