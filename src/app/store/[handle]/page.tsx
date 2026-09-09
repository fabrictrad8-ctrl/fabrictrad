'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import StarRatingDisplay from '@/components/commerce/StarRatingDisplay';

type StoreProfile = {
  id: string;
  name: string;
  bio: string;
  bannerUrl: string | null;
  isVerified: boolean;
  isEarlyBird: boolean;
  earlyBirdRank: number | null;
};

type StoreProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  compareAtPrice: number | null;
  unit: string;
  moq: number;
  available: number;
  image: string | null;
};

type SellerReviewRow = {
  id: string;
  rating: number;
  title: string;
  body: string;
  is_verified_purchase: boolean;
  created_at: string;
};

function StorefrontClient({ handle }: { handle: string }) {
  const [seller, setSeller] = useState<StoreProfile | null | undefined>(undefined);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [reviews, setReviews] = useState<SellerReviewRow[]>([]);
  const [ratingAverage, setRatingAverage] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const supabase = createClient();
      const { data: profile, error: profileError } = await supabase
        .from('seller_profiles')
        .select('id,display_name,legal_business_name,store_name,store_bio,store_banner_url,verification_status,is_active,is_early_bird,early_bird_rank')
        .ilike('store_handle', handle)
        .eq('is_active', true)
        .eq('verification_status', 'verified')
        .maybeSingle();

      if (!mounted) return;
      if (profileError || !profile) {
        setSeller(null);
        return;
      }

      setSeller({
        id: profile.id,
        name: profile.store_name || profile.display_name || profile.legal_business_name || 'FabricTrad seller',
        bio: profile.store_bio || '',
        bannerUrl: profile.store_banner_url || null,
        isVerified: profile.verification_status === 'verified',
        isEarlyBird: profile.is_early_bird === true,
        earlyBirdRank: profile.early_bird_rank ?? null,
      });

      const { data: rows, error: productsError } = await supabase
        .from('seller_products')
        .select('id,name,category,price_per_unit,compare_at_price,unit,moq,available_quantity,reserved_quantity,image_url')
        .eq('seller_id', profile.id)
        .eq('status', 'active')
        .eq('approval_status', 'approved')
        .gt('available_quantity', 0)
        .order('updated_at', { ascending: false })
        .limit(60);

      if (!mounted) return;
      if (productsError) {
        setError('Live products could not be loaded.');
        return;
      }

      setProducts(
        (rows || []).map((row) => ({
          id: row.id,
          name: row.name || 'Product',
          category: row.category || 'Other',
          price: Number(row.price_per_unit || 0),
          compareAtPrice: row.compare_at_price ? Number(row.compare_at_price) : null,
          unit: row.unit || 'mtr',
          moq: Number(row.moq || 1),
          available: Math.max(0, Number(row.available_quantity || 0) - Number(row.reserved_quantity || 0)),
          image: row.image_url || null,
        }))
      );

      const [{ data: reviewRows }, { data: aggregate }] = await Promise.all([
        supabase
          .from('seller_reviews')
          .select('id,rating,title,body,is_verified_purchase,created_at')
          .eq('seller_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('seller_rating_aggregates').select('review_count,avg_rating').eq('seller_id', profile.id).maybeSingle(),
      ]);
      if (!mounted) return;
      setReviews((reviewRows || []) as SellerReviewRow[]);
      setRatingCount(Number(aggregate?.review_count || 0));
      setRatingAverage(Number(aggregate?.avg_rating || 0));
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [handle]);

  if (seller === undefined) {
    return (
      <div className="ft-storefront-content py-14">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        </div>
      </div>
    );
  }

  if (seller === null) {
    return (
      <div className="ft-storefront-content py-16">
        <div className="ft-card ft-empty-state mx-auto max-w-lg">
          <div>
            <Icon name="BuildingStorefrontIcon" size={36} className="mx-auto text-primary" />
            <h1 className="mt-4 text-lg font-800">This store could not be found</h1>
            <p className="mt-2 text-sm text-muted-foreground">The store link may be incorrect, or this seller is not yet verified and live on FabricTrad.</p>
            <Link href="/vendors" className="ft-primary-action mt-5 inline-flex px-5 py-2.5 text-sm">Browse verified suppliers</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <section
        className="relative flex min-h-[220px] items-end bg-gradient-to-br from-primary/20 to-secondary/20 px-4 py-10 sm:px-6 lg:px-8"
        style={seller.bannerUrl ? { backgroundImage: `url(${seller.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="relative z-10 mx-auto w-full max-w-[1200px]">
          <div className="flex flex-wrap items-center gap-2">
            {seller.isVerified && <span className="ft-badge ft-badge--success ft-badge--premium"><Icon name="CheckBadgeIcon" size={13} /> Verified seller</span>}
            {seller.isEarlyBird && <span className="ft-badge ft-badge--warning"><Icon name="SparklesIcon" size={13} /> Founding seller #{seller.earlyBirdRank}</span>}
          </div>
          <h1 className="mt-3 text-3xl font-800 tracking-tight text-foreground">{seller.name}</h1>
          <StarRatingDisplay rating={ratingAverage} count={ratingCount} className="mt-2" />
          {seller.bio && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{seller.bio}</p>}
        </div>
      </section>

      <section className="ft-storefront-content py-7 sm:py-9">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-800 text-foreground">Live products from this store</h2>
          <span className="ft-orange-chip">{products.length} live product{products.length === 1 ? '' : 's'}</span>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">{error}</div>
        )}

        {products.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <Link key={product.id} href={`/product-detail?id=${encodeURIComponent(`seller-${product.id}`)}`} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {product.image ? (
                    <AppImage src={product.image} alt={product.name} fill sizes="(max-width:640px) 100vw,25vw" className="object-cover transition duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Icon name="PhotoIcon" size={36} className="text-muted-foreground/40" /></div>
                  )}
                  {!!product.compareAtPrice && product.compareAtPrice > product.price && (
                    <span className="absolute right-2 top-2 rounded-full bg-error px-2 py-1 text-[10px] font-800 text-white">{Math.round((1 - product.price / product.compareAtPrice) * 100)}% OFF</span>
                  )}
                </div>
                <div className="p-4">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-650 text-muted-foreground">{product.category}</span>
                  <h3 className="mt-2 line-clamp-2 text-sm font-800 text-foreground group-hover:text-primary">{product.name}</h3>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-base font-800 text-primary">₹{product.price.toLocaleString('en-IN')}<span className="text-xs font-500 text-muted-foreground">/{product.unit}</span></span>
                      {!!product.compareAtPrice && product.compareAtPrice > product.price && <span className="text-[11px] text-muted-foreground line-through">₹{product.compareAtPrice.toLocaleString('en-IN')}</span>}
                    </span>
                    <span className="text-[10px] font-700 text-muted-foreground">MOQ {product.moq}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-success">{product.available.toLocaleString('en-IN')} {product.unit} available</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="ft-card ft-empty-state">
            <div>
              <Icon name="ArchiveBoxIcon" size={32} className="mx-auto text-muted-foreground" />
              <h3 className="mt-3 text-sm font-800">No live products right now</h3>
              <p className="mt-1 text-xs text-muted-foreground">This store has no approved, in-stock listings at the moment.</p>
            </div>
          </div>
        )}
      </section>

      <section className="ft-storefront-content pb-12">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-800 text-foreground">Buyer reviews</h2>
          <StarRatingDisplay rating={ratingAverage} count={ratingCount} />
        </div>
        {reviews.length ? (
          <div className="space-y-3">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Icon
                        key={value}
                        name="StarIcon"
                        variant="solid"
                        size={14}
                        className={value <= review.rating ? 'text-warning' : 'text-muted-foreground/25'}
                      />
                    ))}
                  </span>
                  <span className="text-sm font-800 text-foreground">{review.title}</span>
                  {review.is_verified_purchase && (
                    <span className="ft-badge ft-badge--success">
                      <Icon name="CheckBadgeIcon" size={12} /> Verified purchase
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.body}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="ft-card ft-empty-state">
            <div>
              <Icon name="StarIcon" size={30} className="mx-auto text-muted-foreground" />
              <h3 className="mt-3 text-sm font-800">No reviews yet</h3>
              <p className="mt-1 text-xs text-muted-foreground">Reviews appear here once buyers rate a fulfilled order from this store.</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export default function StorePage() {
  const params = useParams<{ handle: string }>();
  const handle = String(params?.handle || '');

  return (
    <BuyerOnlyGuard>
      <main className="ft-storefront min-h-screen">
        <Header />
        <div className="pt-16">
          <StorefrontClient handle={handle} />
        </div>
        <Footer />
      </main>
    </BuyerOnlyGuard>
  );
}
