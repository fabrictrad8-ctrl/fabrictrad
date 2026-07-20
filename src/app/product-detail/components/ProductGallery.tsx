'use client';

import { useEffect, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useProduct } from '@/lib/hooks/useProduct';

export default function ProductGallery() {
  const { product, loading } = useProduct();
  const [activeImg, setActiveImg] = useState(0);
  const [zoom, setZoom] = useState(false);
  const images = product.images.length ? product.images : [product.image];

  useEffect(() => {
    setActiveImg(0);
    setZoom(false);
  }, [product.id]);

  if (loading) {
    return <div className="aspect-square animate-pulse rounded-2xl border border-border bg-muted" />;
  }

  const showPrevious = () => setActiveImg((current) => (current - 1 + images.length) % images.length);
  const showNext = () => setActiveImg((current) => (current + 1) % images.length);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div
        className="relative aspect-square cursor-zoom-in overflow-hidden bg-muted"
        onClick={() => setZoom((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') showPrevious();
          if (event.key === 'ArrowRight') showNext();
          if (event.key === 'Enter' || event.key === ' ') setZoom((current) => !current);
        }}
        role="button"
        tabIndex={0}
        aria-label={`${zoom ? 'Zoom out of' : 'Zoom into'} ${product.name}`}
      >
        <AppImage src={images[activeImg]} alt={`${product.name}, image ${activeImg + 1}`} fill priority sizes="(max-width: 1024px) 100vw, 66vw" className={`object-cover transition-transform duration-500 ${zoom ? 'scale-150' : 'scale-100'}`} />

        {images.length > 1 && (
          <>
            <button type="button" onClick={(event) => { event.stopPropagation(); showPrevious(); }} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white" aria-label="Previous product image"><Icon name="ChevronLeftIcon" size={18} /></button>
            <button type="button" onClick={(event) => { event.stopPropagation(); showNext(); }} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white" aria-label="Next product image"><Icon name="ChevronRightIcon" size={18} /></button>
          </>
        )}

        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-xs text-white"><Icon name="MagnifyingGlassPlusIcon" size={12} />{zoom ? 'Zoom out' : 'Zoom'}</div>
        <div className="absolute bottom-3 left-3 rounded-lg bg-black/50 px-2 py-1 text-xs text-white">{activeImg + 1} / {images.length}</div>
      </div>

      <div className="flex gap-2 overflow-x-auto p-3 scrollbar-thin">
        {images.map((image, index) => (
          <button key={`${image}-${index}`} type="button" onClick={() => { setActiveImg(index); setZoom(false); }} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${activeImg === index ? 'border-primary' : 'border-border hover:border-muted-foreground'}`} aria-label={`Show image ${index + 1}`} aria-current={activeImg === index}>
            <AppImage src={image} alt={`${product.name} thumbnail ${index + 1}`} width={64} height={64} className="h-full w-full object-cover" />
          </button>
        ))}
        <a href="#drape-on" className="flex min-w-28 flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-secondary/10 p-2"><Icon name="SparklesIcon" size={16} className="text-primary" /><span className="text-center text-xs font-600 leading-tight text-primary">Virtual Try-On</span><span className="text-xs text-muted-foreground">₹10/image</span></a>
      </div>
    </div>
  );
}
