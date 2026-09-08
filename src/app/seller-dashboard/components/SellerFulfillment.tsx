'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type Shipment = {
  id: string;
  order_id: string;
  buyer_id: string | null;
  courier_type: string | null;
  courier_name: string | null;
  awb_number: string | null;
  tracking_url: string | null;
  estimated_delivery: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  bulk_order_id: string | null;
  catalog_order_id: string | null;
};

type Dispute = {
  id: string;
  status: string | null;
  dispute_type: string | null;
  created_at: string;
  resolved_at: string | null;
  requested_refund_amount: number | null;
};

const terminalDelivered = new Set(['delivered']);
const terminalFailed = new Set(['cancelled', 'failed', 'rto_delivered']);

const monthKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

export default function SellerFulfillment() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [months, setMonths] = useState<3 | 6>(6);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!user?.id) {
      setShipments([]);
      setDisputes([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data: seller, error: sellerError } = await supabase
      .from('seller_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sellerError || !seller?.id) {
      setError(sellerError?.message || 'Seller profile is not available.');
      setLoading(false);
      return;
    }

    const [shipmentResult, disputeResult] = await Promise.all([
      supabase
        .from('seller_shipments')
        .select('id,order_id,buyer_id,courier_type,courier_name,awb_number,tracking_url,estimated_delivery,status,created_at,updated_at,bulk_order_id,catalog_order_id')
        .eq('seller_id', seller.id)
        .order('updated_at', { ascending: false })
        .limit(5000),
      supabase
        .from('disputes')
        .select('id,status,dispute_type,created_at,resolved_at,requested_refund_amount')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false })
        .limit(2000),
    ]);

    const queryError = shipmentResult.error || disputeResult.error;
    if (queryError) setError(queryError.message);
    setShipments((shipmentResult.data || []) as Shipment[]);
    setDisputes((disputeResult.data || []) as Dispute[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const cutoff = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - 1), 1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, [months]);

  const scopedShipments = shipments.filter((shipment) => new Date(shipment.created_at).getTime() >= cutoff);
  const scopedDisputes = disputes.filter((dispute) => new Date(dispute.created_at).getTime() >= cutoff);
  const delivered = scopedShipments.filter((shipment) => terminalDelivered.has(String(shipment.status || '').toLowerCase()));
  const active = scopedShipments.filter((shipment) => !terminalDelivered.has(String(shipment.status || '').toLowerCase()) && !terminalFailed.has(String(shipment.status || '').toLowerCase()));
  const avgDeliveryDays = delivered.length
    ? delivered.reduce((sum, shipment) => sum + Math.max(0, new Date(shipment.updated_at).getTime() - new Date(shipment.created_at).getTime()) / 86400000, 0) / delivered.length
    : null;
  const completionRate = scopedShipments.length ? Math.round((delivered.length / scopedShipments.length) * 1000) / 10 : null;
  const openDisputes = scopedDisputes.filter((dispute) => !['resolved', 'closed', 'rejected'].includes(String(dispute.status || '').toLowerCase()));
  const requestedRefund = scopedDisputes.reduce((sum, dispute) => sum + Number(dispute.requested_refund_amount || 0), 0);

  const monthly = useMemo(() => {
    const rows = new Map<string, { period: string; shipments: number; delivered: number; failed: number; disputes: number; avgDeliveryDays: number | null }>();
    const now = new Date();
    for (let offset = months - 1; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = monthKey(date.toISOString());
      rows.set(key, { period: monthLabel(key), shipments: 0, delivered: 0, failed: 0, disputes: 0, avgDeliveryDays: null });
    }
    const deliverySamples = new Map<string, number[]>();
    scopedShipments.forEach((shipment) => {
      const key = monthKey(shipment.created_at);
      const row = rows.get(key);
      if (!row) return;
      row.shipments += 1;
      const status = String(shipment.status || '').toLowerCase();
      if (terminalDelivered.has(status)) {
        row.delivered += 1;
        const days = Math.max(0, new Date(shipment.updated_at).getTime() - new Date(shipment.created_at).getTime()) / 86400000;
        deliverySamples.set(key, [...(deliverySamples.get(key) || []), days]);
      }
      if (terminalFailed.has(status)) row.failed += 1;
    });
    scopedDisputes.forEach((dispute) => {
      const row = rows.get(monthKey(dispute.created_at));
      if (row) row.disputes += 1;
    });
    rows.forEach((row, key) => {
      const samples = deliverySamples.get(key) || [];
      row.avgDeliveryDays = samples.length ? Math.round((samples.reduce((sum, value) => sum + value, 0) / samples.length) * 10) / 10 : null;
    });
    return [...rows.values()];
  }, [months, scopedDisputes, scopedShipments]);

  const exportRows = monthly.map((row) => ({
    Period: row.period,
    Shipments: row.shipments,
    Delivered: row.delivered,
    Failed: row.failed,
    Disputes: row.disputes,
    'Avg delivery days': row.avgDeliveryDays ?? '',
    'Completion rate (%)': row.shipments ? Math.round((row.delivered / row.shipments) * 1000) / 10 : '',
  }));

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="ft-route-kicker">Fulfilment</p>
          <h1 className="mt-1 text-2xl font-800 text-foreground">Fulfilment performance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Calculated only from saved shipments and disputes for this seller account.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {[3, 6].map((value) => <button key={value} type="button" onClick={() => setMonths(value as 3 | 6)} className={`rounded-lg px-3 py-1.5 text-xs font-700 ${months === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Last {value} months</button>)}
          </div>
          <div className="relative">
            <button type="button" onClick={() => setShowExportMenu((value) => !value)} disabled={!exportRows.length} className="btn-secondary flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs disabled:opacity-50"><Icon name="ArrowDownTrayIcon" size={14} /> Export <Icon name="ChevronDownIcon" size={12} /></button>
            {showExportMenu && <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-border bg-card shadow-lg"><button type="button" onClick={() => { exportToCSV(exportRows, 'seller_fulfillment'); setShowExportMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-700 hover:bg-muted"><Icon name="DocumentTextIcon" size={14} /> CSV</button><button type="button" onClick={() => { exportToExcel(exportRows, 'seller_fulfillment'); setShowExportMenu(false); }} className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-xs font-700 hover:bg-muted"><Icon name="TableCellsIcon" size={14} /> Excel</button></div>}
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50"><Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
        </div>
      </div>

      {error && <div className="mb-5 rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Avg delivery', loading ? '—' : avgDeliveryDays === null ? '—' : `${avgDeliveryDays.toFixed(1)} days`, 'TruckIcon', 'text-primary'],
          ['Delivered', loading ? '—' : delivered.length.toString(), 'CheckCircleIcon', 'text-success'],
          ['Completion rate', loading ? '—' : completionRate === null ? '—' : `${completionRate}%`, 'ChartBarIcon', 'text-success'],
          ['Open disputes', loading ? '—' : openDisputes.length.toString(), 'ExclamationTriangleIcon', openDisputes.length ? 'text-error' : 'text-success'],
        ].map(([label, value, icon, color]) => <div key={String(label)} className="rounded-2xl border border-border bg-card p-4"><Icon name={String(icon)} size={20} className={String(color)} /><p className={`mt-3 text-2xl font-800 ${color}`}>{value}</p><p className="mt-1 text-xs font-700 text-muted-foreground">{label}</p></div>)}
      </div>

      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4"><h2 className="text-sm font-800 text-foreground">Monthly breakdown</h2><p className="mt-1 text-xs text-muted-foreground">No values are pre-filled or simulated.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm"><thead><tr><th className="px-4 py-3 text-left">Period</th><th className="px-4 py-3 text-center">Shipments</th><th className="px-4 py-3 text-center">Delivered</th><th className="px-4 py-3 text-center">Failed/RTO</th><th className="px-4 py-3 text-center">Disputes</th><th className="px-4 py-3 text-center">Avg delivery</th></tr></thead><tbody>{monthly.map((row) => <tr key={row.period}><td className="px-4 py-3 font-800">{row.period}</td><td className="px-4 py-3 text-center">{row.shipments}</td><td className="px-4 py-3 text-center text-success">{row.delivered}</td><td className="px-4 py-3 text-center text-error">{row.failed}</td><td className="px-4 py-3 text-center">{row.disputes}</td><td className="px-4 py-3 text-center">{row.avgDeliveryDays === null ? '—' : `${row.avgDeliveryDays}d`}</td></tr>)}</tbody></table>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-sm font-800 text-foreground">Active delivery progress</h2><p className="mt-1 text-xs text-muted-foreground">Current saved shipment status for orders still moving.</p></div><span className="ft-orange-chip">{active.length} active</span></div>
        {active.length ? <div className="space-y-3">{active.slice(0, 20).map((shipment) => <article key={shipment.id} className="rounded-xl border border-border p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="mono-id">{shipment.catalog_order_id ? `FT-CAT-${shipment.catalog_order_id.slice(0, 8).toUpperCase()}` : shipment.bulk_order_id ? `FT-BULK-${shipment.bulk_order_id.slice(0, 8).toUpperCase()}` : shipment.order_id}</p><p className="mt-1 text-xs text-muted-foreground">{shipment.courier_name || shipment.courier_type || 'Courier pending'} · AWB {shipment.awb_number || 'pending'}</p></div><div className="sm:text-right"><p className="text-xs font-800 text-primary">{String(shipment.status || 'pending').replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-muted-foreground">EDD {shipment.estimated_delivery ? new Date(shipment.estimated_delivery).toLocaleDateString('en-IN') : 'not provided'}</p></div></div>{shipment.tracking_url && <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-800 text-primary hover:underline"><Icon name="ArrowTopRightOnSquareIcon" size={12} /> Courier tracking</a>}</article>)}</div> : <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center"><Icon name="TruckIcon" size={28} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-800">No active shipments</p><p className="mt-1 text-xs text-muted-foreground">Paid orders will appear here once dispatched.</p></div>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-800 text-foreground">Disputes & refund requests</h2><p className="mt-1 text-xs text-muted-foreground">{scopedDisputes.length} dispute{scopedDisputes.length === 1 ? '' : 's'} in this period.</p></div><p className="text-sm font-800 text-foreground">Requested refunds ₹{requestedRefund.toLocaleString('en-IN')}</p></div>
        {scopedDisputes.length ? <div className="mt-4 divide-y divide-border">{scopedDisputes.slice(0, 12).map((dispute) => <div key={dispute.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-700 text-foreground">{dispute.dispute_type || 'Order dispute'}</p><p className="mt-1 text-xs text-muted-foreground">Opened {new Date(dispute.created_at).toLocaleString('en-IN')}</p></div><div className="text-right"><p className="text-xs font-800 capitalize">{String(dispute.status || 'open').replaceAll('_', ' ')}</p>{Number(dispute.requested_refund_amount || 0) > 0 && <p className="mt-1 text-xs text-error">₹{Number(dispute.requested_refund_amount).toLocaleString('en-IN')} requested</p>}</div></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-xs text-muted-foreground">No disputes in this period.</div>}
      </section>
    </div>
  );
}
