'use client';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'document' | 'pdf';
  isRead: boolean;
  isMe: boolean;
}

interface BuyerChatProps {
  contextId: string;
  contextTitle: string;
  sellerName: string;
  sellerAvatar: string;
  onClose: () => void;
}

function containsContactInfo(text: string): boolean {
  const phoneRegex = /(\+91|0)?[\s-]?[6-9]\d{9}|(\d[\s-]?){10}/;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const whatsappRegex = /whatsapp|wa\.me|telegram|t\.me/i;
  return phoneRegex.test(text) || emailRegex.test(text) || whatsappRegex.test(text);
}

const SYSTEM_MSG: ChatMessage = {
  id: 'sys-1',
  senderId: 'system',
  senderName: 'FabricTrad',
  text: '🔒 Secure buyer-seller chat. Phone numbers, emails, and external contact details are not allowed.',
  timestamp: 'Now',
  isRead: true,
  isMe: false,
};

export default function BuyerChat({
  contextId,
  contextTitle,
  sellerName,
  sellerAvatar,
  onClose,
}: BuyerChatProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([SYSTEM_MSG]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [blockedWarning, setBlockedWarning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: 'image' | 'document' | 'pdf';
    preview?: string;
  } | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Login gate
  if (!user || !profile) {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-secondary to-primary text-white">
          <div className="flex-1">
            <p className="text-xs font-700">Chat with Seller</p>
            <p className="text-xs opacity-75 truncate">{contextTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg">
            <Icon name="XMarkIcon" size={14} className="text-white" />
          </button>
        </div>
        <div className="p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Icon name="LockClosedIcon" size={22} className="text-primary" />
          </div>
          <p className="text-sm font-700 text-foreground mb-1">Sign in to Chat</p>
          <p className="text-xs text-muted-foreground mb-4">
            You need to be logged in as a buyer to chat with sellers.
          </p>
          <Link
            href="/login?role=buyer"
            className="btn-primary w-full py-2.5 text-sm rounded-xl block text-center"
          >
            Sign In as Buyer
          </Link>
        </div>
      </div>
    );
  }

  if (profile.role !== 'buyer') {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-secondary to-primary text-white">
          <div className="flex-1">
            <p className="text-xs font-700">Buyer Chat</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg">
            <Icon name="XMarkIcon" size={14} className="text-white" />
          </button>
        </div>
        <div className="p-5 text-center">
          <Icon name="InformationCircleIcon" size={24} className="text-warning mx-auto mb-2" />
          <p className="text-sm font-700 text-foreground mb-1">Buyer Chat Only</p>
          <p className="text-xs text-muted-foreground">
            This chat is for buyers. Sellers manage conversations from the Seller Dashboard → Inbox.
          </p>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const fileType: 'image' | 'document' | 'pdf' = isImage ? 'image' : isPdf ? 'pdf' : 'document';
    setAttachedFile({
      name: file.name,
      type: fileType,
      preview: isImage ? URL.createObjectURL(file) : undefined,
    });
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
      senderId: user.id,
      senderName: profile.full_name || 'Buyer',
      text: inputText,
      timestamp: now,
      fileUrl: attachedFile ? '#' : undefined,
      fileName: attachedFile?.name,
      fileType: attachedFile?.type,
      isRead: false,
      isMe: true,
    };
    setTimeout(() => {
      setMessages((prev) => [...prev, msg]);
      setInputText('');
      setAttachedFile(null);
      setIsSending(false);
      if (inputText.trim()) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: `reply-${Date.now()}`,
              senderId: 'seller',
              senderName: sellerName,
              text: 'Thank you for reaching out! I can fulfil this requirement. Let me share our catalogue and pricing details.',
              timestamp: new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              isRead: false,
              isMe: false,
            },
          ]);
        }, 1500);
      }
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
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-secondary to-primary text-white shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 shrink-0">
          <AppImage
            src={sellerAvatar}
            alt={`${sellerName} seller profile photo`}
            width={32}
            height={32}
            className="object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-700 truncate">{sellerName}</p>
          <p className="text-xs opacity-75 truncate">{contextTitle}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized((m) => !m)}
            className="p-1 hover:bg-white/20 rounded-lg"
          >
            <Icon
              name={isMinimized ? 'ChevronUpIcon' : 'ChevronDownIcon'}
              size={14}
              className="text-white"
            />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg">
            <Icon name="XMarkIcon" size={14} className="text-white" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border-b border-success/20">
            <Icon name="ShieldCheckIcon" size={11} className="text-success shrink-0" />
            <p className="text-xs text-success font-600">
              Secure buyer chat · No contact info sharing
            </p>
          </div>

          <div
            className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/20"
            style={{ minHeight: 0 }}
          >
            {messages.map((msg) => {
              if (msg.senderId === 'system') {
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
                  className={`flex gap-2 ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`flex flex-col gap-1 max-w-[75%] ${msg.isMe ? 'items-end' : 'items-start'}`}
                  >
                    {!msg.isMe && (
                      <p className="text-xs text-muted-foreground px-1">{msg.senderName}</p>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm ${msg.isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-card border border-border text-foreground rounded-tl-sm'}`}
                    >
                      {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                      {msg.fileName && (
                        <div
                          className={`flex items-center gap-2 mt-1 p-2 rounded-lg ${msg.isMe ? 'bg-white/20' : 'bg-muted'}`}
                        >
                          <Icon
                            name={msg.fileType === 'image' ? 'PhotoIcon' : 'DocumentIcon'}
                            size={14}
                            className={msg.isMe ? 'text-white' : 'text-muted-foreground'}
                          />
                          <span
                            className={`text-xs truncate max-w-[140px] ${msg.isMe ? 'text-white' : 'text-foreground'}`}
                          >
                            {msg.fileName}
                          </span>
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

          {blockedWarning && (
            <div className="mx-3 mb-2 p-2 bg-error/10 border border-error/20 rounded-xl flex items-center gap-2">
              <Icon name="ShieldExclamationIcon" size={14} className="text-error shrink-0" />
              <p className="text-xs text-error">
                Phone numbers, emails, and external contact details are not allowed.
              </p>
            </div>
          )}

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
              <button onClick={() => setAttachedFile(null)}>
                <Icon name="XMarkIcon" size={13} className="text-muted-foreground" />
              </button>
            </div>
          )}

          <div className="p-3 border-t border-border bg-card shrink-0">
            <div className="flex items-end gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-muted rounded-lg transition-colors shrink-0"
              >
                <Icon name="PaperClipIcon" size={16} className="text-muted-foreground" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 input-base px-3 py-2 text-sm rounded-xl resize-none"
                style={{ minHeight: 36, maxHeight: 80 }}
              />
              <button
                onClick={handleSend}
                disabled={isSending || (!inputText.trim() && !attachedFile)}
                className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
              >
                <Icon name="PaperAirplaneIcon" size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
