'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface Review {
  id: string;
  buyer_name: string;
  buyer_city: string;
  overall_rating: number;
  fabric_quality_rating: number;
  seller_service_rating: number;
  title: string;
  body: string;
  verified_purchase: boolean;
  order_ref: string;
  helpful_count: number;
  created_at: string;
  photo_urls?: string[] | null;
}

interface RatingBreakdown {
  stars: number;
  count: number;
  pct: number;
}

export default function SellerRatings({ sellerId }: { sellerId?: string }) {
  const { user, profile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [breakdown, setBreakdown] = useState<RatingBreakdown[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [helpful, setHelpful] = useState<Record<string, boolean>>({});
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [fabricRating, setFabricRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const query = supabase
      .from('seller_reviews')
      .select('id,buyer_name,buyer_city,overall_rating,fabric_quality_rating,seller_service_rating,title,body,verified_purchase,order_ref,helpful_count,created_at,photo_urls')
      .order('created_at', { ascending: false })
      .limit(20);

    if (sellerId) {
      query.eq('seller_id', sellerId);
    }

    const { data, error } = await query;
    if (error || !data) {
      setLoading(false);
      return;
    }

    const rows = data as Review[];
    setReviews(rows);
    setTotalCount(rows.length);

    if (rows.length > 0) {
      const avg = rows.reduce((sum, r) => sum + r.overall_rating, 0) / rows.length;
      setAvgRating(Math.round(avg * 10) / 10);

      const counts = [5, 4, 3, 2, 1].map((stars) => {
        const count = rows.filter((r) => Math.round(r.overall_rating) === stars).length;
        return { stars, count, pct: rows.length > 0 ? Math.round((count / rows.length) * 100) : 0 };
      });
      setBreakdown(counts);
    }
    setLoading(false);
  }, [sellerId]);

  useEffect(() => { void loadReviews(); }, [loadReviews]);

  const handleSubmitReview = async () => {
    if (!newRating || !newTitle.trim() || !newBody.trim()) return;
    if (!user?.id) { toast.error('Sign in to submit a review.'); return; }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('seller_reviews').insert({
        seller_id: sellerId || null,
        buyer_id: user.id,
        buyer_name: profile?.full_name || profile?.business_name || 'Verified Buyer',
        buyer_city: profile?.city || '',
        overall_rating: newRating,
        fabric_quality_rating: fabricRating || newRating,
        seller_service_rating: serviceRating || newRating,
        title: newTitle.trim(),
        body: newBody.trim(),
        verified_purchase: true,
        order_ref: '',
        helpful_count: 0,
      });
      if (error) throw error;
      toast.success('Review submitted successfully!');
      setSubmitted(true);
      setShowReviewForm(false);
      setNewRating(0); setFabricRating(0); setServiceRating(0);
      setNewTitle(''); setNewBody('');
      void loadReviews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const markHelpful = async (reviewId: string) => {
    if (helpful[reviewId]) return;
    setHelpful((prev) => ({ ...prev, [reviewId]: true }));
    const supabase = createClient();
    try {
      await supabase.rpc('increment_review_helpful', { review_id: reviewId });
    } catch {
      // Non-blocking
    }
    setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r));
  };

  const StarInput = ({ value, onChange, hover, onHover }: { value: number; onChange: (v: number) => void; hover: number; onHover: (v: number) => void }) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onMouseEnter={() => onHover(star)} onMouseLeave={() => onHover(0)} onClick={() => onChange(star)} className="transition-transform hover:scale-110 min-w-[28px] min-h-[28px] flex items-center justify-center">
          <Icon name="StarIcon" size={24} className={star <= (hover || value) ? 'text-amber-400' : 'text-muted'} variant="solid" />
        </button>
      ))}
      {value > 0 && <span className="ml-2 text-sm font-700 text-amber-600">{['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][value]}</span>}
    </div>
  );

  return (
    <div className="bg-card rounded-2xl border border-border p-5 mt-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-800 text-foreground">Customer Reviews</h2>
        {!showReviewForm && !submitted && user && (
          <button onClick={() => setShowReviewForm(true)} className="flex items-center gap-1.5 btn-secondary px-3 py-2 text-xs rounded-xl min-h-[36px]">
            <Icon name="PencilSquareIcon" size={14} />Write a Review
          </button>
        )}
        {submitted && (
          <span className="flex items-center gap-1 text-xs font-600 text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-1">
            <Icon name="CheckCircleIcon" size={13} />Review submitted!
          </span>
        )}
      </div>

      {showReviewForm && (
        <div className="mb-6 p-4 bg-muted/50 rounded-2xl border border-border">
          <h3 className="text-sm font-800 text-foreground mb-4">Rate Your Experience</h3>
          <div className="mb-4">
            <p className="text-xs font-600 text-muted-foreground mb-2">Overall Rating *</p>
            <StarInput value={newRating} onChange={setNewRating} hover={hoverRating} onHover={setHoverRating} />
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-600 text-muted-foreground mb-2">Fabric Quality</p>
              <StarInput value={fabricRating} onChange={setFabricRating} hover={0} onHover={() => {}} />
            </div>
            <div>
              <p className="text-xs font-600 text-muted-foreground mb-2">Seller Service</p>
              <StarInput value={serviceRating} onChange={setServiceRating} hover={0} onHover={() => {}} />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-600 text-muted-foreground block mb-1.5">Review Title *</label>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Summarize your experience..." maxLength={80} className="input-base w-full px-3 py-2.5 text-sm rounded-xl" />
          </div>
          <div className="mb-4">
            <label className="text-xs font-600 text-muted-foreground block mb-1.5">Detailed Review *</label>
            <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Share details about fabric quality, dispatch speed, seller communication..." rows={4} maxLength={500} className="input-base w-full px-3 py-2.5 text-sm rounded-xl resize-none" />
            <p className="text-xs text-muted-foreground text-right mt-1">{newBody.length}/500</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void handleSubmitReview()} disabled={!newRating || !newTitle.trim() || !newBody.trim() || submitting} className="btn-primary px-4 py-2 text-xs rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 min-h-[36px]">
              {submitting ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</> : <><Icon name="PaperAirplaneIcon" size={13} />Submit Review</>}
            </button>
            <button onClick={() => { setShowReviewForm(false); setNewRating(0); setNewTitle(''); setNewBody(''); }} className="btn-secondary px-4 py-2 text-xs rounded-xl min-h-[36px]">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center"><span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : totalCount === 0 ? (
        <div className="py-10 text-center">
          <Icon name="StarIcon" size={32} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-700 text-foreground">No reviews yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Be the first to review this seller.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-6 mb-6 pb-6 border-b border-border">
            <div className="flex flex-col items-center justify-center shrink-0">
              <span className="text-5xl font-800 text-foreground">{avgRating}</span>
              <div className="flex items-center gap-0.5 my-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Icon key={s} name="StarIcon" size={16} className={s <= Math.round(avgRating) ? 'text-amber-400' : 'text-amber-200'} variant="solid" />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{totalCount} verified review{totalCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex-1 space-y-1.5">
              {breakdown.map((r) => (
                <div key={r.stars} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 text-right">{r.stars}</span>
                  <Icon name="StarIcon" size={11} className="text-amber-400 shrink-0" variant="solid" />
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${r.pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-6">{r.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-border pb-5 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-800 text-primary">{review.buyer_name?.[0] || 'B'}</span>
                    </div>
                    <div>
                      <p className="text-xs font-700 text-foreground">{review.buyer_name}</p>
                      <p className="text-xs text-muted-foreground">{review.buyer_city} · {new Date(review.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Icon key={s} name="StarIcon" size={13} className={s <= review.overall_rating ? 'text-amber-400' : 'text-muted'} variant="solid" />
                      ))}
                    </div>
                    {review.verified_purchase && (
                      <span className="text-[10px] font-600 text-success flex items-center gap-0.5">
                        <Icon name="CheckBadgeIcon" size={11} />Verified
                      </span>
                    )}
                  </div>
                </div>

                {(review.fabric_quality_rating > 0 || review.seller_service_rating > 0) && (
                  <div className="flex flex-wrap gap-3 mb-2">
                    {review.fabric_quality_rating > 0 && (
                      <span className="text-xs text-muted-foreground">Fabric: <span className="font-700 text-foreground">{review.fabric_quality_rating}/5</span></span>
                    )}
                    {review.seller_service_rating > 0 && (
                      <span className="text-xs text-muted-foreground">Service: <span className="font-700 text-foreground">{review.seller_service_rating}/5</span></span>
                    )}
                  </div>
                )}

                <p className="text-sm font-700 text-foreground mb-1">{review.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{review.body}</p>

                {Array.isArray(review.photo_urls) && review.photo_urls.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {review.photo_urls.map((url, i) => (
                      <img key={i} src={url} alt={`Review photo ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-border" />
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <button onClick={() => void markHelpful(review.id)} disabled={helpful[review.id]} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 min-h-[32px] px-2">
                    <Icon name="HandThumbUpIcon" size={13} />
                    Helpful ({review.helpful_count})
                  </button>
                  {review.order_ref && (
                    <span className="text-xs text-muted-foreground font-mono">{review.order_ref}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
