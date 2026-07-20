'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { CatalogProduct } from '@/lib/catalog';

export type WishlistProduct = Pick<
  CatalogProduct,
  | 'id'
  | 'source'
  | 'sellerId'
  | 'name'
  | 'seller'
  | 'city'
  | 'category'
  | 'price'
  | 'unit'
  | 'moq'
  | 'available'
  | 'gsm'
  | 'width'
  | 'work'
  | 'rating'
  | 'reviews'
  | 'badge'
  | 'verified'
  | 'image'
  | 'images'
  | 'alt'
  | 'dispatchDays'
  | 'gst'
  | 'description'
  | 'sku'
>;

const LOCAL_KEY_PREFIX = 'fabrictrad:wishlist:';
const CHANGE_EVENT = 'fabrictrad:wishlist-change';

function getLocalKey(userId?: string | null) {
  return `${LOCAL_KEY_PREFIX}${userId || 'guest'}`;
}

function readLocalWishlist(userId?: string | null): WishlistProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = window.localStorage.getItem(getLocalKey(userId));
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalWishlist(userId: string | null | undefined, items: WishlistProduct[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getLocalKey(userId), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function useWishlist() {
  const { user, isDemoAccount } = useAuth();
  const [items, setItems] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    setLoading(true);
    const localItems = readLocalWishlist(user?.id);

    if (!user?.id || isDemoAccount) {
      setItems(localItems);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('buyer_wishlist')
      .select('product_data, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setItems(localItems);
    } else {
      const dbItems = (data || [])
        .map((row) => row.product_data as WishlistProduct)
        .filter((product) => product?.id);
      setItems(dbItems);
      writeLocalWishlist(user.id, dbItems);
    }
    setLoading(false);
  }, [isDemoAccount, supabase, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sync = () => setItems(readLocalWishlist(user?.id));
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [user?.id]);

  const has = useCallback(
    (productId: string) => items.some((product) => product.id === productId),
    [items]
  );

  const remove = useCallback(
    async (productId: string) => {
      const next = items.filter((product) => product.id !== productId);
      setItems(next);
      writeLocalWishlist(user?.id, next);
      if (user?.id && !isDemoAccount) {
        await supabase
          .from('buyer_wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('product_key', productId);
      }
    },
    [isDemoAccount, items, supabase, user?.id]
  );

  const add = useCallback(
    async (product: WishlistProduct) => {
      const next = [product, ...items.filter((item) => item.id !== product.id)];
      setItems(next);
      writeLocalWishlist(user?.id, next);
      if (user?.id && !isDemoAccount) {
        const { error } = await supabase.from('buyer_wishlist').upsert(
          {
            user_id: user.id,
            product_key: product.id,
            product_data: product,
          },
          { onConflict: 'user_id,product_key' }
        );
        if (error) throw error;
      }
    },
    [isDemoAccount, items, supabase, user?.id]
  );

  const toggle = useCallback(
    async (product: WishlistProduct) => {
      if (has(product.id)) {
        await remove(product.id);
        return false;
      }
      await add(product);
      return true;
    },
    [add, has, remove]
  );

  return { items, loading, has, add, remove, toggle, refresh: load };
}
