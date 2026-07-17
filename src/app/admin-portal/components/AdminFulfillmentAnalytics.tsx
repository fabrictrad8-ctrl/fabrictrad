'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

// Fulfillment analytics data per seller
const sellerFulfillmentData = [
  {
    seller: 'Surat Textile Mills',
    id: 'FT-SLR-001234',
    totalOrders: 310,
    delivered: 291,
    refunded: 8,
    disputed: 4,
    cancelled: 7,
    avgDeliveryDays: 3.2,
    fulfillmentRate: 93.9,
    refundRate: 2.6,
    disputeRate: 1.3,
    failureReasons: [
      { reason: 'Stock unavailable', count: 4 },
      { reason: 'Courier delay', count: 2 },
      { reason: 'Quality dispute', count: 1 },
    ],
  },
  {
    seller: 'Jaipur Crafts Emporium',
    id: 'FT-SLR-001890',
    totalOrders: 189,
    delivered: 172,
    refunded: 9,
    disputed: 5,
    cancelled: 3,
    avgDeliveryDays: 4.1,
    fulfillmentRate: 91.0,
    refundRate: 4.8,
    disputeRate: 2.6,
    failureReasons: [
      { reason: 'Wrong item shipped', count: 5 },
      { reason: 'Delayed dispatch', count: 4 },
    ],
  },
  {
    seller: 'Kolkata Silk House',
    id: 'FT-SLR-001102',
    totalOrders: 241,
    delivered: 228,
    refunded: 6,
    disputed: 3,
    cancelled: 4,
    avgDeliveryDays: 3.8,
    fulfillmentRate: 94.6,
    refundRate: 2.5,
    disputeRate: 1.2,
    failureReasons: [
      { reason: 'Courier delay', count: 4 },
      { reason: 'Address issue', count: 2 },
    ],
  },
  {
    seller: 'Bhiwandi Weave House',
    id: 'FT-SLR-001654',
    totalOrders: 89,
    delivered: 74,
    refunded: 8,
    disputed: 5,
    cancelled: 2,
    avgDeliveryDays: 5.6,
    fulfillmentRate: 83.1,
    refundRate: 9.0,
    disputeRate: 5.6,
    failureReasons: [
      { reason: 'Quality issue', count: 5 },
      { reason: 'Stock unavailable', count: 3 },
      { reason: 'Delayed dispatch', count: 2 },
    ],
  },
  {
    seller: 'Ludhiana Fabric Co.',
    id: 'FT-SLR-001445',
    totalOrders: 134,
    delivered: 118,
    refunded: 10,
    disputed: 4,
    cancelled: 2,
    avgDeliveryDays: 4.9,
    fulfillmentRate: 88.1,
    refundRate: 7.5,
    disputeRate: 3.0,
    failureReasons: [
      { reason: 'Courier delay', count: 6 },
      { reason: 'Wrong item', count: 4 },
    ],
  },
];

const dateRanges = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Custom'];

