'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { formatMoney, useBuyerBulkOrders, firstOrderItem } from '@/lib/hooks/useAccountOrders';

type CatalogOrder = {
  id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  quantity: number;
  unit: string;
  created_at: string;
  seller_id: string;
  seller_products?: { name?: string | null; category?: string | null } | null;
};

const CATEGORY_COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#06b6d4', '#84cc16', '#ec4899', '#6366f1',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getLast6Months() {
  const result: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
  }
  return result;
}

function getLast12Months() {
  const result: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
  }
  return result;
}

type AnalyticsTab = 'overview' | 'export';

export default function BuyerAnalytics() {
  const { user } = useAuth();
  const { orders: bulkOrders, loading: bulkLoading } = useBuyerBulkOrders();
  const [catalogOrders, setCatalogOrders] = useState<CatalogOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [exportType, setExportType] = useState<'month' | 'category' | 'seller'>('month');
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportPeriod, setExportPeriod] = useState<'6m' | '12m' | 'all'>('6m');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('catalog_order_requests')
      .select('id,status,payment_status,total_amount,quantity,unit,created_at,seller_id,seller_products(name,category)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    setCatalogOrders((data || []) as unknown as CatalogOrder[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const allOrders = useMemo(() => {
    const catalog = catalogOrders.map((o) => ({
      id: o.id,
      amount: Number(o.total_amount || 0),
      status: o.status,
      paymentStatus: o.payment_status,
      createdAt: o.created_at,
      sellerId: o.seller_id,
      sellerName: `Seller ${o.seller_id?.slice(0, 6).toUpperCase() || 'N/A'}`,
      category: o.seller_products?.category || 'Other',
      isPaid: ['paid', 'fulfilled', 'shipped', 'delivered'].includes(o.status) || o.payment_status === 'paid',
    }));
    const bulk = bulkOrders.map((o) => {
      const item = firstOrderItem(o);
      return {
        id: o.id,
        amount: Number(o.net_total || 0),
        status: o.status || 'draft',
        paymentStatus: o.payment_status || 'unpaid',
        createdAt: o.created_at || '',
        sellerId: o.seller_id || '',
        sellerName: `Seller ${o.seller_id?.slice(0, 6).toUpperCase() || 'N/A'}`,
        category: item?.product_name ? 'Bulk Fabric' : 'Other',
        isPaid: ['paid', 'fulfilled', 'shipped', 'delivered'].includes(o.status || '') || o.payment_status === 'paid',
      };
    });
    return [...catalog, ...bulk];
  }, [catalogOrders, bulkOrders]);

  // Spending trends — last 6 months
  const spendingTrends = useMemo(() => {
    const months = getLast6Months();
    const map: Record<string, number> = {};
    months.forEach((m) => { map[m] = 0; });
    allOrders.forEach((o) => {
      if (!o.createdAt || !o.isPaid) return;
      const key = getMonthKey(o.createdAt);
      if (key in map) map[key] += o.amount;
    });
    return months.map((m) => ({ month: m.split(' ')[0], amount: Math.round(map[m]) }));
  }, [allOrders]);

  // Order count by category
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    allOrders.forEach((o) => {
      const cat = o.category || 'Other';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [allOrders]);

  // Favorite sellers — top 5 by order count
  const favoriteSellers = useMemo(() => {
    const map: Record<string, { count: number; totalSpend: number; name: string }> = {};
    allOrders.forEach((o) => {
      if (!o.sellerId) return;
      if (!map[o.sellerId]) map[o.sellerId] = { count: 0, totalSpend: 0, name: o.sellerName };
      map[o.sellerId].count += 1;
      if (o.isPaid) map[o.sellerId].totalSpend += o.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([sellerId, stats], idx) => ({
        rank: idx + 1,
        sellerId,
        displayId: stats.name,
        count: stats.count,
        totalSpend: stats.totalSpend,
      }));
  }, [allOrders]);

  // Repeat purchase rate
  const repeatPurchaseRate = useMemo(() => {
    const sellerOrderCounts: Record<string, number> = {};
    allOrders.forEach((o) => {
      if (!o.sellerId) return;
      sellerOrderCounts[o.sellerId] = (sellerOrderCounts[o.sellerId] || 0) + 1;
    });
    const totalSellers = Object.keys(sellerOrderCounts).length;
    const repeatSellers = Object.values(sellerOrderCounts).filter((c) => c > 1).length;
    if (totalSellers === 0) return 0;
    return Math.round((repeatSellers / totalSellers) * 100);
  }, [allOrders]);

  const totalSpend = useMemo(() => allOrders.filter((o) => o.isPaid).reduce((sum, o) => sum + o.amount, 0), [allOrders]);
  const totalOrders = allOrders.length;
  const busy = loading || bulkLoading;

  // Export data builders
  const getFilteredOrdersForExport = useCallback(() => {
    const now = new Date();
    let cutoff: Date | null = null;
    if (exportPeriod === '6m') cutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    else if (exportPeriod === '12m') cutoff = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    return allOrders.filter((o) => {
      if (!o.createdAt) return false;
      if (cutoff && new Date(o.createdAt) < cutoff) return false;
      return true;
    });
  }, [allOrders, exportPeriod]);

  const buildMonthlyRows = useCallback(() => {
    const orders = getFilteredOrdersForExport();
    const months = exportPeriod === '12m' ? getLast12Months() : exportPeriod === '6m' ? getLast6Months() : getLast12Months();
    const map: Record<string, { orders: number; spend: number; paid: number }> = {};
    months.forEach((m) => { map[m] = { orders: 0, spend: 0, paid: 0 }; });
    orders.forEach((o) => {
      const key = getMonthKey(o.createdAt);
      if (!map[key]) map[key] = { orders: 0, spend: 0, paid: 0 };
      map[key].orders += 1;
      if (o.isPaid) { map[key].spend += o.amount; map[key].paid += 1; }
    });
    return Object.entries(map).map(([month, d]) => ({
      'Month': month,
      'Total Orders': d.orders,
      'Paid Orders': d.paid,
      'Total Spend (₹)': d.spend.toFixed(2),
    }));
  }, [getFilteredOrdersForExport, exportPeriod]);

  const buildCategoryRows = useCallback(() => {
    const orders = getFilteredOrdersForExport();
    const map: Record<string, { orders: number; spend: number }> = {};
    orders.forEach((o) => {
      const cat = o.category || 'Other';
      if (!map[cat]) map[cat] = { orders: 0, spend: 0 };
      map[cat].orders += 1;
      if (o.isPaid) map[cat].spend += o.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].spend - a[1].spend)
      .map(([category, d]) => ({
        'Category': category,
        'Total Orders': d.orders,
        'Total Spend (₹)': d.spend.toFixed(2),
      }));
  }, [getFilteredOrdersForExport]);

  const buildSellerRows = useCallback(() => {
    const orders = getFilteredOrdersForExport();
    const map: Record<string, { name: string; orders: number; spend: number }> = {};
    orders.forEach((o) => {
      if (!o.sellerId) return;
      if (!map[o.sellerId]) map[o.sellerId] = { name: o.sellerName, orders: 0, spend: 0 };
      map[o.sellerId].orders += 1;
      if (o.isPaid) map[o.sellerId].spend += o.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].spend - a[1].spend)
      .map(([, d]) => ({
        'Seller': d.name,
        'Total Orders': d.orders,
        'Total Spend (₹)': d.spend.toFixed(2),
      }));
  }, [getFilteredOrdersForExport]);

  const handleExport = useCallback(() => {
    setExporting(true);
    try {
      let rows: Record<string, string | number>[] = [];
      let filename = 'spending_report';

      if (exportType === 'month') { rows = buildMonthlyRows(); filename = `spending_by_month_${exportPeriod}`; }
      else if (exportType === 'category') { rows = buildCategoryRows(); filename = `spending_by_category_${exportPeriod}`; }
      else { rows = buildSellerRows(); filename = `spending_by_seller_${exportPeriod}`; }

      if (rows.length === 0) { setExporting(false); return; }

      if (exportFormat === 'csv') {
        const headers = Object.keys(rows[0]);
        const csvContent = [
          headers.join(','),
          ...rows.map((row) => headers.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(',')),
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // PDF export — simple HTML print
        const headers = Object.keys(rows[0]);
        const tableRows = rows.map((row) =>
          `<tr>${headers.map((h) => `<td style="padding:6px 10px;border:1px solid #e5e7eb;">${row[h]}</td>`).join('')}</tr>`
        ).join('');
        const html = `<!DOCTYPE html><html><head><title>${filename}</title><style>body{font-family:sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th{background:#008060;color:white;padding:8px 10px;border:1px solid #006b52;text-align:left}td{font-size:13px}</style></head><body><h2 style="color:#008060">FabricTrad — Spending Report</h2><p style="color:#6b7280;font-size:13px">Generated: ${new Date().toLocaleDateString('en-IN')} | Period: ${exportPeriod === '6m' ? 'Last 6 months' : exportPeriod === '12m' ? 'Last 12 months' : 'All time'}</p><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
        const win = window.open('', '_blank');
        if (win) { win.document.write(html); win.document.close(); win.print(); }
      }
    } finally {
      setExporting(false);
    }
  }, [exportType, exportFormat, exportPeriod, buildMonthlyRows, buildCategoryRows, buildSellerRows]);

  if (busy) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-800 text-foreground">Buying Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Spending trends, category breakdown, and seller insights for your account</p>
        </div>
        {/* Tab switcher */}
        <div className="flex rounded-xl border border-border bg-muted p-1">
          <button type="button" onClick={() => setActiveTab('overview')} className={`rounded-lg px-4 py-1.5 text-xs font-700 transition ${activeTab === 'overview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            Overview
          </button>
          <button type="button" onClick={() => setActiveTab('export')} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-700 transition ${activeTab === 'export' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            <Icon name="ArrowDownTrayIcon" size={12} /> Export
          </button>
        </div>
      </div>

      {activeTab === 'export' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-1 text-sm font-800 text-foreground">Download Spending Report</h2>
            <p className="mb-5 text-xs text-muted-foreground">Export your procurement data for budget tracking and analysis</p>

            <div className="grid gap-5 sm:grid-cols-3">
              {/* Report Type */}
              <div>
                <p className="mb-2 text-xs font-700 text-foreground">Report Type</p>
                <div className="space-y-2">
                  {([
                    { key: 'month', label: 'By Month', desc: 'Monthly spending summary', icon: 'CalendarIcon' },
                    { key: 'category', label: 'By Category', desc: 'Spend per fabric category', icon: 'TagIcon' },
                    { key: 'seller', label: 'By Seller', desc: 'Spend per supplier', icon: 'BuildingStorefrontIcon' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setExportType(opt.key)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${exportType === opt.key ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20'}`}
                    >
                      <Icon name={opt.icon as 'CalendarIcon'} size={16} className={exportType === opt.key ? 'text-primary' : 'text-muted-foreground'} />
                      <div>
                        <p className={`text-xs font-700 ${exportType === opt.key ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                        <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Period */}
              <div>
                <p className="mb-2 text-xs font-700 text-foreground">Time Period</p>
                <div className="space-y-2">
                  {([
                    { key: '6m', label: 'Last 6 Months' },
                    { key: '12m', label: 'Last 12 Months' },
                    { key: 'all', label: 'All Time' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setExportPeriod(opt.key)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${exportPeriod === opt.key ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20'}`}
                    >
                      <div className={`h-3 w-3 rounded-full border-2 ${exportPeriod === opt.key ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                      <p className={`text-xs font-700 ${exportPeriod === opt.key ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div>
                <p className="mb-2 text-xs font-700 text-foreground">Export Format</p>
                <div className="space-y-2">
                  {([
                    { key: 'csv', label: 'CSV Spreadsheet', desc: 'Open in Excel / Google Sheets', icon: 'TableCellsIcon' },
                    { key: 'pdf', label: 'PDF Report', desc: 'Print-ready formatted report', icon: 'DocumentTextIcon' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setExportFormat(opt.key)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${exportFormat === opt.key ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20'}`}
                    >
                      <Icon name={opt.icon as 'TableCellsIcon'} size={16} className={exportFormat === opt.key ? 'text-primary' : 'text-muted-foreground'} />
                      <div>
                        <p className={`text-xs font-700 ${exportFormat === opt.key ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                        <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4">
              <div className="text-xs text-muted-foreground">
                <span className="font-700 text-foreground">{totalOrders}</span> total orders · <span className="font-700 text-foreground">{formatMoney(totalSpend)}</span> total spend
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || totalOrders === 0}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-700 text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {exporting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon name="ArrowDownTrayIcon" size={16} />
                )}
                {exporting ? 'Generating…' : `Download ${exportFormat.toUpperCase()}`}
              </button>
            </div>
          </div>

          {/* Preview table */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-3 text-xs font-800 text-foreground">Preview</h3>
            {exportType === 'month' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border">{['Month', 'Total Orders', 'Paid Orders', 'Total Spend (₹)'].map((h) => <th key={h} className="pb-2 pr-4 text-left font-700 text-muted-foreground">{h}</th>)}</tr></thead>
                  <tbody>{buildMonthlyRows().slice(0, 6).map((row, i) => <tr key={i} className="border-b border-border/50">{Object.values(row).map((v, j) => <td key={j} className="py-2 pr-4 text-foreground">{v}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
            {exportType === 'category' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border">{['Category', 'Total Orders', 'Total Spend (₹)'].map((h) => <th key={h} className="pb-2 pr-4 text-left font-700 text-muted-foreground">{h}</th>)}</tr></thead>
                  <tbody>{buildCategoryRows().slice(0, 6).map((row, i) => <tr key={i} className="border-b border-border/50">{Object.values(row).map((v, j) => <td key={j} className="py-2 pr-4 text-foreground">{v}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
            {exportType === 'seller' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border">{['Seller', 'Total Orders', 'Total Spend (₹)'].map((h) => <th key={h} className="pb-2 pr-4 text-left font-700 text-muted-foreground">{h}</th>)}</tr></thead>
                  <tbody>{buildSellerRows().slice(0, 6).map((row, i) => <tr key={i} className="border-b border-border/50">{Object.values(row).map((v, j) => <td key={j} className="py-2 pr-4 text-foreground">{v}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
            {totalOrders === 0 && <p className="text-center text-xs text-muted-foreground py-6">No orders found for the selected period</p>}
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total orders', value: String(totalOrders), icon: 'ShoppingBagIcon', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
              { label: 'Total spent', value: formatMoney(totalSpend), icon: 'CurrencyRupeeIcon', color: 'text-success', bg: 'bg-success/10 border-success/20' },
              { label: 'Unique sellers', value: String(Object.keys(allOrders.reduce((acc, o) => { if (o.sellerId) acc[o.sellerId] = 1; return acc; }, {} as Record<string, number>)).length), icon: 'BuildingStorefrontIcon', color: 'text-purple-700', bg: 'bg-purple-500/10 border-purple-500/20' },
              { label: 'Repeat purchase rate', value: `${repeatPurchaseRate}%`, icon: 'ArrowPathIcon', color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
            ].map((card) => (
              <div key={card.label} className={`stat-card border ${card.bg}`}>
                <Icon name={card.icon as 'ShoppingBagIcon'} size={20} className={card.color} />
                <p className={`mt-3 text-2xl font-800 ${card.color}`}>{card.value}</p>
                <p className="mt-1 text-xs font-700 leading-tight text-muted-foreground">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Spending Trends Chart */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4">
              <h2 className="text-sm font-800 text-foreground">Spending Trends</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Monthly spend on paid orders over the last 6 months</p>
            </div>
            {spendingTrends.every((d) => d.amount === 0) ? (
              <div className="flex h-48 items-center justify-center text-center">
                <div>
                  <Icon name="ChartBarIcon" size={32} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No paid orders yet — spending trends will appear here</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={spendingTrends} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Spent']} />
                  <Area type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={2} fill="url(#spendGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Order Count by Category + Favorite Sellers */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Category Breakdown */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-800 text-foreground">Orders by Category</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Distribution of your orders across fabric categories</p>
              </div>
              {categoryData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-center">
                  <div>
                    <Icon name="TagIcon" size={28} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No orders yet</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                        {categoryData.map((_, index) => (
                          <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} orders`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {categoryData.slice(0, 6).map((item, idx) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} />
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{item.name}</span>
                        <span className="shrink-0 text-xs font-700 text-muted-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Favorite Sellers */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4">
                <h2 className="text-sm font-800 text-foreground">Favourite Sellers</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Your most-ordered sellers ranked by order count</p>
              </div>
              {favoriteSellers.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-center">
                  <div>
                    <Icon name="BuildingStorefrontIcon" size={28} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No orders yet — favourite sellers will appear here</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {favoriteSellers.map((seller) => (
                    <div key={seller.sellerId} className="flex items-center gap-3 rounded-xl border border-border p-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-800 ${
                        seller.rank === 1 ? 'bg-amber-100 text-amber-700' :
                        seller.rank === 2 ? 'bg-gray-100 text-gray-600' :
                        seller.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'
                      }`}>
                        {seller.rank === 1 ? '🥇' : seller.rank === 2 ? '🥈' : seller.rank === 3 ? '🥉' : `#${seller.rank}`}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-700 text-foreground">{seller.displayId}</p>
                        <p className="text-xs text-muted-foreground">{seller.count} order{seller.count !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-800 text-foreground">{formatMoney(seller.totalSpend)}</p>
                        <p className="text-xs text-muted-foreground">total spent</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Repeat Purchase Rate Detail */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-800 text-foreground">Repeat Purchase Rate</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Percentage of sellers you have ordered from more than once</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-3xl font-800 text-primary">{repeatPurchaseRate}%</p>
                <p className="text-xs text-muted-foreground">repeat rate</p>
              </div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${repeatPurchaseRate}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{favoriteSellers.filter((s) => s.count > 1).length}</strong> sellers reordered
              </span>
              <span>
                <strong className="text-foreground">{totalOrders}</strong> total orders placed
              </span>
              {repeatPurchaseRate >= 50 && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 font-700 text-success">
                  Great loyalty score!
                </span>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
