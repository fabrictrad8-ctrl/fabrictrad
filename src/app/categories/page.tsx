'use client';

import React, { useMemo, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const categories = [
  { id: 'net-embroidered', name: 'Net & Embroidered', description: 'Soft net, sequin, handwork and zari embroidered fabrics', count: 240, icon: '🪡', image: 'https://images.unsplash.com/photo-1514830482894-94795a87f997?w=900&auto=format&fit=crop', href: '/marketplace?category=net-embroidered' },
  { id: 'cotton', name: 'Cotton & Cambric', description: 'Pure cotton, cambric, khadi and handloom cotton varieties', count: 380, icon: '🌿', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_197569977-1767988369489.png', href: '/marketplace?category=cotton' },
  { id: 'silk', name: 'Silk & Brocade', description: 'Banarasi silk, brocade, raw silk, dupion and tussar', count: 165, icon: '✨', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_13e79a640-1775554509083.png', href: '/marketplace?category=silk' },
  { id: 'georgette-chiffon', name: 'Georgette & Chiffon', description: 'Georgette, chiffon, crepe, digital print and plain fabrics', count: 290, icon: '🌸', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1a15cecc6-1766283014372.png', href: '/marketplace?category=georgette' },
  { id: 'polyester', name: 'Polyester & Synthetic', description: 'Polyester crepe, satin, lycra and blended fabrics', count: 420, icon: '🔷', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1dfa765bb-1772211451367.png', href: '/marketplace?category=polyester' },
  { id: 'linen', name: 'Linen & Jute', description: 'Pure linen, linen slub, jute and natural fibre fabrics', count: 130, icon: '🌾', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_186b88c42-1772146413683.png', href: '/marketplace?category=linen' },
  { id: 'velvet', name: 'Velvet & Velour', description: 'Crushed velvet, velour, velvet brocade and stretch velvet', count: 95, icon: '◆', image: 'https://images.unsplash.com/photo-1556354148-58e886e0c4ec?w=900&auto=format&fit=crop', href: '/marketplace?category=velvet' },
  { id: 'denim-suiting', name: 'Denim & Suiting', description: 'Stretch denim, wool suiting, tweed and formal fabrics', count: 175, icon: '👔', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_19faec2de-1775604046124.png', href: '/marketplace?category=denim' },
  { id: 'organza', name: 'Organza & Sheer', description: 'Organza, tissue, sequin organza and sheer fabrics', count: 110, icon: '◌', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1807e8cd1-1771579098647.png', href: '/marketplace?category=organza' },
  { id: 'wool-blends', name: 'Wool & Blends', description: 'Wool, wool-polyester blends, acrylic and winter fabrics', count: 88, icon: '🐑', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_188a3fd77-1767716579419.png', href: '/marketplace?category=wool' },
  { id: 'digital-print', name: 'Digital Print', description: 'Digitally printed chiffon, georgette, cotton and satin', count: 320, icon: '◫', image: 'https://images.unsplash.com/photo-1642761653048-d8daeea2d97b?w=900&auto=format&fit=crop', href: '/marketplace?category=digital-print' },
  { id: 'khadi-handloom', name: 'Khadi & Handloom', description: 'Handloom khadi, block-print-ready and artisan woven fabrics', count: 72, icon: '🧵', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_11953b441-1772872649342.png', href: '/marketplace?category=khadi' },
];

type SortMode = 'popular' | 'alphabetical' | 'largest';

export default function CategoriesPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('popular');

  const visibleCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = categories.filter((category) =>
      !normalized || `${category.name} ${category.description}`.toLowerCase().includes(normalized)
    );
    return [...filtered].sort((a, b) => {
      if (sort === 'alphabetical') return a.name.localeCompare(b.name);
      if (sort === 'largest') return b.count - a.count;
      return categories.findIndex((item) => item.id === a.id) - categories.findIndex((item) => item.id === b.id);
    });
  }, [query, sort]);

  const totalProducts = categories.reduce((total, category) => total + category.count, 0);

  return (
    <BuyerOnlyGuard>
      <main className="ft-storefront min-h-screen">
        <Header />
        <div className="pt-16">
          <section className="ft-route-hero px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="relative z-10 mx-auto max-w-[1440px]">
              <div className="max-w-3xl">
                <p className="ft-route-kicker">Fabric catalogue</p>
                <h1 className="ft-route-title mt-3">Browse every fabric family in one organised marketplace.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Explore {totalProducts.toLocaleString('en-IN')}+ listings across {categories.length} categories, then narrow by colour, work type, state, price, stock and minimum order quantity.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/marketplace" className="ft-primary-action inline-flex items-center gap-2 px-5 py-3 text-sm">
                  Browse all products <Icon name="ArrowRightIcon" size={16} />
                </Link>
                <Link href="/buyer-requirements" className="ft-secondary-action inline-flex items-center gap-2 px-5 py-3 text-sm">
                  <Icon name="MegaphoneIcon" size={16} /> Post a requirement
                </Link>
              </div>
            </div>
          </section>

          <section className="ft-storefront-content py-7 sm:py-9">
            <div className="ft-filter-bar mb-6">
              <div className="ft-search min-w-[220px] flex-1">
                <Icon name="MagnifyingGlassIcon" size={18} className="ml-3 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search categories or fabric types"
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="mr-2 rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Clear search">
                    <Icon name="XMarkIcon" size={16} />
                  </button>
                )}
              </div>
              <label className="flex min-w-[190px] items-center gap-2 text-xs font-750 text-muted-foreground">
                Sort
                <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="ft-filter-control flex-1 px-3 text-sm">
                  <option value="popular">Recommended</option>
                  <option value="largest">Most products</option>
                  <option value="alphabetical">A–Z</option>
                </select>
              </label>
              <span className="ft-orange-chip">{visibleCategories.length} categories</span>
            </div>

            {visibleCategories.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleCategories.map((category) => (
                  <Link key={category.id} href={category.href} className="ft-resource-card group overflow-hidden">
                    <div className="ft-resource-image relative aspect-[16/10] overflow-hidden">
                      <AppImage
                        src={category.image}
                        alt={`${category.name} fabric category`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                      <div className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-black/25 text-xl text-white backdrop-blur-md">
                        {category.icon}
                      </div>
                      <span className="absolute right-3 top-3 rounded-full border border-white/30 bg-black/30 px-2.5 py-1 text-xs font-750 text-white backdrop-blur-md">
                        {category.count}+ products
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-base font-800 text-foreground group-hover:text-primary">{category.name}</h2>
                        <Icon name="ArrowUpRightIcon" size={17} className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{category.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ft-card ft-empty-state">
                <div>
                  <Icon name="MagnifyingGlassIcon" size={34} className="mx-auto text-primary" />
                  <h2 className="mt-4 text-lg font-800">No categories match “{query}”</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Try a broader fabric name or open the full marketplace.</p>
                  <button type="button" onClick={() => setQuery('')} className="ft-primary-action mt-5 px-5 py-2.5 text-sm">Clear search</button>
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
              <div>
                <p className="ft-route-kicker">Sell on FabricTrad</p>
                <h2 className="mt-2 text-2xl font-800 tracking-tight text-foreground">Have fabrics buyers should discover?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Activate selling on the same account, upload colour-level stock and pricing, and manage orders from the seller workspace.</p>
              </div>
              <Link href="/seller-registration" className="ft-primary-action inline-flex items-center justify-center gap-2 px-5 py-3 text-sm">
                Activate selling <Icon name="ArrowRightIcon" size={16} />
              </Link>
            </div>
          </section>
        </div>
        <Footer />
      </main>
    </BuyerOnlyGuard>
  );
}
