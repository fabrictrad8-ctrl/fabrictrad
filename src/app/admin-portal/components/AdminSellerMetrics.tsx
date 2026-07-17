'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

// Seller metrics data for export
const sellerMetrics = [
  { seller: 'Surat Textile Mills', id: 'FT-SLR-001234', orders: 310, gmv: 4200000, commission: 420000, avgOrderValue: 135484, rating: 4.8, reviews: 284, responseTime: '1.2 hrs', acceptanceRate: 94, fulfillmentRate: 93.9, refundRate: 2.6, date: '2026-07-17' },
  { seller: 'Kolkata Silk House', id: 'FT-SLR-001102', orders: 241, gmv: 3500000, commission: 350000, avgOrderValue: 145228, rating: 4.7, reviews: 218, responseTime: '1.8 hrs', acceptanceRate: 91, fulfillmentRate: 94.6, refundRate: 2.5, date: '2026-07-17' },
  { seller: 'Jaipur Crafts Emporium', id: 'FT-SLR-001890', orders: 189, gmv: 2800000, commission: 280000, avgOrderValue: 148148, rating: 4.6, reviews: 162, responseTime: '2.4 hrs', acceptanceRate: 88, fulfillmentRate: 91.0, refundRate: 4.8, date: '2026-07-17' },
  { seller: 'Ludhiana Fabric Co.', id: 'FT-SLR-001445', orders: 134, gmv: 1800000, commission: 180000, avgOrderValue: 134328, rating: 3.9, reviews: 98, responseTime: '4.5 hrs', acceptanceRate: 72, fulfillmentRate: 88.1, refundRate: 7.5, date: '2026-07-17' },
  { seller: 'Bhiwandi Weave House', id: 'FT-SLR-001654', orders: 89, gmv: 1200000, commission: 120000, avgOrderValue: 134831, rating: 4.1, reviews: 74, responseTime: '3.8 hrs', acceptanceRate: 79, fulfillmentRate: 83.1, refundRate: 9.0, date: '2026-07-17' },
];

const formatINR = (v: number) => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
};

export default function AdminSellerMetrics() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'gmv' | 'orders' | 'rating' | 'fulfillmentRate'>('gmv');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const sorted = [...sellerMetrics].sort((a, b) => b[sortBy] - a[sortBy]);

  const getExportData = () =>
    sorted.map((s) => ({
      Seller: s.seller,
      'Seller ID': s.id,
      'Total Orders': s.orders,
      'GMV (₹)': s.gmv,
      'Commission (₹)': s.commission,
      'Avg Order Value (₹)': s.avgOrderValue,
      Rating: s.rating,
      Reviews: s.reviews,
      'Response Time': s.responseTime,
      'Acceptance Rate (%)': s.acceptanceRate,
      'Fulfillment Rate (%)': s.fulfillmentRate,
      'Refund Rate (%)': s.refundRate,
      'Date Range': dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'All Time',
    }));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Seller Metrics</h1>
          <p className="text-sm text-muted-foreground">Performance metrics across all sellers</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2">
            <Icon name="CalendarIcon" size={14} className="text-muted-foreground" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent text-xs text-foreground outline-none w-28" />
            <span className="text-xs text-muted-foreground">–</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent text-xs text-foreground outline-none w-28" />
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
                  onClick={() => { exportToCSV(getExportData(), 'seller_metrics'); setShowExportMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-600 text-foreground hover:bg-muted transition-colors rounded-t-xl"
                >
                  <Icon name="DocumentTextIcon" size={14} className="text-success" />
                  Export CSV
                </button>
                <button
                  onClick={() => { exportToExcel(getExportData(), 'seller_metrics'); setShowExportMenu(false); }}
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

      {/* Sort Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-thin mb-5">
        {[
          { key: 'gmv' as const, label: 'By GMV' },
          { key: 'orders' as const, label: 'By Orders' },
          { key: 'rating' as const, label: 'By Rating' },
          { key: 'fulfillmentRate' as const, label: 'By Fulfillment' },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${sortBy === opt.key ? 'bg-secondary text-white' : 'bg-card border border-border text-muted-foreground hover:border-secondary'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground">Seller</th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground">GMV</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Orders</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Rating</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Reviews</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Fulfillment</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Acceptance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((s, idx) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-800 ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-100 text-slate-600' : 'bg-muted text-muted-foreground'}`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-700 text-foreground">{s.seller}</p>
                        <p className="mono-id">{s.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-800 text-success">{formatINR(s.gmv)}</p>
                    <p className="text-xs text-muted-foreground">Comm: {formatINR(s.commission)}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <p className="text-sm font-800 text-foreground">{s.orders}</p>
                    <p className="text-xs text-muted-foreground">AOV: {formatINR(s.avgOrderValue)}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Icon name="StarIcon" size={12} className="text-amber-400" variant="solid" />
                      <span className="text-sm font-800 text-foreground">{s.rating}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <p className="text-sm font-700 text-foreground">{s.reviews}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <p className={`text-sm font-800 ${s.fulfillmentRate >= 93 ? 'text-success' : s.fulfillmentRate >= 88 ? 'text-amber-600' : 'text-error'}`}>
                      {s.fulfillmentRate}%
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <p className={`text-sm font-800 ${s.acceptanceRate >= 90 ? 'text-success' : s.acceptanceRate >= 80 ? 'text-amber-600' : 'text-error'}`}>
                      {s.acceptanceRate}%
                    </p>
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
