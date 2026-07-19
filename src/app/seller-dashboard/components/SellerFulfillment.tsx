'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

// Seller fulfillment data
const fulfillmentData = [
  {
    date: 'Jun 2026',
    totalOrders: 52,
    delivered: 49,
    refunded: 2,
    disputed: 1,
    cancelled: 0,
    avgDeliveryDays: 3.1,
    fulfillmentRate: 94.2,
    refundRate: 3.8,
    disputeRate: 1.9,
  },
  {
    date: 'May 2026',
    totalOrders: 48,
    delivered: 44,
    refunded: 3,
    disputed: 1,
    cancelled: 0,
    avgDeliveryDays: 3.4,
    fulfillmentRate: 91.7,
    refundRate: 6.3,
    disputeRate: 2.1,
  },
  {
    date: 'Apr 2026',
    totalOrders: 41,
    delivered: 39,
    refunded: 1,
    disputed: 0,
    cancelled: 1,
    avgDeliveryDays: 3.0,
    fulfillmentRate: 95.1,
    refundRate: 2.4,
    disputeRate: 0.0,
  },
  {
    date: 'Mar 2026',
    totalOrders: 55,
    delivered: 51,
    refunded: 2,
    disputed: 2,
    cancelled: 0,
    avgDeliveryDays: 3.6,
    fulfillmentRate: 92.7,
    refundRate: 3.6,
    disputeRate: 3.6,
  },
  {
    date: 'Feb 2026',
    totalOrders: 38,
    delivered: 36,
    refunded: 1,
    disputed: 1,
    cancelled: 0,
    avgDeliveryDays: 3.2,
    fulfillmentRate: 94.7,
    refundRate: 2.6,
    disputeRate: 2.6,
  },
];

const failureReasons = [
  { reason: 'Courier delay', count: 5, pct: 42 },
  { reason: 'Stock unavailable at dispatch', count: 3, pct: 25 },
  { reason: 'Quality dispute by buyer', count: 2, pct: 17 },
  { reason: 'Address issue', count: 1, pct: 8 },
  { reason: 'Other', count: 1, pct: 8 },
];

const activeOrderProgress = [
  {
    id: 'FT-BULK-DEMO-002',
    buyer: 'Jaipur Garment House',
    product: 'Linen Slub Fabric',
    partner: 'Shiprocket',
    status: 'Pickup scheduled',
    progress: 50,
    eta: '21 Jul 2026',
  },
  {
    id: 'FT-BULK-DEMO-003',
    buyer: 'Mumbai Design Co.',
    product: 'Organza Sequence Fabric',
    partner: 'Own partner: DTDC',
    status: 'In transit',
    progress: 72,
    eta: '22 Jul 2026',
  },
  {
    id: 'FT-BULK-DEMO-004',
    buyer: 'Surat Boutique Studio',
    product: 'Georgette Embroidered',
    partner: 'Own partner: Local Transport',
    status: 'Delivered',
    progress: 100,
    eta: 'Delivered',
  },
];

