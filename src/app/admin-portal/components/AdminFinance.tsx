'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

const formatINR = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getLast6MonthKeys() {
  const result: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTHS[d.getMonth()],
    });
  }
  return result;
}

type FinanceSummary = {
  totalGMV: number;
  commissionEarned: number;
  pendingSettlements: number;
  settledAmount: number;
  totalRefunds: number;
  refundCount: number;
  pendingPayouts: number;
  approvedPayouts: number;
};

type MonthlyData = {
  month: string;
  gmv: number;
  commission: number;
  refunds: number;
  payouts: number;
};

type SettlementStatus = {
  label: string;
  count: number;
  amount: number;
  color: string;
};

export default function AdminFinance() {
  const [summary, setSummary] = useState<FinanceSummary>({
    totalGMV: 0,
    commissionEarned: 0,
    pendingSettlements: 0,
    settledAmount: 0,
    totalRefunds: 0,
    refundCount: 0,
    pendingPayouts: 0,
    approvedPayouts: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [settlementStatuses, setSettlementStatuses] = useState<SettlementStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<'gmv' | 'commission' | 'refunds'>('gmv');

  const COMMISSION_RATE = 0.05; // 5% platform commission

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const months = getLast6MonthKeys();

      // Fetch catalog orders
      const { data: catalogOrders } = await supabase
        .from('catalog_order_requests')
        .select('id,status,payment_status,total_amount,created_at')
        .order('created_at', { ascending: false })
        .limit(10000);

      // Fetch payout requests
      const { data: payoutRequests } = await supabase
        .from('seller_payout_requests')
        .select('id,status,amount,created_at')
        .order('created_at', { ascending: false })
        .limit(1000);

      const orders = catalogOrders || [];
      const payouts = payoutRequests || [];

      const paidStatuses = new Set(['paid', 'fulfilled', 'shipped', 'delivered']);
      const refundStatuses = new Set(['refunded', 'refund_requested', 'disputed']);

      // Calculate summary
      const paidOrders = orders.filter((o) => paidStatuses.has(String(o.status)) || o.payment_status === 'paid');
      const refundOrders = orders.filter((o) => refundStatuses.has(String(o.status)));
      const totalGMV = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      const commissionEarned = totalGMV * COMMISSION_RATE;
      const totalRefunds = refundOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      const pendingPayouts = payouts.filter((p) => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const approvedPayouts = payouts.filter((p) => p.status === 'approved' || p.status === 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0);

      setSummary({
        totalGMV,
        commissionEarned,
        pendingSettlements: pendingPayouts,
        settledAmount: approvedPayouts,
        totalRefunds,
        refundCount: refundOrders.length,
        pendingPayouts: payouts.filter((p) => p.status === 'pending').length,
        approvedPayouts: payouts.filter((p) => p.status === 'approved' || p.status === 'paid').length,
      });

      // Monthly breakdown
      const monthly = months.map(({ key, label }) => {
        const monthOrders = orders.filter((o) => String(o.created_at || '').startsWith(key));
        const monthPaid = monthOrders.filter((o) => paidStatuses.has(String(o.status)) || o.payment_status === 'paid');
        const monthRefunds = monthOrders.filter((o) => refundStatuses.has(String(o.status)));
        const monthPayouts = payouts.filter((p) => String(p.created_at || '').startsWith(key));
        const gmv = monthPaid.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
        return {
          month: label,
          gmv: Math.round(gmv),
          commission: Math.round(gmv * COMMISSION_RATE),
          refunds: Math.round(monthRefunds.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)),
          payouts: Math.round(monthPayouts.reduce((sum, p) => sum + Number(p.amount || 0), 0)),
        };
      });
      setMonthlyData(monthly);

      // Settlement status breakdown
      const statusMap: Record<string, { count: number; amount: number }> = {};
      payouts.forEach((p) => {
        const s = String(p.status || 'pending');
        if (!statusMap[s]) statusMap[s] = { count: 0, amount: 0 };
        statusMap[s].count += 1;
        statusMap[s].amount += Number(p.amount || 0);
      });
      const statusColors: Record<string, string> = {
        pending: '#f59e0b',
        approved: '#10b981',
        paid: '#3b82f6',
        rejected: '#ef4444',
      };
      setSettlementStatuses(
        Object.entries(statusMap).map(([label, d]) => ({
          label: label.charAt(0).toUpperCase() + label.slice(1),
          count: d.count,
          amount: d.amount,
          color: statusColors[label] || '#6b7280',
        }))
      );
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const kpis = [
    { label: 'Total GMV', value: formatINR(summary.totalGMV), icon: 'CurrencyRupeeIcon', color: 'text-primary', bg: 'bg-primary/10 border-primary/20', sub: 'Gross Merchandise Value' },
    { label: 'Commission Earned', value: formatINR(summary.commissionEarned), icon: 'BanknotesIcon', color: 'text-success', bg: 'bg-success/10 border-success/20', sub: '5% platform fee on GMV' },
    { label: 'Pending Settlements', value: formatINR(summary.pendingSettlements), icon: 'ClockIcon', color: 'text-warning', bg: 'bg-warning/10 border-warning/20', sub: `${summary.pendingPayouts} payout requests` },
    { label: 'Total Refunds', value: formatINR(summary.totalRefunds), icon: 'ArrowUturnLeftIcon', color: 'text-error', bg: 'bg-error/10 border-error/20', sub: `${summary.refundCount} refund orders` },
  ];

  const chartDataKey = chartView === 'gmv' ? 'gmv' : chartView === 'commission' ? 'commission' : 'refunds';
  const chartColor = chartView === 'gmv' ? '#3b82f6' : chartView === 'commission' ? '#10b981' : '#ef4444';
  const chartLabel = chartView === 'gmv' ? 'GMV' : chartView === 'commission' ? 'Commission' : 'Refunds';

  return (
    <div className="space-y-6">
      <div>
        <p className="ft-route-kicker">Finance</p>
        <h1 className="mt-1 text-2xl font-800 text-foreground">Finance Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform-wide GMV, commission, settlement status, payout trends, and refund activity</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4 animate-pulse">
                <div className="h-5 w-5 rounded bg-muted" />
                <div className="mt-3 h-7 w-24 rounded bg-muted" />
                <div className="mt-1 h-3 w-16 rounded bg-muted" />
              </div>
            ))
          : kpis.map((kpi) => (
              <div key={kpi.label} className={`rounded-2xl border p-4 ${kpi.bg}`}>
                <Icon name={kpi.icon as 'CurrencyRupeeIcon'} size={20} className={kpi.color} />
                <p className={`mt-3 text-2xl font-800 ${kpi.color}`}>{kpi.value}</p>
                <p className="mt-0.5 text-xs font-700 text-foreground">{kpi.label}</p>
                <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>
              </div>
            ))}
      </div>

      {/* Monthly Trends Chart */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-800 text-foreground">Monthly Financial Trends</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Last 6 months breakdown</p>
          </div>
          <div className="flex rounded-xl bg-muted p-1">
            {(['gmv', 'commission', 'refunds'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setChartView(v)} className={`rounded-lg px-3 py-1.5 text-xs font-700 capitalize transition ${chartView === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {v === 'gmv' ? 'GMV' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={formatINR} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value: number) => [formatINR(value), chartLabel]} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey={chartDataKey} fill={chartColor} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Settlement Status */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-800 text-foreground">Settlement Status</h2>
          <p className="mb-4 text-xs text-muted-foreground">Seller payout request breakdown by status</p>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : settlementStatuses.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-muted-foreground">No payout requests yet</p>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={settlementStatuses} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="count">
                    {settlementStatuses.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} requests`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {settlementStatuses.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs font-700 text-foreground">{s.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-700 text-foreground">{formatINR(s.amount)}</span>
                      <span className="ml-1.5 text-[10px] text-muted-foreground">({s.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Seller Payout Trends */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-800 text-foreground">Seller Payout Trends</h2>
          <p className="mb-4 text-xs text-muted-foreground">Monthly payout amounts requested by sellers</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={formatINR} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number) => [formatINR(value), 'Payouts']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="payouts" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>

      {/* Refund Activity */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-800 text-foreground">Refund Activity</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Monthly refund amounts vs GMV for operational oversight</p>
          </div>
          <div className="shrink-0 rounded-xl border border-error/20 bg-error/5 px-3 py-2 text-right">
            <p className="text-lg font-800 text-error">{formatINR(summary.totalRefunds)}</p>
            <p className="text-[10px] text-muted-foreground">total refunds</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={formatINR} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="gmv" fill="#3b82f6" radius={[4, 4, 0, 0]} name="GMV" />
            <Bar dataKey="refunds" fill="#ef4444" radius={[4, 4, 0, 0]} name="Refunds" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> GMV</div>
          <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Refunds</div>
          {summary.totalGMV > 0 && (
            <span className="ml-auto font-700 text-foreground">
              Refund rate: {((summary.totalRefunds / summary.totalGMV) * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
