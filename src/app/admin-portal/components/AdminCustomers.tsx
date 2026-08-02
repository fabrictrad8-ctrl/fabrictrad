'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { exportToCSV } from '@/lib/exportUtils';

type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  role: string | null;
  is_active: boolean;
  can_buy: boolean | null;
  can_sell: boolean | null;
  account_kind: string | null;
  verification_status: string | null;
  gstin: string | null;
  city: string | null;
  state: string | null;
  created_at: string | null;
};

type Filter = 'all' | 'buyers' | 'sellers' | 'both' | 'pending' | 'inactive' | 'admins';

const capabilityLabel = (customer: CustomerRow) => {
  const admin = customer.role === 'super_admin' || customer.role === 'admin_staff';
  if (admin) return 'Administrator';
  if (customer.can_buy && customer.can_sell) return 'Buyer + Seller';
  if (customer.can_sell || customer.role === 'seller') return 'Seller';
  return 'Buyer';
};

export default function AdminCustomers() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from('user_profiles')
      .select('id,full_name,email,phone,business_name,role,is_active,can_buy,can_sell,account_kind,verification_status,gstin,city,state,created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (queryError) {
      setCustomers([]);
      setError('Customer accounts could not be loaded.');
    } else {
      setCustomers((data || []) as CustomerRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  useEffect(() => {
    if (!focusId || loading) return;
    window.setTimeout(() => {
      document.getElementById(`customer-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [focusId, loading]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const admin = customer.role === 'super_admin' || customer.role === 'admin_staff';
      const matchesFilter =
        filter === 'all' ||
        (filter === 'buyers' && customer.can_buy === true && customer.can_sell !== true && !admin) ||
        (filter === 'sellers' && customer.can_sell === true && customer.can_buy !== true && !admin) ||
        (filter === 'both' && customer.can_buy === true && customer.can_sell === true && !admin) ||
        (filter === 'pending' && customer.verification_status === 'pending') ||
        (filter === 'inactive' && customer.is_active === false) ||
        (filter === 'admins' && admin);
      if (!matchesFilter) return false;
      if (!normalized) return true;
      return [
        customer.full_name,
        customer.email,
        customer.phone,
        customer.business_name,
        customer.gstin,
        customer.city,
        customer.state,
        capabilityLabel(customer),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [customers, filter, query]);

  const updateStatus = async (customer: CustomerRow, active: boolean) => {
    setUpdatingId(customer.id);
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ active }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Account status could not be changed.');
      setCustomers((current) =>
        current.map((row) => (row.id === customer.id ? { ...row, is_active: active } : row))
      );
      toast.success(active ? 'Account activated.' : 'Account deactivated.');
    } catch (caughtError) {
      toast.error(caughtError instanceof Error ? caughtError.message : 'Account status could not be changed.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: 'All customers' },
    { key: 'buyers', label: 'Buyers' },
    { key: 'sellers', label: 'Sellers' },
    { key: 'both', label: 'Buyer + Seller' },
    { key: 'pending', label: 'Pending verification' },
    { key: 'inactive', label: 'Inactive' },
    { key: 'admins', label: 'Staff' },
  ];

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-800 uppercase tracking-[0.14em] text-primary">Customers</p>
          <h1 className="mt-1 text-2xl font-800 tracking-tight text-foreground">Customer and account directory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search buyers, sellers, business accounts and staff by name, email, phone, GSTIN or location.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadCustomers()} className="ft-secondary-action inline-flex items-center gap-2 px-3 py-2 text-xs">
            <Icon name="ArrowPathIcon" size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            onClick={() =>
              exportToCSV(
                filtered.map((customer) => ({
                  Name: customer.full_name || '',
                  Business: customer.business_name || '',
                  Email: customer.email || '',
                  Phone: customer.phone || '',
                  Access: capabilityLabel(customer),
                  Status: customer.is_active ? 'Active' : 'Inactive',
                  Verification: customer.verification_status || '',
                  GSTIN: customer.gstin || '',
                  City: customer.city || '',
                  State: customer.state || '',
                  Created: customer.created_at || '',
                })),
                'fabrictrad-customers'
              )
            }
            className="ft-secondary-action inline-flex items-center gap-2 px-3 py-2 text-xs"
          >
            <Icon name="ArrowDownTrayIcon" size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3">
            <Icon name="MagnifyingGlassIcon" size={17} className="text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, phone, business, GSTIN, city or state"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-800 transition ${filter === item.key ? 'bg-primary text-white' : 'border border-border bg-card text-muted-foreground hover:text-foreground'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-muted-foreground">
          <span>{loading ? 'Loading customer accounts…' : `${filtered.length} of ${customers.length} accounts`}</span>
          <span>Live Supabase profiles</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-muted/70 text-left text-xs font-800 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-14 text-center text-sm text-muted-foreground">No customer accounts match this view.</td></tr>
              )}
              {filtered.map((customer) => {
                const focused = focusId === customer.id;
                return (
                  <tr id={`customer-${customer.id}`} key={customer.id} className={focused ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/30'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-800 text-primary">
                          {(customer.full_name || customer.business_name || customer.email || 'FT').slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-800 text-foreground">{customer.full_name || customer.business_name || 'Unnamed account'}</p>
                          <p className="truncate text-xs text-muted-foreground">{customer.email || 'No email'}{customer.phone ? ` · +91 ${customer.phone}` : ''}</p>
                          {customer.business_name && customer.business_name !== customer.full_name && <p className="truncate text-xs text-muted-foreground">{customer.business_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-800 text-secondary">{capabilityLabel(customer)}</span>
                      <p className="mt-1 text-xs text-muted-foreground">{customer.account_kind || 'individual'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-800 capitalize text-foreground">{customer.verification_status || 'unverified'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{customer.gstin || 'No GSTIN'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{[customer.city, customer.state].filter(Boolean).join(', ') || 'Not added'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{customer.created_at ? new Date(customer.created_at).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-800 ${customer.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          type="button"
                          disabled={updatingId === customer.id}
                          onClick={() => void updateStatus(customer, !customer.is_active)}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-800 text-foreground hover:border-primary/30 hover:text-primary disabled:opacity-50"
                        >
                          {updatingId === customer.id ? 'Saving…' : customer.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
