'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import InWebsiteChat from '@/app/components/InWebsiteChat';

interface InboxThread {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar: string;
  subject: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  type: 'product_inquiry' | 'requirement_response' | 'post_purchase';
  productName?: string;
}

const MOCK_THREADS: InboxThread[] = [
{
  id: 'THR-001',
  buyerId: 'FT-BYR-004521',
  buyerName: 'Rajesh Mehta',
  buyerAvatar: "https://images.unsplash.com/photo-1619263719761-165c773ee5df",
  subject: 'Inquiry: Pure Dyeable Soft Nett Fabric',
  lastMessage: 'Can you share the colour options available for this fabric?',
  lastAt: '10 min ago',
  unread: 2,
  type: 'product_inquiry',
  productName: 'Pure Dyeable Soft Nett Fabric'
},
{
  id: 'THR-002',
  buyerId: 'FT-BYR-007832',
  buyerName: 'Priya Sharma',
  buyerAvatar: "https://img.rocket.new/generatedImages/rocket_gen_img_194b902a5-1772695463897.png",
  subject: 'Requirement: Georgette Fabric in Pastel Shades',
  lastMessage: 'We have georgette in mint and blush. Minimum 50m per colour.',
  lastAt: '1 hour ago',
  unread: 0,
  type: 'requirement_response'
},
{
  id: 'THR-003',
  buyerId: 'FT-BYR-002341',
  buyerName: 'Amit Patel',
  buyerAvatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1844cd8c3-1773030175247.png",
  subject: 'Post-Purchase: Banarasi Silk Brocade — Order FT-ORD-004320',
  lastMessage: 'The fabric arrived. Can you help with care instructions?',
  lastAt: '3 hours ago',
  unread: 1,
  type: 'post_purchase',
  productName: 'Banarasi Silk Brocade'
}];


const typeConfig: Record<string, {label: string;color: string;icon: string;}> = {
  product_inquiry: { label: 'Product Inquiry', color: 'bg-primary/10 text-primary border-primary/20', icon: 'ShoppingBagIcon' },
  requirement_response: { label: 'Requirement', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'MegaphoneIcon' },
  post_purchase: { label: 'Post-Purchase', color: 'bg-success/10 text-success border-success/20', icon: 'CheckCircleIcon' }
};

export default function SellerInbox() {
  const [threads] = useState<InboxThread[]>(MOCK_THREADS);
  const [activeThread, setActiveThread] = useState<InboxThread | null>(null);
  const [filter, setFilter] = useState<'all' | InboxThread['type']>('all');

  const filtered = threads.filter((t) => filter === 'all' || t.type === filter);
  const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-800 text-foreground">Buyer Inbox</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            All buyer messages — product inquiries, requirement responses, post-purchase support
          </p>
        </div>
        {totalUnread > 0 &&
        <span className="bg-primary text-white text-xs font-700 px-2.5 py-1 rounded-full">
            {totalUnread} unread
          </span>
        }
      </div>

      {/* Privacy Notice */}
      <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-xl mb-5">
        <Icon name="ShieldCheckIcon" size={14} className="text-success shrink-0" />
        <p className="text-xs text-success">
          <span className="font-700">Secure messaging:</span> All communication stays on FabricTrad. No phone numbers or email addresses are shared.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
        { key: 'all', label: 'All Messages' },
        { key: 'product_inquiry', label: 'Product Inquiries' },
        { key: 'requirement_response', label: 'Requirements' },
        { key: 'post_purchase', label: 'Post-Purchase' }].
        map((tab) =>
        <button
          key={tab.key}
          onClick={() => setFilter(tab.key as typeof filter)}
          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-600 border transition-all ${
          filter === tab.key ?
          'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50'}`
          }>
          
            {tab.label}
          </button>
        )}
      </div>

      {/* Thread List */}
      <div className="space-y-3">
        {filtered.length === 0 &&
        <div className="text-center py-12 text-muted-foreground">
            <Icon name="ChatBubbleLeftRightIcon" size={32} className="mx-auto mb-3 opacity-40" />
            <p className="font-600">No messages yet</p>
          </div>
        }
        {filtered.map((thread) => {
          const tc = typeConfig[thread.type];
          return (
            <button
              key={thread.id}
              onClick={() => setActiveThread(thread)}
              className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all">
              
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
                    <AppImage
                      src={thread.buyerAvatar}
                      alt={`${thread.buyerName} buyer profile photo`}
                      width={40}
                      height={40}
                      className="object-cover" />
                    
                  </div>
                  {thread.unread > 0 &&
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-xs font-800 rounded-full flex items-center justify-center">
                      {thread.unread}
                    </span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className={`text-sm font-700 text-foreground ${thread.unread > 0 ? 'font-800' : ''}`}>
                      {thread.buyerName}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">{thread.lastAt}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{thread.subject}</p>
                  <p className={`text-xs mt-1 truncate ${thread.unread > 0 ? 'text-foreground font-600' : 'text-muted-foreground'}`}>
                    {thread.lastMessage}
                  </p>
                  <div className="mt-2">
                    <span className={`text-xs font-600 border px-2 py-0.5 rounded-full ${tc.color}`}>
                      {tc.label}
                    </span>
                  </div>
                </div>
              </div>
            </button>);

        })}
      </div>

      {/* Chat Window */}
      {activeThread &&
      <InWebsiteChat
        contextId={activeThread.id}
        contextTitle={activeThread.subject}
        otherPartyName={activeThread.buyerName}
        otherPartyAvatar={activeThread.buyerAvatar}
        currentUserRole="seller"
        onClose={() => setActiveThread(null)} />

      }
    </div>);

}