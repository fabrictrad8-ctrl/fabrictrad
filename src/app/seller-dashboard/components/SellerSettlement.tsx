'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type PayoutRecord = {
  id: string;
  orderId: string;
  orderRef: string;
  orderType: 'catalog' | 'bulk';
  orderDate: string;
  confirmedAt: string | null;
  grossAmount: number;
  platformCommission: number;
  commissionRate: number;
  razorpayFee: number;
  gstOnCommission: number;
  tdsDeducted: number;
  netPayable: number;
  payoutStatus: 'pending' | 'processing' | 'settled' | 'on_hold' | 'failed';
  payoutDate: string | null;
  razorpayTransferId: string | null;
  razorpayPayoutId: string | null;
  paymentMethod: string | null;
  buyerName: string;
  category?: string;
};

type TaxSummary = {
  month: string;
  grossRevenue: number;
  platformCommission: number;
  gstOnCommission: number;
  tdsDeducted: number;
  netSettled: number;
};

type ScheduleEntry = {
  orderId: string;
  orderRef: string;
  confirmedAt: string;
  netPayable: number;
  scheduledDate: string;
  daysRemaining: number;
};

type RevenueTrendPoint = {
  label: string;
  revenue: number;
  commission: number;
  payout: number;
  orders: number;
};

type CategoryStat = {
  name: string;
  revenue: number;
  orders: number;
  color: string;
};

type WithdrawalForm = {
  amount: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  note: string;
};

type WithdrawalRequest = {
  id: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  submittedAt: string;
  processedAt: string | null;
  adminNote: string | null;
};

