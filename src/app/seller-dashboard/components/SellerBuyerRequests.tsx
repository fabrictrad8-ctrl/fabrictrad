'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import InWebsiteChat from '@/app/components/InWebsiteChat';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface SellerVisibleRequirement {
  id: string;
  buyerId: string;
  buyerName: string;
  title: string;
  description: string;
  category: string;
  quantity: string;
  budget: string;
  deadline: string;
  postedAt: string;
  responses: number;
  tags: string[];
}

const demoRequests: SellerVisibleRequirement[] = [
  {
    id: 'DEMO-REQ-001',
    buyerId: 'fabrictrad-demo-buyer',
    buyerName: 'Verified buyer',
    title: 'Need 180 mtr ivory embroidered net',
    description:
      'Wedding-season ivory embroidered net with soft hand feel. Buyer needs quick dispatch and sample availability.',
    category: 'Net / Embroidered',
    quantity: '180 mtr',
    budget: '₹750 - ₹950/mtr',
    deadline: '22 Jul 2026',
    postedAt: 'Today',
    responses: 3,
    tags: ['Ivory', 'Embroidery', 'Wedding', 'Fast dispatch'],
  },
  {
    id: 'DEMO-REQ-002',
    buyerId: 'fabrictrad-demo-buyer-2',
    buyerName: 'Verified buyer',
    title: 'Cotton cambric for kurti production',
    description:
      'Looking for repeatable cambric quality in pastel shades. Buyer will discuss order only after seller responds to this request.',
    category: 'Cotton / Khadi',
    quantity: '500 mtr',
    budget: '₹110 - ₹145/mtr',
    deadline: 'Flexible',
    postedAt: 'Yesterday',
    responses: 6,
    tags: ['Cambric', 'Pastel', 'Repeat order'],
  },
];

const categories = ['All', 'Net / Embroidered', 'Cotton / Khadi', 'Georgette', 'Linen'];

function formatDate(value?: string | null) {
  if (!value) return 'Recently';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function SellerBuyerRequests() {
  const { user, isDemoAccount } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [requirements, setRequirements] = useState<SellerVisibleRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [activeRequirement, setActiveRequirement] = useState<SellerVisibleRequirement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadRequirements() {
      if (isDemoAccount) {
        setRequirements(demoRequests);
        setLoading(false);
        return;
      }

      if (!user?.id) {
        setRequirements([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('buyer_requirements')
        .select(
          'id,buyer_id,title,description,category,quantity,budget,deadline,tags,response_count,created_at'
        )
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!mounted) return;
      setRequirements(
        error
          ? []
          : (data || []).map((row) => ({
              id: row.id,
              buyerId: row.buyer_id,
              buyerName: 'Verified buyer',
              title: row.title,
              description: row.description,
              category: row.category,
              quantity: row.quantity,
              budget: row.budget,
              deadline: row.deadline ? formatDate(row.deadline) : 'Flexible',
              postedAt: formatDate(row.created_at),
              responses: Number(row.response_count || 0),
              tags: Array.isArray(row.tags) ? row.tags : [],
            }))
      );
      setLoading(false);
    }

    loadRequirements();
    return () => {
      mounted = false;
    };
  }, [isDemoAccount, supabase, user?.id]);

  const filtered = requirements.filter((request) => {
    const matchesCategory = selectedCategory === 'All' || request.category === selectedCategory;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      request.title.toLowerCase().includes(q) ||
      request.description.toLowerCase().includes(q) ||
      request.tags.some((tag) => tag.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-800 text-foreground">Buyer Requests</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Open requirements posted by buyers. Sellers can respond only from these buyer-created
            requests or from buyer-started product/order chats.
          </p>
        </div>
        <div className="rounded-xl border border-success/20 bg-success/10 px-3 py-2">
          <p className="text-xs font-700 text-success">No seller-to-seller browsing</p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Icon
              name="MagnifyingGlassIcon"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search buyer requests by fabric, work, colour, tags..."
              className="input-base w-full rounded-xl py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-700 transition-colors ${
                  selectedCategory === category
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: 'Open Requests', value: requirements.length, icon: 'MegaphoneIcon' },
          {
            label: 'Matched Tags',
            value: new Set(requirements.flatMap((request) => request.tags)).size,
            icon: 'TagIcon',
          },
          {
            label: 'Avg Responses',
            value:
              requirements.length > 0
                ? Math.round(
                    requirements.reduce((sum, request) => sum + request.responses, 0) /
                      requirements.length
                  )
                : 0,
            icon: 'ChatBubbleLeftRightIcon',
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-card p-4">
            <Icon name={stat.icon as 'MegaphoneIcon'} size={18} className="mb-2 text-primary" />
            <p className="text-xl font-800 text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {loading && (
          <div className="rounded-2xl border border-border bg-card py-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center">
            <Icon name="MegaphoneIcon" size={32} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-800 text-foreground">No matching buyer requests</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Buyer requirements will appear here when live buyers post requests matching your
              search or category filters.
            </p>
          </div>
        )}

        {filtered.map((request) => (
          <div key={request.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="mono-id">{request.id}</span>
                  <span className="rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-xs font-700 text-success">
                    Buyer posted
                  </span>
                  <span className="text-xs text-muted-foreground">{request.postedAt}</span>
                </div>
                <h2 className="text-base font-800 text-foreground">{request.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {request.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    request.category,
                    request.quantity,
                    request.budget,
                    `By ${request.deadline}`,
                  ].map((detail) => (
                    <span key={detail} className="rounded-lg bg-muted px-2 py-1 text-xs">
                      {detail}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {request.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="w-full shrink-0 lg:w-56">
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Existing seller responses</p>
                  <p className="text-lg font-800 text-foreground">{request.responses}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRequirement(request)}
                  className="btn-primary mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
                >
                  <Icon name="ChatBubbleLeftRightIcon" size={15} />
                  Respond to Request
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeRequirement && (
        <InWebsiteChat
          contextId={activeRequirement.id}
          contextTitle={activeRequirement.title}
          otherPartyName={activeRequirement.buyerName}
          otherPartyAvatar=""
          currentUserRole="seller"
          onClose={() => setActiveRequirement(null)}
        />
      )}
    </div>
  );
}
