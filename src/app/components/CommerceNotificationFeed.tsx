'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { RazorpayCheckout } from '@/components/RazorpayCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type NotificationRow = {
  id: string;
  audience: 'buyer' | 'seller' | 'system';
  kind: string;
  title: string;
  message: string;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export default function CommerceNotificationFeed({ mode }: { mode: 'buyer' | 'seller' }) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('commerce_notifications')
      .select('id,audience,kind,title,message,action_url,entity_type,entity_id,is_read,read_at,metadata,created_at')
      .eq('user_id', user.id)
      .eq('audience', mode)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) toast.error(error.message);
    setRows((data || []) as NotificationRow[]);
    setLoading(false);
  }, [mode, supabase, user?.id]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from('commerce_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setRows((current) => current.map((row) => row.id === id ? { ...row, is_read: true, read_at: new Date().toISOString() } : row));
    }
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('commerce_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('audience', mode)
      .eq('is_read', false);
    if (error) return toast.error(error.message);
    setRows((current) => current.map((row) => ({ ...row, is_read: true })));
  };

  const decideOrder = async (notification: NotificationRow, action: 'accept' | 'reject') => {
    if (!notification.entity_id) return;
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Reason for rejecting this order:')?.trim() || '';
      if (!reason) return;
    }
    setBusyId(notification.id);
    try {
      const { error } = await supabase.rpc('seller_decide_catalog_order', {
        p_order_id: notification.entity_id,
        p_action: action,
        p_reason: reason || null,
      });
      if (error) throw error;
      await markRead(notification.id);
      toast.success(action === 'accept' ? 'Order accepted. The buyer can pay now.' : 'Order rejected. The buyer was updated.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Order could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const unread = rows.filter((row) => !row.is_read).length;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon name="BellAlertIcon" size={18} />
            </span>
            <div>
              <h2 className="text-base font-800 text-foreground">Action centre</h2>
              <p className="text-xs text-muted-foreground">
                {mode === 'seller' ? 'New orders, payments and dispatch actions.' : 'Seller decisions, payment and delivery updates.'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && <span className="rounded-full bg-error px-2.5 py-1 text-xs font-800 text-white">{unread} new</span>}
          <button type="button" onClick={() => void load()} className="ft-icon-button !min-h-9 !min-w-9" aria-label="Refresh notifications">
            <Icon name="ArrowPathIcon" size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {unread > 0 && <button type="button" onClick={() => void markAllRead()} className="ft-secondary-action px-3 py-2 text-xs">Mark all read</button>}
        </div>
      </div>

      {loading && !rows.length ? (
        <div className="py-12 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Icon name="BellIcon" size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-800 text-foreground">No commerce notifications yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Real order and shipment events will appear here automatically.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => {
            const totalAmount = Number(row.metadata?.totalAmount || 0);
            const canSellerDecide = mode === 'seller' && row.kind === 'new_order' && Boolean(row.entity_id);
            const canBuyerPay = mode === 'buyer' && row.kind === 'order_accepted' && Boolean(row.entity_id);
            return (
              <article key={row.id} className={`p-4 sm:p-5 ${row.is_read ? '' : 'bg-primary/[0.035]'}`}>
                <div className="flex gap-3">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${row.kind === 'payment_received' || row.kind === 'order_accepted' ? 'bg-success/10 text-success' : row.kind.includes('shipment') ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
                    <Icon name={row.kind.includes('shipment') ? 'TruckIcon' : row.kind === 'payment_received' ? 'BanknotesIcon' : 'ShoppingBagIcon'} size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-800 text-foreground">{row.title}</p>
                      {!row.is_read && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleString('en-IN')}</p>

                    {canSellerDecide && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={busyId === row.id} onClick={() => void decideOrder(row, 'accept')} className="rounded-xl bg-success px-4 py-2 text-xs font-800 text-white disabled:opacity-50">
                          <Icon name="CheckIcon" size={13} className="mr-1 inline" /> Accept order
                        </button>
                        <button type="button" disabled={busyId === row.id} onClick={() => void decideOrder(row, 'reject')} className="rounded-xl border border-error/20 bg-error/5 px-4 py-2 text-xs font-800 text-error disabled:opacity-50">
                          Reject
                        </button>
                      </div>
                    )}

                    {canBuyerPay && (
                      <div className="mt-3 max-w-md">
                        <RazorpayCheckout
                          amount={totalAmount}
                          orderId={row.entity_id || undefined}
                          orderType="catalog"
                          buttonText="Pay accepted order"
                          onSuccess={() => {
                            void markRead(row.id);
                            window.setTimeout(() => void load(), 900);
                          }}
                          onError={(error) => toast.error(error.message)}
                        />
                      </div>
                    )}

                    {!canSellerDecide && !canBuyerPay && row.action_url && (
                      <Link href={row.action_url} onClick={() => void markRead(row.id)} className="mt-3 inline-flex items-center gap-1 text-xs font-800 text-primary">
                        {row.kind === 'payment_received' ? 'Open order and ship' : row.kind.includes('shipment') ? 'View tracking' : 'Open order'}
                        <Icon name="ArrowRightIcon" size={12} />
                      </Link>
                    )}
                  </div>
                  {!row.is_read && (
                    <button type="button" onClick={() => void markRead(row.id)} className="h-8 shrink-0 rounded-lg px-2 text-[11px] font-800 text-muted-foreground hover:bg-muted">Read</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
