'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

const inventory = [
  {
    id: 'SKU-001',
    name: 'Pure Dyeable Soft Nett Fabric',
    sku: 'STM-NET-001',
    available: 2400,
    reserved: 500,
    minimum: 200,
    unit: 'mtrs',
    price: 840,
    status: 'active',
    lastUpdated: '17 Jul 2026',
  },
  {
    id: 'SKU-002',
    name: 'Organza Sequence Fabric',
    sku: 'STM-ORG-001',
    available: 45,
    reserved: 100,
    minimum: 100,
    unit: 'mtrs',
    price: 980,
    status: 'low',
    lastUpdated: '16 Jul 2026',
  },
  {
    id: 'SKU-003',
    name: 'Georgette Embroidered',
    sku: 'STM-GEO-001',
    available: 800,
    reserved: 75,
    minimum: 150,
    unit: 'mtrs',
    price: 1250,
    status: 'active',
    lastUpdated: '15 Jul 2026',
  },
  {
    id: 'SKU-004',
    name: 'Velvet Crush Fabric',
    sku: 'STM-VLV-001',
    available: 20,
    reserved: 30,
    minimum: 50,
    unit: 'mtrs',
    price: 680,
    status: 'low',
    lastUpdated: '14 Jul 2026',
  },
  {
    id: 'SKU-005',
    name: 'Chiffon Digital Print',
    sku: 'STM-CHF-001',
    available: 30,
    reserved: 0,
    minimum: 75,
    unit: 'mtrs',
    price: 420,
    status: 'low',
    lastUpdated: '13 Jul 2026',
  },
  {
    id: 'SKU-006',
    name: 'Linen Slub Fabric',
    sku: 'STM-LIN-001',
    available: 1200,
    reserved: 200,
    minimum: 300,
    unit: 'mtrs',
    price: 560,
    status: 'active',
    lastUpdated: '12 Jul 2026',
  },
];

export default function SellerInventory() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [minThreshold, setMinThreshold] = useState<Record<string, string>>({});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-800 text-foreground">Inventory Management</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 btn-secondary px-3 py-2 text-xs rounded-xl">
            <Icon name="ArrowUpTrayIcon" size={14} />
            CSV Import
          </button>
          <button className="flex items-center gap-1.5 btn-primary px-3 py-2 text-xs rounded-xl">
            <Icon name="PlusIcon" size={14} />
            Add Product
          </button>
        </div>
      </div>

      {/* Low Stock Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-800 text-success">
            {inventory.filter((i) => i.status === 'active').length}
          </p>
          <p className="text-xs text-muted-foreground">In Stock</p>
        </div>
        <div className="bg-card rounded-xl border border-error/30 p-4 text-center">
          <p className="text-2xl font-800 text-error">
            {inventory.filter((i) => i.status === 'low').length}
          </p>
          <p className="text-xs text-muted-foreground">Low Stock</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-800 text-foreground">{inventory.length}</p>
          <p className="text-xs text-muted-foreground">Total Products</p>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground">
                  Product
                </th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground">
                  Available
                </th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground">
                  Reserved
                </th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground hidden sm:table-cell">
                  Min Stock
                </th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground hidden md:table-cell">
                  Price
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Status
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inventory.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs font-700 text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === item.id ? (
                      <input
                        type="number"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        className="input-base w-20 px-2 py-1 text-xs rounded-lg text-right"
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm font-700 text-foreground">
                        {item.available.toLocaleString('en-IN')}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-600 text-warning">{item.reserved}</span>
                    <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    {editingId === item.id ? (
                      <input
                        type="number"
                        value={minThreshold[item.id] || item.minimum.toString()}
                        onChange={(e) =>
                          setMinThreshold({ ...minThreshold, [item.id]: e.target.value })
                        }
                        className="input-base w-20 px-2 py-1 text-xs rounded-lg text-right"
                      />
                    ) : (
                      <span className="text-sm font-600 text-muted-foreground">{item.minimum}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-sm font-700 text-foreground">
                      ₹{item.price.toLocaleString('en-IN')}/mtr
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-700 ${
                        item.status === 'low'
                          ? 'bg-error/10 text-error'
                          : 'bg-success/10 text-success'
                      }`}
                    >
                      {item.status === 'low' ? '⚠ Low Stock' : '✓ In Stock'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => setEditingId(null)}
                          className="bg-success text-white text-xs px-2 py-1 rounded-lg"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="bg-muted border border-border text-xs px-2 py-1 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setEditQty(item.available.toString());
                        }}
                        className="text-xs text-primary font-600 hover:underline flex items-center gap-1 mx-auto"
                      >
                        <Icon name="PencilSquareIcon" size={12} />
                        Update
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock Notification Settings */}
      <div className="mt-5 bg-card rounded-2xl border border-border p-5">
        <h3 className="font-800 text-foreground mb-3 flex items-center gap-2">
          <Icon name="BellAlertIcon" size={16} className="text-primary" />
          Low Stock Notification Settings
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          You will receive in-app + SMS + email alerts when any product's stock drops below its
          minimum threshold.
        </p>
        <div className="flex flex-wrap gap-3">
          {['In-App Notification', 'SMS Alert', 'Email Alert'].map((channel) => (
            <div key={channel} className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
              <div className="w-4 h-4 rounded border-2 border-success bg-success flex items-center justify-center">
                <Icon name="CheckIcon" size={10} className="text-white" />
              </div>
              <span className="text-xs font-600 text-foreground">{channel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
