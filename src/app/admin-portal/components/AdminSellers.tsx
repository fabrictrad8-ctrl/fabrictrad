'use client';
import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface Seller {
  dbId: string;
  id: string;
  name: string;
  contact: string;
  city: string;
  type: string;
  gstin: string;
  status:
    | 'registration_started'
    | 'documents_pending'
    | 'pending_review'
    | 'verified'
    | 'suspended'
    | 'deactivated'
    | 'rejected';
  products: number;
  orders: number;
  gmv: string;
  joinDate: string;
  avatar: string;
}

const initialSellers: Seller[] = [];

const statusConfig: Record<string, { label: string; class: string }> = {
  verified: { label: '✓ Verified', class: 'bg-success/10 text-success' },
  registration_started: { label: 'Registration Started', class: 'bg-blue-50 text-blue-700' },
  documents_pending: { label: 'Documents Pending', class: 'bg-blue-50 text-blue-700' },
  pending_review: { label: '⏳ Pending Review', class: 'bg-amber-50 text-warning' },
  suspended: { label: '⛔ Suspended', class: 'bg-error/10 text-error' },
  deactivated: { label: '✗ Deactivated', class: 'bg-muted text-muted-foreground' },
  rejected: { label: '✗ Rejected', class: 'bg-error/10 text-error' },
};

