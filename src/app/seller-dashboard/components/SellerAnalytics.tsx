'use client';
import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';

const last30Days = [
  { date: 'Jun 18', orders: 4, gmv: 320000 },
  { date: 'Jun 19', orders: 2, gmv: 180000 },
  { date: 'Jun 20', orders: 6, gmv: 540000 },
  { date: 'Jun 21', orders: 3, gmv: 270000 },
  { date: 'Jun 22', orders: 5, gmv: 450000 },
  { date: 'Jun 23', orders: 1, gmv: 84000 },
  { date: 'Jun 24', orders: 4, gmv: 360000 },
  { date: 'Jun 25', orders: 7, gmv: 630000 },
  { date: 'Jun 26', orders: 3, gmv: 252000 },
  { date: 'Jun 27', orders: 8, gmv: 720000 },
  { date: 'Jun 28', orders: 5, gmv: 450000 },
  { date: 'Jun 29', orders: 2, gmv: 168000 },
  { date: 'Jun 30', orders: 9, gmv: 810000 },
  { date: 'Jul 01', orders: 4, gmv: 340000 },
  { date: 'Jul 02', orders: 6, gmv: 504000 },
  { date: 'Jul 03', orders: 3, gmv: 252000 },
  { date: 'Jul 04', orders: 7, gmv: 588000 },
  { date: 'Jul 05', orders: 5, gmv: 420000 },
  { date: 'Jul 06', orders: 2, gmv: 168000 },
  { date: 'Jul 07', orders: 8, gmv: 672000 },
  { date: 'Jul 08', orders: 4, gmv: 336000 },
  { date: 'Jul 09', orders: 6, gmv: 504000 },
  { date: 'Jul 10', orders: 9, gmv: 756000 },
  { date: 'Jul 11', orders: 3, gmv: 252000 },
  { date: 'Jul 12', orders: 7, gmv: 588000 },
  { date: 'Jul 13', orders: 5, gmv: 420000 },
  { date: 'Jul 14', orders: 4, gmv: 336000 },
  { date: 'Jul 15', orders: 8, gmv: 672000 },
  { date: 'Jul 16', orders: 6, gmv: 504000 },
  { date: 'Jul 17', orders: 5, gmv: 420000 },
];

const formatINR = (val: number) => {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val}`;
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-card text-xs">
        <p className="font-700 text-foreground mb-1">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color }} className="font-600">
            {entry.name === 'gmv' ? formatINR(entry.value) : `${entry.value} orders`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function SellerAnalytics() {
  const [chartType, setChartType] = useState<'orders' | 'gmv'>('orders');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const totalOrders = last30Days.reduce((s, d) => s + d.orders, 0);
  const totalGMV = last30Days.reduce((s, d) => s + d.gmv, 0);
  const avgOrderValue = Math.round(totalGMV / totalOrders);

  const getExportData = () =>
    last30Days.map((d) => ({
      Date: d.date,
      Orders: d.orders,
      'GMV (₹)': d.gmv,
      'Avg Order Value (₹)': Math.round(d.gmv / (d.orders || 1)),
    }));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-800 text-foreground">Sales Analytics</h1>
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
                  onClick={() => { exportToCSV(getExportData(), 'seller_analytics'); setShowExportMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-600 text-foreground hover:bg-muted transition-colors rounded-t-xl"
                >
                  <Icon name="DocumentTextIcon" size={14} className="text-success" />
                  Export CSV
                </button>
                <button
                  onClick={() => { exportToExcel(getExportData(), 'seller_analytics'); setShowExportMenu(false); }}
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
          { label: 'Total Orders', value: totalOrders.toString(), icon: 'ShoppingBagIcon', color: 'text-primary' },
          { label: 'Total GMV', value: formatINR(totalGMV), icon: 'CurrencyRupeeIcon', color: 'text-success' },
          { label: 'Avg Order Value', value: formatINR(avgOrderValue), icon: 'ChartBarIcon', color: 'text-secondary' },
          { label: 'Acceptance Rate', value: '94%', icon: 'CheckCircleIcon', color: 'text-amber-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-2xl border border-border p-4">
            <Icon name={kpi.icon as 'ShoppingBagIcon'} size={20} className={`${kpi.color} mb-2`} />
            <p className={`text-xl font-800 ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-800 text-foreground text-sm">Order Volume & Sales Performance</h2>
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
            <button
              onClick={() => setChartType('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-600 transition-all ${chartType === 'orders' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Orders
            </button>
            <button
              onClick={() => setChartType('gmv')}
              className={`px-3 py-1.5 rounded-lg text-xs font-600 transition-all ${chartType === 'gmv' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              GMV
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          {chartType === 'orders' ? (
            <BarChart data={last30Days} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="orders" fill="var(--primary)" radius={[4, 4, 0, 0]} name="orders" />
            </BarChart>
          ) : (
            <LineChart data={last30Days}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={formatINR} />
              <Tooltip content={<CustomTooltip />} />
              <Line dataKey="gmv" stroke="var(--primary)" strokeWidth={2} dot={false} name="gmv" />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Top Products */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h2 className="font-800 text-foreground text-sm mb-4">Top Products by Revenue</h2>
        <div className="space-y-3">
          {[
            { name: 'Pure Dyeable Soft Nett', revenue: '₹4.8L', orders: 18, share: 38 },
            { name: 'Georgette Embroidered', revenue: '₹2.9L', orders: 11, share: 23 },
            { name: 'Organza Sequence Fabric', revenue: '₹2.1L', orders: 9, share: 17 },
            { name: 'Linen Slub Fabric', revenue: '₹1.6L', orders: 7, share: 13 },
            { name: 'Velvet Crush Fabric', revenue: '₹1.1L', orders: 5, share: 9 },
          ].map((product, i) => (
            <div key={product.name} className="flex items-center gap-3">
              <span className="text-xs font-800 text-muted-foreground w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-700 text-foreground truncate">{product.name}</p>
                  <p className="text-xs font-800 text-primary ml-2 shrink-0">{product.revenue}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${product.share}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{product.orders} orders</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}