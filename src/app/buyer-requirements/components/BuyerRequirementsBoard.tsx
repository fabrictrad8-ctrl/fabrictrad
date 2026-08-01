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
      <header className="bg-card border-b border-border sticky top-0 z-40 h-14 flex items-center px-4 sm:px-6 gap-4">
        <Link
          href="/"
          className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl sm:min-w-0 sm:justify-start"
          aria-label="FabricTrad home"
        >
          <AppLogo size={30} />
          <span className="font-800 text-sm text-secondary hidden sm:block">FabricTrad</span>
        </Link>
        <div className="ml-2">
          <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 font-700">
            Buyer Requirements Board
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/marketplace" className="hidden sm:flex items-center gap-1.5 text-xs font-600 text-muted-foreground hover:text-primary">
            <Icon name="ArrowLeftIcon" size={14} /> Marketplace
          </Link>
          {canPost && (
            <button
              onClick={() => setShowPostForm(true)}
              className="btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5"
            >
              <Icon name="PlusIcon" size={14} />
              <span className="hidden sm:inline">Post Requirement</span>
              <span className="sm:hidden">Post</span>
            </button>
          )}
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-800 text-foreground">Buyer Requirements</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Post what you need, receive seller responses and compare matching supply.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-72">
                <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search requirements"
                  className="input-base w-full pl-9 pr-3 py-2.5 text-sm"
                />
              </div>
              <label className="btn-secondary px-3.5 py-2.5 text-xs flex items-center justify-center gap-2 cursor-pointer">
                <Icon name="PhotoIcon" size={15} /> Match reference
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) runReferenceMatch(file.name);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex gap-2 mt-5 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-700 transition-colors ${
                  selectedCategory === category
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-3 text-sm text-muted-foreground">Loading requirements…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Icon name="ClipboardDocumentListIcon" size={36} className="mx-auto text-muted-foreground" />
            <h2 className="mt-4 text-lg font-800 text-foreground">No requirements found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {canPost ? 'Post your first sourcing requirement to reach verified sellers.' : 'No open buyer requirements match these filters.'}
            </p>
            {canPost && (
              <button onClick={() => setShowPostForm(true)} className="btn-primary mt-5 px-5 py-2.5 text-sm">
                Post Requirement
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((requirement) => (
              <article key={requirement.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center">
                      {requirement.buyerAvatar ? (
                        <AppImage src={requirement.buyerAvatar} alt={requirement.buyerName} width={40} height={40} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-800 text-primary">{requirement.buyerName.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-800 text-foreground">{requirement.buyerName}</p>
                      <p className="text-xs text-muted-foreground">{requirement.postedAt}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-700 ${statusConfig[requirement.status]?.color}`}>
                    {statusConfig[requirement.status]?.label}
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-800 text-foreground">{requirement.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{requirement.description}</p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-muted-foreground">Quantity</p>
                    <p className="mt-1 font-800 text-foreground">{requirement.quantity}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-muted-foreground">Budget</p>
                    <p className="mt-1 font-800 text-foreground">{requirement.budget}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-muted-foreground">Category</p>
                    <p className="mt-1 font-800 text-foreground">{requirement.category}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-muted-foreground">Need by</p>
                    <p className="mt-1 font-800 text-foreground">{requirement.deadline}</p>
                  </div>
                </div>

                {!!requirement.tags.length && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {requirement.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-700 text-primary">{tag}</span>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground">{requirement.responses} seller responses</span>
                  <button
                    onClick={() => setActiveChatReq(requirement)}
                    className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5"
                  >
                    <Icon name="ChatBubbleLeftRightIcon" size={14} /> Discuss
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showPostForm && (
        <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center" onMouseDown={() => setShowPostForm(false)}>
          <section className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-800 uppercase tracking-wide text-primary">New sourcing request</p>
                <h2 className="mt-1 text-xl font-800 text-foreground">Post Requirement</h2>
              </div>
              <button onClick={() => setShowPostForm(false)} className="ft-icon-button" aria-label="Close requirement form">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-700 text-foreground">
                Requirement title
                <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="input-base mt-2 w-full px-3.5 py-3" />
              </label>
              <label className="block text-sm font-700 text-foreground">
                Description
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} className="input-base mt-2 w-full px-3.5 py-3" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-700 text-foreground">
                  Category
                  <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="input-base mt-2 w-full px-3.5 py-3">
                    {CATEGORIES.filter((category) => category !== 'All').map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-700 text-foreground">
                  Quantity
                  <input value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="e.g. 250 mtr" className="input-base mt-2 w-full px-3.5 py-3" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-700 text-foreground">
                  Budget
                  <input value={form.budget} onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))} placeholder="e.g. ₹500-650/mtr" className="input-base mt-2 w-full px-3.5 py-3" />
                </label>
                <label className="block text-sm font-700 text-foreground">
                  Deadline
                  <input type="date" value={form.deadline} onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))} className="input-base mt-2 w-full px-3.5 py-3" />
                </label>
              </div>
              <label className="block text-sm font-700 text-foreground">
                Tags
                <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="Ivory, embroidery, quick dispatch" className="input-base mt-2 w-full px-3.5 py-3" />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowPostForm(false)} className="btn-secondary px-4 py-2.5 text-sm">Cancel</button>
              <button onClick={() => void handlePost()} className="btn-primary px-4 py-2.5 text-sm">Post requirement</button>
            </div>
          </section>
        </div>
      )}

      {showReferenceMatches && (
        <div className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center" onMouseDown={() => setShowReferenceMatches(false)}>
          <section className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:p-6" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-800 uppercase tracking-wide text-primary">Reference match</p>
                <h2 className="mt-1 text-xl font-800 text-foreground">Visual supplier matches</h2>
                <p className="mt-1 text-xs text-muted-foreground">{referenceImageName || 'Uploaded reference image'}</p>
              </div>
              <button onClick={() => setShowReferenceMatches(false)} className="ft-icon-button" aria-label="Close reference matches">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>

            {matchStatus === 'scanning' ? (
              <div className="py-16 text-center">
                <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="mt-4 text-sm font-700 text-foreground">Comparing colour, texture and design details…</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {referenceVendorMatches.map((match) => (
                  <article key={match.id} className="overflow-hidden rounded-2xl border border-border bg-muted/20">
                    <AppImage src={match.image} alt={match.title} width={640} height={720} className="h-52 w-full object-cover" />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-700 text-primary">{match.vendor} · {match.city}</p>
                          <h3 className="mt-1 font-800 text-foreground">{match.title}</h3>
                        </div>
                        <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-800 text-success">{match.confidence}%</span>
                      </div>
                      <p className="mt-3 text-sm font-800 text-foreground">{match.price}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{match.availability}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {match.tags.map((tag) => <span key={tag} className="rounded-full bg-card px-2 py-1 text-[11px] text-muted-foreground">{tag}</span>)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeChatReq && (
        <InWebsiteChat
          isOpen={!!activeChatReq}
          onClose={() => setActiveChatReq(null)}
          contextType="requirement"
          contextId={activeChatReq.id}
          contextTitle={activeChatReq.title}
          currentUserRole={userRole}
        />
      )}
    </div>
  );
}
