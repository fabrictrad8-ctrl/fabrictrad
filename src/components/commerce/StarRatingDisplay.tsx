import Icon from '@/components/ui/AppIcon';

type StarRatingDisplayProps = {
  rating: number;
  count: number;
  size?: number;
  className?: string;
};

export default function StarRatingDisplay({ rating, count, size = 14, className = '' }: StarRatingDisplayProps) {
  if (count <= 0) {
    return <span className={`text-xs text-muted-foreground ${className}`}>No reviews yet</span>;
  }
  const rounded = Math.round(rating * 10) / 10;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Icon name="StarIcon" variant="solid" size={size} className="text-warning" />
      <span className="text-xs font-800 text-foreground">{rounded.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">
        ({count} review{count === 1 ? '' : 's'})
      </span>
    </span>
  );
}
