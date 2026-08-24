'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CatalogProduct, CatalogVariant } from '@/lib/catalog';

const CART_STORAGE_KEY = 'fabrictrad:buyer-cart:v1';
const CART_EVENT = 'fabrictrad:cart-updated';

export type CartItem = {
  key: string;
  productId: string;
  rawProductId?: string | null;
  sellerId?: string | null;
  variantId?: string | null;
  variantLabel?: string | null;
  name: string;
  seller: string;
  image: string;
  price: number;
  unit: string;
  quantity: number;
  minimum: number;
  available: number;
  addedAt: string;
};

const normaliseNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readCart = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object' && item.productId && item.name)
      .map((item) => ({
        ...item,
        price: Math.max(0, normaliseNumber(item.price, 0)),
        quantity: Math.max(0.01, normaliseNumber(item.quantity, 1)),
        minimum: Math.max(0.01, normaliseNumber(item.minimum, 1)),
        available: Math.max(0, normaliseNumber(item.available, 0)),
      })) as CartItem[];
  } catch {
    return [];
  }
};

const persistCart = (items: CartItem[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
};

const cartKey = (productId: string, variantId?: string | null) =>
  `${productId}:${variantId || 'default'}`;

export function cartItemHref(item: CartItem) {
  const params = new URLSearchParams({ id: item.productId, qty: String(item.quantity) });
  if (item.variantId) params.set('variant', item.variantId);
  return `/product-detail?${params.toString()}`;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const sync = useCallback(() => setItems(readCart()), []);

  useEffect(() => {
    sync();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === CART_STORAGE_KEY) sync();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(CART_EVENT, sync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CART_EVENT, sync);
    };
  }, [sync]);

  const add = useCallback(
    (
      product: CatalogProduct,
      variant?: CatalogVariant | null,
      requestedQuantity?: number,
      unitPrice?: number
    ) => {
      const chosenVariant = variant || product.variants?.find((entry) => entry.available > 0) || null;
      const minimum = Math.max(0.01, Number(chosenVariant?.moq ?? product.moq ?? 1));
      const available = Math.max(0, Number(chosenVariant?.available ?? product.available ?? 0));
      const requested = Number(requestedQuantity ?? minimum);
      const quantity = Math.min(
        available || Number.POSITIVE_INFINITY,
        Math.max(minimum, Number.isFinite(requested) ? requested : minimum)
      );
      const key = cartKey(product.id, chosenVariant?.id);
      const nextItem: CartItem = {
        key,
        productId: product.id,
        rawProductId: product.rawProductId,
        sellerId: product.sellerId,
        variantId: chosenVariant?.id || null,
        variantLabel: chosenVariant
          ? [chosenVariant.colorName, chosenVariant.designName].filter(Boolean).join(' · ')
          : null,
        name: product.name,
        seller: product.seller,
        image: chosenVariant?.image || product.image,
        price: Math.max(0, Number(unitPrice ?? chosenVariant?.price ?? product.price ?? 0)),
        unit: chosenVariant?.unit || product.unit,
        quantity,
        minimum,
        available,
        addedAt: new Date().toISOString(),
      };

      const current = readCart();
      const existingIndex = current.findIndex((entry) => entry.key === key);
      const next = [...current];
      if (existingIndex >= 0) {
        next[existingIndex] = { ...nextItem, addedAt: current[existingIndex].addedAt };
      } else {
        next.unshift(nextItem);
      }
      persistCart(next);
      setItems(next);
      return nextItem;
    },
    []
  );

  const remove = useCallback((key: string) => {
    const next = readCart().filter((item) => item.key !== key);
    persistCart(next);
    setItems(next);
  }, []);

  const updateQuantity = useCallback((key: string, value: number) => {
    const next = readCart().map((item) => {
      if (item.key !== key) return item;
      const requested = Number.isFinite(value) ? value : item.minimum;
      const quantity = Math.min(
        item.available || Number.POSITIVE_INFINITY,
        Math.max(item.minimum, requested)
      );
      return { ...item, quantity: Number(quantity.toFixed(2)) };
    });
    persistCart(next);
    setItems(next);
  }, []);

  const clear = useCallback(() => {
    persistCart([]);
    setItems([]);
  }, []);

  const estimatedTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  return {
    items,
    lineCount: items.length,
    estimatedTotal,
    add,
    remove,
    updateQuantity,
    clear,
  };
}
