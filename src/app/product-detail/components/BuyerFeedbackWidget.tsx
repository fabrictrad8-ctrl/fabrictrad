'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface ReviewRow {
  overall_rating: number;
  fabric_quality_rating: number;
  seller_service_rating: number;
  title: string;
  body: string;
  buyer_name: string;
  buyer_city: string;
  created_at: string;
  order_ref: string;
}

export default function BuyerFeedbackWidget({ sellerId }: { sellerId?: string }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'ratings'>('overview');
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgOverall, setAvgOverall] = useState(0);
  const [avgFabric, setAvgFabric] = useState(0);
  const [avgService, setAvgService] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const query = supabase
      .from('seller_reviews')
      .select('overall_rating,fabric_quality_rating,seller_service_rating,title,body,buyer_name,buyer_city,created_at,order_ref')
      .order('created_at', { ascending: false })
      .limit(10);
    if (sellerId) query.eq('seller_id', sellerId);

    const { data } = await query;
    const rows = (data || []) as ReviewRow[];
    setReviews(rows);
    setTotalCount(rows.length);
    if (rows.length > 0) {
      setAvgOverall(Math.round((rows.reduce((s, r) => s + r.overall_rating, 0) / rows.length) * 10) / 10);
      const fabricRows = rows.filter((r) => r.fabric_quality_rating > 0);
      setAvgFabric(fabricRows.length ? Math.round((fabricRows.reduce((s, r) => s + r.fabric_quality_rating, 0) / fabricRows.length) * 10) / 10 : 0);
      const serviceRows = rows.filter((r) => r.seller_service_rating > 0);
      setAvgService(serviceRows.length ? Math.round((serviceRows.reduce((s, r) => s + r.seller_service_rating, 0) / serviceRows.length) * 10) / 10 : 0);
    }
    setLoading(false);
  }, [sellerId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const tabs = [
    { key: 'overview' as const, label: 'Recent Reviews', icon: 'StarIcon' },
    { key: 'ratings' as const, label: 'Rating Breakdown', icon: 'ChartBarIcon' },
  ];

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border overflow-hidden mt-6 p-8 text-center">
        <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (totalCount === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden mt-6">
      <div className="p-4 border-b border-border bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Icon name="StarIcon" size={16} className="text-amber-500" variant="solid" />
            </div>
            <div>
              <h3 className="font-700 text-sm text-foreground">Buyer Feedback</h3>
              <p className="text-xs text-muted-foreground">From {totalCount} verified review{totalCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-800 text-foreground">{avgOverall}</span>
            <div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Icon key={s} name="StarIcon" size={12} className={s <= Math.round(avgOverall) ? 'text-amber-400' : 'text-amber-200'} variant="solid" />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{totalCount} reviews</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-600 whitespace-nowrap border-b-2 transition-colors min-h-[40px] ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon name={tab.icon as 'StarIcon'} size={13} />{tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-3">Recent Reviews</p>
            {reviews.slice(0, 5).map((review, i) => (
              <div key={i} className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-800 text-amber-700">{review.buyer_name?.[0] || 'B'}</span>
                    </div>
                    <div>
                      <p className="text-xs font-700 text-foreground">{review.buyer_name}</p>
                      <p className="text-xs text-muted-foreground">{review.buyer_city} · {new Date(review.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Icon key={s} name="StarIcon" size={11} className={s <= review.overall_rating ? 'text-amber-400' : 'text-muted'} variant="solid" />
                    ))}
                  </div>
                </div>
                <p className="text-xs font-700 text-foreground mb-0.5">{review.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{review.body}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ratings' && (
          <div className="space-y-4">
            <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-3">Average Ratings</p>
            {[
              { label: 'Overall', value: avgOverall, color: 'bg-amber-400' },
              { label: 'Fabric Quality', value: avgFabric, color: 'bg-primary' },
              { label: 'Seller Service', value: avgService, color: 'bg-success' },
            ].filter((item) => item.value > 0).map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs font-600 text-foreground w-28 shrink-0">{item.label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${(item.value / 5) * 100}%` }} />
                </div>
                <span className="text-xs font-700 text-foreground w-8 text-right">{item.value}/5</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
