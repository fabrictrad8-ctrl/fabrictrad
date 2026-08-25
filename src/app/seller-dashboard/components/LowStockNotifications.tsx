'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type LowStockProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  availableQuantity: number;
  reservedQuantity: number;
  moq: number;
  minStock: number;
  unit: string;
  pricePerUnit: number;
};

type RestockItem = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
};

const money = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

export default function LowStockNotifications() {
  const { user } = useAuth();
  const supabase = createClient();
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [restockItems, setRestockItems] = useState<RestockItem[]>([]);
  const [showRestockForm, setShowRestockForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: seller } = await supabase
        .from('seller_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!seller?.id) { setLoading(false); return; }

      const { data: products } = await supabase
        .from('seller_products')
        .select('id,name,sku,category,available_quantity,reserved_quantity,moq,min_stock,unit,unit_label,price_per_unit')
        .eq('seller_id', seller.id)
        .eq('status', 'active')
        .order('available_quantity', { ascending: true })
        .limit(100);

      if (products) {
        const low = (products as unknown as Record<string, unknown>[])
          .filter((p) => {
            const available = Number(p.available_quantity || 0) - Number(p.reserved_quantity || 0);
            const moq = Number(p.moq || 1);
            const minStock = Number(p.min_stock || 0);
            return available <= Math.max(moq, minStock);
          })
          .map((p) => ({
            id: String(p.id),
            name: String(p.name || ''),
            sku: String(p.sku || ''),
            category: String(p.category || ''),
            availableQuantity: Number(p.available_quantity || 0),
            reservedQuantity: Number(p.reserved_quantity || 0),
            moq: Number(p.moq || 1),
            minStock: Number(p.min_stock || 0),
            unit: String(p.unit_label || p.unit || 'unit'),
            pricePerUnit: Number(p.price_per_unit || 0),
          }));
        setLowStockProducts(low);
      }
    } catch {
      setLowStockProducts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  useEffect(() => { void load(); }, [load]);

  const addAllToRestock = () => {
    const items: RestockItem[] = lowStockProducts
      .filter((p) => !dismissed.includes(p.id))
      .map((p) => ({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        quantity: p.moq * 5, // default restock = 5x MOQ
        unit: p.unit,
      }));
    setRestockItems(items);
    setShowRestockForm(true);
  };

  const updateRestockQty = (productId: string, quantity: number) => {
    setRestockItems((prev) =>
      prev.map((item) => item.productId === productId ? { ...item, quantity } : item)
    );
  };

  const submitRestockOrder = async () => {
    setSubmitting(true);
    try {
      const updates = restockItems.map((item) =>
        supabase
          .from('seller_products')
          .update({
            available_quantity: item.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.productId)
      );
      await Promise.all(updates);
      setSubmitted(true);
      setShowRestockForm(false);
      void load();
    } catch {
      // silently handle
    } finally {
      setSubmitting(false);
    }
  };

  const visibleProducts = lowStockProducts.filter((p) => !dismissed.includes(p.id));

  if (loading || visibleProducts.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-100/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200">
            <Icon name="ExclamationTriangleIcon" size={16} className="text-amber-700" />
          </div>
          <div>
            <p className="text-sm font-700 text-amber-800">
              {visibleProducts.length} product{visibleProducts.length === 1 ? '' : 's'} running low on stock
            </p>
            <p className="text-xs text-amber-600">Inventory at or below MOQ threshold</p>
          </div>
        </div>
        <button
          type="button"
          onClick={addAllToRestock}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-700 text-white hover:bg-amber-700 transition"
        >
          <Icon name="ArrowPathIcon" size={12} />
          Bulk Restock
        </button>
      </div>

      {/* Product List */}
      <div className="divide-y divide-amber-100">
        {visibleProducts.slice(0, 5).map((product) => {
          const available = product.availableQuantity - product.reservedQuantity;
          const isCritical = available <= 0;
          return (
            <div key={product.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-600 text-gray-900 truncate">{product.name}</p>
                  {isCritical && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-700 text-red-700">
                      OUT OF STOCK
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  SKU: {product.sku} · {product.category}
                </p>
                <p className="text-xs text-amber-700 font-600">
                  {available} {product.unit} available · MOQ: {product.moq} {product.unit}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-500">{money(product.pricePerUnit)}/{product.unit}</span>
                <button
                  type="button"
                  onClick={() => {
                    setRestockItems([{
                      productId: product.id,
                      productName: product.name,
                      sku: product.sku,
                      quantity: product.moq * 5,
                      unit: product.unit,
                    }]);
                    setShowRestockForm(true);
                  }}
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-600 text-amber-700 hover:bg-amber-50 transition"
                >
                  Restock
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed((prev) => [...prev, product.id])}
                  className="rounded-lg p-1 text-amber-400 hover:text-amber-600 hover:bg-amber-100 transition"
                  aria-label="Dismiss"
                >
                  <Icon name="XMarkIcon" size={14} />
                </button>
              </div>
            </div>
          );
        })}
        {visibleProducts.length > 5 && (
          <div className="px-5 py-2 text-xs text-amber-600 text-center">
            +{visibleProducts.length - 5} more low-stock products
          </div>
        )}
      </div>

      {/* Restock Form Modal */}
      {showRestockForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowRestockForm(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-base font-700 text-gray-900">Bulk Restock Order</h3>
                <p className="mt-0.5 text-sm text-gray-500">Adjust quantities and confirm restock</p>
              </div>
              <button type="button" onClick={() => setShowRestockForm(false)} className="rounded-lg p-1.5 hover:bg-gray-100">
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {restockItems.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-600 text-gray-900 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-500">{item.sku}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateRestockQty(item.productId, Number(e.target.value))}
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-center focus:border-[#008060] focus:outline-none"
                    />
                    <span className="text-xs text-gray-500">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void submitRestockOrder()}
                disabled={submitting}
                className="flex-1 rounded-xl bg-[#008060] py-2.5 text-sm font-700 text-white hover:bg-[#006b52] transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Icon name="CheckIcon" size={14} />
                    Confirm Restock
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowRestockForm(false)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-600 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {submitted && (
        <div className="border-t border-amber-200 bg-emerald-50 px-5 py-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <Icon name="CheckCircleIcon" size={14} />
            <p className="text-xs font-600">Restock order submitted successfully!</p>
          </div>
        </div>
      )}
    </div>
  );
}
