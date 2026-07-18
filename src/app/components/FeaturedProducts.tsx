'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { personalizeProducts } from '@/lib/recommendations';

const products = [
  {
    id: 'p1',
    name: 'Pure Dyeable Soft Nett Fabric',
    seller: 'Surat Textile Mills Pvt Ltd',
    sellerCity: 'Surat, Gujarat',
    price: 840,
    unit: 'per mtr',
    moq: 50,
    moqUnit: 'mtrs',
    gsm: '120 GSM',
    width: '44 inches',
    work: 'Handwork All Over',
    rating: 4.8,
    reviews: 124,
    image: 'https://images.unsplash.com/photo-1727933882951-115ddb44388d',
    alt: 'Cream colored soft nett fabric with intricate gold embroidery floral pattern, close-up texture detail',
    badge: 'bestseller',
    verified: true,
    gstReady: true,
    dispatch: '2-3 days',
  },
  {
    id: 'p2',
    name: 'Premium Cotton Cambric Fabric',
    seller: 'Bhiwandi Weave House',
    sellerCity: 'Bhiwandi, Maharashtra',
    price: 185,
    unit: 'per mtr',
    moq: 100,
    moqUnit: 'mtrs',
    gsm: '80 GSM',
    width: '60 inches',
    work: 'Plain Weave',
    rating: 4.6,
    reviews: 89,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_197569977-1767988369489.png',
    alt: 'Stacked rolls of natural white cotton fabric in bright warehouse, clean professional setting',
    badge: 'new',
    verified: true,
    gstReady: true,
    dispatch: '1-2 days',
  },
  {
    id: 'p3',
    name: 'Georgette Embroidered Fabric',
    seller: 'Jaipur Crafts Emporium',
    sellerCity: 'Jaipur, Rajasthan',
    price: 1250,
    unit: 'per mtr',
    moq: 25,
    moqUnit: 'mtrs',
    gsm: '90 GSM',
    width: '44 inches',
    work: 'Zari Embroidery',
    rating: 4.9,
    reviews: 67,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1a15cecc6-1766283014372.png',
    alt: 'Pink georgette fabric with gold zari embroidery work, elegant draping on mannequin, warm lighting',
    badge: 'bestseller',
    verified: true,
    gstReady: true,
    dispatch: '3-5 days',
  },
  {
    id: 'p4',
    name: 'Banarasi Silk Brocade',
    seller: 'Varanasi Silk Traders',
    sellerCity: 'Varanasi, UP',
    price: 3200,
    unit: 'per mtr',
    moq: 10,
    moqUnit: 'mtrs',
    gsm: '200 GSM',
    width: '44 inches',
    work: 'Zari Brocade',
    rating: 5.0,
    reviews: 43,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_13e79a640-1775554509083.png',
    alt: 'Deep red Banarasi silk with intricate gold zari brocade pattern, traditional design, rich texture',
    badge: 'premium',
    verified: true,
    gstReady: true,
    dispatch: '5-7 days',
  },
  {
    id: 'p5',
    name: 'Polyester Crepe Fabric',
    seller: 'Mumbai Fabric Zone',
    sellerCity: 'Mumbai, Maharashtra',
    price: 320,
    unit: 'per mtr',
    moq: 200,
    moqUnit: 'mtrs',
    gsm: '140 GSM',
    width: '58 inches',
    work: 'Solid Colour',
    rating: 4.4,
    reviews: 201,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1dfa765bb-1772211451367.png',
    alt: 'Colorful polyester crepe fabric rolls stacked in warehouse, vibrant colors, clean bright setting',
    badge: null,
    verified: true,
    gstReady: false,
    dispatch: '1-2 days',
  },
  {
    id: 'p6',
    name: 'Handloom Khadi Cotton',
    seller: 'Kutch Khadi Gramodyog',
    sellerCity: 'Bhuj, Gujarat',
    price: 450,
    unit: 'per mtr',
    moq: 50,
    moqUnit: 'mtrs',
    gsm: '160 GSM',
    width: '36 inches',
    work: 'Block Print Ready',
    rating: 4.7,
    reviews: 56,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_115904a16-1772093522188.png',
    alt: 'Natural handloom khadi cotton fabric on traditional wooden loom, artisan hands weaving, warm earthy tones',
    badge: 'new',
    verified: true,
    gstReady: true,
    dispatch: '4-6 days',
  },
  {
    id: 'p7',
    name: 'Velvet Crush Fabric',
    seller: 'Ludhiana Velvet House',
    sellerCity: 'Ludhiana, Punjab',
    price: 680,
    unit: 'per mtr',
    moq: 30,
    moqUnit: 'mtrs',
    gsm: '280 GSM',
    width: '44 inches',
    work: 'Crushed Velvet',
    rating: 4.5,
    reviews: 38,
    image: 'https://images.unsplash.com/photo-1657127218743-ef1c339bb204',
    alt: 'Deep purple crushed velvet fabric with rich texture and light reflection, close-up macro shot',
    badge: null,
    verified: false,
    gstReady: true,
    dispatch: '2-4 days',
  },
  {
    id: 'p8',
    name: 'Organza Embroidered',
    seller: 'Surat Zari Works',
    sellerCity: 'Surat, Gujarat',
    price: 980,
    unit: 'per mtr',
    moq: 20,
    moqUnit: 'mtrs',
    gsm: '60 GSM',
    width: '44 inches',
    work: 'Sequence Work',
    rating: 4.8,
    reviews: 91,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1eaf9b420-1781143698529.png',
    alt: 'Sheer white organza fabric with delicate gold sequence embroidery, dark background, glittering detail',
    badge: 'bestseller',
    verified: true,
    gstReady: true,
    dispatch: '3-4 days',
  },
];

