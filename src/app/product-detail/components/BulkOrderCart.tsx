'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface CartItem {
  id: string;
  productName: string;
  sku: string;
  pricePerMtr: number;
  quantity: number;
  moqTier: 3 | 6 | 9 | 12;
  gstRate: number;
}

interface MOQTier {
  metres: 3 | 6 | 9 | 12;
  label: string;
  discount: number;
}

const MOQ_TIERS: MOQTier[] = [
  { metres: 3, label: '3 mtr', discount: 0 },
  { metres: 6, label: '6 mtr', discount: 3 },
  { metres: 9, label: '9 mtr', discount: 5 },
  { metres: 12, label: '12 mtr', discount: 8 },
];

const INITIAL_ITEMS: CartItem[] = [
  { id: 'item-1', productName: 'Pure Dyeable Soft Nett Fabric', sku: 'STM-NET-001', pricePerMtr: 840, quantity: 9, moqTier: 9, gstRate: 5 },
  { id: 'item-2', productName: 'Georgette Embroidered', sku: 'STM-GEO-001', pricePerMtr: 1250, quantity: 6, moqTier: 6, gstRate: 5 },
];

function getMOQTier(qty: number): 3 | 6 | 9 | 12 {
  if (qty >= 12) return 12;
  if (qty >= 9) return 9;
  if (qty >= 6) return 6;
  return 3;
}

function getDiscount(tier: 3 | 6 | 9 | 12): number {
  return MOQ_TIERS.find((t) => t.metres === tier)?.discount ?? 0;
}

function calcItemTotal(item: CartItem): { base: number; discount: number; gst: number; total: number } {
  const base = item.pricePerMtr * item.quantity;
  const discountAmt = (base * getDiscount(item.moqTier)) / 100;
  const afterDiscount = base - discountAmt;
  const gst = (afterDiscount * item.gstRate) / 100;
  return { base, discount: discountAmt, gst, total: afterDiscount + gst };
}

