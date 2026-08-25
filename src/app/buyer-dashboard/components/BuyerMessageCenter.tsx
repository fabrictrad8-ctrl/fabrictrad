'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: 'buyer' | 'seller';
  body: string;
  created_at: string;
  read_at: string | null;
}

interface Thread {
  id: string;
  thread_number: number;
  buyer_id: string;
  seller_id: string;
  subject: string;
  last_message: string;
  last_at: string;
  unread_buyer: number;
  unread_seller: number;
  buyer_name: string;
  seller_name: string;
  status: 'open' | 'closed';
}

interface BuyerMessageCenterProps {
  mode?: 'buyer' | 'seller';
}

export default function BuyerMessageCenter({ mode = 'buyer' }: BuyerMessageCenterProps) {
  const { user, profile } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newSellerSearch, setNewSellerSearch] = useState('');
  const [sellerResults, setSellerResults] = useState<Array<{ id: string; display_name: string; user_id: string }>>([]);
  const [selectedSeller, setSelectedSeller] = useState<{ id: string; display_name: string; user_id: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('message_threads')
      .select('id,thread_number,buyer_id,seller_id,subject,last_message,last_at,unread_buyer,unread_seller,buyer_name,seller_name,status')
      .eq(mode === 'buyer' ? 'buyer_id' : 'seller_id', user.id)
      .order('last_at', { ascending: false });
    if (!error && data) setThreads(data as Thread[]);
    setLoading(false);
  }, [user?.id, mode]);

  useEffect(() => { void loadThreads(); }, [loadThreads]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-${mode}-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_threads', filter: `${mode === 'buyer' ? 'buyer_id' : 'seller_id'}=eq.${user.id}` }, () => { void loadThreads(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${activeThread?.id}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, activeThread?.id, mode, loadThreads]);

  const openThread = async (thread: Thread) => {
    setActiveThread(thread);
    const supabase = createClient();
    const { data } = await supabase
      .from('messages')
      .select('id,thread_id,sender_id,sender_role,body,created_at,read_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });
    setMessages((data || []) as Message[]);
    const unreadField = mode === 'buyer' ? 'unread_buyer' : 'unread_seller';
    await supabase.from('message_threads').update({ [unreadField]: 0 }).eq('id', thread.id);
    setThreads((prev) => prev.map((t) => t.id === thread.id ? { ...t, [unreadField]: 0 } : t));
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeThread || !user?.id) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.from('messages').insert({
      thread_id: activeThread.id,
      sender_id: user.id,
      sender_role: mode,
      body: newMessage.trim(),
    });
    if (error) { toast.error('Could not send message.'); } else {
      const body = newMessage.trim();
      setNewMessage('');
      const unreadField = mode === 'buyer' ? 'unread_seller' : 'unread_buyer';
      await supabase.from('message_threads').update({ last_message: body, last_at: new Date().toISOString(), [unreadField]: (activeThread.unread_seller || 0) + 1 }).eq('id', activeThread.id);
    }
    setSending(false);
  };

  const searchSellers = async (query: string) => {
    if (query.length < 2) { setSellerResults([]); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from('seller_profiles')
      .select('id,display_name,user_id')
      .ilike('display_name', `%${query}%`)
      .eq('is_active', true)
      .limit(5);
    setSellerResults((data || []) as Array<{ id: string; display_name: string; user_id: string }>);
  };

  const startNewThread = async () => {
    if (!selectedSeller || !newSubject.trim() || !user?.id) return;
    setSending(true);
    const supabase = createClient();
    const buyerName = profile?.full_name || profile?.business_name || user.email?.split('@')[0] || 'Buyer';
    const { data, error } = await supabase.from('message_threads').insert({
      buyer_id: user.id,
      seller_id: selectedSeller.user_id,
      subject: newSubject.trim(),
      buyer_name: buyerName,
      seller_name: selectedSeller.display_name,
      last_message: '',
      status: 'open',
      unread_buyer: 0,
      unread_seller: 0,
    }).select().single();
    if (error) { toast.error('Could not start conversation.'); setSending(false); return; }
    setShowNewThread(false);
    setNewSubject('');
    setSelectedSeller(null);
    setNewSellerSearch('');
    await loadThreads();
    if (data) void openThread(data as Thread);
    setSending(false);
  };

  const totalUnread = threads.reduce((sum, t) => sum + (mode === 'buyer' ? (t.unread_buyer || 0) : (t.unread_seller || 0)), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-800 text-foreground">Message Center</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Numbered conversations with {mode === 'buyer' ? 'sellers' : 'buyers'}</p>
        </div>
        <div className="flex items-center gap-2">
          {totalUnread > 0 && <span className="bg-primary text-white text-xs font-700 px-2.5 py-1 rounded-full">{totalUnread} unread</span>}
          {mode === 'buyer' && (
            <button onClick={() => setShowNewThread(true)} className="flex items-center gap-1.5 btn-primary px-3 py-2 text-xs rounded-xl min-h-[36px]">
              <Icon name="PlusIcon" size={14} />New Message
            </button>
          )}
        </div>
      </div>

      {showNewThread && mode === 'buyer' && (
        <div className="mb-5 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-800 text-foreground mb-3">Start a new conversation</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-600 text-muted-foreground block mb-1.5">Search Seller</label>
              <input type="text" value={newSellerSearch} onChange={(e) => { setNewSellerSearch(e.target.value); void searchSellers(e.target.value); }} placeholder="Type seller name..." className="input-base w-full px-3 py-2.5 text-sm rounded-xl" />
              {sellerResults.length > 0 && (
                <div className="mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                  {sellerResults.map((s) => (
                    <button key={s.id} onClick={() => { setSelectedSeller(s); setNewSellerSearch(s.display_name); setSellerResults([]); }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors">
                      {s.display_name}
                    </button>
                  ))}
                </div>
              )}
              {selectedSeller && <p className="mt-1 text-xs text-success">✓ {selectedSeller.display_name} selected</p>}
            </div>
            <div>
              <label className="text-xs font-600 text-muted-foreground block mb-1.5">Subject</label>
              <input type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g. Inquiry about cotton fabric MOQ" maxLength={100} className="input-base w-full px-3 py-2.5 text-sm rounded-xl" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => void startNewThread()} disabled={!selectedSeller || !newSubject.trim() || sending} className="btn-primary px-4 py-2 text-xs rounded-xl disabled:opacity-50 min-h-[36px]">Start Conversation</button>
              <button onClick={() => { setShowNewThread(false); setSelectedSeller(null); setNewSellerSearch(''); setNewSubject(''); }} className="btn-secondary px-4 py-2 text-xs rounded-xl min-h-[36px]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {loading ? (
            <div className="py-10 text-center"><span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : threads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center">
              <Icon name="ChatBubbleLeftRightIcon" size={32} className="mx-auto mb-3 opacity-40" />
              <p className="font-700 text-foreground">No conversations yet</p>
              {mode === 'buyer' && <p className="mt-1 text-xs text-muted-foreground">Start a conversation with a seller using the button above.</p>}
            </div>
          ) : (
            threads.map((thread) => {
              const unread = mode === 'buyer' ? thread.unread_buyer : thread.unread_seller;
              return (
                <button key={thread.id} onClick={() => void openThread(thread)} className={`w-full text-left bg-card border rounded-2xl p-4 hover:border-primary/30 transition-all ${activeThread?.id === thread.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-800 text-primary">
                      #{thread.thread_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-700 text-foreground truncate ${unread > 0 ? 'font-800' : ''}`}>{mode === 'buyer' ? thread.seller_name : thread.buyer_name}</p>
                        <span className="text-xs text-muted-foreground shrink-0">{thread.last_at ? new Date(thread.last_at).toLocaleDateString('en-IN') : ''}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{thread.subject}</p>
                      <p className={`text-xs mt-1 truncate ${unread > 0 ? 'text-foreground font-600' : 'text-muted-foreground'}`}>{thread.last_message || 'No messages yet'}</p>
                      {unread > 0 && <span className="mt-1.5 inline-block bg-primary text-white text-[10px] font-700 px-1.5 py-0.5 rounded-full">{unread} new</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {activeThread ? (
          <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden" style={{ minHeight: '400px', maxHeight: '600px' }}>
            <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-muted/30">
              <div>
                <p className="text-sm font-800 text-foreground">#{activeThread.thread_number} · {mode === 'buyer' ? activeThread.seller_name : activeThread.buyer_name}</p>
                <p className="text-xs text-muted-foreground">{activeThread.subject}</p>
              </div>
              <button onClick={() => setActiveThread(null)} className="text-muted-foreground hover:text-foreground min-w-[32px] min-h-[32px] flex items-center justify-center">
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No messages yet. Start the conversation!</div>
              )}
              {messages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${isMine ? 'bg-primary text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
                      <p className="leading-relaxed">{msg.body}</p>
                      <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-muted-foreground'}`}>{new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="border-t border-border p-3 flex gap-2">
              <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} placeholder="Type a message..." className="input-base flex-1 px-3 py-2 text-sm rounded-xl" disabled={sending} />
              <button onClick={() => void sendMessage()} disabled={sending || !newMessage.trim()} className="btn-primary px-4 py-2 text-xs rounded-xl disabled:opacity-50 min-h-[40px] min-w-[40px] flex items-center justify-center">
                {sending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name="PaperAirplaneIcon" size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card flex items-center justify-center" style={{ minHeight: '300px' }}>
            <div className="text-center">
              <Icon name="ChatBubbleLeftRightIcon" size={32} className="mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-700 text-foreground">Select a conversation</p>
              <p className="mt-1 text-xs text-muted-foreground">Click a thread to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
