'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import InWebsiteChat from '@/app/components/InWebsiteChat';

interface Requirement {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar: string;
  title: string;
  description: string;
  category: string;
  quantity: string;
  budget: string;
  deadline: string;
  postedAt: string;
  responses: number;
  status: 'open' | 'in_discussion' | 'fulfilled';
  tags: string[];
}

const MOCK_REQUIREMENTS: Requirement[] = [
{
  id: 'REQ-001',
  buyerId: 'FT-BYR-004521',
  buyerName: 'Rajesh Mehta',
  buyerAvatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1cd846a98-1772279769196.png",
  title: 'Looking for Pure Silk Banarasi with Gold Zari Work',
  description:
  'Need high-quality pure silk Banarasi fabric with traditional gold zari work. Minimum 50 metres. The fabric should be suitable for bridal lehengas. Prefer manufacturers from Varanasi.',
  category: 'Silk Fabric',
  quantity: '50–100 metres',
  budget: '₹1,200–₹1,800/mtr',
  deadline: '15 Aug 2026',
  postedAt: '2 hours ago',
  responses: 3,
  status: 'open',
  tags: ['Silk', 'Banarasi', 'Zari', 'Bridal']
},
{
  id: 'REQ-002',
  buyerId: 'FT-BYR-007832',
  buyerName: 'Priya Sharma',
  buyerAvatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1407673ab-1774245048977.png",
  title: 'Georgette Fabric in Pastel Shades — Bulk Order',
  description:
  'Require georgette fabric in pastel shades (mint, blush, lavender). Need consistent colour across all metres. For ready-to-stitch suits. Quantity flexible based on pricing.',
  category: 'Georgette',
  quantity: '200+ metres',
  budget: '₹300–₹500/mtr',
  deadline: '30 Jul 2026',
  postedAt: '5 hours ago',
  responses: 7,
  status: 'in_discussion',
  tags: ['Georgette', 'Pastel', 'Bulk', 'Suits']
},
{
  id: 'REQ-003',
  buyerId: 'FT-BYR-002341',
  buyerName: 'Amit Patel',
  buyerAvatar: "https://img.rocket.new/generatedImages/rocket_gen_img_170fe9e2c-1764668265175.png",
  title: 'Cotton Khadi Fabric — Natural Dyed',
  description:
  'Looking for handloom cotton khadi with natural/vegetable dyes. Earthy tones preferred. For ethnic wear brand. Need GST invoice. Prefer Gujarat or Rajasthan weavers.',
  category: 'Cotton / Khadi',
  quantity: '30–50 metres',
  budget: '₹400–₹700/mtr',
  deadline: '20 Aug 2026',
  postedAt: '1 day ago',
  responses: 2,
  status: 'open',
  tags: ['Cotton', 'Khadi', 'Natural Dye', 'Handloom']
},
{
  id: 'REQ-004',
  buyerId: 'FT-BYR-009123',
  buyerName: 'Sunita Joshi',
  buyerAvatar: "https://img.rocket.new/generatedImages/rocket_gen_img_17467ed66-1772523678063.png",
  title: 'Embroidered Net Fabric for Dupatta',
  description:
  'Need embroidered net fabric with mirror work or sequin embellishments. For dupatta production. Colours: red, royal blue, emerald green. Minimum 20 metres each colour.',
  category: 'Net / Embroidered',
  quantity: '60+ metres',
  budget: '₹600–₹1,000/mtr',
  deadline: '10 Aug 2026',
  postedAt: '2 days ago',
  responses: 5,
  status: 'open',
  tags: ['Net', 'Embroidered', 'Mirror Work', 'Dupatta']
}];