export default function SellerFulfillment() {
  const [dateRange, setDateRange] = useState('Last 6 Months');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const avgDelivery =
    Math.round(
      (fulfillmentData.reduce((s, d) => s + d.avgDeliveryDays, 0) / fulfillmentData.length) * 10
    ) / 10;
  const avgFulfillment =
    Math.round(
      (fulfillmentData.reduce((s, d) => s + d.fulfillmentRate, 0) / fulfillmentData.length) * 10
    ) / 10;
  const totalRefunds = fulfillmentData.reduce((s, d) => s + d.refunded, 0);
  const totalDisputes = fulfillmentData.reduce((s, d) => s + d.disputed, 0);

  const getExportData = () =>
    fulfillmentData.map((d) => ({
      Period: d.date,
      'Total Orders': d.totalOrders,
      Delivered: d.delivered,
      Refunded: d.refunded,
      Disputed: d.disputed,
      Cancelled: d.cancelled,
      'Avg Delivery (days)': d.avgDeliveryDays,
      'Fulfillment Rate (%)': d.fulfillmentRate,
      'Refund Rate (%)': d.refundRate,
      'Dispute Rate (%)': d.disputeRate,
    }));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Fulfillment Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Your delivery performance & dispute tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {['Last 3 Months', 'Last 6 Months'].map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${dateRange === r ? 'bg-secondary text-white' : 'bg-card border border-border text-muted-foreground hover:border-secondary'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 btn-secondary px-3 py-2 text-xs rounded-xl"
            >
              <Icon name="ArrowDownTrayIcon" size={14} />
              Export
              <Icon name="ChevronDownIcon" size={12} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-10 min-w-[140px]">
                <button
                  onClick={() => {
                    exportToCSV(getExportData(), 'my_fulfillment');
                    setShowExportMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-600 text-foreground hover:bg-muted transition-colors rounded-t-xl"
                >
                  <Icon name="DocumentTextIcon" size={14} className="text-success" />
                  Export CSV
                </button>
                <button
                  onClick={() => {
                    exportToExcel(getExportData(), 'my_fulfillment');
                    setShowExportMenu(false);
                  }}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: 'Avg Delivery Time',
            value: `${avgDelivery} days`,
            icon: 'TruckIcon',
            color: avgDelivery <= 4 ? 'text-success' : 'text-amber-600',
            bg:
              avgDelivery <= 4 ? 'bg-success/10 border-success/20' : 'bg-amber-50 border-amber-200',
          },
          {
            label: 'Fulfillment Rate',
            value: `${avgFulfillment}%`,
            icon: 'CheckCircleIcon',
            color: avgFulfillment >= 93 ? 'text-success' : 'text-amber-600',
            bg:
              avgFulfillment >= 93
                ? 'bg-success/10 border-success/20'
                : 'bg-amber-50 border-amber-200',
          },
          {
            label: 'Total Refunds',
            value: totalRefunds.toString(),
            icon: 'ArrowUturnLeftIcon',
            color: 'text-amber-600',
            bg: 'bg-amber-50 border-amber-200',
          },
          {
            label: 'Total Disputes',
            value: totalDisputes.toString(),
            icon: 'ExclamationTriangleIcon',
            color: totalDisputes <= 3 ? 'text-success' : 'text-error',
            bg:
              totalDisputes <= 3
                ? 'bg-success/10 border-success/20'
                : 'bg-error/10 border-error/20',
          },
        ].map((kpi) => (
          <div key={kpi.label} className={`stat-card border ${kpi.bg}`}>
            <Icon name={kpi.icon as 'TruckIcon'} size={20} className={`${kpi.color} mb-2`} />
            <p className={`text-2xl font-800 ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground font-500 leading-tight mt-0.5">
              {kpi.label}
            </p>
          </div>
        ))}
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-800 text-foreground text-sm">Monthly Fulfillment Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground">
                  Period
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Orders
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Delivered
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Avg Delivery
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Fulfillment %
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Refunds
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Disputes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fulfillmentData.map((row) => (
                <tr key={row.date} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-700 text-foreground">{row.date}</td>
                  <td className="px-4 py-3 text-center text-sm font-700 text-foreground">
                    {row.totalOrders}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-700 text-success">
                    {row.delivered}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-sm font-800 ${row.avgDeliveryDays <= 3.5 ? 'text-success' : row.avgDeliveryDays <= 4.5 ? 'text-amber-600' : 'text-error'}`}
                    >
                      {row.avgDeliveryDays}d
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`text-sm font-800 ${row.fulfillmentRate >= 93 ? 'text-success' : row.fulfillmentRate >= 88 ? 'text-amber-600' : 'text-error'}`}
                      >
                        {row.fulfillmentRate}%
                      </span>
                      <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${row.fulfillmentRate >= 93 ? 'bg-success' : row.fulfillmentRate >= 88 ? 'bg-amber-400' : 'bg-error'}`}
                          style={{ width: `${row.fulfillmentRate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-sm font-700 ${row.refunded === 0 ? 'text-success' : row.refunded <= 2 ? 'text-amber-600' : 'text-error'}`}
                    >
                      {row.refunded}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-sm font-700 ${row.disputed === 0 ? 'text-success' : row.disputed <= 1 ? 'text-amber-600' : 'text-error'}`}
                    >
                      {row.disputed}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Order Progress */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-800 text-foreground">Order Delivery Progress</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Per-order delivery tracking across Shiprocket and seller-managed partners.
            </p>
          </div>
          <span className="w-fit rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs font-700 text-success">
            Buyer-visible tracking
          </span>
        </div>
        <div className="space-y-3">
          {activeOrderProgress.map((order) => (
            <div key={order.id} className="rounded-xl border border-border p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="mono-id">{order.id}</p>
                  <p className="mt-1 text-sm font-800 text-foreground">{order.product}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.buyer} · {order.partner}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs font-800 text-primary">{order.status}</p>
                  <p className="text-xs text-muted-foreground">ETA: {order.eta}</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success"
                  style={{ width: `${order.progress}%` }}
                />
              </div>
              <p className="mt-1 text-right text-xs font-700 text-success">{order.progress}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Failure Reasons */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h2 className="font-800 text-foreground text-sm mb-4">Failure Reasons Breakdown</h2>
        <div className="space-y-3">
          {failureReasons.map((fr) => (
            <div key={fr.reason} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-error/10 text-error text-xs font-800 flex items-center justify-center shrink-0">
                {fr.count}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-700 text-foreground">{fr.reason}</p>
                  <p className="text-xs font-800 text-muted-foreground">{fr.pct}%</p>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-error/60 rounded-full"
                    style={{ width: `${fr.pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