export default function FeaturedProducts() {
  const { user, profile } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'featured' | 'new' | 'bestseller'>('featured');

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const recommendedProducts = useMemo(
    () => personalizeProducts(products, profile, user, 'homepage'),
    [profile, user]
  );

  const filtered =
    activeTab === 'featured'
      ? recommendedProducts
      : recommendedProducts.filter((p) => p.badge === activeTab);

  return (
    <section className="py-12 md:py-16 bg-muted/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-700 text-primary uppercase tracking-widest mb-1">
              Textile Products
            </p>
            <h2 className="text-section-title text-foreground">
              {profile?.role === 'seller'
                ? 'Marketplace Intelligence'
                : profile?.role === 'admin_staff' || profile?.role === 'super_admin'
                  ? 'Platform-Ranked Listings'
                  : profile
                    ? 'Recommended For You'
                    : 'Featured Listings'}
            </h2>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
            {(['featured', 'bestseller', 'new'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-600 capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'bestseller'
                  ? 'Best Sellers'
                  : tab === 'new'
                    ? 'New Arrivals'
                    : 'Featured'}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Select Bar */}
        {selected.length > 0 && (
          <div className="mb-4 flex items-center justify-between bg-primary/10 border border-primary/25 rounded-xl px-4 py-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <Icon name="ShoppingCartIcon" size={18} className="text-primary" />
              <span className="text-sm font-600 text-primary">
                {selected.length} products selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelected([])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
              >
                Clear
              </button>
              <Link href="/product-detail" className="btn-primary px-4 py-2 text-xs rounded-lg">
                Add to Order Request
              </Link>
            </div>
          </div>
        )}

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {filtered.map((product, i) => (
            <div
              key={product.id}
              className="product-card border border-border group relative"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Checkbox for bulk select */}
              <button
                onClick={() => toggleSelect(product.id)}
                className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                  selected.includes(product.id)
                    ? 'bg-primary border-primary'
                    : 'bg-white/80 border-border opacity-0 group-hover:opacity-100'
                }`}
                aria-label={`Select ${product.name}`}
              >
                {selected.includes(product.id) && (
                  <Icon name="CheckIcon" size={12} className="text-white" />
                )}
              </button>

              {/* Badge */}
              {product.badge && (
                <div className="absolute top-2 right-2 z-10">
                  {product.badge === 'bestseller' && (
                    <span className="tag-bestseller">Best Seller</span>
                  )}
                  {product.badge === 'new' && <span className="tag-new">New</span>}
                  {product.badge === 'premium' && (
                    <span className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white text-[0.6rem] font-800 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Premium
                    </span>
                  )}
                </div>
              )}

              {/* Image */}
              <Link href="/product-detail" className="block aspect-square overflow-hidden bg-muted">
                <AppImage
                  src={product.image}
                  alt={product.alt}
                  width={300}
                  height={300}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </Link>

              {/* Content */}
              <div className="p-3">
                {/* Seller */}
                <div className="flex items-center gap-1 mb-1.5">
                  {product.verified && (
                    <Icon name="ShieldCheckIcon" size={12} className="text-success shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground truncate">
                    {product.sellerCity}
                  </span>
                  {product.gstReady && <span className="badge-gstin ml-auto shrink-0">GST</span>}
                </div>

                <Link href="/product-detail">
                  <h3 className="text-sm font-700 text-foreground line-clamp-2 mb-1 hover:text-primary transition-colors leading-snug">
                    {product.name}
                  </h3>
                </Link>

                {/* Specs */}
                <div className="flex flex-wrap gap-1 mb-2">
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                    {product.gsm}
                  </span>
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                    {product.width}
                  </span>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1 mb-2">
                  <Icon name="StarIcon" size={12} className="text-amber-400" variant="solid" />
                  <span className="text-xs font-700 text-foreground">{product.rating}</span>
                  <span className="text-xs text-muted-foreground">({product.reviews})</span>
                </div>

                {/* Price */}
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <span className="text-base font-800 text-primary">
                      ₹{product.price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">{product.unit}</span>
                  </div>
                  <span className="badge-moq">
                    MOQ: {product.moq}
                    {product.moqUnit}
                  </span>
                </div>

                {/* Dispatch */}
                <div className="flex items-center gap-1 mb-3">
                  <Icon name="TruckIcon" size={12} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Dispatch in {product.dispatch}
                  </span>
                </div>

                {/* CTA */}
                <Link
                  href="/product-detail"
                  className="btn-primary w-full py-2 text-xs rounded-lg block text-center"
                >
                  Request Order
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/marketplace"
            className="btn-secondary px-8 py-3 text-sm rounded-xl inline-flex items-center gap-2"
          >
            Browse All Products
            <Icon name="ArrowRightIcon" size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
