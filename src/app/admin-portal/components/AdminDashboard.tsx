'use client';
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '@/components/ui/AppIcon';

const todayMetrics = [
  {
    label: "Today's Orders",
    value: '0',
    change: 'Live orders',
    icon: 'ShoppingBagIcon',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    label: 'GMV Today',
    value: '₹0',
    change: 'Live payments',
    icon: 'CurrencyRupeeIcon',
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    label: 'Platform Commission',
    value: '₹0',
    change: '10% of captured GMV',
    icon: 'ReceiptPercentIcon',
    color: 'text-secondary',
    bg: 'bg-secondary/10',
  },
  {
    label: 'New Registrations',
    value: '0',
    change: 'Live profiles',
    icon: 'UserPlusIcon',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    label: 'Seller Applications',
    value: '0',
    change: 'Live seller profiles',
    icon: 'BuildingStorefrontIcon',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    label: 'Listings Submitted',
    value: '0',
    change: 'Live listings',
    icon: 'TagIcon',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    label: 'Failed Payments',
    value: '0',
    change: 'Live failures',
    icon: 'ExclamationCircleIcon',
    color: 'text-error',
    bg: 'bg-error/10',
  },
  {
    label: 'Active Disputes',
    value: '0',
    change: 'Live disputes',
    icon: 'FlagIcon',
    color: 'text-warning',
    bg: 'bg-amber-50',
  },
];

const weeklyGMV: { day: string; gmv: number; commission: number }[] = [];

const formatCr = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${(val / 1000).toFixed(0)}K`;
};

const filterOptions = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month'];

export default function AdminDashboard() {
  const [dateFilter, setDateFilter] = useState('Today');

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Platform overview · {new Date().toLocaleDateString('en-IN')}
          </p>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {filterOptions.map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${
                dateFilter === f
                  ? 'bg-secondary text-white'
                  : 'bg-card border border-border text-muted-foreground hover:border-secondary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {todayMetrics.map((metric) => (
          <div key={metric.label} className="bg-card rounded-2xl border border-border p-4">
            <div
              className={`w-9 h-9 rounded-xl ${metric.bg} flex items-center justify-center mb-3`}
            >
              <Icon name={metric.icon as 'ShoppingBagIcon'} size={18} className={metric.color} />
            </div>
            <p className={`text-xl font-800 ${metric.color}`}>{metric.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{metric.label}</p>
            <p className="text-xs text-success font-600 mt-1">{metric.change}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* GMV Chart */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-800 text-foreground text-sm mb-4">Weekly GMV vs Commission</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyGMV} barGap={4}>
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
                tickFormatter={formatCr}
              />
              <Tooltip
                formatter={(val: number, name: string) => [
                  formatCr(val),
                  name === 'gmv' ? 'GMV' : 'Commission',
                ]}
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Bar
                dataKey="gmv"
                fill="var(--secondary)"
                radius={[4, 4, 0, 0]}
                barSize={14}
                name="GMV"
              />
              <Bar
                dataKey="commission"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
                barSize={14}
                name="Commission"
              />
            </BarChart>
          </ResponsiveContainer>
          {weeklyGMV.length === 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
              <p className="text-sm font-700 text-foreground">No GMV trend yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Captured payment totals will populate this chart.
              </p>
            </div>
          )}
        </div>

        {/* Order Status Distribution */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-800 text-foreground text-sm mb-4">Today's Order Status</h2>
          <div className="space-y-3">
            {[
              { label: 'Awaiting Seller Response', count: 28, total: 124, color: 'bg-warning' },
              { label: 'Seller Confirmed', count: 35, total: 124, color: 'bg-success' },
              { label: 'Payment Completed', count: 41, total: 124, color: 'bg-secondary' },
              { label: 'In Transit', count: 12, total: 124, color: 'bg-purple-500' },
              { label: 'Delivered', count: 6, total: 124, color: 'bg-primary' },
              { label: 'Cancelled / Rejected', count: 2, total: 124, color: 'bg-error' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-500 text-foreground">{item.label}</span>
                    <span className="text-xs font-800 text-foreground">{item.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${(item.count / item.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h2 className="font-800 text-foreground text-sm mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Review Seller Applications',
              count: '4 pending',
              icon: 'BuildingStorefrontIcon',
              color: 'text-purple-600',
              bg: 'bg-purple-50 border-purple-200',
            },
            {
              label: 'Approve Product Listings',
              count: '12 pending',
              icon: 'TagIcon',
              color: 'text-blue-600',
              bg: 'bg-blue-50 border-blue-200',
            },
            {
              label: 'Process Refund Requests',
              count: '2 pending',
              icon: 'ArrowUturnLeftIcon',
              color: 'text-error',
              bg: 'bg-error/10 border-error/20',
            },
            {
              label: 'Review Disputes',
              count: '2 active',
              icon: 'FlagIcon',
              color: 'text-warning',
              bg: 'bg-amber-50 border-amber-200',
            },
          ].map((action) => (
            <button
              key={action.label}
              className={`p-4 rounded-xl border ${action.bg} text-left hover:shadow-sm transition-all`}
            >
              <Icon name={action.icon as 'TagIcon'} size={20} className={`${action.color} mb-2`} />
              <p className="text-xs font-700 text-foreground leading-snug mb-1">{action.label}</p>
              <p className={`text-xs font-700 ${action.color}`}>{action.count}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
