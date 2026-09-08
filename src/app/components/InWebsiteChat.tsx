'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: 'buyer' | 'seller' | 'system';
  message_text: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: 'image' | 'document' | 'pdf' | 'video' | null;
  is_read: boolean;
  created_at: string;
};

type ContextType = 'product_inquiry' | 'requirement_response' | 'post_purchase';

interface InWebsiteChatProps {
  contextType: ContextType;
  contextId: string;
  contextTitle: string;
  otherPartyName: string;
  otherPartyAvatar: string;
  currentUserRole: 'buyer' | 'seller';
  onClose: () => void;
  /** Buyer's user_profiles id (= auth uid). Required when currentUserRole is 'seller'. */
  buyerUserId?: string;
  /** Seller's user_profiles id (= auth uid). Provide when already known. */
  sellerUserId?: string;
  /** seller_profiles.id — resolved to the seller's user id via a server RPC when sellerUserId isn't already known. */
  sellerProfileId?: string;
  /** An already-known thread id (e.g. from an inbox list), skipping the find-or-create lookup. */
  threadId?: string;
}

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function containsContactInfo(text: string): boolean {
  const digitsOnly = text.replace(/[^0-9]/g, '');
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const whatsappRegex = /whatsapp|wa\.me|telegram|t\.me/i;
  return digitsOnly.length >= 10 || emailRegex.test(text) || whatsappRegex.test(text);
}

function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
}