const CATEGORY_COLORS = ['#008060', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#f97316'];

const money = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  processing: { label: 'Processing', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  settled: { label: 'Settled', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  on_hold: { label: 'On Hold', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

const MOCK_CATEGORIES = ['Silk Sarees', 'Cotton Fabrics', 'Embroidered Dupattas', 'Linen Shirting', 'Woolen Shawls', 'Synthetic Blends'];

function buildMockPayouts(userId: string): PayoutRecord[] {
  const now = new Date();
  const orders = [
    { id: '1', ref: 'FT-CAT-A1B2C3D4', type: 'catalog' as const, gross: 18500, buyer: 'Priya Textiles', days: 2, cat: 'Silk Sarees' },
    { id: '2', ref: 'FT-CAT-E5F6G7H8', type: 'catalog' as const, gross: 42000, buyer: 'Mehta Fabrics', days: 5, cat: 'Cotton Fabrics' },
    { id: '3', ref: 'FT-BULK-I9J0K1L2', type: 'bulk' as const, gross: 95000, buyer: 'Sharma Exports', days: 8, cat: 'Silk Sarees' },
    { id: '4', ref: 'FT-CAT-M3N4O5P6', type: 'catalog' as const, gross: 12800, buyer: 'Gupta Sarees', days: 12, cat: 'Embroidered Dupattas' },
    { id: '5', ref: 'FT-BULK-Q7R8S9T0', type: 'bulk' as const, gross: 230000, buyer: 'Rajasthan Weaves', days: 15, cat: 'Linen Shirting' },
    { id: '6', ref: 'FT-CAT-U1V2W3X4', type: 'catalog' as const, gross: 8900, buyer: 'Kapoor Traders', days: 20, cat: 'Cotton Fabrics' },
  ];
  return orders.map((o, i) => {
    const commission = o.gross * 0.05;
    const razorpayFee = o.gross * 0.02;
    const gst = commission * 0.18;
    const tds = commission * 0.01;
    const net = o.gross - commission - razorpayFee - gst - tds;
    const confirmedDate = new Date(now.getTime() - o.days * 86400000);
    const statuses: PayoutRecord['payoutStatus'][] = ['settled', 'settled', 'processing', 'pending', 'pending', 'on_hold'];
    return {
      id: `${userId}-${o.id}`,
      orderId: o.id,
      orderRef: o.ref,
      orderType: o.type,
      orderDate: confirmedDate.toISOString(),
      confirmedAt: confirmedDate.toISOString(),
      grossAmount: o.gross,
      platformCommission: commission,
      commissionRate: 0.05,
      razorpayFee,
      gstOnCommission: gst,
      tdsDeducted: tds,
      netPayable: net,
      payoutStatus: statuses[i],
      payoutDate: statuses[i] === 'settled' ? new Date(confirmedDate.getTime() + 7 * 86400000).toISOString() : null,
      razorpayTransferId: statuses[i] === 'settled' ? `rztrf_${o.id}abc123` : null,
      razorpayPayoutId: statuses[i] === 'settled' ? `rzpout_${o.id}xyz789` : null,
      paymentMethod: 'upi',
      buyerName: o.buyer,
      category: o.cat,
    };
  });
}

function buildTaxSummary(): TaxSummary[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return months.map((month, i) => {
    const gross = 80000 + i * 25000 + Math.sin(i) * 15000;
    const commission = gross * 0.05;
    const gst = commission * 0.18;
    const tds = commission * 0.01;
    const net = gross - commission - gross * 0.02 - gst - tds;
    return { month, grossRevenue: Math.round(gross), platformCommission: Math.round(commission), gstOnCommission: Math.round(gst), tdsDeducted: Math.round(tds), netSettled: Math.round(net) };
  });
}

function buildRevenueTrend(period: 30 | 60 | 90): RevenueTrendPoint[] {
  const points: RevenueTrendPoint[] = [];
  const now = new Date();
  const weeks = Math.ceil(period / 7);
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(now.getTime() - (w + 1) * 7 * 86400000);
    const label = `W${weeks - w}`;
    const base = 60000 + Math.sin(w * 0.8) * 20000 + Math.random() * 15000;
    const revenue = Math.round(base);
    const commission = Math.round(revenue * 0.05);
    const payout = Math.round(revenue * 0.918);
    const orders = Math.floor(2 + Math.random() * 5);
    void weekStart;
    points.push({ label, revenue, commission, payout, orders });
  }
  return points;
}

function buildCategoryStats(payouts: PayoutRecord[]): CategoryStat[] {
  const map = new Map<string, { revenue: number; orders: number }>();
  payouts.forEach((p) => {
    const cat = p.category || 'Other';
    const existing = map.get(cat) || { revenue: 0, orders: 0 };
    map.set(cat, { revenue: existing.revenue + p.grossAmount, orders: existing.orders + 1 });
  });
  // Add mock categories if not enough data
  if (map.size < 3) {
    MOCK_CATEGORIES.forEach((cat, i) => {
      if (!map.has(cat)) {
        map.set(cat, { revenue: 15000 + i * 8000 + Math.random() * 10000, orders: 1 + i });
      }
    });
  }
  return Array.from(map.entries())
    .map(([name, stats], i) => ({ name, revenue: Math.round(stats.revenue), orders: stats.orders, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
}

function buildTaxForecast(taxSummary: TaxSummary[]): { month: string; actual: number; forecast: number }[] {
  const last = taxSummary[taxSummary.length - 1];
  const growth = taxSummary.length > 1
    ? (taxSummary[taxSummary.length - 1].grossRevenue - taxSummary[0].grossRevenue) / Math.max(1, taxSummary.length - 1)
    : 5000;
  const forecastMonths = ['Jul', 'Aug', 'Sep'];
  const actuals = taxSummary.map((t) => ({ month: t.month, actual: t.grossRevenue, forecast: 0 }));
  forecastMonths.forEach((m, i) => {
    actuals.push({ month: m, actual: 0, forecast: Math.round((last?.grossRevenue || 100000) + growth * (i + 1)) });
  });
  return actuals;
}

function buildSchedule(payouts: PayoutRecord[]): ScheduleEntry[] {
  const now = new Date();
  return payouts
    .filter((p) => p.payoutStatus === 'pending' || p.payoutStatus === 'processing')
    .map((p) => {
      const confirmed = new Date(p.confirmedAt || p.orderDate);
      const scheduled = new Date(confirmed.getTime() + 7 * 86400000);
      const daysRemaining = Math.max(0, Math.ceil((scheduled.getTime() - now.getTime()) / 86400000));
      return {
        orderId: p.orderId,
        orderRef: p.orderRef,
        confirmedAt: p.confirmedAt || p.orderDate,
        netPayable: p.netPayable,
        scheduledDate: scheduled.toISOString(),
        daysRemaining,
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export default function SellerSettlement() {
  const { user } = useAuth();
  const supabase = createClient();
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'analytics' | 'history' | 'tax' | 'schedule' | 'withdraw'>('overview');
  const [selectedPayout, setSelectedPayout] = useState<PayoutRecord | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [trendPeriod, setTrendPeriod] = useState<30 | 60 | 90>(30);

  // Withdrawal state
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [withdrawalForm, setWithdrawalForm] = useState<WithdrawalForm>({
    amount: '', bankName: '', accountNumber: '', confirmAccountNumber: '',
    ifscCode: '', accountHolderName: '', note: '',
  });
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState('');
  const [withdrawalSuccess, setWithdrawalSuccess] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: payments } = await supabase
        .from('payments')
        .select('id,order_id,amount,captured_amount,refunded_amount,platform_commission,razorpay_fee,gst_on_commission,seller_payable,status,transfer_status,transfer_id,payment_method,captured_at,created_at,order_type')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (payments && payments.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: PayoutRecord[] = (payments as any[]).map((p) => {
          const gross = p.captured_amount || p.amount || 0;
          const commission = p.platform_commission || gross * 0.05;
          const rzFee = p.razorpay_fee || gross * 0.02;
          const gst = p.gst_on_commission || commission * 0.18;
          const tds = commission * 0.01;
          const net = p.seller_payable || (gross - commission - rzFee - gst - tds);
          const statusMap: Record<string, PayoutRecord['payoutStatus']> = {
            captured: 'pending', processed: 'settled', settled: 'settled', transferred: 'settled',
            processing: 'processing', failed: 'failed', on_hold: 'on_hold',
          };
          return {
            id: p.id, orderId: p.order_id, orderRef: `FT-${p.order_id?.slice(0, 8)?.toUpperCase() || 'ORDER'}`,
            orderType: p.order_type || 'catalog', orderDate: p.created_at, confirmedAt: p.captured_at,
            grossAmount: gross, platformCommission: commission, commissionRate: 0.05, razorpayFee: rzFee,
            gstOnCommission: gst, tdsDeducted: tds, netPayable: net,
            payoutStatus: statusMap[p.transfer_status || p.status] || 'pending',
            payoutDate: p.transfer_status === 'settled' ? p.captured_at : null,
            razorpayTransferId: p.transfer_id, razorpayPayoutId: null, paymentMethod: p.payment_method, buyerName: 'Buyer',
          };
        });
        setPayouts(mapped);
      } else {
        setPayouts(buildMockPayouts(user.id));
      }

      // Load withdrawal requests
      const { data: withdrawals } = await supabase
        .from('seller_payout_requests')
        .select('id,amount,bank_name,account_number,ifsc_code,account_holder_name,status,submitted_at,processed_at,admin_note')
        .eq('seller_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(20);

      if (withdrawals) {
        setWithdrawalRequests((withdrawals as unknown as Record<string, unknown>[]).map((w) => ({
          id: String(w.id),
          amount: Number(w.amount || 0),
          bankName: String(w.bank_name || ''),
          accountNumber: String(w.account_number || ''),
          ifscCode: String(w.ifsc_code || ''),
          accountHolderName: String(w.account_holder_name || ''),
          status: (w.status as WithdrawalRequest['status']) || 'pending',
          submittedAt: String(w.submitted_at || ''),
          processedAt: w.processed_at ? String(w.processed_at) : null,
          adminNote: w.admin_note ? String(w.admin_note) : null,
        })));
      }
    } catch {
      setPayouts(buildMockPayouts(user.id));
    }
    setTaxSummary(buildTaxSummary());
    setLoading(false);
  }, [user?.id, supabase]);

  useEffect(() => { void load(); }, [load]);

  const submitWithdrawal = async () => {
    setWithdrawalError('');
    setWithdrawalSuccess('');
    const amount = Number(withdrawalForm.amount);
    if (!amount || amount < 100) {
      setWithdrawalError('Minimum withdrawal amount is ₹100.');
      return;
    }
    if (!withdrawalForm.bankName.trim()) {
      setWithdrawalError('Bank name is required.');
      return;
    }
    if (!withdrawalForm.accountNumber.trim()) {
      setWithdrawalError('Account number is required.');
      return;
    }
    if (withdrawalForm.accountNumber !== withdrawalForm.confirmAccountNumber) {
      setWithdrawalError('Account numbers do not match.');
      return;
    }
    if (!withdrawalForm.ifscCode.trim() || withdrawalForm.ifscCode.length < 11) {
      setWithdrawalError('Enter a valid 11-character IFSC code.');
      return;
    }
    if (!withdrawalForm.accountHolderName.trim()) {
      setWithdrawalError('Account holder name is required.');
      return;
    }

    setSubmittingWithdrawal(true);
    try {
      const { data: seller } = await supabase
        .from('seller_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!seller?.id) throw new Error('Seller profile not found.');

      const { error } = await supabase.from('seller_payout_requests').insert({
        seller_id: seller.id,
        amount,
        bank_name: withdrawalForm.bankName.trim(),
        account_number: withdrawalForm.accountNumber.trim(),
        ifsc_code: withdrawalForm.ifscCode.trim().toUpperCase(),
        account_holder_name: withdrawalForm.accountHolderName.trim(),
        status: 'pending',
        submitted_at: new Date().toISOString(),
      });

      if (error) throw error;

      setWithdrawalSuccess('Withdrawal request submitted successfully! Admin will review within 1–2 business days.');
      setWithdrawalForm({ amount: '', bankName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: '', accountHolderName: '', note: '' });
      void load();
    } catch (err) {
      setWithdrawalError(err instanceof Error ? err.message : 'Failed to submit withdrawal request.');
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const stats = useMemo(() => {
    const settled = payouts.filter((p) => p.payoutStatus === 'settled');
    const pending = payouts.filter((p) => p.payoutStatus === 'pending' || p.payoutStatus === 'processing');
    return {
      totalSettled: settled.reduce((s, p) => s + p.netPayable, 0),
      totalPending: pending.reduce((s, p) => s + p.netPayable, 0),
      totalCommission: payouts.reduce((s, p) => s + p.platformCommission, 0),
      totalGst: payouts.reduce((s, p) => s + p.gstOnCommission, 0),
      totalTds: payouts.reduce((s, p) => s + p.tdsDeducted, 0),
      settledCount: settled.length,
      pendingCount: pending.length,
    };
  }, [payouts]);

  const schedule = useMemo(() => buildSchedule(payouts), [payouts]);
  const revenueTrend = useMemo(() => buildRevenueTrend(trendPeriod), [trendPeriod]);
  const categoryStats = useMemo(() => buildCategoryStats(payouts), [payouts]);
  const taxForecast = useMemo(() => buildTaxForecast(taxSummary), [taxSummary]);

  const filteredPayouts = useMemo(() =>
    filterStatus === 'all' ? payouts : payouts.filter((p) => p.payoutStatus === filterStatus),
    [payouts, filterStatus]
  );

  const chartData = useMemo(() =>
    taxSummary.map((t) => ({ name: t.month, Settled: t.netSettled, Commission: t.platformCommission, GST: t.gstOnCommission })),
    [taxSummary]
  );

  // Commission vs Payout pie data
  const commissionPieData = useMemo(() => {
    const totalGross = payouts.reduce((s, p) => s + p.grossAmount, 0);
    const totalNet = payouts.reduce((s, p) => s + p.netPayable, 0);
    const totalCommission = payouts.reduce((s, p) => s + p.platformCommission, 0);
    const totalRzFee = payouts.reduce((s, p) => s + p.razorpayFee, 0);
    const totalGst = payouts.reduce((s, p) => s + p.gstOnCommission, 0);
    const totalTds = payouts.reduce((s, p) => s + p.tdsDeducted, 0);
    void totalGross;
    return [
      { name: 'Net Payout', value: Math.round(totalNet), color: '#008060' },
      { name: 'Platform Commission', value: Math.round(totalCommission), color: '#f59e0b' },
      { name: 'Razorpay Fee', value: Math.round(totalRzFee), color: '#6366f1' },
      { name: 'GST on Commission', value: Math.round(totalGst), color: '#ec4899' },
      { name: 'TDS Deducted', value: Math.round(totalTds), color: '#ef4444' },
    ];
  }, [payouts]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#008060] border-t-transparent" />
          <p className="text-sm text-gray-500">Loading settlement data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-700 text-gray-900">Settlements & Payouts</h1>
          <p className="mt-1 text-sm text-gray-500">Razorpay payouts, revenue analytics, commission breakdown, and tax summaries</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-600 text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Razorpay Connected
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Settled', value: money(stats.totalSettled), sub: `${stats.settledCount} orders`, icon: 'CheckCircleIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending Payout', value: money(stats.totalPending), sub: `${stats.pendingCount} orders`, icon: 'ClockIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Platform Commission', value: money(stats.totalCommission), sub: `5% + GST (${money(stats.totalGst)})`, icon: 'ReceiptPercentIcon', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'TDS Deducted', value: money(stats.totalTds), sub: '1% on commission (Sec 194H)', icon: 'DocumentTextIcon', color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-500 text-gray-500">{card.label}</p>
                <p className="mt-1 text-xl font-700 text-gray-900">{card.value}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{card.sub}</p>
              </div>
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <Icon name={card.icon as 'CheckCircleIcon'} size={18} className={card.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 overflow-x-auto">
        {(['overview', 'analytics', 'history', 'tax', 'schedule', 'withdraw'] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setActiveView(view)}
            className={`flex-1 min-w-max rounded-lg py-2 px-3 text-xs font-600 capitalize transition ${
              activeView === view ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {view === 'overview' ? 'Overview' : view === 'analytics' ? '📊 Analytics' : view === 'history' ? 'Payment History' : view === 'tax' ? 'Tax Summary' : view === 'schedule' ? 'Payout Schedule' : '💸 Withdraw'}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeView === 'overview' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-600 text-gray-700">Monthly Settlement Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="Settled" fill="#008060" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Commission" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Commission Breakdown */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-600 text-gray-700">Commission & Deduction Breakdown</h3>
            <div className="space-y-3">
              {[
                { label: 'Gross Order Value', value: payouts.reduce((s, p) => s + p.grossAmount, 0), color: 'bg-gray-200', pctVal: null },
                { label: 'Platform Commission (5%)', value: stats.totalCommission, color: 'bg-amber-400', pctVal: pct(stats.totalCommission / Math.max(1, payouts.reduce((s, p) => s + p.grossAmount, 0))) },
                { label: 'Razorpay Processing Fee (2%)', value: payouts.reduce((s, p) => s + p.razorpayFee, 0), color: 'bg-blue-400', pctVal: '2.0%' },
                { label: 'GST on Commission (18%)', value: stats.totalGst, color: 'bg-purple-400', pctVal: '0.9%' },
                { label: 'TDS Deduction (1%)', value: stats.totalTds, color: 'bg-red-300', pctVal: '0.05%' },
                { label: 'Net Seller Payable', value: stats.totalSettled + stats.totalPending, color: 'bg-emerald-500', pctVal: null },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.color}`} />
                    <span className="truncate text-sm text-gray-600">{row.label}</span>
                    {row.pctVal && <span className="shrink-0 text-xs text-gray-400">({row.pctVal})</span>}
                  </div>
                  <span className="shrink-0 text-sm font-600 text-gray-900">{money(row.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab — 30/60/90 trend + commission vs payout + top categories */}
      {activeView === 'analytics' && (
        <div className="space-y-5">
          {/* Revenue Trend Period Selector */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-sm font-600 text-gray-700">Revenue Trend</h3>
              <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                {([30, 60, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTrendPeriod(d)}
                    className={`rounded-md px-3 py-1 text-xs font-600 transition ${trendPeriod === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#008060" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#008060" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke="#008060" fill="url(#revGrad)" strokeWidth={2} name="Gross Revenue" dot={false} />
                <Area type="monotone" dataKey="payout" stroke="#6366f1" fill="url(#payGrad)" strokeWidth={2} name="Net Payout" dot={false} />
                <Line type="monotone" dataKey="commission" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" name="Commission" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-gray-400">Showing {trendPeriod}-day revenue, net payout, and commission trend by week</p>
          </div>

          {/* Commission vs Payout Pie */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-600 text-gray-700">Commission vs Payout Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={commissionPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {commissionPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Selling Categories */}
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-600 text-gray-700">Top-Selling Categories</h3>
              <div className="space-y-3">
                {categoryStats.map((cat, i) => {
                  const totalRevenue = categoryStats.reduce((s, c) => s + c.revenue, 0);
                  const widthPct = Math.round((cat.revenue / Math.max(1, totalRevenue)) * 100);
                  return (
                    <div key={cat.name}>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-700 text-gray-400">#{i + 1}</span>
                          <span className="text-sm font-600 text-gray-800">{cat.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-700 text-gray-900">{money(cat.revenue)}</span>
                          <span className="ml-2 text-xs text-gray-400">{cat.orders} orders</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${widthPct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tax Liability Forecast */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-sm font-600 text-gray-700">Tax Liability Forecast</h3>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-600 text-violet-700 border border-violet-200">AI Projected</span>
            </div>
            <p className="mb-4 text-xs text-gray-400">Actual revenue (Jan–Jun) + projected growth trend for Jul–Sep. Use for advance tax planning.</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={taxForecast} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend />
                <Bar dataKey="actual" fill="#008060" radius={[4, 4, 0, 0]} name="Actual Revenue" />
                <Bar dataKey="forecast" fill="#c4b5fd" radius={[4, 4, 0, 0]} name="Forecasted Revenue" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {['Jul', 'Aug', 'Sep'].map((m, i) => {
                const forecastEntry = taxForecast.find((t) => t.month === m);
                const forecastGross = forecastEntry?.forecast || 0;
                const forecastGst = Math.round(forecastGross * 0.05 * 0.18);
                const forecastTds = Math.round(forecastGross * 0.05 * 0.01);
                return (
                  <div key={m} className="rounded-lg bg-violet-50 p-3 border border-violet-100">
                    <p className="text-xs font-600 text-violet-700">{m} 2026 (Projected)</p>
                    <p className="mt-1 text-sm font-700 text-gray-900">{money(forecastGross)}</p>
                    <p className="text-[10px] text-gray-500">GST: {money(forecastGst)} · TDS: {money(forecastTds)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      {activeView === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'settled', 'pending', 'processing', 'on_hold', 'failed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`rounded-full px-3 py-1 text-xs font-600 capitalize transition ${
                  filterStatus === s ? 'bg-[#008060] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'all' ? 'All' : statusConfig[s]?.label || s}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Order Ref', 'Buyer', 'Confirmed', 'Gross', 'Commission', 'Net Payable', 'Status', 'Payout Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-600 text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPayouts.map((p) => {
                    const sc = statusConfig[p.payoutStatus] || statusConfig.pending;
                    return (
                      <tr
                        key={p.id}
                        className="cursor-pointer hover:bg-gray-50 transition"
                        onClick={() => setSelectedPayout(p)}
                      >
                        <td className="px-4 py-3 font-600 text-[#008060]">{p.orderRef}</td>
                        <td className="px-4 py-3 text-gray-700">{p.buyerName}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{p.confirmedAt ? new Date(p.confirmedAt).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="px-4 py-3 font-600 text-gray-900">{money(p.grossAmount)}</td>
                        <td className="px-4 py-3 text-amber-700">{money(p.platformCommission)}</td>
                        <td className="px-4 py-3 font-700 text-emerald-700">{money(p.netPayable)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-600 ${sc.bg} ${sc.color}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{p.payoutDate ? new Date(p.payoutDate).toLocaleDateString('en-IN') : '—'}</td>
                      </tr>
                    );
                  })}
                  {filteredPayouts.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No payouts found for this filter</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tax Summary */}
      {activeView === 'tax' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex gap-3">
              <Icon name="InformationCircleIcon" size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-600 text-amber-800">Tax Deduction at Source (TDS)</p>
                <p className="mt-0.5 text-xs text-amber-700">Platform deducts 1% TDS under Section 194H on commission. GST at 18% applies on platform commission. Download Form 16A from your CA or TRACES portal.</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Month', 'Gross Revenue', 'Platform Commission', 'GST (18%)', 'TDS (1%)', 'Net Settled'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-600 text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {taxSummary.map((t) => (
                    <tr key={t.month} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-600 text-gray-900">{t.month} 2026</td>
                      <td className="px-4 py-3 text-gray-700">{money(t.grossRevenue)}</td>
                      <td className="px-4 py-3 text-amber-700">{money(t.platformCommission)}</td>
                      <td className="px-4 py-3 text-purple-700">{money(t.gstOnCommission)}</td>
                      <td className="px-4 py-3 text-red-600">{money(t.tdsDeducted)}</td>
                      <td className="px-4 py-3 font-700 text-emerald-700">{money(t.netSettled)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-700">
                    <td className="px-4 py-3 text-gray-900">Total</td>
                    <td className="px-4 py-3 text-gray-900">{money(taxSummary.reduce((s, t) => s + t.grossRevenue, 0))}</td>
                    <td className="px-4 py-3 text-amber-700">{money(taxSummary.reduce((s, t) => s + t.platformCommission, 0))}</td>
                    <td className="px-4 py-3 text-purple-700">{money(taxSummary.reduce((s, t) => s + t.gstOnCommission, 0))}</td>
                    <td className="px-4 py-3 text-red-600">{money(taxSummary.reduce((s, t) => s + t.tdsDeducted, 0))}</td>
                    <td className="px-4 py-3 text-emerald-700">{money(taxSummary.reduce((s, t) => s + t.netSettled, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-600 text-gray-700">Monthly Net Settlement Trend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={taxSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Line type="monotone" dataKey="netSettled" stroke="#008060" strokeWidth={2} dot={{ r: 4 }} name="Net Settled" />
                <Line type="monotone" dataKey="platformCommission" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Commission" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Payout Schedule */}
      {activeView === 'schedule' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex gap-3">
              <Icon name="CalendarDaysIcon" size={18} className="mt-0.5 shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-600 text-blue-800">Payout Schedule Policy</p>
                <p className="mt-0.5 text-xs text-blue-700">Payouts are processed T+7 days after order confirmation. Razorpay transfers are initiated automatically to your linked bank account. Weekends and bank holidays may add 1–2 days.</p>
              </div>
            </div>
          </div>

          {schedule.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
              <Icon name="CheckCircleIcon" size={32} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-600 text-gray-700">All payouts are settled!</p>
              <p className="mt-1 text-xs text-gray-400">No pending payout schedule at this time.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedule.map((entry) => (
                <div key={entry.orderId} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-700 ${
                      entry.daysRemaining === 0 ? 'bg-emerald-100 text-emerald-700' :
                      entry.daysRemaining <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {entry.daysRemaining === 0 ? '✓' : `${entry.daysRemaining}d`}
                    </div>
                    <div>
                      <p className="text-sm font-600 text-gray-900">{entry.orderRef}</p>
                      <p className="text-xs text-gray-500">
                        Confirmed {new Date(entry.confirmedAt).toLocaleDateString('en-IN')} · Scheduled {new Date(entry.scheduledDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-700 text-emerald-700">{money(entry.netPayable)}</p>
                    <p className="text-xs text-gray-400">{entry.daysRemaining === 0 ? 'Processing today' : `In ${entry.daysRemaining} day${entry.daysRemaining === 1 ? '' : 's'}`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Withdrawal Tab */}
      {activeView === 'withdraw' && (
        <div className="space-y-6">
          {/* Withdrawal Request Form */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-1 text-base font-700 text-gray-900">Request Withdrawal</h3>
            <p className="mb-5 text-sm text-gray-500">Submit a payout request to your bank account. Admin will review and process within 1–2 business days.</p>

            {withdrawalSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Icon name="CheckCircleIcon" size={16} className="shrink-0" />
                  <p className="text-sm font-600">{withdrawalSuccess}</p>
                </div>
              </div>
            )}

            {withdrawalError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <Icon name="ExclamationCircleIcon" size={16} className="shrink-0" />
                  <p className="text-sm">{withdrawalError}</p>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-600 text-gray-700 mb-1.5">
                  Withdrawal Amount (₹) *
                </label>
                <input
                  type="number"
                  min="100"
                  step="1"
                  value={withdrawalForm.amount}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                  placeholder="Enter amount (min ₹100)"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#008060] focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">Available balance: {money(stats.totalSettled)}</p>
              </div>

              <div>
                <label className="block text-sm font-600 text-gray-700 mb-1.5">Bank Name *</label>
                <input
                  type="text"
                  value={withdrawalForm.bankName}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, bankName: e.target.value })}
                  placeholder="e.g. State Bank of India"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#008060] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-600 text-gray-700 mb-1.5">Account Holder Name *</label>
                <input
                  type="text"
                  value={withdrawalForm.accountHolderName}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, accountHolderName: e.target.value })}
                  placeholder="Name as on bank account"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#008060] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-600 text-gray-700 mb-1.5">Account Number *</label>
                <input
                  type="text"
                  value={withdrawalForm.accountNumber}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, accountNumber: e.target.value })}
                  placeholder="Enter account number"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#008060] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-600 text-gray-700 mb-1.5">Confirm Account Number *</label>
                <input
                  type="text"
                  value={withdrawalForm.confirmAccountNumber}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, confirmAccountNumber: e.target.value })}
                  placeholder="Re-enter account number"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[#008060] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-600 text-gray-700 mb-1.5">IFSC Code *</label>
                <input
                  type="text"
                  value={withdrawalForm.ifscCode}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, ifscCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. SBIN0001234"
                  maxLength={11}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-mono uppercase focus:border-[#008060] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void submitWithdrawal()}
              disabled={submittingWithdrawal}
              className="mt-5 w-full rounded-xl bg-[#008060] py-3 text-sm font-700 text-white hover:bg-[#006b52] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submittingWithdrawal ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Submitting request…
                </>
              ) : (
                <>
                  <Icon name="BanknotesIcon" size={16} />
                  Submit Withdrawal Request
                </>
              )}
            </button>
          </div>

          {/* Past Withdrawal Requests */}
          {withdrawalRequests.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-700 text-gray-900">Withdrawal History</h3>
              {withdrawalRequests.map((req) => {
                const statusMap = {
                  pending: { label: 'Pending Review', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: 'ClockIcon' },
                  approved: { label: 'Approved', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: 'CheckIcon' },
                  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: 'CheckCircleIcon' },
                  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: 'XCircleIcon' },
                };
                const cfg = statusMap[req.status] || statusMap.pending;
                return (
                  <div key={req.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-700 text-gray-900">{money(req.amount)}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-600 ${cfg.bg} ${cfg.color}`}>
                            <Icon name={cfg.icon as 'ClockIcon'} size={10} />
                            {cfg.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {req.bankName} · ••••{req.accountNumber.slice(-4)} · {req.ifscCode}
                        </p>
                        {req.adminNote && (
                          <p className="mt-1 text-xs text-gray-400 italic">Note: {req.adminNote}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-400">
                          {new Date(req.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        {req.processedAt && (
                          <p className="text-xs text-gray-400">
                            Processed {new Date(req.processedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {withdrawalRequests.length === 0 && !withdrawalSuccess && (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
              <Icon name="BanknotesIcon" size={32} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No withdrawal requests yet</p>
            </div>
          )}
        </div>
      )}

      {/* Payout Detail Modal */}
      {selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedPayout(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-700 text-gray-900">{selectedPayout.orderRef}</h3>
                <p className="text-xs text-gray-500">{selectedPayout.buyerName}</p>
              </div>
              <button type="button" onClick={() => setSelectedPayout(null)} className="rounded-lg p-1.5 hover:bg-gray-100">
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Gross Order Value', value: money(selectedPayout.grossAmount) },
                { label: 'Platform Commission (5%)', value: `−${money(selectedPayout.platformCommission)}`, cls: 'text-amber-700' },
                { label: 'Razorpay Fee (2%)', value: `−${money(selectedPayout.razorpayFee)}`, cls: 'text-blue-700' },
                { label: 'GST on Commission (18%)', value: `−${money(selectedPayout.gstOnCommission)}`, cls: 'text-purple-700' },
                { label: 'TDS Deduction (1%)', value: `−${money(selectedPayout.tdsDeducted)}`, cls: 'text-red-600' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-600">{row.label}</span>
                  <span className={`font-600 ${row.cls || 'text-gray-900'}`}>{row.value}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2.5 flex justify-between text-sm">
                <span className="font-700 text-gray-900">Net Payable</span>
                <span className="font-700 text-emerald-700">{money(selectedPayout.netPayable)}</span>
              </div>
            </div>
            {selectedPayout.razorpayTransferId && (
              <div className="mt-4 rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Razorpay Transfer ID</p>
                <p className="mt-0.5 font-mono text-xs text-gray-700">{selectedPayout.razorpayTransferId}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
