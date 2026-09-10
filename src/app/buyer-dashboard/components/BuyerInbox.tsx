'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import InWebsiteChat from '@/app/components/InWebsiteChat';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface InboxThread {
  id: string;
  context_type: 'product_inquiry' | 'requirement_response' | 'post_purchase';
  context_title: string;
  otherPartyId: string;
  otherPartyName: string;
  otherPartyAvatar: string;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
}

const typeConfig: Record<string, { label: string; color: string; icon: string }> = {
  product_inquiry: { label: 'Product Inquiry', color: 'inline-flex rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-800', icon: 'ShoppingBagIcon' },
  requirement_response: { label: 'Requirement', color: 'inline-flex rounded-full bg-warning/10 text-warning px-2.5 py-1 text-[11px] font-800', icon: 'MegaphoneIcon' },
  post_purchase: { label: 'Post-Purchase', color: 'inline-flex rounded-full bg-success/10 text-success px-2.5 py-1 text-[11px] font-800', icon: 'CheckCircleIcon' },
};

function relativeTime(value: string | null) {
  if (!value) return '';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function BuyerInbox() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<InboxThread | null>(null);
  const [filter, setFilter] = useState<'all' | InboxThread['context_type']>('all');

  const load = useCallback(async () => {
    if (!user?.id) {
      setThreads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('my_chat_threads');
    if (error) {
      toast.error(error.message);
      setThreads([]);
      setLoading(false);
      return;
    }
    setThreads(
      ((data || []) as any[])
        .filter((row) => row.role === 'buyer')
        .map((row) => ({
          id: row.id,
          context_type: row.context_type,
          context_title: row.context_title,
          otherPartyId: row.other_party_id,
          otherPartyName: row.other_party_name,
          otherPartyAvatar: row.other_party_avatar,
          lastMessage: row.last_message,
          lastAt: row.last_message_at,
          unread: Number(row.unread || 0),
        }))
    );
    setLoading(false);
  }, [user?.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`buyer-inbox-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads', filter: `buyer_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, supabase, load]);

  const filtered = threads.filter((t) => filter === 'all' || t.context_type === filter);
  const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-800 text-foreground">Inbox</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conversations you started with sellers — product questions, requirement replies, post-purchase support.
          </p>
        </div>
        {totalUnread > 0 && (
          <span className="bg-primary text-primary-foreground text-xs font-700 px-2.5 py-1 rounded-full">{totalUnread} unread</span>
        )}
      </div>

      <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/20 rounded-xl mb-5">
        <Icon name="ShieldCheckIcon" size={14} className="text-success mt-0.5 shrink-0" />
        <p className="text-xs text-success"><span className="font-700">Secure messaging:</span> conversations stay inside FabricTrad. Sharing phone numbers or emails in chat is blocked.</p>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All Messages' },
          { key: 'product_inquiry', label: 'Product Inquiries' },
          { key: 'requirement_response', label: 'Requirements' },
          { key: 'post_purchase', label: 'Post-Purchase' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-600 border transition-all ${filter === tab.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-muted-foreground">
            <Icon name="ChatBubbleLeftRightIcon" size={32} className="mx-auto mb-3 opacity-40" />
            <p className="font-700 text-foreground">No conversations yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm">Use &quot;Chat with Seller&quot; on any product page to start a conversation — it will appear here.</p>
          </div>
        )}
        {filtered.map((thread) => {
          const tc = typeConfig[thread.context_type];
          return (
            <button
              key={thread.id}
              onClick={() => setActiveThread(thread)}
              className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
                    <AppImage src={thread.otherPartyAvatar} alt={`${thread.otherPartyName} seller profile photo`} width={40} height={40} className="object-cover" />
                  </div>
                  {thread.unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs font-800 rounded-full flex items-center justify-center">{thread.unread}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className={`text-sm font-700 text-foreground ${thread.unread > 0 ? 'font-800' : ''}`}>{thread.otherPartyName}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{relativeTime(thread.lastAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{thread.context_title}</p>
                  <p className={`text-xs mt-1 truncate ${thread.unread > 0 ? 'text-foreground font-600' : 'text-muted-foreground'}`}>{thread.lastMessage || 'No messages yet'}</p>
                  <div className="mt-2"><span className={tc.color}>{tc.label}</span></div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {activeThread && (
        <InWebsiteChat
          threadId={activeThread.id}
          contextType={activeThread.context_type}
          contextId={activeThread.id}
          contextTitle={activeThread.context_title}
          otherPartyName={activeThread.otherPartyName}
          otherPartyAvatar={activeThread.otherPartyAvatar}
          currentUserRole="buyer"
          onClose={() => {
            setActiveThread(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