export default function AdminSellers() {
  const [filter, setFilter] = useState('All');
  const [sellers, setSellers] = useState<Seller[]>(initialSellers);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<{
    seller: Seller;
    action: 'approve' | 'reject' | 'suspend' | 'deactivate' | 'reactivate';
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const filters = ['All', 'Verified', 'Pending Review', 'Suspended', 'Deactivated'];

  useEffect(() => {
    let mounted = true;
    async function loadSellers() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('seller_profiles')
        .select(
          'id,seller_ref,legal_business_name,display_name,business_type,gstin,verification_status,pickup_address,is_active,created_at,user_profiles(full_name,avatar_url,email)'
        )
        .order('created_at', { ascending: false })
        .limit(200);

      if (!mounted) return;
      setSellers(
        (data || []).map((seller) => {
          const userProfile = Array.isArray(seller.user_profiles)
            ? seller.user_profiles[0]
            : seller.user_profiles;
          const pickup = seller.pickup_address as Record<string, unknown> | null;
          const city = [pickup?.city, pickup?.state].filter(Boolean).join(', ');
          return {
            dbId: seller.id,
            id: seller.seller_ref || `FT-SLR-${String(seller.id).slice(0, 8).toUpperCase()}`,
            name: seller.display_name || seller.legal_business_name || 'Seller account',
            contact: userProfile?.full_name || userProfile?.email || 'Account owner',
            city: city || 'Pickup address not set',
            type: seller.business_type || 'Seller',
            gstin: seller.gstin || '',
            status: (seller.is_active === false
              ? 'deactivated'
              : seller.verification_status || 'pending_review') as Seller['status'],
            products: 0,
            orders: 0,
            gmv: '₹0',
            joinDate: seller.created_at
              ? new Date(seller.created_at).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '',
            avatar: userProfile?.avatar_url || '',
          };
        })
      );
      setLoading(false);
    }

    loadSellers();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered =
    filter === 'All'
      ? sellers
      : sellers.filter((s) => {
          if (filter === 'Verified') return s.status === 'verified';
          if (filter === 'Pending Review') return s.status === 'pending_review';
          if (filter === 'Suspended') return s.status === 'suspended';
          if (filter === 'Deactivated') return s.status === 'deactivated';
          return true;
        });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async () => {
    if (!actionModal) return;
    const { seller, action } = actionModal;
    const newStatus: Seller['status'] =
      action === 'approve'
        ? 'verified'
        : action === 'reject'
          ? 'rejected'
          : action === 'suspend'
            ? 'suspended'
            : action === 'deactivate'
              ? 'deactivated'
              : 'verified';

    const supabase = createClient();
    await supabase
      .from('seller_profiles')
      .update({
        verification_status: newStatus === 'deactivated' ? seller.status : newStatus,
        is_active: newStatus !== 'deactivated',
      })
      .eq('id', seller.dbId);

    setSellers((prev) => prev.map((s) => (s.id === seller.id ? { ...s, status: newStatus } : s)));
    showToast(`Seller ${action}d successfully`);
    setActionModal(null);
    setActionReason('');
  };

  const pendingCount = sellers.filter((s) => s.status === 'pending_review').length;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = () => {
    if (!actionModal) return;
    const { seller, action } = actionModal;
    const newStatus: Seller['status'] =
    action === 'approve' ? 'verified' :
    action === 'reject' ? 'rejected' :
    action === 'suspend' ? 'suspended' :
    action === 'deactivate' ? 'deactivated' : 'verified';

    setSellers((prev) => prev.map((s) => s.id === seller.id ? { ...s, status: newStatus } : s));
    showToast(`Seller ${action}d successfully`);
    setActionModal(null);
    setActionReason('');
  };

  const pendingCount = sellers.filter((s) => s.status === 'pending_review').length;

  return (
    <div className="relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-success text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-600 flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={16} />
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-800 text-foreground">Seller Management</h1>
        <div className="flex items-center gap-2 text-xs">
          {pendingCount > 0 && (
            <span className="bg-amber-50 text-warning border border-amber-200 px-2.5 py-1 rounded-full font-700">
              {pendingCount} pending review
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-thin pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${
              filter === f
                ? 'bg-secondary text-white'
                : 'bg-card border border-border text-muted-foreground hover:border-secondary'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Sellers Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground">
                  Seller
                </th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground hidden sm:table-cell">
                  Location
                </th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground hidden md:table-cell">
                  GSTIN
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground hidden lg:table-cell">
                  GMV
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((seller) => (
                <tr key={seller.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                        {seller.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={seller.avatar}
                            alt={`${seller.contact} profile photo`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-800 text-primary">
                            {seller.name[0]?.toUpperCase() || 'S'}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-700 text-foreground">{seller.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {seller.contact} · {seller.type}
                        </p>
                        <p className="mono-id">{seller.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs text-foreground">{seller.city}</p>
                    <p className="text-xs text-muted-foreground">Since {seller.joinDate}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-xs font-mono text-foreground">
                      {seller.gstin.slice(0, 10)}****
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-700 ${statusConfig[seller.status]?.class}`}
                    >
                      {statusConfig[seller.status]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <p className="text-sm font-800 text-foreground">{seller.gmv}</p>
                    <p className="text-xs text-muted-foreground">{seller.orders} orders</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {seller.status === 'pending_review' && (
                        <>
                          <button
                            onClick={() => setActionModal({ seller, action: 'approve' })}
                            className="bg-success text-white text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-green-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setActionModal({ seller, action: 'reject' })}
                            className="bg-error/10 text-error text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-error hover:text-white transition-all"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {seller.status === 'verified' && (
                        <>
                          <button
                            onClick={() => setActionModal({ seller, action: 'suspend' })}
                            className="bg-warning/10 text-warning text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-warning hover:text-white transition-all"
                          >
                            Suspend
                          </button>
                          <button
                            onClick={() => setActionModal({ seller, action: 'deactivate' })}
                            className="bg-error/10 text-error text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-error hover:text-white transition-all"
                          >
                            Deactivate
                          </button>
                        </>
                      )}
                      {(seller.status === 'suspended' || seller.status === 'deactivated') && (
                        <button
                          onClick={() => setActionModal({ seller, action: 'reactivate' })}
                          className="bg-success/10 text-success text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-success hover:text-white transition-all"
                        >
                          Reactivate
                        </button>
                      )}
                      {seller.status === 'rejected' && (
                        <span className="text-xs text-muted-foreground">Rejected</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <Icon
                      name={loading ? 'ArrowPathIcon' : 'BuildingStorefrontIcon'}
                      size={30}
                      className={`mx-auto mb-2 text-muted-foreground ${loading ? 'animate-spin' : ''}`}
                    />
                    <p className="text-sm font-700 text-foreground">
                      {loading ? 'Loading sellers...' : 'No seller records found'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Seller applications from the live database will appear here.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  actionModal.action === 'approve' || actionModal.action === 'reactivate'
                    ? 'bg-success/10'
                    : actionModal.action === 'suspend'
                      ? 'bg-warning/10'
                      : 'bg-error/10'
                }`}
              >
                <Icon
                  name={
                    actionModal.action === 'approve' || actionModal.action === 'reactivate'
                      ? 'CheckCircleIcon'
                      : actionModal.action === 'suspend'
                        ? 'PauseCircleIcon'
                        : 'NoSymbolIcon'
                  }
                  size={20}
                  className={
                    actionModal.action === 'approve' || actionModal.action === 'reactivate'
                      ? 'text-success'
                      : actionModal.action === 'suspend'
                        ? 'text-warning'
                        : 'text-error'
                  }
                />
              </div>
              <div>
                <h3 className="font-800 text-foreground capitalize">{actionModal.action} Seller</h3>
                <p className="text-xs text-muted-foreground">{actionModal.seller.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {actionModal.action === 'approve' &&
                'This will approve the seller and allow them to list products and accept orders.'}
              {actionModal.action === 'reject' &&
                'This will reject the seller application. They will be notified with the reason.'}
              {actionModal.action === 'suspend' &&
                'This will temporarily suspend the seller. They cannot accept new orders but existing orders continue.'}
              {actionModal.action === 'deactivate' &&
                'This will permanently deactivate the account. All listings will be hidden. Requires manual review to reverse.'}
              {actionModal.action === 'reactivate' &&
                "This will restore the seller's account and allow them to accept new orders."}
            </p>
            {actionModal.action !== 'approve' && actionModal.action !== 'reactivate' && (
              <div className="mb-4">
                <label className="text-xs font-700 text-foreground block mb-1.5">
                  Reason <span className="text-error">*</span>
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Provide reason for this action..."
                  className="input-base w-full px-3 py-2 text-sm rounded-xl resize-none"
                  rows={3}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAction}
                disabled={
                  actionModal.action !== 'approve' &&
                  actionModal.action !== 'reactivate' &&
                  !actionReason.trim()
                }
                className={`flex-1 py-2.5 rounded-xl text-sm font-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  actionModal.action === 'approve' || actionModal.action === 'reactivate'
                    ? 'bg-success text-white hover:bg-green-700'
                    : actionModal.action === 'suspend'
                      ? 'bg-warning text-white hover:bg-amber-600'
                      : 'bg-error text-white hover:bg-red-700'
                }`}
              >
                Confirm
              </button>
              <button
                onClick={() => {
                  setActionModal(null);
                  setActionReason('');
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-600 bg-muted text-muted-foreground hover:bg-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
