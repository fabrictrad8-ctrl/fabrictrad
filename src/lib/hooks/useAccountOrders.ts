'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DEMO_BULK_ORDERS } from '@/lib/demoAccounts';

export type BulkOrderItem = {
  product_name?: string | null;
  sku?: string | null;
  quantity_mtrs?: number | null;
  price_per_mtr?: number | null;
};

export type AccountBulkOrder = {
  id: string;
  buyer_id?: string | null;
  status?: string | null;
  buyer_name?: string | null;
  buyer_company?: string | null;
  buyer_email?: string | null;
  seller_id?: string | null;
  gross_total?: number | null;
  gst_total?: number | null;
  net_total?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  notes?: string | null;
  bulk_order_items?: BulkOrderItem[] | null;
};

const selectBulkOrders =
  'id,buyer_id,status,buyer_name,buyer_company,buyer_email,seller_id,gross_total,gst_total,net_total,created_at,updated_at,notes,bulk_order_items(product_name,sku,quantity_mtrs,price_per_mtr)';

export function formatMoney(value?: number | null) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export function formatOrderDate(value?: string | null) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function firstOrderItem(order: AccountBulkOrder) {
  return order.bulk_order_items?.[0];
}

export function useBuyerBulkOrders() {
  const { user, isDemoAccount } = useAuth();
  const [orders, setOrders] = useState<AccountBulkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setError(null);
    if (isDemoAccount) {
      setOrders(DEMO_BULK_ORDERS.buyer as AccountBulkOrder[]);
      setLoading(false);
      return;
    }
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from('bulk_orders')
      .select(selectBulkOrders)
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });
    if (queryError) {
      setOrders([]);
      setError(queryError.message);
    } else {
      setOrders((data || []) as AccountBulkOrder[]);
    }
    setLoading(false);
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const cancelOrder = useCallback(
    async (orderId: string) => {
      if (isDemoAccount) {
        setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status: 'cancelled' } : order));
        return;
      }
      if (!user?.id) throw new Error('Authentication required.');
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('bulk_orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('buyer_id', user.id)
        .in('status', ['draft', 'quote_sent', 'confirmed']);
      if (updateError) throw updateError;
      await loadOrders();
    },
    [isDemoAccount, loadOrders, user?.id]
  );

  return { orders, loading, error, refresh: loadOrders, cancelOrder };
}

export function useSellerBulkOrders() {
  const { user, isDemoAccount } = useAuth();
  const [orders, setOrders] = useState<AccountBulkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setError(null);
    if (isDemoAccount) {
      setOrders(DEMO_BULK_ORDERS.seller as AccountBulkOrder[]);
      setLoading(false);
      return;
    }
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: sellerProfile, error: sellerError } = await supabase
      .from('seller_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sellerError || !sellerProfile?.id) {
      setOrders([]);
      setError(sellerError?.message || 'Seller profile is not available.');
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from('bulk_orders')
      .select(selectBulkOrders)
      .eq('seller_id', sellerProfile.id)
      .order('created_at', { ascending: false });
    if (queryError) {
      setOrders([]);
      setError(queryError.message);
    } else {
      setOrders((data || []) as AccountBulkOrder[]);
    }
    setLoading(false);
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const updateOrder = useCallback(
    async (orderId: string, patch: { status?: string; notes?: string }) => {
      if (isDemoAccount) {
        setOrders((current) =>
          current.map((order) => (order.id === orderId ? { ...order, ...patch } : order))
        );
        return;
      }
      if (!user?.id) throw new Error('Authentication required.');

      const allowedPatch: { status?: string; notes?: string; updated_at: string } = {
        updated_at: new Date().toISOString(),
      };
      if (patch.status) allowedPatch.status = patch.status;
      if (patch.notes !== undefined) allowedPatch.notes = patch.notes;

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('bulk_orders')
        .update(allowedPatch)
        .eq('id', orderId);
      if (updateError) throw updateError;
      await loadOrders();
    },
    [isDemoAccount, loadOrders, user?.id]
  );

  return { orders, loading, error, refresh: loadOrders, updateOrder };
}