export default function AdminFulfillmentAnalytics() {
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sellerFilter, setSellerFilter] = useState('All');
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const sellers = ['All', ...sellerFulfillmentData.map((s) => s.seller)];
  const displayData =
    sellerFilter === 'All'
      ? sellerFulfillmentData
      : sellerFulfillmentData.filter((s) => s.seller === sellerFilter);

  const platformAvgDelivery =
    Math.round((displayData.reduce((s, d) => s + d.avgDeliveryDays, 0) / displayData.length) * 10) / 10;
  const platformFulfillment =
    Math.round((displayData.reduce((s, d) => s + d.fulfillmentRate, 0) / displayData.length) * 10) / 10;
  const totalRefunds = displayData.reduce((s, d) => s + d.refunded, 0);
  const totalDisputes = displayData.reduce((s, d) => s + d.disputed, 0);

  const getExportData = () =>
    displayData.map((d) => ({
      Seller: d.seller,
      'Seller ID': d.id,
      'Total Orders': d.totalOrders,
      Delivered: d.delivered,
      Refunded: d.refunded,
      Disputed: d.disputed,
      Cancelled: d.cancelled,
      'Avg Delivery (days)': d.avgDeliveryDays,
      'Fulfillment Rate (%)': d.fulfillmentRate,
      'Refund Rate (%)': d.refundRate,
      'Dispute Rate (%)': d.disputeRate,
      'Date Range': dateRange,
    }));

  const getRateColor = (rate: number, type: 'fulfillment' | 'refund' | 'dispute') => {
    if (type === 'fulfillment') {
      if (rate >= 93) return 'text-success';
      if (rate >= 88) return 'text-amber-600';
      return 'text-error';
    }
    if (rate <= 2) return 'text-success';
    if (rate <= 5) return 'text-amber-600';
    return 'text-error';
  };

  const getBarColor = (rate: number, type: 'fulfillment' | 'refund' | 'dispute') => {
    if (type === 'fulfillment') {
      if (rate >= 93) return 'bg-success';
      if (rate >= 88) return 'bg-amber-400';
      return 'bg-error';
    }
    if (rate <= 2) return 'bg-success';
    if (rate <= 5) return 'bg-amber-400';
    return 'bg-error';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Fulfillment Analytics</h1>
          <p className="text-sm text-muted-foreground">Delivery performance, success rates & dispute tracking</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex gap-1 overflow-x-auto scrollbar-thin">
            {dateRanges.map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${dateRange === r ? 'bg-secondary text-white' : 'bg-card border border-border text-muted-foreground hover:border-secondary'}`}
              >
                {r}
              </button>
            ))}
          </div>
          {dateRange === 'Custom' && (
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent text-xs text-foreground outline-none w-28" />
              <span className="text-xs text-muted-foreground">–</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent text-xs text-foreground outline-none w-28" />
            </div>
          )}
          {/* Export */}
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
                  onClick={() => { exportToCSV(getExportData(), `fulfillment_${dateRange.replace(/ /g, '_')}`); setShowExportMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-600 text-foreground hover:bg-muted transition-colors rounded-t-xl"
                >
                  <Icon name="DocumentTextIcon" size={14} className="text-success" />
                  Export CSV
                </button>
                <button
                  onClick={() => { exportToExcel(getExportData(), `fulfillment_${dateRange.replace(/ /g, '_')}`); setShowExportMenu(false); }}
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

      {/* Platform KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Avg Delivery Time', value: `${platformAvgDelivery} days`, icon: 'TruckIcon', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
          { label: 'Fulfillment Rate', value: `${platformFulfillment}%`, icon: 'CheckCircleIcon', color: 'text-success', bg: 'bg-success/10 border-success/20' },
          { label: 'Total Refunds', value: totalRefunds.toString(), icon: 'ArrowUturnLeftIcon', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Total Disputes', value: totalDisputes.toString(), icon: 'ExclamationTriangleIcon', color: 'text-error', bg: 'bg-error/10 border-error/20' },
        ].map((kpi) => (
          <div key={kpi.label} className={`stat-card border ${kpi.bg}`}>
            <Icon name={kpi.icon as 'TruckIcon'} size={20} className={`${kpi.color} mb-2`} />
            <p className={`text-2xl font-800 ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground font-500 leading-tight mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Seller Filter */}
      <div className="flex gap-1 overflow-x-auto scrollbar-thin mb-5">
        {sellers.map((s) => (
          <button
            key={s}
            onClick={() => setSellerFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${sellerFilter === s ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:border-primary'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Seller Breakdown Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-800 text-foreground text-sm">Seller Fulfillment Breakdown — {dateRange}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground">Seller</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Orders</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Avg Delivery</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Fulfillment %</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Refund %</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Dispute %</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayData.map((seller) => (
                <React.Fragment key={seller.id}>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-700 text-foreground">{seller.seller}</p>
                      <p className="mono-id">{seller.id}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <p className="text-sm font-800 text-foreground">{seller.totalOrders}</p>
                      <p className="text-xs text-muted-foreground">{seller.delivered} delivered</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <p className={`text-sm font-800 ${seller.avgDeliveryDays <= 4 ? 'text-success' : seller.avgDeliveryDays <= 5 ? 'text-amber-600' : 'text-error'}`}>
                        {seller.avgDeliveryDays}d
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <p className={`text-sm font-800 ${getRateColor(seller.fulfillmentRate, 'fulfillment')}`}>
                          {seller.fulfillmentRate}%
                        </p>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getBarColor(seller.fulfillmentRate, 'fulfillment')}`}
                            style={{ width: `${seller.fulfillmentRate}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <p className={`text-sm font-800 ${getRateColor(seller.refundRate, 'refund')}`}>
                        {seller.refundRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">{seller.refunded} orders</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <p className={`text-sm font-800 ${getRateColor(seller.disputeRate, 'dispute')}`}>
                        {seller.disputeRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">{seller.disputed} cases</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setExpandedSeller(expandedSeller === seller.id ? null : seller.id)}
                        className="flex items-center gap-1 text-xs font-600 text-primary hover:underline mx-auto"
                      >
                        Failure Reasons
                        <Icon name={expandedSeller === seller.id ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={12} />
                      </button>
                    </td>
                  </tr>
                  {expandedSeller === seller.id && (
                    <tr className="bg-muted/20">
                      <td colSpan={7} className="px-6 py-4">
                        <p className="text-xs font-700 text-foreground mb-3">Failure Reasons — {seller.seller}</p>
                        <div className="flex flex-wrap gap-2">
                          {seller.failureReasons.map((fr) => (
                            <div
                              key={fr.reason}
                              className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2"
                            >
                              <span className="w-5 h-5 rounded-full bg-error/10 text-error text-xs font-800 flex items-center justify-center">
                                {fr.count}
                              </span>
                              <span className="text-xs font-600 text-foreground">{fr.reason}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Legend */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-700 text-muted-foreground mb-3 uppercase tracking-wider">Performance Thresholds</p>
        <div className="flex flex-wrap gap-4">
          {[
            { color: 'bg-success', label: 'Fulfillment ≥ 93% · Refund/Dispute ≤ 2%' },
            { color: 'bg-amber-400', label: 'Fulfillment 88–93% · Refund/Dispute 2–5%' },
            { color: 'bg-error', label: 'Fulfillment < 88% · Refund/Dispute > 5%' },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${t.color}`} />
              <span className="text-xs text-muted-foreground">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
