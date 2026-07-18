'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface Review {
  id: number;
  buyer: string;
  city: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified: boolean;
  orderId: string;
  helpful: number;
}

const initialReviews: Review[] = [
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
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const totalReviews = ratingBreakdown.reduce((s, r) => s + r.count, 0) + (submitted ? 1 : 0);
  const aggregateRating = 4.8;

  const handleSubmitReview = () => {
    if (!newRating || !newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      const newReview: Review = {
        id: Date.now(),
        buyer: 'You (Verified Buyer)',
        city: 'Your City',
        rating: newRating,
        date: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        title: newTitle.trim(),
        body: newBody.trim(),
        verified: true,
        orderId: 'FT-ORD-005892',
        helpful: 0,
      };
      setReviews((prev) => [newReview, ...prev]);
      setSubmitting(false);
      setSubmitted(true);
      setShowReviewForm(false);
      setNewRating(0);
      setNewTitle('');
      setNewBody('');
    }, 800);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 mt-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-800 text-foreground">Customer Reviews</h2>
        {!showReviewForm && !submitted && (
          <button
            onClick={() => setShowReviewForm(true)}
            className="flex items-center gap-1.5 btn-secondary px-3 py-2 text-xs rounded-xl"
          >
            <Icon name="PencilSquareIcon" size={14} />
            Write a Review
          </button>
        )}
        {submitted && (
          <span className="flex items-center gap-1 text-xs font-600 text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-1">
            <Icon name="CheckCircleIcon" size={13} />
            Review submitted!
          </span>
        )}
      </div>

      {/* Review Form */}
      {showReviewForm && (
        <div className="mb-6 p-4 bg-muted/50 rounded-2xl border border-border">
          <h3 className="text-sm font-800 text-foreground mb-4">Rate Your Experience</h3>
          {/* Star Rating Input */}
          <div className="mb-4">
            <p className="text-xs font-600 text-muted-foreground mb-2">Your Rating *</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setNewRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Icon
                    name="StarIcon"
                    size={28}
                    className={star <= (hoverRating || newRating) ? 'text-amber-400' : 'text-muted'}
                    variant="solid"
                  />
                </button>
              ))}
              {newRating > 0 && (
                <span className="ml-2 text-sm font-700 text-amber-600">
                  {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][newRating]}
                </span>
              )}
            </div>
          </div>
          {/* Title */}
          <div className="mb-3">
            <label className="text-xs font-600 text-muted-foreground block mb-1.5">
              Review Title *
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Summarize your experience..."
              maxLength={80}
              className="input-base w-full px-3 py-2.5 text-sm rounded-xl"
            />
          </div>
          {/* Body */}
          <div className="mb-4">
            <label className="text-xs font-600 text-muted-foreground block mb-1.5">
              Detailed Review *
            </label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Share details about fabric quality, dispatch speed, seller communication..."
              rows={4}
              maxLength={500}
              className="input-base w-full px-3 py-2.5 text-sm rounded-xl resize-none"
            />
            <p className="text-xs text-muted-foreground text-right mt-1">{newBody.length}/500</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmitReview}
              disabled={!newRating || !newTitle.trim() || !newBody.trim() || submitting}
              className="btn-primary px-4 py-2 text-xs rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Icon name="PaperAirplaneIcon" size={13} />
                  Submit Review
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowReviewForm(false);
                setNewRating(0);
                setNewTitle('');
                setNewBody('');
              }}
              className="btn-secondary px-4 py-2 text-xs rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-col sm:flex-row gap-6 mb-6 pb-6 border-b border-border">
        <div className="flex flex-col items-center justify-center shrink-0">
          <span className="text-5xl font-800 text-foreground">{aggregateRating}</span>
          <div className="flex items-center gap-0.5 my-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Icon
                key={s}
                name="StarIcon"
                size={16}
                className={s <= 4 ? 'text-amber-400' : 'text-amber-200'}
                variant="solid"
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{totalReviews} verified reviews</span>
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
                  <p className="text-xs text-muted-foreground">
                    {review.city} · {review.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Icon
                    key={s}
                    name="StarIcon"
                    size={12}
                    className={s <= review.rating ? 'text-amber-400' : 'text-amber-200'}
                    variant="solid"
                  />
                ))}
              </div>
            </div>
            <p className="text-sm font-700 text-foreground mb-1">{review.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">{review.body}</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Order: <span className="mono-id">{review.orderId}</span>
              </span>
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
