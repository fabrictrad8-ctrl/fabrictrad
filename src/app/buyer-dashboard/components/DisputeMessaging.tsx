'use client';
import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';


interface Message {
  id: string;
  sender: 'buyer' | 'seller' | 'admin';
  senderName: string;
  text: string;
  timestamp: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'document' | 'video';
  isRead: boolean;
}

interface Dispute {
  id: string;
  orderId: string;
  product: string;
  status: 'open' | 'under_review' | 'resolved' | 'escalated';
  type: 'exchange_request' | 'damage_claim' | 'quality_issue' | 'general_query';
  createdAt: string;
  unreadCount: number;
  messages: Message[];
  hasUnboxingVideo: boolean;
}

const MOCK_DISPUTES: Dispute[] = [
  {
    id: 'DSP-001',
    orderId: 'FT-ORD-004320',
    product: 'Banarasi Silk Brocade',
    status: 'open',
    type: 'exchange_request',
    createdAt: '10 Jul 2026',
    unreadCount: 2,
    hasUnboxingVideo: true,
    messages: [
      {
        id: 'm1',
        sender: 'buyer',
        senderName: 'Rajesh Mehta',
        text: 'Hello, I received the Banarasi Silk Brocade but there is a visible damage on 3 metres of the fabric. I have attached the unboxing video as proof.',
        timestamp: '10 Jul 2026, 2:30 PM',
        isRead: true,
      },
      {
        id: 'm2',
        sender: 'buyer',
        senderName: 'Rajesh Mehta',
        text: 'Unboxing video showing the damage',
        timestamp: '10 Jul 2026, 2:31 PM',
        fileUrl: '#',
        fileName: 'unboxing_video.mp4',
        fileType: 'video',
        isRead: true,
      },
      {
        id: 'm3',
        sender: 'seller',
        senderName: 'Varanasi Silk Traders',
        text: 'Thank you for reaching out. We have reviewed your unboxing video. We acknowledge the damage and will arrange an exchange for the affected 3 metres. Please confirm your shipping address.',
        timestamp: '11 Jul 2026, 10:00 AM',
        isRead: false,
      },
      {
        id: 'm4',
        sender: 'seller',
        senderName: 'Varanasi Silk Traders',
        text: 'Exchange approval document',
        timestamp: '11 Jul 2026, 10:05 AM',
        fileUrl: '#',
        fileName: 'exchange_approval.pdf',
        fileType: 'document',
        isRead: false,
      },
    ],
  },
  {
    id: 'DSP-002',
    orderId: 'FT-ORD-004489',
    product: 'Georgette Embroidered Fabric',
    status: 'under_review',
    type: 'general_query',
    createdAt: '15 Jul 2026',
    unreadCount: 0,
    hasUnboxingVideo: false,
    messages: [
      {
        id: 'm5',
        sender: 'buyer',
        senderName: 'Rajesh Mehta',
        text: 'Can you provide the exact dispatch date and AWB number for order FT-ORD-004489?',
        timestamp: '15 Jul 2026, 9:00 AM',
        isRead: true,
      },
      {
        id: 'm6',
        sender: 'seller',
        senderName: 'Jaipur Crafts Emporium',
        text: 'Your order was dispatched on 16 Jul 2026. AWB: 1234567890. Expected delivery: 19 Jul 2026.',
        timestamp: '15 Jul 2026, 11:30 AM',
        isRead: true,
      },
    ],
  },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-primary/10 text-primary border-primary/20' },
  under_review: { label: 'Under Review', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolved: { label: 'Resolved', color: 'bg-success/10 text-success border-success/20' },
  escalated: { label: 'Escalated', color: 'bg-error/10 text-error border-error/20' },
};

const typeLabels: Record<string, string> = {
  exchange_request: 'Exchange Request',
  damage_claim: 'Damage Claim',
  quality_issue: 'Quality Issue',
  general_query: 'General Query',
};

interface DisputeMessagingProps {
  mode?: 'buyer' | 'seller';
}

export default function DisputeMessaging({ mode = 'buyer' }: DisputeMessagingProps) {
  const [disputes, setDisputes] = useState<Dispute[]>(MOCK_DISPUTES);
  const [activeDisputeId, setActiveDisputeId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNewDisputeForm, setShowNewDisputeForm] = useState(false);
  const [newDisputeType, setNewDisputeType] = useState<Dispute['type']>('general_query');
  const [newDisputeOrderId, setNewDisputeOrderId] = useState('');
  const [newDisputeDesc, setNewDisputeDesc] = useState('');
  const [hasUnboxingVideo, setHasUnboxingVideo] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: 'image' | 'document' | 'video' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const activeDispute = disputes.find((d) => d.id === activeDisputeId);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeDisputeId, activeDispute?.messages.length]);

  const handleSendMessage = () => {
    if (!newMessage.trim() && !uploadedFile) return;
    if (!activeDisputeId) return;
    setIsSending(true);

    setTimeout(() => {
      const msg: Message = {
        id: `m-${Date.now()}`,
        sender: mode,
        senderName: mode === 'buyer' ? 'Rajesh Mehta' : 'Varanasi Silk Traders',
        text: newMessage,
        timestamp: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        fileUrl: uploadedFile ? '#' : undefined,
        fileName: uploadedFile?.name,
        fileType: uploadedFile?.type,
        isRead: false,
      };

      setDisputes((prev) =>
        prev.map((d) =>
          d.id === activeDisputeId
            ? { ...d, messages: [...d.messages, msg] }
            : d
        )
      );
      setNewMessage('');
      setUploadedFile(null);
      setIsSending(false);
    }, 500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile({ name: file.name, type });
    }
  };

  const handleCreateDispute = () => {
    if (!newDisputeOrderId || !newDisputeDesc) return;

    if ((newDisputeType === 'exchange_request' || newDisputeType === 'damage_claim') && !hasUnboxingVideo) {
      alert('An unboxing video is required for exchange requests and damage claims. Please upload your unboxing video to proceed.');
      return;
    }

    const newDispute: Dispute = {
      id: `DSP-${Date.now()}`,
      orderId: newDisputeOrderId,
      product: 'Order ' + newDisputeOrderId,
      status: 'open',
      type: newDisputeType,
      createdAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      unreadCount: 0,
      hasUnboxingVideo,
      messages: [
        {
          id: `m-init-${Date.now()}`,
          sender: 'buyer',
          senderName: 'Rajesh Mehta',
          text: newDisputeDesc,
          timestamp: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          isRead: false,
        },
      ],
    };

    setDisputes((prev) => [newDispute, ...prev]);
    setActiveDisputeId(newDispute.id);
    setShowNewDisputeForm(false);
    setNewDisputeOrderId('');
    setNewDisputeDesc('');
    setHasUnboxingVideo(false);
    setNewDisputeType('general_query');
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden" style={{ minHeight: 520 }}>
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-secondary/5 to-primary/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
            <Icon name="ChatBubbleLeftRightIcon" size={16} className="text-secondary" />
          </div>
          <div>
            <h3 className="font-700 text-sm text-foreground">Disputes &amp; Messages</h3>
            <p className="text-xs text-muted-foreground">Direct buyer-seller communication</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setShowNewDisputeForm(true); setActiveDisputeId(null); }}
          className="btn-primary px-3 py-1.5 text-xs rounded-xl flex items-center gap-1.5"
        >
          <Icon name="PlusIcon" size={13} />
          New Query
        </button>
      </div>

      <div className="flex" style={{ height: 480 }}>
        {/* Left: Dispute List */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto">
          {disputes.map((dispute) => (
            <button
              key={dispute.id}
              type="button"
              onClick={() => { setActiveDisputeId(dispute.id); setShowNewDisputeForm(false); }}
              className={`w-full text-left p-3 border-b border-border hover:bg-muted/50 transition-colors ${
                activeDisputeId === dispute.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className="text-xs font-700 text-foreground truncate">{dispute.orderId}</span>
                {dispute.unreadCount > 0 && (
                  <span className="shrink-0 w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center font-700">
                    {dispute.unreadCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mb-1">{dispute.product}</p>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs px-1.5 py-0.5 rounded-full border font-600 ${statusConfig[dispute.status].color}`}>
                  {statusConfig[dispute.status].label}
                </span>
                {dispute.hasUnboxingVideo && (
                  <Icon name="VideoCameraIcon" size={11} className="text-success" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{dispute.createdAt}</p>
            </button>
          ))}
        </div>

        {/* Right: Chat or New Form */}
        <div className="flex-1 flex flex-col min-w-0">
          {showNewDisputeForm ? (
            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="font-700 text-sm text-foreground mb-4">Open New Query / Dispute</h4>

              {/* Policy Notice */}
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <Icon name="ExclamationTriangleIcon" size={14} className="text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-700 text-warning mb-1">Platform Policy</p>
                    <p className="text-xs text-amber-700">
                      <strong>No Returns.</strong> Exchanges are only accepted for damaged goods with an unboxing video as proof.
                      No Cash on Delivery — all orders are 100% prepaid.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-700 text-foreground mb-1.5">Order ID *</label>
                  <input
                    type="text"
                    value={newDisputeOrderId}
                    onChange={(e) => setNewDisputeOrderId(e.target.value)}
                    placeholder="e.g. FT-ORD-004521"
                    className="input-base w-full px-3 py-2.5 text-sm rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-700 text-foreground mb-1.5">Query Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(typeLabels) as [Dispute['type'], string][]).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewDisputeType(key)}
                        className={`px-3 py-2 rounded-xl text-xs font-600 border transition-all text-left ${
                          newDisputeType === key
                            ? 'bg-primary/10 border-primary text-primary' :'bg-muted border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-700 text-foreground mb-1.5">Description *</label>
                  <textarea
                    rows={3}
                    value={newDisputeDesc}
                    onChange={(e) => setNewDisputeDesc(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    className="input-base w-full px-3 py-2.5 text-sm rounded-xl resize-none"
                  />
                </div>

                {(newDisputeType === 'exchange_request' || newDisputeType === 'damage_claim') && (
                  <div className={`p-3 rounded-xl border ${hasUnboxingVideo ? 'bg-success/5 border-success/20' : 'bg-error/5 border-error/20'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon name="VideoCameraIcon" size={14} className={hasUnboxingVideo ? 'text-success' : 'text-error'} />
                        <p className="text-xs font-700 text-foreground">Unboxing Video Required</p>
                      </div>
                      {hasUnboxingVideo && (
                        <span className="text-xs text-success font-600">✓ Uploaded</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Exchange/damage claims require an unboxing video showing the damage at the time of delivery.
                    </p>
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className={`w-full py-2 text-xs rounded-xl font-600 border transition-all ${
                        hasUnboxingVideo
                          ? 'bg-success/10 border-success/30 text-success' :'bg-error/10 border-error/30 text-error hover:bg-error hover:text-white'
                      }`}
                    >
                      {hasUnboxingVideo ? '✓ Video Attached — Click to Replace' : 'Upload Unboxing Video *'}
                    </button>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={() => setHasUnboxingVideo(true)}
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewDisputeForm(false)}
                    className="btn-secondary flex-1 py-2.5 text-sm rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateDispute}
                    disabled={!newDisputeOrderId || !newDisputeDesc}
                    className="btn-primary flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50"
                  >
                    Submit Query
                  </button>
                </div>
              </div>
            </div>
          ) : activeDispute ? (
            <>
              {/* Dispute Info Bar */}
              <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-700 text-foreground">{activeDispute.orderId}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-600 ${statusConfig[activeDispute.status].color}`}>
                      {statusConfig[activeDispute.status].label}
                    </span>
                    <span className="text-xs text-muted-foreground">{typeLabels[activeDispute.type]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{activeDispute.product}</p>
                </div>
                {activeDispute.hasUnboxingVideo && (
                  <div className="flex items-center gap-1 shrink-0 text-xs text-success font-600 bg-success/10 px-2 py-1 rounded-lg">
                    <Icon name="VideoCameraIcon" size={12} />
                    Video Proof
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {activeDispute.messages.map((msg) => {
                  const isMe = msg.sender === mode;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-700 ${
                        msg.sender === 'buyer' ? 'bg-primary/20 text-primary' :
                        msg.sender === 'seller'? 'bg-secondary/20 text-secondary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {msg.senderName[0]}
                      </div>
                      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        <span className="text-xs text-muted-foreground px-1">{msg.senderName}</span>
                        <div className={`rounded-2xl px-3 py-2 text-sm ${
                          isMe
                            ? 'bg-primary text-white rounded-tr-sm' :'bg-muted text-foreground rounded-tl-sm'
                        }`}>
                          {msg.text && <p>{msg.text}</p>}
                          {msg.fileUrl && (
                            <a
                              href={msg.fileUrl}
                              className={`flex items-center gap-2 mt-1 text-xs underline ${isMe ? 'text-white/80' : 'text-primary'}`}
                            >
                              <Icon
                                name={msg.fileType === 'video' ? 'VideoCameraIcon' : msg.fileType === 'image' ? 'PhotoIcon' : 'DocumentIcon'}
                                size={13}
                              />
                              {msg.fileName}
                            </a>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground px-1">{msg.timestamp}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Uploaded file preview */}
              {uploadedFile && (
                <div className="px-3 py-2 border-t border-border bg-muted/30 flex items-center gap-2">
                  <Icon
                    name={uploadedFile.type === 'video' ? 'VideoCameraIcon' : uploadedFile.type === 'image' ? 'PhotoIcon' : 'DocumentIcon'}
                    size={14}
                    className="text-primary"
                  />
                  <span className="text-xs text-foreground flex-1 truncate">{uploadedFile.name}</span>
                  <button type="button" onClick={() => setUploadedFile(null)} className="text-muted-foreground hover:text-error">
                    <Icon name="XMarkIcon" size={14} />
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-border flex items-end gap-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Attach image or document"
                  >
                    <Icon name="PaperClipIcon" size={16} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const isImage = file.type.startsWith('image/');
                        setUploadedFile({ name: file.name, type: isImage ? 'image' : 'document' });
                      }
                    }}
                  />
                </div>
                <textarea
                  rows={1}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="input-base flex-1 px-3 py-2 text-sm rounded-xl resize-none"
                  style={{ minHeight: 38, maxHeight: 100 }}
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isSending || (!newMessage.trim() && !uploadedFile)}
                  className="btn-primary p-2.5 rounded-xl disabled:opacity-50 shrink-0"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Icon name="PaperAirplaneIcon" size={16} />
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Icon name="ChatBubbleLeftRightIcon" size={28} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-700 text-foreground mb-1">Select a conversation</p>
              <p className="text-xs text-muted-foreground mb-4">
                Choose a dispute from the list or open a new query
              </p>
              <button
                type="button"
                onClick={() => setShowNewDisputeForm(true)}
                className="btn-primary px-4 py-2 text-sm rounded-xl"
              >
                Open New Query
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
