import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const related = [
  {
    name: 'Organza Sequence Fabric',
    price: 980,
    moq: 20,
    image: 'https://images.unsplash.com/photo-1536342022607-ac46ac74d0e3',
    alt: 'White organza with gold sequence work on dark background close-up',
    rating: 4.8,
  },
  {
    name: 'Georgette Embroidered',
    price: 1250,
    moq: 25,
    image: 'https://images.unsplash.com/photo-1639195320261-5066f5c864a5',
    alt: 'Pink georgette fabric with gold embroidery draped on mannequin',
    rating: 4.9,
  },
  {
    name: 'Banarasi Silk Brocade',
    price: 3200,
    moq: 10,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_13e79a640-1775554509083.png',
    alt: 'Deep red Banarasi silk with gold brocade pattern',
    rating: 5.0,
  },
  {
    name: 'Chiffon Digital Print',
    price: 420,
    moq: 50,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_12cbc1d6c-1780173991466.png',
    alt: 'Flowing chiffon with vibrant digital floral print, light setting',
    rating: 4.6,
  },
];

export default function RelatedProducts() {
  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-section-title text-foreground">Similar Products</h2>
        <Link href="/marketplace" className="text-sm font-600 text-primary hover:underline">
          View All →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {related?.map((p) => (
          <Link
            key={p?.name}
            href="/product-detail"
            className="product-card border border-border group block"
          >
            <div className="aspect-square overflow-hidden bg-muted">
              <AppImage
                src={p?.image}
                alt={p?.alt}
                width={200}
                height={200}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-3">
              <h3 className="text-xs font-700 text-foreground line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                {p?.name}
              </h3>
              <div className="flex items-center gap-1 mb-2">
                <Icon name="StarIcon" size={11} className="text-amber-400" variant="solid" />
                <span className="text-xs font-700">{p?.rating}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-sm font-800 text-primary">
                  ₹{p?.price?.toLocaleString('en-IN')}
                  <span className="text-xs text-muted-foreground font-400">/mtr</span>
                </span>
                <span className="badge-moq">MOQ:{p?.moq}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
