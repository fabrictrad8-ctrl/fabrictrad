'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';


const reviews = [
  {
    id: 1,
    buyer: 'Mehta Garments Pvt Ltd',
    city: 'Mumbai',
    rating: 5,
    date: '12 Jul 2026',
    title: 'Excellent quality, fast dispatch',
    body: 'Received exactly 300 metres as ordered. Fabric quality is top-notch — very smooth dyeable nett. Dispatch was within 2 days. Will reorder.',
    verified: true,
    orderId: 'FT-ORD-004821',
    helpful: 14,
  },
  {
    id: 2,
    buyer: 'Patel Creations',
    city: 'Ahmedabad',
    rating: 5,
    date: '05 Jul 2026',
    title: 'Consistent quality across bulk orders',
    body: 'Third time ordering from this seller. Every batch is consistent. GST invoice provided on time. Highly recommended for bulk buyers.',
    verified: true,
    orderId: 'FT-ORD-004612',
    helpful: 9,
  },
  {
    id: 3,
    buyer: 'Sharma Textiles',
    city: 'Delhi',
    rating: 4,
    date: '28 Jun 2026',
    title: 'Good fabric, slight delay in response',
    body: 'Fabric quality is as described. Seller took about 4 hours to confirm the order. Delivery was on time. Overall satisfied.',
    verified: true,
    orderId: 'FT-ORD-004390',
    helpful: 5,
  },
];

const ratingBreakdown = [
  { stars: 5, count: 98, pct: 79 },
  { stars: 4, count: 18, pct: 15 },
  { stars: 3, count: 5, pct: 4 },
  { stars: 2, count: 2, pct: 2 },
  { stars: 1, count: 1, pct: 1 },
];

export default function SellerRatings() {
  const [helpful, setHelpful] = useState<Record<number, boolean>>({});

  return (
    <div className="bg-card rounded-2xl border border-border p-5 mt-6">
      <h2 className="text-base font-800 text-foreground mb-5">Customer Reviews</h2>

      {/* Summary */}
      <div className="flex flex-col sm:flex-row gap-6 mb-6 pb-6 border-b border-border">
        <div className="flex flex-col items-center justify-center shrink-0">
          <span className="text-5xl font-800 text-foreground">4.8</span>
          <div className="flex items-center gap-0.5 my-1.5">
            {[1,2,3,4,5].map((s) => (
              <Icon key={s} name="StarIcon" size={16} className={s <= 4 ? 'text-amber-400' : 'text-amber-200'} variant="solid" />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">124 verified reviews</span>
        </div>
        <div className="flex-1 space-y-1.5">
          {ratingBreakdown.map((r) => (
            <div key={r.stars} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4 text-right">{r.stars}</span>
              <Icon name="StarIcon" size={11} className="text-amber-400 shrink-0" variant="solid" />
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${r.pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground w-6">{r.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Review List */}
      <div className="space-y-5">
        {reviews.map((review) => (
          <div key={review.id} className="pb-5 border-b border-border last:border-b-0 last:pb-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-800 text-secondary">{review.buyer[0]}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-700 text-foreground">{review.buyer}</span>
                    {review.verified && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-600 text-success bg-success/10 border border-success/20 rounded-full px-1.5 py-0.5">
                        <Icon name="CheckBadgeIcon" size={11} className="text-success" />
                        Verified Purchase
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{review.city} · {review.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {[1,2,3,4,5].map((s) => (
                  <Icon key={s} name="StarIcon" size={12} className={s <= review.rating ? 'text-amber-400' : 'text-amber-200'} variant="solid" />
                ))}
              </div>
            </div>
            <p className="text-sm font-700 text-foreground mb-1">{review.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">{review.body}</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Order: <span className="mono-id">{review.orderId}</span></span>
              <button
                onClick={() => setHelpful((h) => ({ ...h, [review.id]: !h[review.id] }))}
                className={`flex items-center gap-1 text-xs font-600 transition-colors ${helpful[review.id] ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
              >
                <Icon name="HandThumbUpIcon" size={13} />
                Helpful ({review.helpful + (helpful[review.id] ? 1 : 0)})
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
