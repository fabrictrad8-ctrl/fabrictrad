'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { focusTarget, withFocus } from '@/lib/focusTarget';

export type NotificationAudience = 'buyer' | 'seller' | 'admin';

type Notification = {
  id: string;
  kind: string;
  title: string;
  message: string;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
};

/** Icon and tone per kind, so the list is scannable without reading every line. */
const TONE: Record<string, { icon: string; tone: string }> = {
  new_order: { icon: 'ShoppingBagIcon', tone: 'text-primary' },
  payment_received: { icon: 'BanknotesIcon', tone: 'text-success' },
  order_accepted: { icon: 'CheckCircleIcon', tone: 'text-success' },
  order_rejected: { icon: 'XCircleIcon', tone: 'text-error' },
  shipment_created: { icon: 'TruckIcon', tone: 'text-primary' },
  invoice_issued: { icon: 'DocumentTextIcon', tone: 'text-muted-foreground' },
  dispute_opened: { icon: 'FlagIcon', tone: 'text-error' },
  message: { icon: 'ChatBubbleLeftRightIcon', tone: 'text-primary' },
};

const since = (iso: string) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/**
 * Every notification already stores an action_url and the entity it concerns,
 * but nothing read them: the bell simply jumped to the notifications tab and
 * left the reader to find the order it was about. This turns each row into the
 * thing it describes -- the right tab, then the row itself, scrolled to and
 * flashed, so the action is in front of them rather than somewhere on the page.
 */
const destinationFor = (n: Notification) => {
  if (!n.action_url) return null;
  const focus = n.entity_id ? `${n.entity_type || 'entity'}-${n.entity_id}` : undefined;
  return withFocus(n.action_url, focus);
};

export default function NotificationPane({
  audience,
  open,
  onClose,
  onCountChange,
  onSeeAll,
}: {
  audience: NotificationAudience;
  open: boolean;
  onClose: () => void;
  onCountChange?: (unread: number) => void;
  /** Optional link to the full workspace notifications tab. */
  onSeeAll?: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('commerce_notifications')
      .select('id,kind,title,message,action_url,entity_type,entity_id,is_read,created_at')
      .eq('user_id', user.id)
      .eq('audience', audience)
      .order('created_at', { ascending: false })
      .limit(20);
    setItems((data as Notification[]) || []);
    setLoading(false);
    onCountChange?.(((data as Notification[]) || []).filter((n) => !n.is_read).length);
  }, [audience, onCountChange, supabase, user?.id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Close on outside click and on Escape, the two ways anyone expects a tray to
  // go away.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (paneRef.current && !paneRef.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (!ids.length || !user?.id) return;
      await supabase
        .from('commerce_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', ids)
        .eq('user_id', user.id);
    },
    [supabase, user?.id]
  );

  const openNotification = async (n: Notification) => {
    const href = destinationFor(n);
    if (!n.is_read) {
      // Optimistic: the row should stop looking unread the instant it is opened,
      // not after a round trip.
      setItems((current) => current.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      onCountChange?.(items.filter((x) => !x.is_read && x.id !== n.id).length);
      void markRead([n.id]);
    }
    onClose();
    if (!href) return;
    router.push(href);
    // The destination usually renders after the navigation, so focusTarget hunts
    // for it rather than assuming it is already there.
    const focus = n.entity_id ? `${n.entity_type || 'entity'}-${n.entity_id}` : null;
    if (focus) window.setTimeout(() => void focusTarget(focus), 250);
  };

  const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id);

  if (!open) return null;

  return (
    <div
      ref={paneRef}
      role="dialog"
      aria-label={`${audience} notifications`}
      className="ft-notification-pane absolute right-0 top-12 z-50 w-[min(380px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-800 text-foreground">Notifications</p>
          <p className="text-xs text-muted-foreground">
            {unreadIds.length ? `${unreadIds.length} unread` : 'You are up to date'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {unreadIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setItems((current) => current.map((x) => ({ ...x, is_read: true })));
                onCountChange?.(0);
                void markRead(unreadIds);
              }}
              className="rounded-lg px-2 py-2 text-xs font-700 text-primary hover:bg-muted"
            >
              Mark all read
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Close notifications">
            <Icon name="XMarkIcon" size={16} />
          </button>
        </div>
      </div>

      <div className="max-h-[min(420px,60vh)] overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-10">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Icon name="BellIcon" size={28} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-800 text-foreground">Nothing yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Orders, payments and messages will appear here as they happen.
            </p>
          </div>
        ) : (
          items.map((n) => {
            const tone = TONE[n.kind] || { icon: 'BellIcon', tone: 'text-muted-foreground' };
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => void openNotification(n)}
                className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-muted/60 ${n.is_read ? '' : 'bg-primary/5'}`}
              >
                <span className={`mt-0.5 shrink-0 ${tone.tone}`}>
                  <Icon name={tone.icon} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`truncate text-sm ${n.is_read ? 'font-700 text-foreground' : 'font-800 text-foreground'}`}>
                      {n.title}
                    </span>
                    {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{n.message}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{since(n.created_at)}</span>
                </span>
                {destinationFor(n) && (
                  <span className="mt-1 shrink-0 text-muted-foreground">
                    <Icon name="ChevronRightIcon" size={15} />
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {onSeeAll && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onSeeAll();
          }}
          className="w-full border-t border-border px-4 py-3 text-center text-xs font-800 text-primary hover:bg-muted"
        >
          See all notifications
        </button>
      )}
    </div>
  );
}
