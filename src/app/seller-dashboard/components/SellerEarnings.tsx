'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type PaymentRow = {
  id: string;
  orderId: string;
  orderType: 'catalog' | 'bulk';
  amount: number;
  capturedAmount: number;
  refundedAmount: number;
  platformCommission: number;
  razorpayFee: number;
  gstOnCommission: number;
  sellerPayable: number;
  status: string;
  transferStatus: string | null;
  transferId: string | null;
  paymentMethod: string | null;
  capturedAt: string | null;
  createdAt: string;
};

type SellerState = {
  settlementEligible: boolean;
  linkedAccountId: string | null;
};

const settledStatuses = new Set(['processed', 'settled', 'transferred', 'completed']);
const capturedStatuses = new Set(['captured', 'paid', 'authorized']);

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0);

const monthKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export default function SellerEarnings() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [seller, setSeller] = useState<SellerState | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'pending' | 'history'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!user?.id) {
      setPayments([]);
      setSeller(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: sellerRow, error: sellerError } = await supabase
      .from('seller_profiles')
      .select('id,settlement_eligible,razorpay_linked_account_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sellerError || !sellerRow?.id) {
      setError(sellerError?.message || 'Seller profile is not available.');
      setLoading(false);
      return;
    }
    setSeller({
      settlementEligible: sellerRow.settlement_eligible === true,
      linkedAccountId: sellerRow.razorpay_linked_account_id || null,
    });

    const [{ data: catalogOrders }, { data: bulkOrders }] = await Promise.all([
      supabase.from('catalog_order_requests').select('id').eq('seller_id', sellerRow.id).limit(5000),
      supabase.from('bulk_orders').select('id').eq('seller_id', sellerRow.id).limit(5000),
    ]);
    const catalogIds = (catalogOrders || []).map((row) => row.id);
    const bulkIds = (bulkOrders || []).map((row) => row.id);

    const catalogPromise = catalogIds.length
      ? supabase.from('catalog_order_payments').select('id,catalog_order_id,amount,captured_amount,refunded_amount,platform_commission,razorpay_fee,razorpay_fee_actual,gst_on_commission,seller_payable,status,transfer_status,razorpay_transfer_id,payment_method,captured_at,created_at').in('catalog_order_id', catalogIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any);
    const bulkPromise = bulkIds.length
      ? supabase.from('bulk_order_payments').select('id,bulk_order_id,amount,captured_amount,refunded_amount,platform_commission,razorpay_fee,razorpay_fee_actual,gst_on_commission,seller_payable,status,transfer_status,razorpay_transfer_id,payment_method,captured_at,created_at').in('bulk_order_id', bulkIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any);

    const [catalogResult, bulkResult] = await Promise.all([catalogPromise, bulkPromise]);
    const paymentError = catalogResult.error || bulkResult.error;
    if (paymentError) setError(paymentError.message);

    const mapPayment = (row: any, orderType: 'catalog' | 'bulk'): PaymentRow => ({
      id: String(row.id),
      orderId: String(orderType === 'catalog' ? row.catalog_order_id : row.bulk_order_id),
      orderType,
      amount: Number(row.amount || 0),
      capturedAmount: Number(row.captured_amount ?? row.amount ?? 0),
      refundedAmount: Number(row.refunded_amount || 0),
      platformCommission: Number(row.platform_commission || 0),
      razorpayFee: Number(row.razorpay_fee_actual ?? row.razorpay_fee ?? 0),
      gstOnCommission: Number(row.gst_on_commission || 0),
      sellerPayable: Number(row.seller_payable || 0),
      status: String(row.status || ''),
      transferStatus: row.transfer_status || null,
      transferId: row.razorpay_transfer_id || null,
      paymentMethod: row.payment_method || null,
      capturedAt: row.captured_at || null,
      createdAt: String(row.created_at),
    });

    setPayments([
      ...(catalogResult.data || []).map((row: any) => mapPayment(row, 'catalog')),
      ...(bulkResult.data || []).map((row: any) => mapPayment(row, 'bulk')),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const captured = payments.filter((payment) => capturedStatuses.has(payment.status.toLowerCase()) || payment.capturedAmount > 0);
  const grossCaptured = captured.reduce((sum, payment) => sum + Math.max(payment.capturedAmount, payment.amount), 0);
  const refunds = captured.reduce((sum, payment) => sum + payment.refundedAmount, 0);
  const fees = captured.reduce((sum, payment) => sum + payment.platformCommission + payment.razorpayFee + payment.gstOnCommission, 0);
  const sellerEarned = captured.reduce((sum, payment) => sum + payment.sellerPayable, 0);
  const settled = captured.filter((payment) => Boolean(payment.transferId) || settledStatuses.has(String(payment.transferStatus || '').toLowerCase()));
  const settledAmount = settled.reduce((sum, payment) => sum + payment.sellerPayable, 0);
  const pending = captured.filter((payment) => !settled.includes(payment));
  const pendingAmount = pending.reduce((sum, payment) => sum + payment.sellerPayable, 0);

  const monthRows = useMemo(() => {
    const rows = new Map<string, { month: string; earnings: number }>();
    const now = new Date();
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = monthKey(date.toISOString());
      rows.set(key, { month: date.toLocaleDateString('en-IN', { month: 'short' }), earnings: 0 });
    }
    captured.forEach((payment) => {
      const key = monthKey(payment.capturedAt || payment.createdAt);
      const row = rows.get(key);
      if (row) row.earnings += payment.sellerPayable;
    });
    return [...rows.values()];
  }, [captured]);

  const tabs = [
    { key: 'overview', label: 'Earnings overview', icon: 'ChartBarIcon' },
    { key: 'pending', label: 'Pending settlement', icon: 'ClockIcon' },
    { key: 'history', label: 'Transfer history', icon: 'DocumentTextIcon' },
  ] as const;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ft-route-kicker">Payments</p>
          <h1 className="mt-1 text-2xl font-800 text-foreground">Seller earnings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {seller?.linkedAccountId ? 'Razorpay linked settlement account connected.' : 'No Razorpay linked settlement account is connected yet.'}
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50"><Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {seller && !seller.settlementEligible && (
        <div className="mb-5 rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
          Settlement is not enabled for this seller yet. Captured payments can still appear below, but automated transfer requires an eligible linked account.
        </div>
      )}
      {error && <div className="mb-5 rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Gross captured', loading ? '—' : money(grossCaptured), 'CurrencyRupeeIcon', 'text-primary'],
          ['Seller payable', loading ? '—' : money(sellerEarned), 'BanknotesIcon', 'text-success'],
          ['Pending settlement', loading ? '—' : money(pendingAmount), 'ClockIcon', 'text-warning'],
          ['Transferred', loading ? '—' : money(settledAmount), 'CheckCircleIcon', 'text-success'],
        ].map(([label, value, icon, color]) => <div key={String(label)} className="rounded-2xl border border-border bg-card p-4"><Icon name={String(icon)} size={20} className={String(color)} /><p className={`mt-3 text-xl font-800 ${color}`}>{value}</p><p className="mt-1 text-xs font-700 text-muted-foreground">{label}</p></div>)}
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setActiveSection(tab.key)} className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-700 ${activeSection === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><Icon name={tab.icon} size={14} /> {tab.label}</button>)}
      </div>

      {activeSection === 'overview' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-800 text-foreground">Seller payable by month</h2>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={monthRows} barSize={18}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}K`} /><Tooltip formatter={(value: number) => [money(value), 'Seller payable']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} /><Bar dataKey="earnings" fill="var(--success)" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
            {!captured.length && <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center"><p className="text-sm font-800">No captured payments yet</p><p className="mt-1 text-xs text-muted-foreground">The chart will populate after real Razorpay captures are recorded.</p></div>}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-800 text-foreground">Payment deductions recorded</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Platform + processing + commission GST</p><p className="mt-1 text-xl font-800 text-foreground">{money(fees)}</p></div>
              <div className="rounded-xl bg-error/5 p-4"><p className="text-xs text-muted-foreground">Refunded</p><p className="mt-1 text-xl font-800 text-error">{money(refunds)}</p></div>
              <div className="rounded-xl bg-success/5 p-4"><p className="text-xs text-muted-foreground">Net seller payable</p><p className="mt-1 text-xl font-800 text-success">{money(sellerEarned)}</p></div>
            </div>
          </section>
        </div>
      )}

      {activeSection === 'pending' && (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4"><h2 className="text-sm font-800">Pending settlement</h2><p className="mt-1 text-xs text-muted-foreground">{pending.length} captured payment{pending.length === 1 ? '' : 's'} without a completed transfer.</p></div>
          {pending.length ? <div className="divide-y divide-border">{pending.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="mono-id">{payment.orderType === 'catalog' ? 'FT-CAT' : 'FT-BULK'}-{payment.orderId.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-xs text-muted-foreground">{payment.paymentMethod || 'Payment method not recorded'} · {new Date(payment.capturedAt || payment.createdAt).toLocaleString('en-IN')}</p></div><div className="text-right"><p className="text-sm font-800 text-success">{money(payment.sellerPayable)}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{String(payment.transferStatus || 'pending').replaceAll('_', ' ')}</p></div></div>)}</div> : <div className="px-5 py-10 text-center"><Icon name="ClockIcon" size={30} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-800">No pending settlements</p></div>}
        </section>
      )}

      {activeSection === 'history' && (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4"><h2 className="text-sm font-800">Completed transfers</h2><p className="mt-1 text-xs text-muted-foreground">Only records with a saved Razorpay transfer or settled status are shown.</p></div>
          {settled.length ? <div className="divide-y divide-border">{settled.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="mono-id">{payment.transferId || payment.id}</p><p className="mt-1 text-xs text-muted-foreground">Order {payment.orderId.slice(0, 8).toUpperCase()} · {new Date(payment.capturedAt || payment.createdAt).toLocaleString('en-IN')}</p></div><div className="text-right"><p className="text-sm font-800 text-success">{money(payment.sellerPayable)}</p><p className="mt-1 text-xs text-success">Transferred</p></div></div>)}</div> : <div className="px-5 py-10 text-center"><Icon name="CheckCircleIcon" size={30} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-800">No completed transfers yet</p></div>}
        </section>
      )}
    </div>
  );
}
