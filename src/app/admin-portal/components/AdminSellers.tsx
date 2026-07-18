'use client';
import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

interface Seller {
  id: string;name: string;contact: string;city: string;type: string;
  gstin: string;status: 'verified' | 'pending_review' | 'suspended' | 'deactivated' | 'rejected';
  products: number;orders: number;gmv: string;joinDate: string;avatar: string;
}

const initialSellers: Seller[] = [
{ id: 'FT-SLR-001234', name: 'Surat Textile Mills Pvt Ltd', contact: 'Arjun Sharma', city: 'Surat, Gujarat', type: 'Manufacturer', gstin: '24AAAPL1234Z1Z5', status: 'verified', products: 48, orders: 310, gmv: '₹42L', joinDate: '12 Jan 2026', avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_18d48d780-1767603781679.png" },
{ id: 'FT-SLR-001890', name: 'Jaipur Crafts Emporium', contact: 'Priya Nair', city: 'Jaipur, Rajasthan', type: 'Wholesaler', gstin: '08BBBPN5678Y2Z6', status: 'verified', products: 32, orders: 189, gmv: '₹28L', joinDate: '03 Feb 2026', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop&crop=face' },
{ id: 'FT-SLR-002341', name: 'Varanasi Silk Traders', contact: 'Deepak Mishra', city: 'Varanasi, UP', type: 'Manufacturer', gstin: '09CCCVS9012W3Z7', status: 'pending_review', products: 0, orders: 0, gmv: '₹0', joinDate: '15 Jul 2026', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face' },
{ id: 'FT-SLR-002398', name: 'Mumbai Fabric Zone', contact: 'Sunita Kapoor', city: 'Mumbai, Maharashtra', type: 'Distributor', gstin: '27DDDMF3456X4Z8', status: 'pending_review', products: 0, orders: 0, gmv: '₹0', joinDate: '16 Jul 2026', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face' },
{ id: 'FT-SLR-001654', name: 'Bhiwandi Weave House', contact: 'Ramesh Patil', city: 'Bhiwandi, Maharashtra', type: 'Manufacturer', gstin: '27EEEBW7890Y5Z9', status: 'suspended', products: 24, orders: 89, gmv: '₹12L', joinDate: '20 Mar 2026', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face' }];


const statusConfig: Record<string, {label: string;class: string;}> = {
  verified: { label: '✓ Verified', class: 'bg-success/10 text-success' },
  pending_review: { label: '⏳ Pending Review', class: 'bg-amber-50 text-warning' },
  suspended: { label: '⛔ Suspended', class: 'bg-error/10 text-error' },
  deactivated: { label: '✗ Deactivated', class: 'bg-muted text-muted-foreground' },
  rejected: { label: '✗ Rejected', class: 'bg-error/10 text-error' }
};

export default function AdminSellers() {
  const [filter, setFilter] = useState('All');
  const [sellers, setSellers] = useState<Seller[]>(initialSellers);
  const [actionModal, setActionModal] = useState<{seller: Seller;action: 'approve' | 'reject' | 'suspend' | 'deactivate' | 'reactivate';} | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const filters = ['All', 'Verified', 'Pending Review', 'Suspended', 'Deactivated'];

  const filtered = filter === 'All' ? sellers : sellers.filter((s) => {
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
      {toast &&
      <div className="fixed top-4 right-4 z-50 bg-success text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-600 flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={16} />
          {toast}
        </div>
      }

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-800 text-foreground">Seller Management</h1>
        <div className="flex items-center gap-2 text-xs">
          {pendingCount > 0 &&
          <span className="bg-amber-50 text-warning border border-amber-200 px-2.5 py-1 rounded-full font-700">{pendingCount} pending review</span>
          }
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-thin pb-1">
        {filters.map((f) =>
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 transition-all ${
          filter === f ? 'bg-secondary text-white' : 'bg-card border border-border text-muted-foreground hover:border-secondary'}`
          }>
          
            {f}
          </button>
        )}
      </div>

      {/* Sellers Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground">Seller</th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground hidden sm:table-cell">Location</th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground hidden md:table-cell">GSTIN</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground hidden lg:table-cell">GMV</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((seller) =>
              <tr key={seller.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-muted shrink-0">
                        <AppImage src={seller.avatar} alt={`${seller.contact} profile photo`} width={36} height={36} className="object-cover" />
                      </div>
                      <div>
                        <p className="text-xs font-700 text-foreground">{seller.name}</p>
                        <p className="text-xs text-muted-foreground">{seller.contact} · {seller.type}</p>
                        <p className="mono-id">{seller.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs text-foreground">{seller.city}</p>
                    <p className="text-xs text-muted-foreground">Since {seller.joinDate}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-xs font-mono text-foreground">{seller.gstin.slice(0, 10)}****</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-700 ${statusConfig[seller.status]?.class}`}>
                      {statusConfig[seller.status]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <p className="text-sm font-800 text-foreground">{seller.gmv}</p>
                    <p className="text-xs text-muted-foreground">{seller.orders} orders</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {seller.status === 'pending_review' &&
                    <>
                          <button
                        onClick={() => setActionModal({ seller, action: 'approve' })}
                        className="bg-success text-white text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-green-700 transition-colors">
                        
                            Approve
                          </button>
                          <button
                        onClick={() => setActionModal({ seller, action: 'reject' })}
                        className="bg-error/10 text-error text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-error hover:text-white transition-all">
                        
                            Reject
                          </button>
                        </>
                    }
                      {seller.status === 'verified' &&
                    <>
                          <button
                        onClick={() => setActionModal({ seller, action: 'suspend' })}
                        className="bg-warning/10 text-warning text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-warning hover:text-white transition-all">
                        
                            Suspend
                          </button>
                          <button
                        onClick={() => setActionModal({ seller, action: 'deactivate' })}
                        className="bg-error/10 text-error text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-error hover:text-white transition-all">
                        
                            Deactivate
                          </button>
                        </>
                    }
                      {(seller.status === 'suspended' || seller.status === 'deactivated') &&
                    <button
                      onClick={() => setActionModal({ seller, action: 'reactivate' })}
                      className="bg-success/10 text-success text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-success hover:text-white transition-all">
                      
                          Reactivate
                        </button>
                    }
                      {seller.status === 'rejected' &&
                    <span className="text-xs text-muted-foreground">Rejected</span>
                    }
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Confirmation Modal */}
      {actionModal &&
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            actionModal.action === 'approve' || actionModal.action === 'reactivate' ? 'bg-success/10' :
            actionModal.action === 'suspend' ? 'bg-warning/10' : 'bg-error/10'}`
            }>
                <Icon
                name={
                actionModal.action === 'approve' || actionModal.action === 'reactivate' ? 'CheckCircleIcon' :
                actionModal.action === 'suspend' ? 'PauseCircleIcon' : 'NoSymbolIcon'
                }
                size={20}
                className={
                actionModal.action === 'approve' || actionModal.action === 'reactivate' ? 'text-success' :
                actionModal.action === 'suspend' ? 'text-warning' : 'text-error'
                } />
              
              </div>
              <div>
                <h3 className="font-800 text-foreground capitalize">{actionModal.action} Seller</h3>
                <p className="text-xs text-muted-foreground">{actionModal.seller.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {actionModal.action === 'approve' && 'This will approve the seller and allow them to list products and accept orders.'}
              {actionModal.action === 'reject' && 'This will reject the seller application. They will be notified with the reason.'}
              {actionModal.action === 'suspend' && 'This will temporarily suspend the seller. They cannot accept new orders but existing orders continue.'}
              {actionModal.action === 'deactivate' && 'This will permanently deactivate the account. All listings will be hidden. Requires manual review to reverse.'}
              {actionModal.action === 'reactivate' && 'This will restore the seller\'s account and allow them to accept new orders.'}
            </p>
            {actionModal.action !== 'approve' && actionModal.action !== 'reactivate' &&
          <div className="mb-4">
                <label className="text-xs font-700 text-foreground block mb-1.5">Reason <span className="text-error">*</span></label>
                <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Provide reason for this action..."
              className="input-base w-full px-3 py-2 text-sm rounded-xl resize-none"
              rows={3} />
            
              </div>
          }
            <div className="flex items-center gap-2">
              <button
              onClick={handleAction}
              disabled={actionModal.action !== 'approve' && actionModal.action !== 'reactivate' && !actionReason.trim()}
              className={`flex-1 py-2.5 rounded-xl text-sm font-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              actionModal.action === 'approve' || actionModal.action === 'reactivate' ? 'bg-success text-white hover:bg-green-700' :
              actionModal.action === 'suspend' ? 'bg-warning text-white hover:bg-amber-600' : 'bg-error text-white hover:bg-red-700'}`
              }>
              
                Confirm
              </button>
              <button
              onClick={() => {setActionModal(null);setActionReason('');}}
              className="flex-1 py-2.5 rounded-xl text-sm font-600 bg-muted text-muted-foreground hover:bg-border transition-colors">
              
                Cancel
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

}