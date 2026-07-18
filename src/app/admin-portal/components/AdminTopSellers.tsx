'use client';
import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

interface Seller {
  id: string;
  name: string;
  contact: string;
  city: string;
  type: string;
  avatar: string;
  responseTime: string;
  responseTimeMs: number;
  acceptanceRate: number;
  orderVolume: number;
  rating: number;
  gmv: string;
  status: 'verified' | 'suspended' | 'deactivated';
  joinDate: string;
  gstin: string;
  categories: string;
  totalReviews: number;
  disputeRate: number;
  lastActive: string;
}

const sellersData: Seller[] = [
  {
    id: 'FT-SLR-001234',
    name: 'Surat Textile Mills Pvt Ltd',
    contact: 'Arjun Sharma',
    city: 'Surat, Gujarat',
    type: 'Manufacturer',
    gstin: '24AAAPL1234Z1Z5',
    avatar: 'https://images.unsplash.com/photo-1711786403727-17ae54322642',
    responseTime: '1.2 hrs',
    responseTimeMs: 72,
    acceptanceRate: 94,
    orderVolume: 310,
    rating: 4.8,
    gmv: '₹42L',
    status: 'verified',
    joinDate: '12 Jan 2026',
    categories: 'Net Fabric, Embroidered, Georgette',
    totalReviews: 284,
    disputeRate: 1.2,
    lastActive: '2 mins ago',
  },
  {
    id: 'FT-SLR-001890',
    name: 'Jaipur Crafts Emporium',
    contact: 'Priya Nair',
    city: 'Jaipur, Rajasthan',
    type: 'Wholesaler',
    gstin: '08BBBPN5678Y2Z6',
    avatar:
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop&crop=face',
    responseTime: '2.4 hrs',
    responseTimeMs: 144,
    acceptanceRate: 88,
    orderVolume: 189,
    rating: 4.6,
    gmv: '₹28L',
    status: 'verified',
    joinDate: '03 Feb 2026',
    categories: 'Silk, Banarasi, Handloom',
    totalReviews: 162,
    disputeRate: 2.1,
    lastActive: '1 hr ago',
  },
  {
    id: 'FT-SLR-001654',
    name: 'Bhiwandi Weave House',
    contact: 'Ramesh Patil',
    city: 'Bhiwandi, Maharashtra',
    type: 'Manufacturer',
    gstin: '27EEEBW7890Y5Z9',
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
    responseTime: '3.8 hrs',
    responseTimeMs: 228,
    acceptanceRate: 79,
    orderVolume: 89,
    rating: 4.1,
    gmv: '₹12L',
    status: 'suspended',
    joinDate: '20 Mar 2026',
    categories: 'Cotton, Linen, Denim',
    totalReviews: 74,
    disputeRate: 5.6,
    lastActive: '3 days ago',
  },
  {
    id: 'FT-SLR-001102',
    name: 'Kolkata Silk House',
    contact: 'Ananya Das',
    city: 'Kolkata, West Bengal',
    type: 'Wholesaler',
    gstin: '19FFFKS1234Z1Z2',
    avatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
    responseTime: '1.8 hrs',
    responseTimeMs: 108,
    acceptanceRate: 91,
    orderVolume: 241,
    rating: 4.7,
    gmv: '₹35L',
    status: 'verified',
    joinDate: '28 Jan 2026',
    categories: 'Silk, Muslin, Jamdani',
    totalReviews: 218,
    disputeRate: 1.8,
    lastActive: '30 mins ago',
  },
  {
    id: 'FT-SLR-001445',
    name: 'Ludhiana Fabric Co.',
    contact: 'Harpreet Singh',
    city: 'Ludhiana, Punjab',
    type: 'Manufacturer',
    gstin: '03GGGFL5678Z2Z3',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
    responseTime: '4.5 hrs',
    responseTimeMs: 270,
    acceptanceRate: 72,
    orderVolume: 134,
    rating: 3.9,
    gmv: '₹18L',
    status: 'verified',
    joinDate: '15 Feb 2026',
    categories: 'Wool, Blended, Suiting',
    totalReviews: 98,
    disputeRate: 3.4,
    lastActive: '5 hrs ago',
  },
];

type SortKey = 'responseTime' | 'acceptanceRate' | 'orderVolume' | 'rating';

