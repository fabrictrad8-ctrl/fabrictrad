'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

const listings: {
  id: string;
  name: string;
  seller: string;
  sellerId: string;
  category: string;
  price: number;
  moq: number;
  stock: number;
  status: string;
  submittedAt: string;
}[] = [];

const statusColors: Record<string, string> = {
  'Pending Review': 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-success/10 text-success border-success/20',
  Rejected: 'bg-error/10 text-error border-error/20',
  Paused: 'bg-muted text-muted-foreground border-border',
};

export default function AdminListings() {
  const [filter, setFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionModal, setActionModal] = useState<{
    listing: (typeof listings)[0];
    action: 'approve' | 'reject';
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const filters = ['All', 'Pending Review', 'Approved', 'Rejected', 'Paused'];
  const filtered = filter === 'All' ? listings : listings.filter((l) => l.status === filter);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Product Listings</h1>
          <p className="text-sm text-muted-foreground">
            Listing review queue from live seller uploads
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <button className="btn-primary px-3 py-2 text-xs rounded-xl flex items-center gap-1.5">
                <Icon name="CheckCircleIcon" size={14} />
                Approve ({selectedIds.length})
              </button>
              <button className="bg-error/10 border border-error/20 text-error px-3 py-2 text-xs rounded-xl font-600 flex items-center gap-1.5 hover:bg-error hover:text-white transition-all">
                <Icon name="XCircleIcon" size={14} />
                Reject ({selectedIds.length})
              </button>
            </>
          )}
          <button className="btn-secondary px-3 py-2 text-xs rounded-xl flex items-center gap-1.5">
            <Icon name="ArrowDownTrayIcon" size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 overflow-x-auto scrollbar-thin mb-5">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${filter === f ? 'bg-secondary text-white' : 'bg-card border border-border text-muted-foreground hover:border-secondary'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Listings Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    className="rounded"
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? filtered.map((l) => l.id) : [])
                    }
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-700 text-muted-foreground">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-700 text-muted-foreground">
                  Seller
                </th>
                <th className="px-4 py-3 text-right text-xs font-700 text-muted-foreground">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-700 text-muted-foreground">
                  Stock
                </th>
                <th className="px-4 py-3 text-center text-xs font-700 text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-700 text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((listing) => (
                <tr key={listing.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedIds.includes(listing.id)}
                      onChange={() => toggleSelect(listing.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                        <div className="flex h-full w-full items-center justify-center">
                          <Icon name="TagIcon" size={18} className="text-muted-foreground" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-700 text-foreground line-clamp-1">
                          {listing.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {listing.category} · <span className="mono-id">{listing.id}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{listing.submittedAt}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-600 text-foreground">{listing.seller}</p>
                    <p className="mono-id">{listing.sellerId}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-800 text-primary">₹{listing.price}/mtr</p>
                    <p className="text-xs text-muted-foreground">MOQ: {listing.moq}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-700 text-foreground">
                      {listing.stock.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-muted-foreground">mtrs</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs font-600 border rounded-full px-2 py-0.5 ${statusColors[listing.status]}`}
                    >
                      {listing.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                        title="View"
                      >
                        <Icon name="EyeIcon" size={14} className="text-muted-foreground" />
                      </button>
                      {listing.status === 'Pending Review' && (
                        <>
                          <button
                            onClick={() => setActionModal({ listing, action: 'approve' })}
                            className="p-1.5 hover:bg-success/10 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <Icon name="CheckCircleIcon" size={14} className="text-success" />
                          </button>
                          <button
                            onClick={() => setActionModal({ listing, action: 'reject' })}
                            className="p-1.5 hover:bg-error/10 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <Icon name="XCircleIcon" size={14} className="text-error" />
                          </button>
                        </>
                      )}
                      <button
                        className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Icon name="PencilSquareIcon" size={14} className="text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <Icon name="TagIcon" size={30} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-700 text-foreground">No listing records found</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Seller product submissions will appear here after they are written to the live
                      catalog workflow.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md">
            <h3 className="font-800 text-foreground mb-2">
              {actionModal.action === 'approve' ? 'Approve Listing' : 'Reject Listing'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{actionModal.listing.name}</p>
            {actionModal.action === 'reject' && (
              <div className="mb-4">
                <label className="text-xs font-700 text-foreground block mb-1.5">
                  Rejection Reason
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why this listing is being rejected..."
                  className="input-base w-full px-3 py-2 text-sm rounded-xl resize-none"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setActionModal(null);
                  setRejectReason('');
                }}
                className="btn-secondary flex-1 py-2.5 text-sm rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setActionModal(null);
                  setRejectReason('');
                }}
                className={`flex-1 py-2.5 text-sm rounded-xl font-700 text-white ${actionModal.action === 'approve' ? 'bg-success hover:bg-success/90' : 'bg-error hover:bg-error/90'} transition-colors`}
              >
                {actionModal.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
