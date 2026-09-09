'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import BottomSheet from '@/components/BottomSheet';

type ExistingReview = { rating: number; title: string; body: string } | null;

type SellerReviewSheetProps = {
  open: boolean;
  onClose: () => void;
  sellerId: string;
  sellerName: string;
  existingReview?: ExistingReview;
  onSubmitted: () => void;
};

export default function SellerReviewSheet({
  open,
  onClose,
  sellerId,
  sellerName,
  existingReview,
  onSubmitted,
}: SellerReviewSheetProps) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState(existingReview?.title || '');
  const [body, setBody] = useState(existingReview?.body || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRating(existingReview?.rating || 0);
    setHoverRating(0);
    setTitle(existingReview?.title || '');
    setBody(existingReview?.body || '');
  }, [open, existingReview]);

  const submit = async () => {
    if (rating < 1) return toast.error('Choose a star rating.');
    if (title.trim().length < 3) return toast.error('Add a short review title.');
    if (body.trim().length < 10) return toast.error('Write a few more words about your experience.');

    setSubmitting(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, rating, title: title.trim(), body: body.trim() }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'The review could not be saved.');
      toast.success(existingReview ? 'Review updated.' : 'Review posted. Thank you!');
      onSubmitted();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The review could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={existingReview ? 'Edit your review' : 'Rate this seller'}
      ariaLabel={`Review ${sellerName}`}
      footer={
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="btn-primary w-full rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {submitting ? 'Saving…' : existingReview ? 'Update review' : 'Post review'}
        </button>
      }
    >
      <p className="mb-4 text-xs text-muted-foreground">Your experience with {sellerName}</p>
      <div className="mb-4 flex items-center gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            onClick={() => setRating(value)}
            onMouseEnter={() => setHoverRating(value)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0.5"
          >
            <Icon
              name="StarIcon"
              variant="solid"
              size={30}
              className={(hoverRating || rating) >= value ? 'text-warning' : 'text-muted-foreground/30'}
            />
          </button>
        ))}
      </div>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-800 text-foreground">Title</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          placeholder="e.g. Great fabric quality, on-time dispatch"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-800 text-foreground">Review</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="What stood out about the fabric, dispatch, or service?"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>
    </BottomSheet>
  );
}
