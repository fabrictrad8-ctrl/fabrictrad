'use client';

import { useEffect, useMemo, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { type CatalogMedia } from '@/lib/catalog';
import { useProduct } from '@/lib/hooks/useProduct';
import { useHorizontalSwipe } from '@/lib/hooks/useHorizontalSwipe';
import { useImagePanZoom } from '@/lib/hooks/useImagePanZoom';
import { useTilt3D } from '@/lib/hooks/useTilt3D';

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
  const [fullscreen, setFullscreen] = useState(false);
  const [tilt3DEnabled, setTilt3DEnabled] = useState(false);

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

  const panZoom = useImagePanZoom({
    onSwipeLeft: () => { if (media.length > 1) showNext(); },
    onSwipeRight: () => { if (media.length > 1) showPrevious(); },
  });
  const tilt3D = useTilt3D(tilt3DEnabled);

  useEffect(() => {
    setActiveIndex(0);
    panZoom.reset();
    setFullscreen(false);
    setTilt3DEnabled(false);
    // panZoom.reset is stable (useCallback with no deps that change here);
    // omitting it keeps this effect scoped to an actual product change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, product.selectedVariantId]);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  const showPrevious = () => {
    setActiveIndex((current) => (current - 1 + media.length) % media.length);
    panZoom.reset();
    setTilt3DEnabled(false);
  };
  const showNext = () => {
    setActiveIndex((current) => (current + 1) % media.length);
    panZoom.reset();
    setTilt3DEnabled(false);
  };
  // Swiping past the last/first image intentionally does nothing rather
  // than wrapping — wrapping under a swipe reads as "nothing happened."
  const swipeHandlers = useHorizontalSwipe(
    () => { if (media.length > 1) showNext(); },
    () => { if (media.length > 1) showPrevious(); }
  );

  if (loading) {
    return <div className="aspect-square animate-pulse rounded-2xl border border-border bg-muted" />;
  }

  const mainMedia = (large = false) => (
    <div
      className={`relative h-full w-full overflow-hidden bg-[#0f1319] ${active.type === 'image' ? 'cursor-zoom-in' : ''}`}
      {...(large ? {} : swipeHandlers)}
    >
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
      ) : large ? (
        <div
          {...(tilt3DEnabled ? tilt3D.bind : panZoom.bind)}
          role="button"
          tabIndex={0}
          aria-label={
            tilt3DEnabled
              ? 'Drag to tilt this photo in 3D'
              : panZoom.isZoomed
                ? `Zoom out of ${product.name}`
                : `Drag to pan, scroll or pinch to zoom into ${product.name}`
          }
          className="relative h-full w-full select-none"
        >
          <AppImage
            src={active.url}
            alt={active.alt || product.alt}
            fill
            priority
            sizes="100vw"
            className="pointer-events-none"
            style={tilt3DEnabled ? { ...tilt3D.style, objectFit: 'contain' } : { ...panZoom.imageStyle, objectFit: 'contain' }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="relative h-full w-full"
          aria-label={`Open ${product.name} detail view`}
        >
          <AppImage
            src={active.url}
            alt={active.alt || product.alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="object-contain"
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
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {large && (
            <button
              type="button"
              onClick={() => {
                if (!tilt3DEnabled) panZoom.reset();
                setTilt3DEnabled((current) => !current);
              }}
              aria-pressed={tilt3DEnabled}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white ${tilt3DEnabled ? 'bg-primary' : 'bg-black/60'}`}
            >
              <Icon name="CubeIcon" size={13} />
              {tilt3DEnabled ? '3D on' : '3D view'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (large) {
                if (tilt3DEnabled) setTilt3DEnabled(false);
                if (panZoom.isZoomed) panZoom.reset(); else panZoom.zoomIn();
              } else {
                setFullscreen(true);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs text-white"
          >
            <Icon name="MagnifyingGlassPlusIcon" size={13} />
            {large && panZoom.isZoomed ? 'Zoom out' : 'View detail'}
          </button>
        </div>
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
                  panZoom.reset();
                  setTilt3DEnabled(false);
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
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Use front/back views and reels to confirm fall, finish and design. Select a detail image for closer inspection.
          </p>

          <a
            href="#drape-on"
            className="ft-drape-promo-banner mt-3 flex items-center gap-3 overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 p-3"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icon name="SparklesIcon" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-850 text-foreground">See it draped on you — free preview</span>
              <span className="block text-xs text-muted-foreground">Upload your photo or use an AI model to visualise fall, colour and fit before you order.</span>
            </span>
            <Icon name="ArrowRightIcon" size={17} className="shrink-0 text-primary" />
          </a>
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
              panZoom.reset();
              setTilt3DEnabled(false);
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
