'use client';
import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'seller';
  text: string;
  timestamp: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'document' | 'pdf';
  isRead: boolean;
}

interface InWebsiteChatProps {
  contextId: string;
  contextTitle: string;
  otherPartyName: string;
  otherPartyAvatar: string;
  currentUserRole: 'buyer' | 'seller';
  onClose: () => void;
}

// Simple content filter to block phone numbers and emails
function containsContactInfo(text: string): boolean {
  const phoneRegex = /(\+91|0)?[\s-]?[6-9]\d{9}|(\d[\s-]?){10}/;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const whatsappRegex = /whatsapp|wa\.me|telegram|t\.me/i;
  return phoneRegex.test(text) || emailRegex.test(text) || whatsappRegex.test(text);
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'sys-1',
    senderId: 'system',
    senderName: 'FabricTrad',
    senderRole: 'seller',
    text: "🔒 This is a secure in-website chat. For everyone's safety, phone numbers, email addresses, and external contact details are not allowed. All communication stays on FabricTrad.",
    timestamp: 'Now',
    isRead: true,
  },
];

export default function InWebsiteChat({
  contextId,
  contextTitle,
  otherPartyName,
  otherPartyAvatar,
  currentUserRole,
  onClose,
}: InWebsiteChatProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [blockedWarning, setBlockedWarning] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: 'image' | 'document' | 'pdf';
    preview?: string;
  } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const fileType: 'image' | 'document' | 'pdf' = isImage ? 'image' : isPdf ? 'pdf' : 'document';
    let preview: string | undefined;
    if (isImage) {
      preview = URL.createObjectURL(file);
    }
    setAttachedFile({ name: file.name, type: fileType, preview });
  };

  const handleSend = () => {
    if (!inputText.trim() && !attachedFile) return;

    if (inputText.trim() && containsContactInfo(inputText)) {
      setBlockedWarning(true);
      setTimeout(() => setBlockedWarning(false), 4000);
      return;
    }

    setIsSending(true);
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: user?.id || 'current-user',
      senderName:
        profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You',
      senderRole: currentUserRole,
      text: inputText,
      timestamp: now,
      fileUrl: attachedFile ? '#' : undefined,
      fileName: attachedFile?.name,
      fileType: attachedFile?.type,
      isRead: false,
    };

    setTimeout(() => {
      setMessages((prev) => [...prev, msg]);
      setInputText('');
      setAttachedFile(null);
      setIsSending(false);
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-border bg-card"
      style={{ width: 360, maxHeight: isMinimized ? 56 : 520 }}
    >
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-secondary to-primary text-white shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 shrink-0 flex items-center justify-center">
          {otherPartyAvatar ? (
            <AppImage
              src={otherPartyAvatar}
              alt={`${otherPartyName} profile photo`}
              width={32}
              height={32}
              className="object-cover"
            />
          ) : (
            <span className="text-xs font-800 text-white">
              {otherPartyName[0]?.toUpperCase() || 'U'}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-700 truncate">{otherPartyName}</p>
          <p className="text-xs opacity-75 truncate">{contextTitle}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized((m) => !m)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <Icon
              name={isMinimized ? 'ChevronUpIcon' : 'ChevronDownIcon'}
              size={14}
              className="text-white"
            />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <Icon name="XMarkIcon" size={14} className="text-white" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Privacy Notice */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border-b border-success/20">
            <Icon name="ShieldCheckIcon" size={11} className="text-success shrink-0" />
            <p className="text-xs text-success font-600">Secure chat · No contact info sharing</p>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/20"
            style={{ minHeight: 0 }}
          >
            {messages.map((msg) => {
              const isSystem = msg.senderId === 'system';
              const isMe = msg.senderRole === currentUserRole && !isSystem;

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 max-w-xs">
                      <p className="text-xs text-amber-700 text-center">{msg.text}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`flex flex-col gap-1 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {!isMe && (
                      <p className="text-xs text-muted-foreground px-1">{msg.senderName}</p>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm ${
                        isMe
                          ? 'bg-primary text-white rounded-tr-sm'
                          : 'bg-card border border-border text-foreground rounded-tl-sm'
                      }`}
                    >
                      {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                      {msg.fileName && (
                        <div
                          className={`flex items-center gap-2 mt-1 p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-muted'}`}
                        >
                          <Icon
                            name={msg.fileType === 'image' ? 'PhotoIcon' : 'DocumentIcon'}
                            size={14}
                            className={isMe ? 'text-white' : 'text-muted-foreground'}
                          />
                          <span
                            className={`text-xs truncate max-w-[140px] ${isMe ? 'text-white' : 'text-foreground'}`}
                          >
                            {msg.fileName}
                          </span>
                          <Icon
                            name="ArrowDownTrayIcon"
                            size={12}
                            className={isMe ? 'text-white/70' : 'text-muted-foreground'}
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground px-1">{msg.timestamp}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Blocked Warning */}
          {blockedWarning && (
            <div className="mx-3 mb-2 p-2 bg-error/10 border border-error/20 rounded-xl flex items-center gap-2">
              <Icon name="ShieldExclamationIcon" size={14} className="text-error shrink-0" />
              <p className="text-xs text-error">
                Phone numbers, emails, and external contact details are not allowed in this chat.
              </p>
            </div>
          )}

          {/* Attached File Preview */}
          {attachedFile && (
            <div className="mx-3 mb-1 flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-xl">
              {attachedFile.preview ? (
                <img
                  src={attachedFile.preview}
                  alt="Attached file preview"
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Icon name="DocumentIcon" size={14} className="text-primary" />
                </div>
              )}
              <span className="text-xs text-primary font-600 flex-1 truncate">
                {attachedFile.name}
              </span>
              <button onClick={() => setAttachedFile(null)} className="p-0.5">
                <Icon name="XMarkIcon" size={13} className="text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-border bg-card shrink-0">
            <div className="flex items-end gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-muted rounded-xl transition-colors shrink-0"
                title="Attach file or image"
              >
                <Icon name="PaperClipIcon" size={16} className="text-muted-foreground" />
              </button>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (no contact info)"
                rows={1}
                className="flex-1 px-3 py-2 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                style={{ maxHeight: 80 }}
              />
              <button
                onClick={handleSend}
                disabled={isSending || (!inputText.trim() && !attachedFile)}
                className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
              >
                {isSending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                ) : (
                  <Icon name="PaperAirplaneIcon" size={16} className="text-white" />
                )}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </>
      )}
    </div>
  );
}
