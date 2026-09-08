'use client';

import { useEffect, useMemo, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { type CatalogMedia } from '@/lib/catalog';
import { useProduct } from '@/lib/hooks/useProduct';

const VIEW_LABELS: Record<CatalogMedia['viewType'], string> = {
  front: 'Front',
  back: 'Back',
  detail: 'Detail',
  reel: 'Reel',
  other: 'Media',
};

export default function ProductGallery() {
  const { product, loading } = useProduct();
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const media = useMemo<CatalogMedia[]>(() => {
    if (product.media?.length) return product.media;
    return (product.images.length ? product.images : [product.image]).map((url, index) => ({
      id: `fallback-${index}`,
      type: 'image',
      viewType: index === 0 ? 'front' : 'detail',
      url,
      alt: `${product.name}, image ${index + 1}`,
    }));
  }, [product.image, product.images, product.media, product.name]);

  const active = media[activeIndex] || media[0];

  useEffect(() => {
    setActiveIndex(0);
    setZoom(false);
    setFullscreen(false);
  }, [product.id, product.selectedVariantId]);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  if (loading) {
    return <div className="aspect-square animate-pulse rounded-2xl border border-border bg-muted" />;
  }

  const showPrevious = () => {
    setActiveIndex((current) => (current - 1 + media.length) % media.length);
    setZoom(false);
  };
  const showNext = () => {
    setActiveIndex((current) => (current + 1) % media.length);
    setZoom(false);
  };

  const mainMedia = (large = false) => (
    <div className={`relative h-full w-full overflow-hidden bg-[#0f1319] ${active.type === 'image' ? 'cursor-zoom-in' : ''}`}>
      {active.type === 'video' ? (
        <video
          key={active.url}
          src={active.url}
          controls
          autoPlay={fullscreen}
          muted={!fullscreen}
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
          aria-label={active.alt}
        />
      ) : (
        <button
          type="button"
          onClick={() => (large ? setZoom((current) => !current) : setFullscreen(true))}
          className="relative h-full w-full"
          aria-label={large && zoom ? `Zoom out of ${product.name}` : `Open ${product.name} detail view`}
        >
          <AppImage
            src={active.url}
            alt={active.alt || product.alt}
            fill
            priority={!large}
            sizes={large ? '100vw' : '(max-width: 1024px) 100vw, 66vw'}
            className={`object-contain transition-transform duration-500 ${large && zoom ? 'scale-150' : 'scale-100'}`}
          />
        </button>
      )}

      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-black/65 px-3 py-1 text-xs font-800 text-white backdrop-blur">
          {active.type === 'video' ? 'Product reel' : VIEW_LABELS[active.viewType]}
        </span>
        {active.durationSeconds && (
          <span className="rounded-full bg-black/65 px-3 py-1 text-xs text-white backdrop-blur">
            {active.durationSeconds.toFixed(0)} sec
          </span>
        )}
      </div>

      {media.length > 1 && (
        <>
          <button
            type="button"
            onClick={showPrevious}
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg hover:bg-white"
            aria-label="Previous product media"
          >
            <Icon name="ChevronLeftIcon" size={18} />
          </button>
          <button
            type="button"
            onClick={showNext}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg hover:bg-white"
            aria-label="Next product media"
          >
            <Icon name="ChevronRightIcon" size={18} />
          </button>
        </>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs text-white">
        {activeIndex + 1} / {media.length}
      </div>
      {active.type === 'image' && (
        <button
          type="button"
          onClick={() => (large ? setZoom((current) => !current) : setFullscreen(true))}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs text-white"
        >
          <Icon name="MagnifyingGlassPlusIcon" size={13} />
          {large && zoom ? 'Zoom out' : 'View detail'}
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="aspect-square">{mainMedia()}</div>

        <div className="border-t border-border p-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {media.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveIndex(index);
                  setZoom(false);
                }}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-muted ${
                  activeIndex === index ? 'border-primary ring-2 ring-primary/10' : 'border-border hover:border-muted-foreground'
                }`}
                aria-label={`Show ${VIEW_LABELS[item.viewType]} ${item.type}`}
                aria-current={activeIndex === index}
              >
                {item.type === 'video' ? (
                  <>
                    <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
                      <Icon name="PlayIcon" size={22} variant="solid" />
                    </span>
                  </>
                ) : (
                  <AppImage src={item.url} alt={item.alt} fill sizes="80px" className="object-cover" />
                )}
                <span className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5 text-[9px] font-800 uppercase text-white">
                  {item.type === 'video' ? 'Reel' : VIEW_LABELS[item.viewType]}
                </span>
              </button>
            ))}
            <a
              href="#drape-on"
              className="flex min-w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-secondary/10 p-2"
            >
              <Icon name="SparklesIcon" size={17} className="text-primary" />
              <span className="text-center text-xs font-800 leading-tight text-primary">Virtual Try-On</span>
            </a>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Use front/back views and reels to confirm fall, finish and design. Select a detail image for closer inspection.
          </p>
        </div>
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} media viewer`}
        >
          <button
            type="button"
            onClick={() => {
              setFullscreen(false);
              setZoom(false);
            }}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
            aria-label="Close product media viewer"
          >
            <Icon name="XMarkIcon" size={22} />
          </button>
          <div className="mx-auto h-full max-w-7xl overflow-hidden rounded-2xl border border-white/10">
            {mainMedia(true)}
          </div>
        </div>
      )}
    </>
  );
}
