'use client';

import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { productDetailHref } from '@/lib/catalog';
import { useProduct } from '@/lib/hooks/useProduct';
import { useRelatedProducts } from '@/lib/hooks/useRelatedProducts';

export default function RelatedProducts() {
  const { product } = useProduct();
  const { products, loading, scope } = useRelatedProducts({
    productId: product.rawProductId,
    sellerId: product.sellerId,
    category: product.category,
    work: product.work,
  });

  // No real candidates: show nothing rather than an empty/fake-looking block.
  if (!loading && products.length === 0) return null;

  const heading = scope === 'seller' ? 'More from this seller' : 'You may also like';
  const eyebrow = scope === 'seller' ? 'From the same verified seller' : 'From the marketplace';
  const seeAllHref =
    product.category && product.category !== 'Other'
      ? `/marketplace?category=${encodeURIComponent(product.category)}`
      : '/marketplace';

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-800 uppercase tracking-wider text-primary">{eyebrow}</p>
          <h2 className="mt-1 text-section-title text-foreground">{heading}</h2>
        </div>
        <Link href={seeAllHref} className="shrink-0 text-sm font-800 text-primary hover:underline">
          See all
        </Link>
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {loading &&
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="w-40 shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card sm:w-48"
            >
              <div className="aspect-square animate-pulse bg-muted" />
              <div className="space-y-2 p-3">
                <div className="h-4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}

        {!loading &&
          products.map((item) => {
            const isLowStock = item.available > 0 && item.available <= 5;
            return (
              <Link
                key={item.id}
                href={productDetailHref(item)}
                className="ft-marketplace-product-card group w-40 shrink-0 snap-start overflow-hidden sm:w-48"
              >
                <div className="ft-marketplace-product-image relative aspect-square overflow-hidden">
                  <div className="ft-marketplace-image-base absolute inset-0">
                    <AppImage
                      src={item.image}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 640px) 40vw, 200px"
                      className="object-cover transition duration-300 group-hover:scale-[1.025]"
                    />
                  </div>
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    {item.badge === 'new' && (
                      <span className="rounded bg-[#cc0c39] px-2 py-1 text-[10px] font-850 text-white">New</span>
                    )}
                    {isLowStock && (
                      <span className="rounded bg-warning px-2 py-1 text-[10px] font-850 text-white">
                        Only {item.available} left
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-3">
                  <p className="truncate text-[11px] font-700 text-muted-foreground">
                    <Icon name="ShieldCheckIcon" size={12} className="mr-1 inline text-success" />
                    {item.seller}
                  </p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-800 text-foreground group-hover:text-[#b12704]">
                    {item.name}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <p className="text-base font-800 text-[#b12704]">
                      ₹{item.price.toLocaleString('en-IN')}
                      <span className="text-xs font-600 text-muted-foreground">/{item.unit}</span>
                    </p>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    MOQ {item.moq} {item.unit}
                  </p>
                </div>
              </Link>
            );
          })}
      </div>
    </section>
  );
}
