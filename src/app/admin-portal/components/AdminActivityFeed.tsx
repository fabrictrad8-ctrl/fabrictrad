'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface Activity {
  id: string;
  createdAt: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  meta: string;
}

function relativeTime(value: string) {
  const difference = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const [ordersResult, paymentsResult, productsResult, registrationsResult] = await Promise.all([
      supabase
        .from('bulk_orders')
        .select('id,status,buyer_company,buyer_name,net_total,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('bulk_order_payments')
        .select('id,status,amount,razorpay_payment_id,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('seller_products')
        .select('id,name,sku,status,available_quantity,updated_at,created_at')
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('seller_registrations')
        .select('id,business_name,registration_status,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(50),
    ]);

    const firstError = [
      ordersResult.error,
      paymentsResult.error,
      productsResult.error,
      registrationsResult.error,
    ].find(Boolean);
    if (firstError) {
      setError(firstError.message);
      setActivities([]);
      setLoading(false);
      return;
    }

    const orderActivities: Activity[] = (ordersResult.data || []).map((order) => ({
      id: `order-${order.id}-${order.updated_at}`,
      createdAt: order.updated_at || order.created_at,
      icon: 'ShoppingBagIcon',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      title: `Order ${String(order.status || 'draft').replaceAll('_', ' ')}`,
      desc: `${order.buyer_company || order.buyer_name || 'Buyer'} · ₹${Number(order.net_total || 0).toLocaleString('en-IN')}`,
      meta: `FT-BULK-${String(order.id).slice(0, 8).toUpperCase()}`,
    }));

    const paymentActivities: Activity[] = (paymentsResult.data || []).map((payment) => ({
      id: `payment-${payment.id}-${payment.updated_at}`,
      createdAt: payment.updated_at || payment.created_at,
      icon: 'CreditCardIcon',
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
      title: `Payment ${String(payment.status || 'created').replaceAll('_', ' ')}`,
      desc: `₹${Number(payment.amount || 0).toLocaleString('en-IN')} payment record updated`,
      meta: payment.razorpay_payment_id || String(payment.id),
    }));

    const productActivities: Activity[] = (productsResult.data || []).map((product) => ({
      id: `product-${product.id}-${product.updated_at}`,
      createdAt: product.updated_at || product.created_at,
      icon: 'SwatchIcon',
      iconBg: 'bg-secondary/10',
      iconColor: 'text-secondary',
      title: `Listing ${product.status}`,
      desc: `${product.name} · ${Number(product.available_quantity || 0).toLocaleString('en-IN')} available`,
      meta: product.sku || String(product.id),
    }));

    const registrationActivities: Activity[] = (registrationsResult.data || []).map(
      (registration) => ({
        id: `registration-${registration.id}-${registration.updated_at}`,
        createdAt: registration.updated_at || registration.created_at,
        icon: 'BuildingStorefrontIcon',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-700',
        title: `Seller registration ${String(registration.registration_status).replaceAll('_', ' ')}`,
        desc: registration.business_name || 'Seller application',
        meta: String(registration.id),
      })
    );

    setActivities(
      [...orderActivities, ...paymentActivities, ...productActivities, ...registrationActivities]
        .filter((activity) => activity.createdAt)
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        )
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const visibleActivities = useMemo(
    () => activities.slice(0, visibleCount),
    [activities, visibleCount]
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-800 text-foreground">Activity Feed</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Recent production events from orders, payments, listings, and seller reviews.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadActivities()}
          disabled={loading}
          className="btn-secondary flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-60"
        >
          <Icon name="ArrowPathIcon" size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Icon name="ArrowPathIcon" size={30} className="mx-auto animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading recent activity…</p>
          </div>
        )}
        {!loading && activities.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Icon name="BoltIcon" size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-800 text-foreground">No activity records yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              New orders, payments, product listings, and seller applications will appear here.
            </p>
          </div>
        )}
        {!loading &&
          visibleActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${activity.iconBg}`}
              >
                <Icon name={activity.icon} size={18} className={activity.iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-700 capitalize text-foreground">{activity.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(activity.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground">{activity.desc}</p>
                <p className="mt-1 truncate font-mono text-xs leading-relaxed text-muted-foreground">
                  {activity.meta}
                </p>
              </div>
            </div>
          ))}
      </div>

      {visibleCount < activities.length && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => Math.min(count + 20, activities.length))}
            className="btn-secondary rounded-xl px-6 py-2.5 text-sm"
          >
            Load More Activity
          </button>
        </div>
      )}
    </div>
  );
}