export default function BulkOrderCart() {
  const [items, setItems] = useState<CartItem[]>(INITIAL_ITEMS);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ productName: '', sku: '', pricePerMtr: '', quantity: '3' });
  const [quoteGenerated, setQuoteGenerated] = useState(false);
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [buyerDetails, setBuyerDetails] = useState({ name: '', company: '', gstin: '', email: '' });
  const [showBuyerForm, setShowBuyerForm] = useState(false);

  const updateQuantity = (id: string, qty: number) => {
    const safeQty = Math.max(3, qty);
    const tier = getMOQTier(safeQty);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: safeQty, moqTier: tier } : item))
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddItem = () => {
    if (!newItem.productName || !newItem.pricePerMtr) return;
    const qty = Math.max(3, parseInt(newItem.quantity) || 3);
    const item: CartItem = {
      id: `item-${Date.now()}`,
      productName: newItem.productName,
      sku: newItem.sku || `SKU-${Date.now()}`,
      pricePerMtr: parseFloat(newItem.pricePerMtr),
      quantity: qty,
      moqTier: getMOQTier(qty),
      gstRate: 5,
    };
    setItems((prev) => [...prev, item]);
    setNewItem({ productName: '', sku: '', pricePerMtr: '', quantity: '3' });
    setShowAddItem(false);
  };

  const totals = items.reduce(
    (acc, item) => {
      const t = calcItemTotal(item);
      return {
        base: acc.base + t.base,
        discount: acc.discount + t.discount,
        gst: acc.gst + t.gst,
        total: acc.total + t.total,
      };
    },
    { base: 0, discount: 0, gst: 0, total: 0 }
  );

  const handleGenerateQuote = () => {
    if (!buyerDetails.name || !buyerDetails.company) {
      setShowBuyerForm(true);
      return;
    }
    setGeneratingQuote(true);
    setTimeout(() => {
      setGeneratingQuote(false);
      setQuoteGenerated(true);
      // Simulate PDF generation
      const quoteContent = `
FORMAL QUOTATION — FabricTrad B2B
Quote No: FT-QT-${Date.now().toString().slice(-6)}
Date: ${new Date().toLocaleDateString('en-IN')}

Buyer: ${buyerDetails.name}
Company: ${buyerDetails.company}
GSTIN: ${buyerDetails.gstin || 'N/A'}

LINE ITEMS:
${items.map((item, i) => {
  const t = calcItemTotal(item);
  return `${i + 1}. ${item.productName} (${item.sku})
   Qty: ${item.quantity} mtr × ₹${item.pricePerMtr}/mtr
   MOQ Tier: ${item.moqTier} mtr (${getDiscount(item.moqTier)}% discount)
   Subtotal: ₹${t.base.toLocaleString('en-IN')}
   Discount: -₹${t.discount.toLocaleString('en-IN')}
   GST @${item.gstRate}%: ₹${t.gst.toLocaleString('en-IN')}
   Line Total: ₹${t.total.toLocaleString('en-IN')}`;
}).join('\n\n')}

SUMMARY:
Gross Total: ₹${totals.base.toLocaleString('en-IN')}
Total Discount: -₹${totals.discount.toLocaleString('en-IN')}
GST: ₹${totals.gst.toLocaleString('en-IN')}
NET PAYABLE: ₹${totals.total.toLocaleString('en-IN')}

Valid for 7 days. Payment 100% advance. No COD.
      `.trim();

      const blob = new Blob([quoteContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FabricTrad_Quote_${Date.now().toString().slice(-6)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }, 1500);
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden mt-6">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-secondary/5 to-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
              <Icon name="ShoppingCartIcon" size={16} className="text-secondary" />
            </div>
            <div>
              <h3 className="font-700 text-sm text-foreground">Bulk Order Cart</h3>
              <p className="text-xs text-muted-foreground">MOQ tiers: 3 / 6 / 9 / 12 metres</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddItem(true)}
            className="btn-secondary px-3 py-1.5 text-xs rounded-xl flex items-center gap-1.5"
          >
            <Icon name="PlusIcon" size={13} />
            Add Item
          </button>
        </div>
      </div>

      {/* MOQ Tier Legend */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border overflow-x-auto">
        {MOQ_TIERS.map((tier) => (
          <div key={tier.metres} className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-700 text-foreground">{tier.label}</span>
            {tier.discount > 0 && (
              <span className="text-xs bg-success/10 text-success border border-success/20 px-1.5 py-0.5 rounded-full font-600">
                -{tier.discount}%
              </span>
            )}
          </div>
        ))}
        <span className="text-xs text-muted-foreground ml-2">· Discount applied automatically</span>
      </div>

      {/* Add Item Form */}
      {showAddItem && (
        <div className="p-4 border-b border-border bg-muted/20">
          <h4 className="text-xs font-700 text-foreground mb-3">Add Line Item</h4>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              value={newItem.productName}
              onChange={(e) => setNewItem({ ...newItem, productName: e.target.value })}
              placeholder="Product name *"
              className="input-base px-3 py-2 text-xs rounded-xl col-span-2"
            />
            <input
              type="text"
              value={newItem.sku}
              onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
              placeholder="SKU (optional)"
              className="input-base px-3 py-2 text-xs rounded-xl"
            />
            <input
              type="number"
              value={newItem.pricePerMtr}
              onChange={(e) => setNewItem({ ...newItem, pricePerMtr: e.target.value })}
              placeholder="Price per mtr (₹) *"
              className="input-base px-3 py-2 text-xs rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground">Quantity (min 3 mtr):</span>
            <div className="flex items-center gap-1">
              {[3, 6, 9, 12].map((qty) => (
                <button
                  key={qty}
                  onClick={() => setNewItem({ ...newItem, quantity: qty.toString() })}
                  className={`px-2.5 py-1 text-xs rounded-lg font-600 border transition-all ${
                    newItem.quantity === qty.toString()
                      ? 'bg-primary text-white border-primary' :'bg-muted border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {qty}m
                </button>
              ))}
              <input
                type="number"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                min={3}
                className="input-base w-16 px-2 py-1 text-xs rounded-lg text-center"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddItem} className="btn-primary px-4 py-2 text-xs rounded-xl">Add to Cart</button>
            <button onClick={() => setShowAddItem(false)} className="btn-secondary px-4 py-2 text-xs rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="divide-y divide-border">
        {items.map((item) => {
          const t = calcItemTotal(item);
          const discount = getDiscount(item.moqTier);
          return (
            <div key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-700 text-foreground truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded-lg hover:bg-error/10 text-muted-foreground hover:text-error transition-colors shrink-0"
                >
                  <Icon name="TrashIcon" size={14} />
                </button>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                {/* Quantity Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Qty:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 3)}
                      disabled={item.quantity <= 3}
                      className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-sm font-700 disabled:opacity-40 hover:bg-muted/80 transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 3)}
                      min={3}
                      className="input-base w-14 text-center px-1 py-1 text-sm font-700 rounded-lg"
                    />
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 3)}
                      className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-sm font-700 hover:bg-muted/80 transition-colors"
                    >
                      +
                    </button>
                    <span className="text-xs text-muted-foreground">mtr</span>
                  </div>
                </div>

                {/* MOQ Tier Badge */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded-full font-600">
                    {item.moqTier}m tier
                  </span>
                  {discount > 0 && (
                    <span className="text-xs bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full font-600">
                      -{discount}% off
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted-foreground">₹{item.pricePerMtr}/mtr × {item.quantity}m</p>
                  {discount > 0 && (
                    <p className="text-xs text-success">-₹{t.discount.toLocaleString('en-IN')} discount</p>
                  )}
                  <p className="text-xs text-muted-foreground">+₹{t.gst.toLocaleString('en-IN')} GST</p>
                  <p className="text-sm font-800 text-foreground">₹{t.total.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Summary */}
      {items.length > 0 && (
        <div className="p-4 border-t border-border bg-muted/20">
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Gross Total</span>
              <span className="font-600 text-foreground">₹{totals.base.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-success">MOQ Discount</span>
              <span className="font-600 text-success">-₹{totals.discount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">GST (split at transaction)</span>
              <span className="font-600 text-foreground">₹{totals.gst.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm font-800 pt-2 border-t border-border">
              <span className="text-foreground">Net Payable</span>
              <span className="text-primary">₹{totals.total.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Buyer Details Form */}
          {showBuyerForm && (
            <div className="mb-4 p-3 bg-card border border-border rounded-xl space-y-2">
              <p className="text-xs font-700 text-foreground mb-2">Buyer Details for Quote</p>
              <input
                type="text"
                value={buyerDetails.name}
                onChange={(e) => setBuyerDetails({ ...buyerDetails, name: e.target.value })}
                placeholder="Contact Name *"
                className="input-base w-full px-3 py-2 text-xs rounded-xl"
              />
              <input
                type="text"
                value={buyerDetails.company}
                onChange={(e) => setBuyerDetails({ ...buyerDetails, company: e.target.value })}
                placeholder="Company Name *"
                className="input-base w-full px-3 py-2 text-xs rounded-xl"
              />
              <input
                type="text"
                value={buyerDetails.gstin}
                onChange={(e) => setBuyerDetails({ ...buyerDetails, gstin: e.target.value })}
                placeholder="GSTIN (optional)"
                className="input-base w-full px-3 py-2 text-xs rounded-xl"
              />
              <input
                type="email"
                value={buyerDetails.email}
                onChange={(e) => setBuyerDetails({ ...buyerDetails, email: e.target.value })}
                placeholder="Email for quote delivery"
                className="input-base w-full px-3 py-2 text-xs rounded-xl"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleGenerateQuote}
              disabled={generatingQuote}
              className="btn-primary flex-1 py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {generatingQuote ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating PDF...
                </>
              ) : quoteGenerated ? (
                <>
                  <Icon name="CheckCircleIcon" size={16} />
                  Quote Downloaded
                </>
              ) : (
                <>
                  <Icon name="DocumentArrowDownIcon" size={16} />
                  Generate Quote PDF
                </>
              )}
            </button>
            <button
              onClick={() => setShowBuyerForm(!showBuyerForm)}
              className="btn-secondary px-3 py-2.5 text-sm rounded-xl"
              title="Buyer details"
            >
              <Icon name="UserIcon" size={16} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            GST split deducted at transaction time · 100% advance payment
          </p>
        </div>
      )}

      {items.length === 0 && (
        <div className="p-8 text-center">
          <Icon name="ShoppingCartIcon" size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-700 text-foreground mb-1">Cart is empty</p>
          <p className="text-xs text-muted-foreground mb-3">Add fabric items to create a bulk order quote</p>
          <button onClick={() => setShowAddItem(true)} className="btn-primary px-4 py-2 text-sm rounded-xl">
            Add First Item
          </button>
        </div>
      )}
    </div>
  );
}
