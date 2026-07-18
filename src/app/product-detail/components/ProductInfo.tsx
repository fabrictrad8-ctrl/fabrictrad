'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

const priceTiers = [
  { min: 50, max: 99, price: 840, label: '50-99 mtrs' },
  { min: 100, max: 249, price: 790, label: '100-249 mtrs' },
  { min: 250, max: 499, price: 750, label: '250-499 mtrs' },
  { min: 500, max: null, price: 720, label: '500+ mtrs' },
];

export default function ProductInfo() {
  const [qty, setQty] = useState(50);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);

  const activePrice =
    priceTiers?.find((t) => qty >= t?.min && (t?.max === null || qty <= t?.max)) || priceTiers?.[0];

  const handleOrderRequest = () => {
    setOrderSubmitted(true);
    setTimeout(() => setOrderSubmitted(false), 3000);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      {/* Product Title */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="tag-bestseller">Best Seller</span>
            <span className="badge-gstin">GST Ready</span>
          </div>
          <h1 className="text-lg font-800 text-foreground leading-snug">
            Pure Dyeable Soft Nett Fabric
          </h1>
        </div>
        <button
          onClick={() => setSaved(!saved)}
          className={`p-2 rounded-xl border transition-all shrink-0 ${saved ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary hover:text-primary'}`}
        >
          <Icon
            name={saved ? 'HeartIcon' : 'HeartIcon'}
            size={18}
            variant={saved ? 'solid' : 'outline'}
          />
        </button>
      </div>
      {/* Rating */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5]?.map((s) => (
            <Icon
              key={s}
              name="StarIcon"
              size={14}
              className={s <= 4 ? 'text-amber-400' : 'text-amber-200'}
              variant="solid"
            />
          ))}
        </div>
        <span className="text-sm font-700 text-foreground">4.8</span>
        <span className="text-sm text-muted-foreground">(124 reviews)</span>
        <span className="text-xs text-muted-foreground">· 380 orders</span>
      </div>
      {/* Price Tiers */}
      <div className="mb-4">
        <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-2">
          Bulk Price Tiers
        </p>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left px-3 py-2 text-xs font-700 text-muted-foreground">
                  Quantity
                </th>
                <th className="text-right px-3 py-2 text-xs font-700 text-muted-foreground">
                  Price/mtr
                </th>
              </tr>
            </thead>
            <tbody>
              {priceTiers?.map((tier) => (
                <tr
                  key={tier?.label}
                  className={`price-tier-row border-t border-border ${qty >= tier?.min && (tier?.max === null || qty <= tier?.max) ? 'bg-primary/5 text-primary font-700' : ''}`}
                >
                  <td className="px-3 py-2 text-xs">{tier?.label}</td>
                  <td className="px-3 py-2 text-xs text-right font-700">₹{tier?.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Current Price */}
      <div className="flex items-end gap-2 mb-4">
        <span className="text-3xl font-800 text-primary">₹{activePrice?.price}</span>
        <span className="text-sm text-muted-foreground mb-1">per metre · {activePrice?.label}</span>
      </div>
      {/* Quantity Input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-700 text-foreground">Quantity (metres)</p>
          <span className="text-xs text-muted-foreground">
            Min: 50 mtrs · Available: 2,400 mtrs
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQty((q) => Math.max(50, q - 10))}
            className="w-10 h-10 rounded-xl border border-border bg-muted flex items-center justify-center hover:border-primary transition-colors"
          >
            <Icon name="MinusIcon" size={16} className="text-foreground" />
          </button>
          <input
            type="number"
            value={qty}
            min={50}
            onChange={(e) => setQty(Math.max(50, parseInt(e?.target?.value) || 50))}
            className="input-base flex-1 text-center px-3 py-2 text-sm rounded-xl font-700"
          />
          <button
            onClick={() => setQty((q) => q + 10)}
            className="w-10 h-10 rounded-xl border border-border bg-muted flex items-center justify-center hover:border-primary transition-colors"
          >
            <Icon name="PlusIcon" size={16} className="text-foreground" />
          </button>
        </div>
      </div>
      {/* Order Total */}
      <div className="bg-muted rounded-xl p-3 mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">
            Subtotal ({qty} mtrs × ₹{activePrice?.price})
          </span>
          <span className="font-700 text-foreground">
            ₹{(qty * activePrice?.price)?.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex justify-between text-sm font-700">
          <span className="text-muted-foreground">GST (5%)</span>
          <span className="text-foreground">
            ₹{Math.round(qty * activePrice?.price * 0.05)?.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm font-800">
          <span className="text-foreground">Estimated Total</span>
          <span className="text-primary">
            ₹{Math.round(qty * activePrice?.price * 1.05)?.toLocaleString('en-IN')}
          </span>
        </div>
      </div>
      {/* Dispatch Info */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-success/5 border border-success/20 rounded-xl">
        <Icon name="TruckIcon" size={16} className="text-success shrink-0" />
        <div>
          <p className="text-xs font-700 text-success">Dispatch in 2-3 business days</p>
          <p className="text-xs text-muted-foreground">
            Shipped via Shiprocket · Tracking included
          </p>
        </div>
      </div>
      {/* Policy Notice */}
      <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <Icon name="ExclamationTriangleIcon" size={14} className="text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-warning leading-relaxed">
          <span className="font-700">No Returns.</span> Exchange accepted within 24hrs with unboxing
          video. No COD — 100% prepaid only.
        </p>
      </div>
      {/* Action Buttons */}
      {orderSubmitted ? (
        <div className="flex items-center justify-center gap-2 bg-success/10 border border-success/30 rounded-xl p-4">
          <Icon name="CheckCircleIcon" size={20} className="text-success" />
          <span className="text-sm font-700 text-success">
            Order request submitted! Seller will respond shortly.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={handleOrderRequest}
            className="btn-primary w-full py-3 text-sm rounded-xl flex items-center justify-center gap-2"
          >
            <Icon name="ShoppingCartIcon" size={16} />
            Submit Order Request
          </button>
          <Link
            href="/register"
            className="btn-secondary w-full py-3 text-sm rounded-xl flex items-center justify-center gap-2"
          >
            <Icon name="DocumentTextIcon" size={16} />
            Create Account to Quote
          </Link>
        </div>
      )}
      {/* Policies */}
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Icon name="LockClosedIcon" size={12} />
          <span>Secure Payment</span>
        </div>
        <div className="flex items-center gap-1">
          <Icon name="ShieldCheckIcon" size={12} />
          <span>GST Invoice</span>
        </div>
        <div className="flex items-center gap-1">
          <Icon name="ReceiptPercentIcon" size={12} />
          <span>No Hidden Charges</span>
        </div>
      </div>
    </div>
  );
}