const statusConfig: Record<string, {label: string;color: string;}> = {
  open: { label: 'Open', color: 'bg-success/10 text-success border-success/20' },
  in_discussion: { label: 'In Discussion', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  fulfilled: { label: 'Fulfilled', color: 'bg-muted text-muted-foreground border-border' }
};

const CATEGORIES = ['All', 'Silk Fabric', 'Georgette', 'Cotton / Khadi', 'Net / Embroidered', 'Linen', 'Velvet', 'Chiffon'];

export default function BuyerRequirementsBoard() {
  const [requirements, setRequirements] = useState<Requirement[]>(MOCK_REQUIREMENTS);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPostForm, setShowPostForm] = useState(false);
  const [activeChatReq, setActiveChatReq] = useState<Requirement | null>(null);
  const [userRole] = useState<'buyer' | 'seller'>('seller'); // In real app, from auth context

  // Post form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Silk Fabric',
    quantity: '',
    budget: '',
    deadline: '',
    tags: ''
  });

  const filtered = requirements.filter((r) => {
    const matchCat = selectedCategory === 'All' || r.category === selectedCategory;
    const matchSearch =
    !searchQuery ||
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  const handlePost = () => {
    if (!form.title || !form.description || !form.quantity || !form.budget) return;
    const newReq: Requirement = {
      id: `REQ-${Date.now()}`,
      buyerId: 'FT-BYR-004521',
      buyerName: 'Rajesh Mehta',
      buyerAvatar: 'https://img.rocket.new/generatedImages/rocket_gen_img_1e0b06c28-1763294358632.png',
      title: form.title,
      description: form.description,
      category: form.category,
      quantity: form.quantity,
      budget: form.budget,
      deadline: form.deadline || 'Flexible',
      postedAt: 'Just now',
      responses: 0,
      status: 'open',
      tags: form.tags.
      split(',').
      map((t) => t.trim()).
      filter(Boolean)
    };
    setRequirements((prev) => [newReq, ...prev]);
    setShowPostForm(false);
    setForm({ title: '', description: '', category: 'Silk Fabric', quantity: '', budget: '', deadline: '', tags: '' });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40 h-14 flex items-center px-4 sm:px-6 gap-4">
        <Link href="/" className="flex items-center gap-2">
          <AppLogo size={30} />
          <span className="font-800 text-sm text-secondary hidden sm:block">FabricTrad</span>
        </Link>
        <div className="ml-2">
          <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 font-700">
            Buyer Requirements Board
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/marketplace" className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
            Marketplace
          </Link>
          <button
            onClick={() => setShowPostForm(true)}
            className="btn-primary px-4 py-2 text-xs rounded-xl flex items-center gap-1.5">
            
            <Icon name="PlusIcon" size={13} />
            Post Requirement
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Hero */}
        <div className="mb-6 p-5 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Icon name="MegaphoneIcon" size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-800 text-foreground mb-1">Buyer Requirements Board</h1>
              <p className="text-sm text-muted-foreground">
                Buyers post what they're looking for. Sellers connect directly through in-website chat — no phone numbers or emails shared.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            {[
            { icon: 'ShieldCheckIcon', text: 'No phone/email sharing' },
            { icon: 'ChatBubbleLeftRightIcon', text: 'In-website chat only' },
            { icon: 'PaperClipIcon', text: 'File & image sharing' }].
            map((item) =>
            <div key={item.text} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1.5">
                <Icon name={item.icon as 'ShieldCheckIcon'} size={12} className="text-success" />
                {item.text}
              </div>
            )}
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search requirements by fabric, category, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors" />
            
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.slice(0, 5).map((cat) =>
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-600 border transition-all ${
              selectedCategory === cat ?
              'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50'}`
              }>
              
                {cat}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
          { label: 'Open Requirements', value: requirements.filter((r) => r.status === 'open').length, color: 'text-success' },
          { label: 'In Discussion', value: requirements.filter((r) => r.status === 'in_discussion').length, color: 'text-amber-600' },
          { label: 'Total Posted', value: requirements.length, color: 'text-primary' }].
          map((stat) =>
          <div key={stat.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className={`text-xl font-800 ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          )}
        </div>

        {/* Requirements List */}
        <div className="space-y-4">
          {filtered.length === 0 &&
          <div className="text-center py-12 text-muted-foreground">
              <Icon name="MagnifyingGlassIcon" size={32} className="mx-auto mb-3 opacity-40" />
              <p className="font-600">No requirements found</p>
              <p className="text-sm mt-1">Try a different search or category</p>
            </div>
          }
          {filtered.map((req) =>
          <div key={req.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                  <AppImage src={req.buyerAvatar} alt={`${req.buyerName} buyer profile`} width={40} height={40} className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-700 text-foreground text-sm leading-snug">{req.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{req.buyerName}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{req.postedAt}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-600 border px-2 py-0.5 rounded-full shrink-0 ${statusConfig[req.status].color}`}>
                      {statusConfig[req.status].label}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-2">{req.description}</p>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <div className="flex items-center gap-1 text-xs bg-muted rounded-lg px-2 py-1">
                      <Icon name="TagIcon" size={11} className="text-muted-foreground" />
                      <span className="text-muted-foreground">{req.category}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-muted rounded-lg px-2 py-1">
                      <Icon name="ScaleIcon" size={11} className="text-muted-foreground" />
                      <span className="text-muted-foreground">{req.quantity}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-success/10 rounded-lg px-2 py-1">
                      <Icon name="CurrencyRupeeIcon" size={11} className="text-success" />
                      <span className="text-success font-600">{req.budget}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs bg-muted rounded-lg px-2 py-1">
                      <Icon name="CalendarIcon" size={11} className="text-muted-foreground" />
                      <span className="text-muted-foreground">By {req.deadline}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {req.tags.map((tag) =>
                  <span key={tag} className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                        #{tag}
                      </span>
                  )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon name="ChatBubbleLeftRightIcon" size={13} />
                      <span>{req.responses} seller{req.responses !== 1 ? 's' : ''} responded</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {userRole === 'seller' &&
                    <button
                      onClick={() => setActiveChatReq(req)}
                      className="btn-primary px-4 py-1.5 text-xs rounded-xl flex items-center gap-1.5">
                      
                          <Icon name="ChatBubbleLeftRightIcon" size={13} />
                          Connect with Buyer
                        </button>
                    }
                      {userRole === 'buyer' && req.buyerId === 'FT-BYR-004521' &&
                    <button
                      onClick={() => setActiveChatReq(req)}
                      className="btn-secondary px-4 py-1.5 text-xs rounded-xl flex items-center gap-1.5">
                      
                          <Icon name="ChatBubbleLeftRightIcon" size={13} />
                          View Responses
                        </button>
                    }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Post Requirement Modal */}
      {showPostForm &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-800 text-foreground">Post Your Requirement</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Sellers will contact you via in-website chat only</p>
              </div>
              <button onClick={() => setShowPostForm(false)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-700 text-foreground block mb-1.5">Requirement Title *</label>
                <input
                type="text"
                placeholder="e.g. Looking for Pure Silk Banarasi Fabric"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors" />
              
              </div>
              <div>
                <label className="text-xs font-700 text-foreground block mb-1.5">Description *</label>
                <textarea
                placeholder="Describe what you're looking for — fabric type, quality, colour, usage, etc."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
              
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-700 text-foreground block mb-1.5">Category *</label>
                  <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors">
                  
                    {CATEGORIES.filter((c) => c !== 'All').map((c) =>
                  <option key={c} value={c}>
                        {c}
                      </option>
                  )}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-700 text-foreground block mb-1.5">Quantity Required *</label>
                  <input
                  type="text"
                  placeholder="e.g. 50–100 metres"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors" />
                
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-700 text-foreground block mb-1.5">Budget Range *</label>
                  <input
                  type="text"
                  placeholder="e.g. ₹500–₹800/mtr"
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors" />
                
                </div>
                <div>
                  <label className="text-xs font-700 text-foreground block mb-1.5">Deadline</label>
                  <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors" />
                
                </div>
              </div>
              <div>
                <label className="text-xs font-700 text-foreground block mb-1.5">Tags (comma separated)</label>
                <input
                type="text"
                placeholder="e.g. Silk, Bridal, Zari, Bulk"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors" />
              
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Icon name="ShieldCheckIcon" size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <span className="font-700">Privacy protected:</span> Sellers can only contact you through in-website chat. No phone numbers or email addresses will be shared.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowPostForm(false)} className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">
                  Cancel
                </button>
                <button
                onClick={handlePost}
                disabled={!form.title || !form.description || !form.quantity || !form.budget}
                className="btn-primary flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50">
                
                  Post Requirement
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      {/* In-Website Chat */}
      {activeChatReq &&
      <InWebsiteChat
        contextId={activeChatReq.id}
        contextTitle={activeChatReq.title}
        otherPartyName={userRole === 'seller' ? activeChatReq.buyerName : 'Seller'}
        otherPartyAvatar={activeChatReq.buyerAvatar}
        currentUserRole={userRole}
        onClose={() => setActiveChatReq(null)} />

      }
    </div>);

}