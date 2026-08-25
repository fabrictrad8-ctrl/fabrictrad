'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { exportToCSV, exportToExcel } from '@/lib/exportUtils';
import { createClient } from '@/lib/supabase/client';

type OrderKind = 'catalog' | 'bulk';
type AdminOrderRow = {
  id: string;
  kind: OrderKind;
  reference: string;
  buyerName: string;
  sellerName: string;
  product: string;
  qty: string;
  amount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: 'order-status-pending',
    confirmed: 'order-status-confirmed',
    accepted: 'order-status-confirmed',
    paid: 'order-status-confirmed',
    shipped: 'order-status-shipped',
    delivered: 'order-status-delivered',
    cancelled: 'order-status-cancelled',
    rejected: 'order-status-cancelled',
  };
  return map[status.toLowerCase()] || 'order-status-pending';
};

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const humanStatus = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | OrderKind>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();

    const [catalogResult, bulkResult] = await Promise.all([
      supabase
        .from('catalog_order_requests')
        .select('id,status,payment_status,total_amount,quantity,unit,created_at,buyer_id,seller_id,seller_products(name)')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('bulk_orders')
        .select('id,status,payment_status,net_total,created_at,buyer_id,seller_id,bulk_order_items(product_name,quantity_mtrs)')
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

    if (catalogResult.error || bulkResult.error) {
      setError('Orders could not be loaded from the database.');
      setLoading(false);
      return;
    }

    // Collect unique user IDs for name lookup
    const allUserIds = new Set<string>();
    const allSellerIds = new Set<string>();
    (catalogResult.data || []).forEach((row) => {
      if (row.buyer_id) allUserIds.add(row.buyer_id);
      if (row.seller_id) allSellerIds.add(row.seller_id);
    });
    (bulkResult.data || []).forEach((row) => {
      if (row.buyer_id) allUserIds.add(row.buyer_id);
      if (row.seller_id) allSellerIds.add(row.seller_id);
    });

    const [profilesResult, sellersResult] = await Promise.all([
      allUserIds.size
        ? supabase.from('user_profiles').select('id,full_name,business_name').in('id', [...allUserIds])
        : Promise.resolve({ data: [], error: null }),
      allSellerIds.size
        ? supabase.from('seller_profiles').select('id,display_name,legal_business_name').in('id', [...allSellerIds])
        : Promise.resolve({ data: [], error: null }),
    ]);

    const profileMap = new Map<string, string>();
    (profilesResult.data || []).forEach((p) => {
      profileMap.set(p.id, p.business_name || p.full_name || `Buyer ${p.id.slice(0, 6)}`);
    });
    const sellerMap = new Map<string, string>();
    (sellersResult.data || []).forEach((s) => {
      sellerMap.set(s.id, s.display_name || s.legal_business_name || `Seller ${s.id.slice(0, 6)}`);
    });

    const catalogRows: AdminOrderRow[] = (catalogResult.data || []).map((row) => ({
      id: row.id,
      kind: 'catalog',
      reference: `FT-CAT-${row.id.slice(0, 8).toUpperCase()}`,
      buyerName: profileMap.get(row.buyer_id) || `Buyer ${row.buyer_id?.slice(0, 6) || '?'}`,
      sellerName: sellerMap.get(row.seller_id) || `Seller ${row.seller_id?.slice(0, 6) || '?'}`,
      product: (row.seller_products as { name?: string } | null)?.name || 'Catalogue product',
      qty: `${Number(row.quantity || 0).toLocaleString('en-IN')} ${row.unit || 'units'}`,
      amount: Number(row.total_amount || 0),
      status: row.status || 'pending',
      paymentStatus: row.payment_status || 'unpaid',
      createdAt: row.created_at || '',
    }));

    const bulkRows: AdminOrderRow[] = (bulkResult.data || []).map((row) => {
      const items = (row.bulk_order_items || []) as Array<{ product_name?: string; quantity_mtrs?: number }>;
      const firstItem = items[0];
      return {
        id: row.id,
        kind: 'bulk',
        reference: `FT-BULK-${row.id.slice(0, 8).toUpperCase()}`,
        buyerName: profileMap.get(row.buyer_id) || `Buyer ${row.buyer_id?.slice(0, 6) || '?'}`,
        sellerName: sellerMap.get(row.seller_id) || (row.seller_id ? `Seller ${row.seller_id.slice(0, 6)}` : 'Unassigned'),
        product: firstItem?.product_name || 'Bulk fabric order',
        qty: firstItem?.quantity_mtrs ? `${Number(firstItem.quantity_mtrs).toLocaleString('en-IN')} mtrs` : '—',
        amount: Number(row.net_total || 0),
        status: row.status || 'draft',
        paymentStatus: row.payment_status || 'unpaid',
        createdAt: row.created_at || '',
      };
    });

    setOrders([...catalogRows, ...bulkRows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const allStatuses = useMemo(() => {
    const set = new Set(orders.map((o) => o.status));
    return ['all', ...Array.from(set).sort()];
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    return orders.filter((o) => {
      const created = new Date(o.createdAt).getTime();
      const matchSearch = !q || [o.reference, o.buyerName, o.sellerName, o.product, o.status].join(' ').toLowerCase().includes(q);
      const matchKind = kindFilter === 'all' || o.kind === kindFilter;
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchFrom = from === null || created >= from;
      const matchTo = to === null || created <= to;
      return matchSearch && matchKind && matchStatus && matchFrom && matchTo;
    });
  }, [orders, search, kindFilter, statusFilter, dateFrom, dateTo]);

  const getExportData = () =>
    filtered.map((o) => ({
      Reference: o.reference,
      Type: o.kind === 'catalog' ? 'Catalogue' : 'Bulk',
      Buyer: o.buyerName,
      Seller: o.sellerName,
      Product: o.product,
      Quantity: o.qty,
      Amount: o.amount,
      Status: humanStatus(o.status),
      'Payment status': humanStatus(o.paymentStatus),
      Date: o.createdAt.slice(0, 10),
    }));

  const summary = useMemo(() => ({
    total: filtered.length,
    gmv: filtered.reduce((sum, o) => sum + o.amount, 0),
    paid: filtered.filter((o) => o.paymentStatus === 'paid').length,
    pending: filtered.filter((o) => ['draft', 'pending', 'quote_sent'].includes(o.status)).length,
  }), [filtered]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-800 uppercase tracking-[0.14em] text-primary">Commerce</p>
          <h1 className="mt-1 text-2xl font-800 text-foreground">Order management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live catalogue and bulk orders across all buyers and sellers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50">
            <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <div className="relative">
            <button type="button" onClick={() => setShowExportMenu(!showExportMenu)} disabled={!filtered.length} className="btn-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs disabled:opacity-50">
              <Icon name="ArrowDownTrayIcon" size={14} /> Export <Icon name="ChevronDownIcon" size={12} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <button type="button" onClick={() => { exportToCSV(getExportData(), 'fabrictrad_orders'); setShowExportMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-700 hover:bg-muted">
                  <Icon name="DocumentTextIcon" size={14} className="text-success" /> Export CSV
                </button>
                <button type="button" onClick={() => { exportToExcel(getExportData(), 'fabrictrad_orders'); setShowExportMenu(false); }} className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-xs font-700 hover:bg-muted">
                  <Icon name="TableCellsIcon" size={14} className="text-primary" /> Export Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total orders', filtered.length, 'ShoppingBagIcon', 'text-primary'],
          ['Gross value', money(summary.gmv), 'CurrencyRupeeIcon', 'text-success'],
          ['Paid orders', summary.paid, 'CheckCircleIcon', 'text-success'],
          ['Pending action', summary.pending, 'ClockIcon', 'text-warning'],
        ].map(([label, value, icon, color]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-card p-4">
            <Icon name={icon as 'ShoppingBagIcon'} size={18} className={String(color)} />
            <p className={`mt-2 text-xl font-800 ${color}`}>{loading ? '—' : value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Icon name="MagnifyingGlassIcon" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders, buyers, sellers…"
            className="input-base w-full rounded-xl py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as 'all' | OrderKind)} className="input-base rounded-xl px-3 py-2.5 text-sm">
          <option value="all">All types</option>
          <option value="catalog">Catalogue</option>
          <option value="bulk">Bulk</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base rounded-xl px-3 py-2.5 text-sm">
          {allStatuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : humanStatus(s)}</option>)}
        </select>
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2">
          <Icon name="CalendarIcon" size={14} className="text-muted-foreground" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-28 bg-transparent text-xs outline-none" />
          <span className="text-xs text-muted-foreground">–</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-28 bg-transparent text-xs outline-none" />
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="ml-1 text-xs text-primary hover:underline">Clear</button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-error/20 bg-error/5 p-3 text-sm text-error">
          {error} <button type="button" onClick={() => void load()} className="ml-2 font-800 underline">Retry</button>
        </div>
      )}

      <p className="mb-3 text-xs text-muted-foreground">
        {loading ? 'Loading orders…' : `Showing ${filtered.length} of ${orders.length} orders`}
      </p>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-700 text-muted-foreground">Reference</th>
                <th className="hidden px-4 py-3 text-left text-xs font-700 text-muted-foreground sm:table-cell">Buyer / Seller</th>
                <th className="hidden px-4 py-3 text-left text-xs font-700 text-muted-foreground md:table-cell">Product</th>
                <th className="px-4 py-3 text-right text-xs font-700 text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-700 text-muted-foreground">Status</th>
                <th className="hidden px-4 py-3 text-center text-xs font-700 text-muted-foreground lg:table-cell">Payment</th>
                <th className="px-4 py-3 text-center text-xs font-700 text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No orders match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((order) => (
                <React.Fragment key={`${order.kind}:${order.id}`}>
                  <tr className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="mono-id">{order.reference}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{order.createdAt.slice(0, 10)} · {order.kind === 'catalog' ? 'Catalogue' : 'Bulk'}</p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <p className="text-xs font-700 text-foreground">{order.buyerName}</p>
                      <p className="text-xs text-muted-foreground">↑ {order.sellerName}</p>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <p className="max-w-[180px] truncate text-xs font-600 text-foreground">{order.product}</p>
                      <p className="text-xs text-muted-foreground">{order.qty}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-800 text-foreground">{money(order.amount)}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-600 ${statusBadge(order.status)}`}>
                        {humanStatus(order.status)}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-center lg:table-cell">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-600 ${order.paymentStatus === 'paid' ? 'bg-success/10 text-success' : order.paymentStatus.includes('refund') ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>
                        {humanStatus(order.paymentStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                        className="rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-600 text-foreground transition hover:border-primary hover:text-primary"
                      >
                        {expandedId === order.id ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === order.id && (
                    <tr>
                      <td colSpan={7} className="border-t border-border bg-muted/20 px-4 py-4">
                        <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          <div><p className="font-700 text-muted-foreground">Reference</p><p className="mt-0.5 font-800 text-foreground">{order.reference}</p></div>
                          <div><p className="font-700 text-muted-foreground">Type</p><p className="mt-0.5 font-800 text-foreground capitalize">{order.kind}</p></div>
                          <div><p className="font-700 text-muted-foreground">Buyer</p><p className="mt-0.5 font-800 text-foreground">{order.buyerName}</p></div>
                          <div><p className="font-700 text-muted-foreground">Seller</p><p className="mt-0.5 font-800 text-foreground">{order.sellerName}</p></div>
                          <div><p className="font-700 text-muted-foreground">Product</p><p className="mt-0.5 font-800 text-foreground">{order.product}</p></div>
                          <div><p className="font-700 text-muted-foreground">Quantity</p><p className="mt-0.5 font-800 text-foreground">{order.qty}</p></div>
                          <div><p className="font-700 text-muted-foreground">Order value</p><p className="mt-0.5 font-800 text-foreground">{money(order.amount)}</p></div>
                          <div><p className="font-700 text-muted-foreground">Created</p><p className="mt-0.5 font-800 text-foreground">{new Date(order.createdAt).toLocaleString('en-IN')}</p></div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <a
                            href={order.kind === 'catalog' ? `/admin-portal?tab=payments` : `/admin-portal?tab=payments`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-700 text-foreground hover:border-primary hover:text-primary"
                          >
                            <Icon name="CreditCardIcon" size={13} /> View payment
                          </a>
                          <a
                            href={`/admin-portal?tab=sellers`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-700 text-foreground hover:border-primary hover:text-primary"
                          >
                            <Icon name="BuildingStorefrontIcon" size={13} /> View seller
                          </a>
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
    </div>
  );
}
