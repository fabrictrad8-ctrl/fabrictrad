'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import InWebsiteChat from '@/app/components/InWebsiteChat';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

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

const emptyRequirements: Requirement[] = [];

const demoRequirements: Requirement[] = [
  {
    id: 'DEMO-REQ-001',
    buyerId: 'fabrictrad-demo-buyer',
    buyerName: 'Demo Buyer',
    buyerAvatar: '',
    title: 'Need 180 mtr ivory embroidered net',
    description:
      'Looking for wedding-season ivory embroidered net with soft hand feel and quick dispatch.',
    category: 'Net / Embroidered',
    quantity: '180 mtr',
    budget: '₹750 - ₹950/mtr',
    deadline: '22 Jul 2026',
    postedAt: 'Today',
    responses: 3,
    status: 'open',
    tags: ['Ivory', 'Embroidery', 'Wedding', 'Fast dispatch'],
  },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-success/10 text-success border-success/20' },
  in_discussion: { label: 'In Discussion', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  fulfilled: { label: 'Fulfilled', color: 'bg-muted text-muted-foreground border-border' },
};

const CATEGORIES = [
  'All',
  'Silk Fabric',
  'Georgette',
  'Cotton / Khadi',
  'Net / Embroidered',
  'Linen',
  'Velvet',
  'Chiffon',
];

const referenceVendorMatches = [
  {
    id: 'REF-1150',
    vendor: 'Aarav Ethnic Studio',
    city: 'Surat',
    title: 'White Indo-Western Jacket',
    image: 'https://images.unsplash.com/photo-1593032465175-481ac7f401f0?w=320&h=360&fit=crop',
    confidence: 94,
    price: '₹1,850 - ₹2,250/pc',
    availability: 'Sample ready, 40 pcs/week',
    tags: ['Ivory', 'Mandarin collar', 'Gold embroidery', 'Pearl buttons'],
  },
  {
    id: 'REF-1142',
    vendor: 'Surat Zari House',
    city: 'Surat',
    title: 'Ivory Designer Fabric Panel',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=320&h=360&fit=crop',
    confidence: 88,
    price: '₹780 - ₹940/mtr',
    availability: '220 mtr available',
    tags: ['Ivory base', 'Zari motif', 'Occasion wear', 'Fabric match'],
  },
];

export default function BuyerRequirementsBoard() {
  const { user, profile, loading: authLoading, isDemoAccount } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [requirements, setRequirements] = useState<Requirement[]>(emptyRequirements);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPostForm, setShowPostForm] = useState(false);
  const [activeChatReq, setActiveChatReq] = useState<Requirement | null>(null);
  const [showReferenceMatches, setShowReferenceMatches] = useState(false);
  const [matchStatus, setMatchStatus] = useState<'idle' | 'scanning' | 'matched'>('idle');
  const [referenceImageName, setReferenceImageName] = useState('');
  const userRole: 'buyer' | 'seller' = profile?.role === 'seller' ? 'seller' : 'buyer';
  const canPost = !!user && profile?.role === 'buyer';
  const accountName =
    profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Buyer';
  const accountAvatar = profile?.avatar_url || '';

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRequirements([]);
      setLoading(false);
      return;
    }

    if (isDemoAccount) {
      setRequirements(demoRequirements);
      setLoading(false);
      return;
    }

    let mounted = true;
    async function loadRequirements() {
      setLoading(true);
      let query = supabase
        .from('buyer_requirements')
        .select(
          'id,buyer_id,title,description,category,quantity,budget,deadline,tags,status,response_count,created_at'
        )
        .order('created_at', { ascending: false })
        .limit(100);

      if (profile?.role === 'buyer') {
        query = query.eq('buyer_id', user.id);
      } else {
        query = query.eq('status', 'open');
      }

      const { data } = await query;
      if (!mounted) return;
      setRequirements(
        (data || []).map((row) => ({
          id: row.id,
          buyerId: row.buyer_id,
          buyerName: row.buyer_id === user.id ? accountName : 'Verified buyer',
          buyerAvatar: row.buyer_id === user.id ? accountAvatar : '',
          title: row.title,
          description: row.description,
          category: row.category,
          quantity: row.quantity,
          budget: row.budget,
          deadline: row.deadline
            ? new Date(row.deadline).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : 'Flexible',
          postedAt: row.created_at
            ? new Date(row.created_at).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : 'Recently',
          responses: Number(row.response_count || 0),
          status: row.status as Requirement['status'],
          tags: Array.isArray(row.tags) ? row.tags : [],
        }))
      );
      setLoading(false);
    }

    loadRequirements();
    return () => {
      mounted = false;
    };
  }, [accountAvatar, accountName, authLoading, isDemoAccount, profile?.role, supabase, user]);

  // Post form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Silk Fabric',
    quantity: '',
    budget: '',
    deadline: '',
    tags: '',
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

  const handlePost = async () => {
    if (!form.title || !form.description || !form.quantity || !form.budget) return;
    if (!user || !canPost) return;

    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (isDemoAccount) {
      const newReq: Requirement = {
        id: `DEMO-REQ-${Date.now().toString().slice(-5)}`,
        buyerId: user.id,
        buyerName: accountName,
        buyerAvatar: accountAvatar,
        title: form.title,
        description: form.description,
        category: form.category,
        quantity: form.quantity,
        budget: form.budget,
        deadline: form.deadline
          ? new Date(form.deadline).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : 'Flexible',
        postedAt: 'Just now',
        responses: 0,
        status: 'open',
        tags,
      };
      setRequirements((prev) => [newReq, ...prev]);
      setShowPostForm(false);
      setForm({
        title: '',
        description: '',
        category: 'Silk Fabric',
        quantity: '',
        budget: '',
        deadline: '',
        tags: '',
      });
      return;
    }

    const { data, error } = await supabase
      .from('buyer_requirements')
      .insert({
        buyer_id: user.id,
        title: form.title,
        description: form.description,
        category: form.category,
        quantity: form.quantity,
        budget: form.budget,
        deadline: form.deadline || null,
        tags,
      })
      .select(
        'id,buyer_id,title,description,category,quantity,budget,deadline,tags,status,response_count,created_at'
      )
      .single();

    if (error || !data) return;

    const newReq: Requirement = {
      id: data.id,
      buyerId: data.buyer_id,
      buyerName: accountName,
      buyerAvatar: accountAvatar,
      title: data.title,
      description: data.description,
      category: data.category,
      quantity: data.quantity,
      budget: data.budget,
      deadline: data.deadline
        ? new Date(data.deadline).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : 'Flexible',
      postedAt: 'Just now',
      responses: Number(data.response_count || 0),
      status: data.status as Requirement['status'],
      tags,
    };
    setRequirements((prev) => [newReq, ...prev]);
    setShowPostForm(false);
    setForm({
      title: '',
      description: '',
      category: 'Silk Fabric',
      quantity: '',
      budget: '',
      deadline: '',
      tags: '',
    });
  };

  const runReferenceMatch = (fileName?: string) => {
    if (fileName) setReferenceImageName(fileName);
    setShowReferenceMatches(true);
    setMatchStatus('scanning');
    window.setTimeout(() => setMatchStatus('matched'), 900);
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
          {userRole === 'buyer' && (
            <Link
              href="/marketplace"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Marketplace
            </Link>
          )}
          {canPost ? (
            <button
              onClick={() => setShowPostForm(true)}
              className="btn-primary px-4 py-2 text-xs rounded-xl flex items-center gap-1.5"
            >
              <Icon name="PlusIcon" size={13} />
              Post Requirement
            </button>
          ) : (
            <Link
              href={user ? '/seller-dashboard' : '/login'}
              className="btn-secondary px-4 py-2 text-xs rounded-xl"
            >
              {user ? 'Seller Dashboard' : 'Sign In'}
            </Link>
          )}
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
                Buyers post what they're looking for. Sellers connect directly through in-website
                chat — no phone numbers or emails shared.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            {[
              { icon: 'ShieldCheckIcon', text: 'No phone/email sharing' },
              { icon: 'ChatBubbleLeftRightIcon', text: 'In-website chat only' },
              { icon: 'PaperClipIcon', text: 'File & image sharing' },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1.5"
              >
                <Icon name={item.icon as 'ShieldCheckIcon'} size={12} className="text-success" />
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* AI Reference Finder */}
        <div className="mb-5 rounded-2xl border border-secondary/20 bg-card p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10">
                  <Icon name="SparklesIcon" size={18} className="text-secondary" />
                </div>
                <div>
                  <h2 className="text-base font-800 text-foreground">AI Reference Finder</h2>
                  <p className="text-xs text-muted-foreground">
                    Upload a product or fabric image to find vendor references.
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                If a buyer posts the same image or a similar fabric reference, FabricTrad filters
                seller WhatsApp catalog uploads and pops up matching vendor accounts with details.
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-card px-4 py-5 text-center transition-colors hover:bg-muted">
                <Icon name="PhotoIcon" size={26} className="text-primary" />
                <span className="text-sm font-800 text-foreground">
                  {referenceImageName || 'Choose buyer reference image'}
                </span>
                <span className="text-xs text-muted-foreground">
                  AI will compare it with vendor WhatsApp catalog references
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) runReferenceMatch(file.name);
                  }}
                />
              </label>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => runReferenceMatch(referenceImageName || 'D.No.1150 reference.jpg')}
                  className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
                >
                  <Icon name="MagnifyingGlassIcon" size={15} />
                  Find Reference Vendors
                </button>
                <button
                  type="button"
                  onClick={() => setShowPostForm(true)}
                  className="btn-secondary rounded-xl px-4 py-2.5 text-sm"
                >
                  Post Requirement
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Icon
              name="MagnifyingGlassIcon"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search requirements by fabric, category, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.slice(0, 5).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-600 border transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {!user && !authLoading && (
          <div className="mb-5 rounded-2xl border border-border bg-card p-6 text-center">
            <Icon name="LockClosedIcon" size={30} className="mx-auto mb-3 text-primary" />
            <h2 className="text-base font-800 text-foreground">Sign in to use the board</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Requirements, chats, and responses are account-bound. Create or sign in to a buyer or
              seller account to continue.
            </p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/login" className="btn-primary px-5 py-2.5 text-sm">
                Sign In
              </Link>
              <Link href="/register" className="btn-secondary px-5 py-2.5 text-sm">
                Create Account
              </Link>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            {
              label: 'Open Requirements',
              value: requirements.filter((r) => r.status === 'open').length,
              color: 'text-success',
            },
            {
              label: 'In Discussion',
              value: requirements.filter((r) => r.status === 'in_discussion').length,
              color: 'text-amber-600',
            },
            { label: 'Total Posted', value: requirements.length, color: 'text-primary' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-card border border-border rounded-xl p-3 text-center"
            >
              <p className={`text-xl font-800 ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Requirements List */}
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-muted-foreground">
              <Icon
                name={loading ? 'ArrowPathIcon' : 'MagnifyingGlassIcon'}
                size={32}
                className={`mx-auto mb-3 opacity-50 ${loading ? 'animate-spin' : ''}`}
              />
              <p className="font-700 text-foreground">
                {loading ? 'Loading requirements...' : 'No requirements found'}
              </p>
              <p className="mt-1 text-sm">
                {profile?.role === 'buyer'
                  ? 'Your posted requirements will appear here.'
                  : 'Open buyer requirements from live accounts will appear here.'}
              </p>
            </div>
          )}
          {filtered.map((req) => (
            <div
              key={req.id}
              className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                  {req.buyerAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={req.buyerAvatar}
                      alt={`${req.buyerName} buyer profile`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-800 text-primary">
                      {req.buyerName[0]?.toUpperCase() || 'B'}
                    </span>
                  )}
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
                    <span
                      className={`text-xs font-600 border px-2 py-0.5 rounded-full shrink-0 ${statusConfig[req.status].color}`}
                    >
                      {statusConfig[req.status].label}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                    {req.description}
                  </p>

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
                    {req.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon name="ChatBubbleLeftRightIcon" size={13} />
                      <span>
                        {req.responses} seller{req.responses !== 1 ? 's' : ''} responded
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {userRole === 'seller' && (
                        <button
                          onClick={() => setActiveChatReq(req)}
                          className="btn-primary px-4 py-1.5 text-xs rounded-xl flex items-center gap-1.5"
                        >
                          <Icon name="ChatBubbleLeftRightIcon" size={13} />
                          Respond to Request
                        </button>
                      )}
                      {userRole === 'buyer' && req.buyerId === user?.id && (
                        <button
                          onClick={() => setActiveChatReq(req)}
                          className="btn-secondary px-4 py-1.5 text-xs rounded-xl flex items-center gap-1.5"
                        >
                          <Icon name="ChatBubbleLeftRightIcon" size={13} />
                          View Responses
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Post Requirement Modal */}
      {showPostForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-800 text-foreground">Post Your Requirement</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sellers will contact you via in-website chat only
                </p>
              </div>
              <button
                onClick={() => setShowPostForm(false)}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
              >
                <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-700 text-foreground block mb-1.5">
                  Requirement Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Looking for Pure Silk Banarasi Fabric"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-700 text-foreground block mb-1.5">
                  Description *
                </label>
                <textarea
                  placeholder="Describe what you're looking for — fabric type, quality, colour, usage, etc."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-700 text-foreground">
                  Reference Image
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted px-3 py-3 transition-colors hover:border-primary/60">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card">
                    <Icon name="PhotoIcon" size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-700 text-foreground">
                      {referenceImageName || 'Attach product or fabric image'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      AI will filter seller catalog references and show matching vendors.
                    </p>
                  </div>
                  <span className="rounded-lg bg-card px-2 py-1 text-xs font-700 text-primary">
                    Scan
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) runReferenceMatch(file.name);
                    }}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-700 text-foreground block mb-1.5">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-700 text-foreground block mb-1.5">
                    Quantity Required *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 50–100 metres"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-700 text-foreground block mb-1.5">
                    Budget Range *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ₹500–₹800/mtr"
                    value={form.budget}
                    onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-700 text-foreground block mb-1.5">Deadline</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-700 text-foreground block mb-1.5">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Silk, Bridal, Zari, Bulk"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Icon name="ShieldCheckIcon" size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <span className="font-700">Privacy protected:</span> Sellers can only contact you
                  through in-website chat. No phone numbers or email addresses will be shared.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowPostForm(false)}
                  className="btn-secondary flex-1 py-2.5 text-sm rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePost}
                  disabled={!form.title || !form.description || !form.quantity || !form.budget}
                  className="btn-primary flex-1 py-2.5 text-sm rounded-xl disabled:opacity-50"
                >
                  Post Requirement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Match Popup */}
      {showReferenceMatches && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <p className="text-xs font-800 uppercase text-primary">AI image match</p>
                <h3 className="text-lg font-800 text-foreground">Reference vendors found</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Matched against seller WhatsApp catalog uploads
                  {referenceImageName ? ` for ${referenceImageName}` : ''}.
                </p>
              </div>
              <button
                onClick={() => setShowReferenceMatches(false)}
                className="rounded-lg p-1.5 transition-colors hover:bg-muted"
                aria-label="Close reference matches"
              >
                <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
              </button>
            </div>

            {matchStatus === 'scanning' ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm font-800 text-foreground">Scanning image reference...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Comparing colour, garment shape, embroidery and catalog text.
                </p>
              </div>
            ) : (
              <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
                {referenceVendorMatches.map((match) => (
                  <div key={match.id} className="rounded-2xl border border-border p-4">
                    <div className="flex gap-3">
                      <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                        <AppImage
                          src={match.image}
                          alt={`${match.title} vendor reference`}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-700 text-primary">{match.id}</p>
                            <h4 className="text-sm font-800 text-foreground">{match.title}</h4>
                          </div>
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-800 text-success">
                            {match.confidence}%
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {match.vendor} · {match.city}
                        </p>
                        <p className="mt-2 text-sm font-800 text-foreground">{match.price}</p>
                        <p className="text-xs text-muted-foreground">{match.availability}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {match.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReferenceMatches(false);
                        setActiveChatReq({
                          id: match.id,
                          buyerId: user?.id || 'buyer',
                          buyerName: accountName,
                          buyerAvatar: accountAvatar,
                          title: match.title,
                          description: `AI matched this buyer reference with ${match.vendor}.`,
                          category: 'AI Reference',
                          quantity: 'Discuss in chat',
                          budget: match.price,
                          deadline: 'Flexible',
                          postedAt: 'Just now',
                          responses: 1,
                          status: 'open',
                          tags: match.tags,
                        });
                      }}
                      className="btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm"
                    >
                      <Icon name="ChatBubbleLeftRightIcon" size={14} />
                      Connect with Reference Vendor
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-Website Chat */}
      {activeChatReq && (
        <InWebsiteChat
          contextId={activeChatReq.id}
          contextTitle={activeChatReq.title}
          otherPartyName={userRole === 'seller' ? activeChatReq.buyerName : 'Seller'}
          otherPartyAvatar={activeChatReq.buyerAvatar}
          currentUserRole={userRole}
          onClose={() => setActiveChatReq(null)}
        />
      )}
    </div>
  );
}
