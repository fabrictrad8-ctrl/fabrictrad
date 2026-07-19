import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';

const categories = [
  {
    id: 'net-embroidered',
    name: 'Net & Embroidered',
    description: 'Soft nett, sequence, handwork, zari embroidered fabrics',
    count: 240,
    icon: '🪡',
    image: 'https://images.unsplash.com/photo-1514830482894-94795a87f997',
    alt: 'Cream nett fabric with gold embroidery floral pattern',
    href: '/marketplace?category=net-embroidered',
  },
  {
    id: 'cotton',
    name: 'Cotton & Cambric',
    description: 'Pure cotton, cambric, khadi, handloom cotton varieties',
    count: 380,
    icon: '🌿',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_197569977-1767988369489.png',
    alt: 'Rolled white cotton fabric bolts in bright warehouse',
    href: '/marketplace?category=cotton',
  },
  {
    id: 'silk',
    name: 'Silk & Brocade',
    description: 'Banarasi silk, brocade, raw silk, dupion, tussar',
    count: 165,
    icon: '✨',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_13e79a640-1775554509083.png',
    alt: 'Deep red Banarasi silk with intricate gold brocade pattern',
    href: '/marketplace?category=silk',
  },
  {
    id: 'georgette-chiffon',
    name: 'Georgette & Chiffon',
    description: 'Georgette, chiffon, crepe, digital print, plain',
    count: 290,
    icon: '🌸',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1a15cecc6-1766283014372.png',
    alt: 'Pink georgette with gold zari embroidery on mannequin',
    href: '/marketplace?category=georgette',
  },
  {
    id: 'polyester',
    name: 'Polyester & Synthetic',
    description: 'Polyester crepe, satin, lycra, blended fabrics',
    count: 420,
    icon: '🔷',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1dfa765bb-1772211451367.png',
    alt: 'Colorful polyester fabric rolls stacked in bright warehouse',
    href: '/marketplace?category=polyester',
  },
  {
    id: 'linen',
    name: 'Linen & Jute',
    description: 'Pure linen, linen slub, jute, natural fibre fabrics',
    count: 130,
    icon: '🌾',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_186b88c42-1772146413683.png',
    alt: 'Natural linen slub fabric with visible texture weave in warm beige tones',
    href: '/marketplace?category=linen',
  },
  {
    id: 'velvet',
    name: 'Velvet & Velour',
    description: 'Crushed velvet, velour, velvet brocade, stretch velvet',
    count: 95,
    icon: '💜',
    image: 'https://images.unsplash.com/photo-1556354148-58e886e0c4ec',
    alt: 'Deep purple crushed velvet fabric with rich light-reflecting texture',
    href: '/marketplace?category=velvet',
  },
  {
    id: 'denim-suiting',
    name: 'Denim & Suiting',
    description: 'Stretch denim, wool suiting, tweed, formal fabrics',
    count: 175,
    icon: '👔',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_19faec2de-1775604046124.png',
    alt: 'Indigo blue stretch denim fabric rolls in factory setting',
    href: '/marketplace?category=denim',
  },
  {
    id: 'organza',
    name: 'Organza & Sheer',
    description: 'Organza, tissue, sequence organza, sheer fabrics',
    count: 110,
    icon: '🫧',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1807e8cd1-1771579098647.png',
    alt: 'Sheer white organza with gold sequence embroidery on dark background',
    href: '/marketplace?category=organza',
  },
  {
    id: 'wool-blends',
    name: 'Wool & Blends',
    description: 'Wool, wool-polyester blends, acrylic, winter fabrics',
    count: 88,
    icon: '🐑',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_188a3fd77-1767716579419.png',
    alt: 'Charcoal grey wool suiting fabric with fine stripe weave',
    href: '/marketplace?category=wool',
  },
  {
    id: 'digital-print',
    name: 'Digital Print',
    description: 'Digital printed chiffon, georgette, cotton, satin',
    count: 320,
    icon: '🖨️',
    image: 'https://images.unsplash.com/photo-1642761653048-d8daeea2d97b',
    alt: 'Flowing chiffon fabric with vibrant digital floral print',
    href: '/marketplace?category=digital-print',
  },
  {
    id: 'khadi-handloom',
    name: 'Khadi & Handloom',
    description: 'Handloom khadi, block print ready, artisan woven fabrics',
    count: 72,
    icon: '🧵',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_11953b441-1772872649342.png',
    alt: 'Natural khadi cotton on traditional wooden loom, artisan weaving',
    href: '/marketplace?category=khadi',
  },
];

export default function CategoriesPage() {
  return (
    <BuyerOnlyGuard>
      <main className="min-h-screen bg-background">
        <Header />
        <div className="pt-16">
          {/* Hero Banner */}
          <div className="bg-gradient-to-br from-secondary to-secondary/80 text-white py-12 px-4">
            <div className="max-w-7xl mx-auto text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Link href="/" className="text-white/60 hover:text-white text-sm transition-colors">
                  Home
                </Link>
                <span className="text-white/40">/</span>
                <span className="text-white text-sm font-500">Categories</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-800 mb-3">Browse by Category</h1>
              <p className="text-white/80 text-base max-w-xl mx-auto">
                Explore {categories?.reduce((a, c) => a + c?.count, 0)?.toLocaleString('en-IN')}+
                verified textile products across {categories?.length} categories from India&apos;s
                top B2B suppliers.
              </p>
            </div>
          </div>

          {/* Category Grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {categories?.map((cat) => (
                <Link
                  key={cat?.id}
                  href={cat?.href}
                  className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300"
                >
                  {/* Image */}
                  <div className="aspect-video overflow-hidden bg-muted relative">
                    <img
                      src={cat?.image}
                      alt={cat?.alt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-2 left-2 text-2xl">{cat?.icon}</div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="font-700 text-sm text-foreground group-hover:text-primary transition-colors mb-1 leading-snug">
                      {cat?.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                      {cat?.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-600 text-primary">{cat?.count}+ products</span>
                      <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        Browse →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-10 text-center bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl p-8">
              <h2 className="text-xl font-800 text-foreground mb-2">
                Can&apos;t find your category?
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                FabricTrad connects you with 500+ verified textile suppliers across India. Browse
                the full marketplace or contact us.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link href="/marketplace" className="btn-primary px-6 py-2.5 text-sm rounded-xl">
                  Browse All Products
                </Link>
                <Link href="/register" className="btn-secondary px-6 py-2.5 text-sm rounded-xl">
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </BuyerOnlyGuard>
  );
}
