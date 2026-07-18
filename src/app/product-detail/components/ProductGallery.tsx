'use client';
import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const images = [
  {
    src: 'https://images.unsplash.com/photo-1514830482894-94795a87f997',
    alt: 'Cream soft nett fabric with intricate gold embroidery floral pattern, full view',
  },
  {
    src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1acbbfc48-1773129576236.png',
    alt: 'Close-up macro detail of gold embroidery thread work on white nett fabric',
  },
  {
    src: 'https://img.rocket.new/generatedImages/rocket_gen_img_13cdc9d4f-1772216883669.png',
    alt: 'Draped soft nett fabric showing flow and texture in studio setting',
  },
  {
    src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1b23ddc65-1772723055087.png',
    alt: 'Fabric texture close-up showing weave pattern and embroidery density',
  },
];

export default function ProductGallery() {
  const [activeImg, setActiveImg] = useState(0);
  const [zoom, setZoom] = useState(false);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Main Image */}
      <div
        className="relative aspect-square bg-muted cursor-zoom-in overflow-hidden"
        onClick={() => setZoom(!zoom)}
      >
        <AppImage
          src={images?.[activeImg]?.src}
          alt={images?.[activeImg]?.alt}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 66vw"
          className={`object-cover transition-transform duration-500 ${zoom ? 'scale-150' : 'scale-100'}`}
        />

        {/* Navigation arrows */}
        <button
          onClick={(e) => {
            e?.stopPropagation();
            setActiveImg((prev) => (prev - 1 + images?.length) % images?.length);
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors"
        >
          <Icon name="ChevronLeftIcon" size={18} className="text-foreground" />
        </button>
        <button
          onClick={(e) => {
            e?.stopPropagation();
            setActiveImg((prev) => (prev + 1) % images?.length);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors"
        >
          <Icon name="ChevronRightIcon" size={18} className="text-foreground" />
        </button>

        {/* Zoom hint */}
        <div className="absolute bottom-3 right-3 bg-black/40 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
          <Icon name="MagnifyingGlassPlusIcon" size={12} />
          {zoom ? 'Click to zoom out' : 'Click to zoom'}
        </div>

        {/* Image counter */}
        <div className="absolute bottom-3 left-3 bg-black/40 text-white text-xs px-2 py-1 rounded-lg">
          {activeImg + 1} / {images?.length}
        </div>
      </div>
      {/* Thumbnails */}
      <div className="flex gap-2 p-3">
        {images?.map((img, i) => (
          <button
            key={i}
            onClick={() => setActiveImg(i)}
            className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
              activeImg === i ? 'border-primary' : 'border-border hover:border-muted-foreground'
            }`}
          >
            <AppImage
              src={img?.src}
              alt={`Thumbnail ${i + 1}`}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          </button>
        ))}

        {/* Virtual Try-On Button */}
        <div className="flex-1 min-w-0 bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 rounded-xl p-2 flex flex-col items-center justify-center gap-1">
          <Icon name="SparklesIcon" size={16} className="text-primary" />
          <span className="text-xs font-600 text-primary text-center leading-tight">
            Virtual Try-On
          </span>
          <span className="text-xs text-muted-foreground">₹10/image</span>
        </div>
      </div>
    </div>
  );
}
