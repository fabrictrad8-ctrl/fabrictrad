'use client';
import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';


const sellers = [
{
  id: 'FT-SLR-001234', name: 'Surat Textile Mills Pvt Ltd', contact: 'Arjun Sharma',
  city: 'Surat, Gujarat', type: 'Manufacturer', gstin: '24AAAPL1234Z1Z5',
  status: 'verified', products: 48, orders: 310, gmv: '₹42L', joinDate: '12 Jan 2026',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d7d81378-1780409713056.png"
},
{
  id: 'FT-SLR-001890', name: 'Jaipur Crafts Emporium', contact: 'Priya Nair',
  city: 'Jaipur, Rajasthan', type: 'Wholesaler', gstin: '08BBBPN5678Y2Z6',
  status: 'verified', products: 32, orders: 189, gmv: '₹28L', joinDate: '03 Feb 2026',
  avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop&crop=face'
},
{
  id: 'FT-SLR-002341', name: 'Varanasi Silk Traders', contact: 'Deepak Mishra',
  city: 'Varanasi, UP', type: 'Manufacturer', gstin: '09CCCVS9012W3Z7',
  status: 'pending_review', products: 0, orders: 0, gmv: '₹0', joinDate: '15 Jul 2026',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face'
},
{
  id: 'FT-SLR-002398', name: 'Mumbai Fabric Zone', contact: 'Sunita Kapoor',
  city: 'Mumbai, Maharashtra', type: 'Distributor', gstin: '27DDDMF3456X4Z8',
  status: 'pending_review', products: 0, orders: 0, gmv: '₹0', joinDate: '16 Jul 2026',
  avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face'
},
{
  id: 'FT-SLR-001654', name: 'Bhiwandi Weave House', contact: 'Ramesh Patil',
  city: 'Bhiwandi, Maharashtra', type: 'Manufacturer', gstin: '27EEEBW7890Y5Z9',
  status: 'suspended', products: 24, orders: 89, gmv: '₹12L', joinDate: '20 Mar 2026',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face'
}];


const statusConfig: Record<string, {label: string;class: string;}> = {
  verified: { label: '✓ Verified', class: 'bg-success/10 text-success' },
  pending_review: { label: '⏳ Pending Review', class: 'bg-amber-50 text-warning' },
  suspended: { label: '⛔ Suspended', class: 'bg-error/10 text-error' },
  rejected: { label: '✗ Rejected', class: 'bg-error/10 text-error' }
};

export default function AdminSellers() {
  const [filter, setFilter] = useState('All');
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);

  const filters = ['All', 'Verified', 'Pending Review', 'Suspended'];
  const filtered = filter === 'All' ? sellers : sellers.filter((s) => {
    if (filter === 'Verified') return s.status === 'verified';
    if (filter === 'Pending Review') return s.status === 'pending_review';
    if (filter === 'Suspended') return s.status === 'suspended';
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-800 text-foreground">Seller Management</h1>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-amber-50 text-warning border border-amber-200 px-2.5 py-1 rounded-full font-700">4 pending review</span>
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
                    <div className="flex items-center justify-center gap-1">
                      {seller.status === 'pending_review' &&
                    <>
                          <button className="bg-success text-white text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-green-700 transition-colors">
                            Approve
                          </button>
                          <button className="bg-error/10 text-error text-xs px-2.5 py-1 rounded-lg font-600 hover:bg-error hover:text-white transition-all">
                            Reject
                          </button>
                        </>
                    }
                      {seller.status === 'verified' &&
                    <button className="bg-muted border border-border text-xs px-2.5 py-1 rounded-lg font-600 text-foreground hover:border-primary transition-colors">
                          View
                        </button>
                    }
                      {seller.status === 'suspended' &&
                    <button className="bg-success/10 text-success text-xs px-2.5 py-1 rounded-lg font-600">
                          Reactivate
                        </button>
                    }
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>);

}