'use client';
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '@/components/ui/AppIcon';
import { formatMoney, useSellerBulkOrders } from '@/lib/hooks/useAccountOrders';

const earningsData: { month: string; earnings: number }[] = [];

const pendingPayouts: {
  id: string;
  buyer: string;
  net: number;
  status: string;
  date: string;
  eta: string;
}[] = [];

const payoutHistory: {
  id: string;
  period: string;
  orders: number;
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
  const [activeSection, setActiveSection] = useState<'overview' | 'pending' | 'history'>(
    'overview'
  );
  const gross = orders.reduce((sum, order) => sum + Number(order.net_total || 0), 0);
  const commission = Math.round(gross * 0.1);
  const razorpayFee = Math.round(gross * 0.02);
  const gstOnCommission = Math.round(commission * 0.18);
  const sellerEarnings = Math.max(gross - commission - razorpayFee - gstOnCommission, 0);
  const pending = Math.round(
    orders
      .filter((order) => ['paid', 'confirmed', 'shipped'].includes(order.status || ''))
      .reduce((sum, order) => sum + Number(order.net_total || 0) * 0.862, 0)
  );
  const paidOrderCount = orders.filter((order) =>
    ['paid', 'confirmed', 'shipped', 'delivered'].includes(order.status || '')
  ).length;

  const tabs = [
    { key: 'overview', label: 'Earnings Overview', icon: 'ChartBarIcon' },
    { key: 'pending', label: 'Pending Payouts', icon: 'ClockIcon' },
    { key: 'history', label: 'Payout History', icon: 'DocumentTextIcon' },
  ] as const;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-800 text-foreground">Seller Earnings</h1>
        <p className="text-sm text-muted-foreground">Settlement Account: HDFC ****4521</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: 'This Month Earnings',
            value: formatMoney(sellerEarnings),
            sub: 'Seller amount earned',
            icon: 'CurrencyRupeeIcon',
            color: 'text-success',
            bg: 'bg-success/10 border-success/20',
          },
          {
            label: 'Available to Settle',
            value: formatMoney(pending),
            sub: `${paidOrderCount} paid account orders`,
            icon: 'BanknotesIcon',
            color: 'text-success',
            bg: 'bg-success/10 border-success/20',
          },
          {
            label: 'Settled Payout',
            value: formatMoney(0),
            sub: 'No completed payouts yet',
            icon: 'CheckCircleIcon',
            color: 'text-primary',
            bg: 'bg-primary/10 border-primary/20',
          },
          {
            label: 'Orders Earning',
            value: paidOrderCount.toString(),
            sub: `${orders.length} total account orders`,
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
                  formatter={(val: number, name: string) => [formatINR(val), 'Seller Earnings']}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="earnings"
                  fill="var(--success)"
                  radius={[4, 4, 0, 0]}
                  barSize={12}
                  name="earnings"
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
              {[{ color: 'bg-success', label: 'Seller Earnings' }].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                  <span className="text-xs text-muted-foreground">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-800 text-foreground text-sm mb-4">What You Made This Month</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: 'Current Earnings', amount: sellerEarnings },
                { label: 'Pending Settlement', amount: pending },
                { label: 'Paid Out', amount: 0 },
              ].map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-success/20 bg-success/10 p-4"
                >
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="mt-1 text-xl font-800 text-success">
                    ₹{Math.round(row.amount).toLocaleString('en-IN')}
                  </p>
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
                    <p className="text-base font-800 text-success">
                      ₹{payout.net.toLocaleString('en-IN')}
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
    </div>
  );
}