export default function InWebsiteChat({
  contextType,
  contextId,
  contextTitle,
  otherPartyName,
  otherPartyAvatar,
  currentUserRole,
  onClose,
  buyerUserId,
  sellerUserId,
  sellerProfileId,
  threadId: initialThreadId,
}: InWebsiteChatProps) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId || null);
  const [initializing, setInitializing] = useState(!initialThreadId);
  const [initError, setInitError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [blockedWarning, setBlockedWarning] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signedUrlCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Resolve or create the thread this conversation belongs to.
  useEffect(() => {
    let cancelled = false;
    if (initialThreadId || !user?.id) {
      if (!user?.id) setInitializing(false);
      return;
    }

    async function resolve() {
      setInitializing(true);
      setInitError('');
      try {
        const resolvedBuyerId = currentUserRole === 'buyer' ? user!.id : buyerUserId;
        let resolvedSellerId = currentUserRole === 'seller' ? user!.id : sellerUserId;

        if (!resolvedSellerId && sellerProfileId) {
          const { data, error } = await supabase.rpc('seller_user_id_for_chat', {
            p_seller_id: sellerProfileId,
          });
          if (error) throw error;
          resolvedSellerId = data || undefined;
        }

        if (!resolvedBuyerId || !resolvedSellerId) {
          throw new Error('This conversation could not be started — the other party could not be identified.');
        }

        const { data: existing, error: findError } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('context_type', contextType)
          .eq('context_id', contextId)
          .eq('buyer_id', resolvedBuyerId)
          .eq('seller_id', resolvedSellerId)
          .maybeSingle();
        if (findError) throw findError;

        let id = existing?.id as string | undefined;
        if (!id) {
          const { data: created, error: createError } = await supabase
            .from('chat_threads')
            .insert({
              context_type: contextType,
              context_id: contextId,
              context_title: contextTitle,
              buyer_id: resolvedBuyerId,
              seller_id: resolvedSellerId,
            })
            .select('id')
            .single();
          if (createError) {
            // Another tab/request may have created it concurrently — re-fetch.
            const { data: retry } = await supabase
              .from('chat_threads')
              .select('id')
              .eq('context_type', contextType)
              .eq('context_id', contextId)
              .eq('buyer_id', resolvedBuyerId)
              .eq('seller_id', resolvedSellerId)
              .maybeSingle();
            if (!retry?.id) throw createError;
            id = retry.id;
          } else {
            id = created.id;
          }
        }
        if (!cancelled) setThreadId(id || null);
      } catch (error) {
        if (!cancelled) setInitError(error instanceof Error ? error.message : 'Chat could not be started.');
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [initialThreadId, user?.id, currentUserRole, buyerUserId, sellerUserId, sellerProfileId, contextType, contextId, contextTitle, supabase]);

  const loadMessages = useCallback(async () => {
    if (!threadId) return;
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id,thread_id,sender_id,sender_role,message_text,file_url,file_name,file_type,is_read,created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages((data || []) as ChatMessage[]);
  }, [threadId, supabase]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Realtime sync + mark unread messages from the other party as read.
  useEffect(() => {
    if (!threadId || !user?.id) return;
    const channel = supabase
      .channel(`chat-thread-${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((current) => (current.some((item) => item.id === row.id) ? current : [...current, row]));
          if (row.sender_id !== user.id) {
            void supabase.from('chat_messages').update({ is_read: true }).eq('id', row.id);
          }
        }
      )
      .subscribe();

    supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('thread_id', threadId)
      .neq('sender_id', user.id)
      .eq('is_read', false)
      .then(() => {
        const unreadColumn = currentUserRole === 'buyer' ? 'buyer_unread' : 'seller_unread';
        void supabase.from('chat_threads').update({ [unreadColumn]: 0 }).eq('id', threadId);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, user?.id, currentUserRole, supabase]);

  const openAttachment = async (message: ChatMessage) => {
    if (!message.file_url) return;
    const cached = signedUrlCache.current.get(message.file_url);
    if (cached) {
      window.open(cached, '_blank', 'noopener,noreferrer');
      return;
    }
    const { data, error } = await supabase.storage.from('chat-attachments').createSignedUrl(message.file_url, 600);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || 'Attachment could not be opened.');
      return;
    }
    signedUrlCache.current.set(message.file_url, data.signedUrl);
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Attach a JPG, PNG, WebP image or a PDF.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Attachments must be 25 MB or smaller.');
      return;
    }
    setAttachedFile(file);
  };

  const handleSend = async () => {
    if (!threadId || !user?.id) return;
    if (!inputText.trim() && !attachedFile) return;
    if (inputText.trim() && containsContactInfo(inputText)) {
      setBlockedWarning(true);
      setTimeout(() => setBlockedWarning(false), 4000);
      return;
    }

    setIsSending(true);
    try {
      let filePath: string | null = null;
      let fileType: 'image' | 'document' | 'pdf' | null = null;
      if (attachedFile) {
        filePath = `${threadId}/${window.crypto.randomUUID()}.${fileExtension(attachedFile.name)}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, attachedFile, { contentType: attachedFile.type, cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        fileType = attachedFile.type === 'application/pdf' ? 'pdf' : 'image';
      }

      const { data: inserted, error } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          sender_role: currentUserRole,
          message_text: inputText.trim() || null,
          file_url: filePath,
          file_name: attachedFile?.name || null,
          file_type: fileType,
        })
        .select('id,thread_id,sender_id,sender_role,message_text,file_url,file_name,file_type,is_read,created_at')
        .single();
      if (error) throw error;

      setMessages((current) => (current.some((item) => item.id === inserted.id) ? current : [...current, inserted as ChatMessage]));
      setInputText('');
      setAttachedFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('CONTACT_INFO_BLOCKED')) {
        setBlockedWarning(true);
        setTimeout(() => setBlockedWarning(false), 4000);
      } else {
        toast.error(message || 'Message could not be sent.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-border bg-card"
      style={{ width: 360, maxHeight: isMinimized ? 56 : 520 }}
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-secondary to-primary text-white shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 shrink-0 flex items-center justify-center">
          {otherPartyAvatar ? (
            <AppImage src={otherPartyAvatar} alt={`${otherPartyName} profile photo`} width={32} height={32} className="object-cover" />
          ) : (
            <span className="text-xs font-800 text-white">{otherPartyName[0]?.toUpperCase() || 'U'}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-700 truncate">{otherPartyName}</p>
          <p className="text-xs opacity-75 truncate">{contextTitle}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized((m) => !m)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <Icon name={isMinimized ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-white" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <Icon name="XMarkIcon" size={14} className="text-white" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border-b border-success/20">
            <Icon name="ShieldCheckIcon" size={11} className="text-success shrink-0" />
            <p className="text-xs text-success font-600">Secure chat · No contact info sharing</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/20" style={{ minHeight: 0 }}>
            {initializing ? (
              <div className="flex h-full items-center justify-center py-10">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : initError ? (
              <p className="py-8 text-center text-xs text-error">{initError}</p>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Say hello — messages stay inside FabricTrad and are visible to both of you.
              </p>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`flex flex-col gap-1 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-2xl px-3 py-2 text-sm ${isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-card border border-border text-foreground rounded-tl-sm'}`}>
                        {msg.message_text && <p className="leading-relaxed whitespace-pre-line break-words">{msg.message_text}</p>}
                        {msg.file_name && (
                          <button
                            type="button"
                            onClick={() => void openAttachment(msg)}
                            className={`flex items-center gap-2 mt-1 p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-muted'}`}
                          >
                            <Icon name={msg.file_type === 'image' ? 'PhotoIcon' : 'DocumentIcon'} size={14} className={isMe ? 'text-white' : 'text-muted-foreground'} />
                            <span className={`text-xs truncate max-w-[140px] ${isMe ? 'text-white' : 'text-foreground'}`}>{msg.file_name}</span>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground px-1">
                        {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {blockedWarning && (
            <div className="mx-3 mb-2 p-2 bg-error/10 border border-error/20 rounded-xl flex items-center gap-2">
              <Icon name="ShieldExclamationIcon" size={14} className="text-error shrink-0" />
              <p className="text-xs text-error">Phone numbers, emails, and external contact details are not allowed in this chat.</p>
            </div>
          )}

          {attachedFile && (
            <div className="mx-3 mb-1 flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Icon name={attachedFile.type === 'application/pdf' ? 'DocumentIcon' : 'PhotoIcon'} size={14} className="text-primary" />
              </div>
              <span className="text-xs text-primary font-600 flex-1 truncate">{attachedFile.name}</span>
              <button onClick={() => setAttachedFile(null)} className="p-0.5">
                <Icon name="XMarkIcon" size={13} className="text-muted-foreground" />
              </button>
            </div>
          )}

          <div className="p-3 border-t border-border bg-card shrink-0">
            <div className="flex items-end gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!threadId}
                className="p-2 hover:bg-muted rounded-xl transition-colors shrink-0 disabled:opacity-50"
                title="Attach file or image"
              >
                <Icon name="PaperClipIcon" size={16} className="text-muted-foreground" />
              </button>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!threadId}
                placeholder="Type a message... (no contact info)"
                rows={1}
                className="flex-1 px-3 py-2 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none disabled:opacity-50"
                style={{ maxHeight: 80 }}
              />
              <button
                onClick={() => void handleSend()}
                disabled={!threadId || isSending || (!inputText.trim() && !attachedFile)}
                className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
              >
                {isSending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                ) : (
                  <Icon name="PaperAirplaneIcon" size={16} className="text-white" />
                )}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} className="hidden" />
          </div>
        </>
      )}
    </div>
  );
}
