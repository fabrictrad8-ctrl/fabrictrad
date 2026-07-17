import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

const categories = [
{
  name: 'Pure Silk Fabrics',
  count: '2,840 products',
  image: "https://images.unsplash.com/photo-1635883553291-d2701919e6c4",
  alt: 'Rich golden silk fabric draped in soft folds, warm ambient lighting, luxurious sheen',
  color: 'from-rose-900/60 to-rose-600/20'
},
{
  name: 'Cotton & Linen',
  count: '5,120 products',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1e0a51a1a-1781075543449.png",
  alt: 'Stacked rolls of natural cotton fabric in earthy tones, bright studio lighting',
  color: 'from-emerald-900/60 to-emerald-600/20'
},
{
  name: 'Net & Embroidered',
  count: '3,210 products',
  image: "https://images.unsplash.com/photo-1727933882951-115ddb44388d",
  alt: 'Delicate white net fabric with gold embroidery detail, dark background, close-up texture',
  color: 'from-amber-900/60 to-amber-600/20'
},
{
  name: 'Georgette & Chiffon',
  count: '1,980 products',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_12cbc1d6c-1780173991466.png",
  alt: 'Flowing chiffon fabric in motion, pastel pink tones, airy studio atmosphere',
  color: 'from-pink-900/60 to-pink-600/20'
},
{
  name: 'Polyester Blends',
  count: '4,670 products',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1efa1a23b-1772211455216.png",
  alt: 'Colorful stacked fabric bolts in a warehouse, bright overhead lighting',
  color: 'from-blue-900/60 to-blue-600/20'
},
{
  name: 'Handloom & Khadi',
  count: '1,340 products',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_12cf53982-1772222050241.png",
  alt: 'Traditional handloom weaving in progress, natural light, wooden loom, earthy tones',
  color: 'from-orange-900/60 to-orange-600/20'
}];


export default function CategorySection() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-700 text-primary uppercase tracking-widest mb-1">Browse by Category</p>
            <h2 className="text-section-title text-foreground">Shop Textile Categories</h2>
          </div>
          <Link href="/marketplace" className="text-sm font-600 text-primary hover:underline hidden sm:block">
            View All →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories?.map((cat, i) =>
          <Link
            key={cat?.name}
            href="/marketplace"
            className="group relative rounded-2xl overflow-hidden aspect-[3/4] cursor-pointer"
            style={{ animationDelay: `${i * 80}ms` }}>
            
              <AppImage
              src={cat?.image}
              alt={cat?.alt}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500" />
            
              <div className={`absolute inset-0 bg-gradient-to-t ${cat?.color} group-hover:opacity-90 transition-opacity`} />
              <div className="absolute inset-0 flex flex-col justify-end p-3">
                <p className="text-white font-700 text-sm leading-tight">{cat?.name}</p>
                <p className="text-white/70 text-xs mt-0.5">{cat?.count}</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </section>);

}