const sortOptions: { key: SortKey; label: string; icon: string }[] = [
  { key: 'responseTime', label: 'Response Time', icon: 'ClockIcon' },
  { key: 'acceptanceRate', label: 'Acceptance Rate', icon: 'CheckCircleIcon' },
  { key: 'orderVolume', label: 'Order Volume', icon: 'ShoppingBagIcon' },
  { key: 'rating', label: 'Customer Rating', icon: 'StarIcon' },
];

const statusConfig = {
  verified: { label: 'Verified', class: 'bg-success/10 text-success border-success/20' },
  suspended: { label: 'Suspended', class: 'bg-error/10 text-error border-error/20' },
  deactivated: { label: 'Deactivated', class: 'bg-muted text-muted-foreground border-border' },
};

export default function AdminTopSellers() {
  const [sortBy, setSortBy] = useState<SortKey>('orderVolume');
  const [topN, setTopN] = useState(5);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellers, setSellers] = useState<Seller[]>(sellersData);
  const [actionModal, setActionModal] = useState<{
    seller: Seller;
    action: 'suspend' | 'deactivate' | 'reactivate';
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const sorted = [...sellers]
    .sort((a, b) => {
      if (sortBy === 'responseTime') return a.responseTimeMs - b.responseTimeMs;
      if (sortBy === 'acceptanceRate') return b.acceptanceRate - a.acceptanceRate;
      if (sortBy === 'orderVolume') return b.orderVolume - a.orderVolume;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0;
    })
    .slice(0, topN);

  const handleAction = () => {
    if (!actionModal) return;
    const { seller, action } = actionModal;
    setSellers((prev) =>
      prev.map((s) => {
        if (s.id !== seller.id) return s;
        if (action === 'suspend') return { ...s, status: 'suspended' };
        if (action === 'deactivate') return { ...s, status: 'deactivated' };
        if (action === 'reactivate') return { ...s, status: 'verified' };
        return s;
      })
    );
    if (selectedSeller?.id === seller.id) {
      setSelectedSeller((prev) =>
        prev
          ? {
              ...prev,
              status:
                action === 'reactivate'
                  ? 'verified'
                  : action === 'suspend'
                    ? 'suspended'
                    : 'deactivated',
            }
          : null
      );
    }
    showToast(`Seller ${action === 'reactivate' ? 'reactivated' : action + 'ed'} successfully`);
    setActionModal(null);
    setActionReason('');
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < Math.floor(rating) ? 'text-amber-400' : 'text-muted'}>
        ★
      </span>
    ));
  };

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-success text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-600 flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={16} />
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Top Sellers Performance</h1>
          <p className="text-sm text-muted-foreground">Ranked by key performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-600 text-muted-foreground">Show Top</label>
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="input-base px-2 py-1.5 text-xs rounded-lg"
          >
            {[3, 5, 10].map((n) => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sort Tabs */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-thin pb-1">
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${
              sortBy === opt.key
                ? 'bg-secondary text-white'
                : 'bg-card border border-border text-muted-foreground hover:border-secondary'
            }`}
          >
            <Icon name={opt.icon as 'ClockIcon'} size={13} />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sellers Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground">Rank</th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground">
                  Seller
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Response Time
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Acceptance
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground hidden sm:table-cell">
                  Orders
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Rating
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Status
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((seller, idx) => (
                <tr key={seller.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-800 ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-700'
                          : idx === 1
                            ? 'bg-slate-100 text-slate-600'
                            : idx === 2
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {idx + 1}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl overflow-hidden bg-muted shrink-0">
                        <AppImage
                          src={seller.avatar}
                          alt={`${seller.contact} profile`}
                          width={32}
                          height={32}
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-700 text-foreground leading-tight">
                          {seller.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{seller.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs font-700 ${seller.responseTimeMs <= 120 ? 'text-success' : seller.responseTimeMs <= 240 ? 'text-warning' : 'text-error'}`}
                    >
                      {seller.responseTime}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`text-xs font-800 ${seller.acceptanceRate >= 90 ? 'text-success' : seller.acceptanceRate >= 80 ? 'text-warning' : 'text-error'}`}
                      >
                        {seller.acceptanceRate}%
                      </span>
                      <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${seller.acceptanceRate >= 90 ? 'bg-success' : seller.acceptanceRate >= 80 ? 'bg-warning' : 'bg-error'}`}
                          style={{ width: `${seller.acceptanceRate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <p className="text-xs font-800 text-foreground">{seller.orderVolume}</p>
                    <p className="text-xs text-muted-foreground">{seller.gmv}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-0.5 text-xs">
                      {getRatingStars(seller.rating)}
                    </div>
                    <p className="text-xs font-700 text-foreground mt-0.5">{seller.rating}</p>
                    <p className="text-xs text-muted-foreground">({seller.totalReviews} reviews)</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 border ${statusConfig[seller.status].class}`}
                    >
                      {statusConfig[seller.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setSelectedSeller(seller)}
                        className="bg-muted border border-border text-xs px-2.5 py-1 rounded-lg font-600 text-foreground hover:border-primary transition-colors"
                      >
                        View
                      </button>
                      {seller.status === 'verified' && (
                        <button
                          onClick={() => setActionModal({ seller, action: 'suspend' })}
                          className="bg-error/10 text-error text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-error hover:text-white transition-all"
                        >
                          Suspend
                        </button>
                      )}
                      {seller.status === 'suspended' && (
                        <>
                          <button
                            onClick={() => setActionModal({ seller, action: 'reactivate' })}
                            className="bg-success/10 text-success text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-success hover:text-white transition-all"
                          >
                            Reactivate
                          </button>
                          <button
                            onClick={() => setActionModal({ seller, action: 'deactivate' })}
                            className="bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-error/10 hover:text-error transition-all"
                          >
                            Deactivate
                          </button>
                        </>
                      )}
                      {seller.status === 'deactivated' && (
                        <button
                          onClick={() => setActionModal({ seller, action: 'reactivate' })}
                          className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-primary hover:text-white transition-all"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seller Drill-Down Modal */}
      {selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-800 text-foreground">Seller Profile</h2>
              <button
                onClick={() => setSelectedSeller(null)}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
              >
                <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted shrink-0">
                  <AppImage
                    src={selectedSeller.avatar}
                    alt={`${selectedSeller.contact} profile`}
                    width={64}
                    height={64}
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-800 text-foreground">{selectedSeller.name}</h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 border ${statusConfig[selectedSeller.status].class}`}
                    >
                      {statusConfig[selectedSeller.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedSeller.contact} · {selectedSeller.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSeller.city} · Joined {selectedSeller.joinDate}
                  </p>
                  <p className="mono-id mt-1">{selectedSeller.id}</p>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Response Time',
                    value: selectedSeller.responseTime,
                    icon: 'ClockIcon',
                    color: selectedSeller.responseTimeMs <= 120 ? 'text-success' : 'text-warning',
                    bg: 'bg-success/10',
                  },
                  {
                    label: 'Acceptance Rate',
                    value: `${selectedSeller.acceptanceRate}%`,
                    icon: 'CheckCircleIcon',
                    color: 'text-primary',
                    bg: 'bg-primary/10',
                  },
                  {
                    label: 'Total Orders',
                    value: selectedSeller.orderVolume.toString(),
                    icon: 'ShoppingBagIcon',
                    color: 'text-secondary',
                    bg: 'bg-secondary/10',
                  },
                  {
                    label: 'Customer Rating',
                    value: `${selectedSeller.rating}/5`,
                    icon: 'StarIcon',
                    color: 'text-amber-600',
                    bg: 'bg-amber-50',
                  },
                ].map((m) => (
                  <div key={m.label} className="bg-muted rounded-xl p-3 text-center">
                    <Icon
                      name={m.icon as 'ClockIcon'}
                      size={18}
                      className={`${m.color} mx-auto mb-1`}
                    />
                    <p className={`text-lg font-800 ${m.color}`}>{m.value}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  {[
                    { label: 'GMV Generated', value: selectedSeller.gmv },
                    { label: 'Total Reviews', value: selectedSeller.totalReviews.toString() },
                    { label: 'Dispute Rate', value: `${selectedSeller.disputeRate}%` },
                    { label: 'Last Active', value: selectedSeller.lastActive },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                    >
                      <span className="text-xs text-muted-foreground">{f.label}</span>
                      <span className="text-xs font-700 text-foreground">{f.value}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'GSTIN', value: `${selectedSeller.gstin.slice(0, 10)}****` },
                    { label: 'Categories', value: selectedSeller.categories },
                    { label: 'Business Type', value: selectedSeller.type },
                    { label: 'Location', value: selectedSeller.city },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                    >
                      <span className="text-xs text-muted-foreground">{f.label}</span>
                      <span className="text-xs font-700 text-foreground">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                {selectedSeller.status === 'verified' && (
                  <>
                    <button
                      onClick={() => {
                        setActionModal({ seller: selectedSeller, action: 'suspend' });
                        setSelectedSeller(null);
                      }}
                      className="flex items-center gap-1.5 bg-warning/10 text-warning border border-warning/20 text-xs px-3 py-2 rounded-xl font-600 hover:bg-warning hover:text-white transition-all"
                    >
                      <Icon name="PauseCircleIcon" size={14} />
                      Suspend Seller
                    </button>
                    <button
                      onClick={() => {
                        setActionModal({ seller: selectedSeller, action: 'deactivate' });
                        setSelectedSeller(null);
                      }}
                      className="flex items-center gap-1.5 bg-error/10 text-error border border-error/20 text-xs px-3 py-2 rounded-xl font-600 hover:bg-error hover:text-white transition-all"
                    >
                      <Icon name="NoSymbolIcon" size={14} />
                      Deactivate Account
                    </button>
                  </>
                )}
                {(selectedSeller.status === 'suspended' ||
                  selectedSeller.status === 'deactivated') && (
                  <button
                    onClick={() => {
                      setActionModal({ seller: selectedSeller, action: 'reactivate' });
                      setSelectedSeller(null);
                    }}
                    className="flex items-center gap-1.5 bg-success/10 text-success border border-success/20 text-xs px-3 py-2 rounded-xl font-600 hover:bg-success hover:text-white transition-all"
                  >
                    <Icon name="CheckCircleIcon" size={14} />
                    Reactivate Seller
                  </button>
                )}
                <button
                  onClick={() => setSelectedSeller(null)}
                  className="ml-auto text-xs px-3 py-2 rounded-xl font-600 bg-muted text-muted-foreground hover:bg-border transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  actionModal.action === 'reactivate'
                    ? 'bg-success/10'
                    : actionModal.action === 'suspend'
                      ? 'bg-warning/10'
                      : 'bg-error/10'
                }`}
              >
                <Icon
                  name={
                    actionModal.action === 'reactivate'
                      ? 'CheckCircleIcon'
                      : actionModal.action === 'suspend'
                        ? 'PauseCircleIcon'
                        : 'NoSymbolIcon'
                  }
                  size={20}
                  className={
                    actionModal.action === 'reactivate'
                      ? 'text-success'
                      : actionModal.action === 'suspend'
                        ? 'text-warning'
                        : 'text-error'
                  }
                />
              </div>
              <div>
                <h3 className="font-800 text-foreground capitalize">
                  {actionModal.action === 'reactivate'
                    ? 'Reactivate'
                    : actionModal.action === 'suspend'
                      ? 'Suspend'
                      : 'Deactivate'}{' '}
                  Seller
                </h3>
                <p className="text-xs text-muted-foreground">{actionModal.seller.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {actionModal.action === 'suspend'
                ? 'This will temporarily suspend the seller. They cannot accept new orders but existing orders will continue.'
                : actionModal.action === 'deactivate'
                  ? 'This will permanently deactivate the seller account. All active listings will be hidden. This action requires manual review to reverse.'
                  : "This will restore the seller's account and allow them to accept new orders again."}
            </p>
            <div className="mb-4">
              <label className="text-xs font-700 text-foreground block mb-1.5">
                Reason{' '}
                {actionModal.action !== 'reactivate' && <span className="text-error">*</span>}
              </label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={
                  actionModal.action === 'reactivate'
                    ? 'Optional note...'
                    : 'Provide reason for this action...'
                }
                className="input-base w-full px-3 py-2 text-sm rounded-xl resize-none"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAction}
                disabled={actionModal.action !== 'reactivate' && !actionReason.trim()}
                className={`flex-1 py-2.5 rounded-xl text-sm font-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  actionModal.action === 'reactivate'
                    ? 'bg-success text-white hover:bg-green-700'
                    : actionModal.action === 'suspend'
                      ? 'bg-warning text-white hover:bg-amber-600'
                      : 'bg-error text-white hover:bg-red-700'
                }`}
              >
                Confirm{' '}
                {actionModal.action === 'reactivate'
                  ? 'Reactivation'
                  : actionModal.action === 'suspend'
                    ? 'Suspension'
                    : 'Deactivation'}
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
