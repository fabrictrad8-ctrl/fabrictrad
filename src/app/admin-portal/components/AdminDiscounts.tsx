'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

const campaigns = [
  {
    id: 'FT-DSC-000041',
    name: 'Monsoon Sale 2026',
    type: 'Website-wide',
    discount: '10%',
    minOrder: '₹50,000',
    usage: '284/500',
    start: '01 Jul 2026',
    end: '31 Jul 2026',
    status: 'active',
    redeemed: '₹12.4L',
    orders: 284,
    funded: 'FabricTrad',
  },
  {
    id: 'FT-DSC-000038',
    name: 'First Order Discount',
    type: 'First-order',
    discount: '5%',
    minOrder: '₹10,000',
    usage: '1,240/unlimited',
    start: '01 Jan 2026',
    end: '31 Dec 2026',
    status: 'active',
    redeemed: '₹4.2L',
    orders: 1240,
    funded: 'Shared 50/50',
  },
  {
    id: 'FT-DSC-000045',
    name: 'Independence Day Flash Sale',
    type: 'Flash Sale',
    discount: '15%',
    minOrder: '₹1,00,000',
    usage: '0/200',
    start: '14 Aug 2026',
    end: '15 Aug 2026',
    status: 'scheduled',
    redeemed: '₹0',
    orders: 0,
    funded: 'FabricTrad',
  },
  {
    id: 'FT-DSC-000030',
    name: 'Silk Category Promo',
    type: 'Category',
    discount: '8%',
    minOrder: '₹25,000',
    usage: '89/100',
    start: '01 Jun 2026',
    end: '30 Jun 2026',
    status: 'expired',
    redeemed: '₹3.1L',
    orders: 89,
    funded: 'Seller',
  },
];

const statusConfig: Record<string, string> = {
  active: 'bg-success/10 text-success',
  scheduled: 'bg-blue-50 text-blue-600',
  expired: 'bg-muted text-muted-foreground',
  paused: 'bg-amber-50 text-warning',
};

export default function AdminDiscounts() {
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: '',
    discount: '',
    minOrder: '',
    maxDiscount: '',
    startDate: '',
    endDate: '',
    usageLimit: '',
    funded: 'FabricTrad',
  });

  const campaignTypes = [
    'Website-wide',
    'Category',
    'Product-specific',
    'Seller-specific',
    'Buyer-specific',
    'First-order',
    'Flash Sale',
    'Coupon Code',
    'Abandoned Cart',
    'Festival Offer',
    'Free Shipping',
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-800 text-foreground">Discount & Promotions</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2"
        >
          <Icon name="PlusIcon" size={16} />
          Create Campaign
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-card rounded-2xl border border-border p-5 mb-6 animate-fade-in">
          <h2 className="font-800 text-foreground mb-4">New Campaign</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">
                Campaign Name *
              </label>
              <input
                type="text"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                placeholder="e.g. Monsoon Sale 2026"
                className="input-base w-full px-3 py-2 text-sm rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">
                Campaign Type *
              </label>
              <select
                value={newCampaign.type}
                onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value })}
                className="input-base w-full px-3 py-2 text-sm rounded-xl"
              >
                <option value="">Select type</option>
                {campaignTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Discount %</label>
              <input
                type="number"
                value={newCampaign.discount}
                onChange={(e) => setNewCampaign({ ...newCampaign, discount: e.target.value })}
                placeholder="e.g. 10"
                className="input-base w-full px-3 py-2 text-sm rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">
                Min Order Value (₹)
              </label>
              <input
                type="number"
                value={newCampaign.minOrder}
                onChange={(e) => setNewCampaign({ ...newCampaign, minOrder: e.target.value })}
                placeholder="50000"
                className="input-base w-full px-3 py-2 text-sm rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">
                Max Discount (₹)
              </label>
              <input
                type="number"
                value={newCampaign.maxDiscount}
                onChange={(e) => setNewCampaign({ ...newCampaign, maxDiscount: e.target.value })}
                placeholder="5000"
                className="input-base w-full px-3 py-2 text-sm rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">
                Total Usage Limit
              </label>
              <input
                type="number"
                value={newCampaign.usageLimit}
                onChange={(e) => setNewCampaign({ ...newCampaign, usageLimit: e.target.value })}
                placeholder="500"
                className="input-base w-full px-3 py-2 text-sm rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Start Date *</label>
              <input
                type="date"
                value={newCampaign.startDate}
                onChange={(e) => setNewCampaign({ ...newCampaign, startDate: e.target.value })}
                className="input-base w-full px-3 py-2 text-sm rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">End Date *</label>
              <input
                type="date"
                value={newCampaign.endDate}
                onChange={(e) => setNewCampaign({ ...newCampaign, endDate: e.target.value })}
                className="input-base w-full px-3 py-2 text-sm rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Funded By</label>
              <select
                value={newCampaign.funded}
                onChange={(e) => setNewCampaign({ ...newCampaign, funded: e.target.value })}
                className="input-base w-full px-3 py-2 text-sm rounded-xl"
              >
                <option>FabricTrad</option>
                <option>Seller</option>
                <option>Shared 50/50</option>
                <option>Custom Split</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowCreate(false)}
              className="btn-secondary px-4 py-2 text-sm rounded-xl"
            >
              Cancel
            </button>
            <button className="btn-primary px-5 py-2 text-sm rounded-xl">Create Campaign</button>
          </div>
        </div>
      )}

      {/* Campaigns Table */}
      <div className="space-y-3">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="mono-id">{campaign.id}</span>
                  <span
                    className={`text-xs font-700 px-2.5 py-0.5 rounded-full ${statusConfig[campaign.status]}`}
                  >
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {campaign.type}
                  </span>
                </div>
                <p className="text-base font-800 text-foreground mb-1">{campaign.name}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    Discount: <span className="font-700 text-primary">{campaign.discount}</span>
                  </span>
                  <span>
                    Min Order: <span className="font-700">{campaign.minOrder}</span>
                  </span>
                  <span>
                    Funded by: <span className="font-700">{campaign.funded}</span>
                  </span>
                  <span>
                    {campaign.start} → {campaign.end}
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-2">
                <p className="text-sm font-800 text-foreground">{campaign.redeemed} redeemed</p>
                <p className="text-xs text-muted-foreground">
                  {campaign.usage} uses · {campaign.orders} orders
                </p>
                <div className="flex gap-1.5">
                  {campaign.status === 'active' && (
                    <button className="bg-amber-50 text-warning border border-amber-200 text-xs px-2.5 py-1 rounded-lg font-600">
                      Pause
                    </button>
                  )}
                  {campaign.status === 'scheduled' && (
                    <button className="bg-success/10 text-success border border-success/20 text-xs px-2.5 py-1 rounded-lg font-600">
                      Activate
                    </button>
                  )}
                  <button className="bg-muted border border-border text-xs px-2.5 py-1 rounded-lg font-600 text-foreground">
                    Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
