'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const allProducts = [
{
  id: 'mp1', name: 'Pure Dyeable Soft Nett Fabric', seller: 'Surat Textile Mills Pvt Ltd',
  city: 'Surat, GJ', price: 840, unit: 'mtr', moq: 50, gsm: '120 GSM', width: '44"',
  work: 'Handwork', rating: 4.8, reviews: 124, badge: 'bestseller', verified: true,
  image: "https://images.unsplash.com/photo-1727933882951-115ddb44388d",
  alt: 'Cream nett fabric with gold embroidery floral pattern close-up',
  dispatch: '2-3d', gst: true
},
{
  id: 'mp2', name: 'Premium Cotton Cambric', seller: 'Bhiwandi Weave House',
  city: 'Bhiwandi, MH', price: 185, unit: 'mtr', moq: 100, gsm: '80 GSM', width: '60"',
  work: 'Plain', rating: 4.6, reviews: 89, badge: 'new', verified: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_197569977-1767988369489.png",
  alt: 'Rolled white cotton fabric bolts in bright warehouse',
  dispatch: '1-2d', gst: true
},
{
  id: 'mp3', name: 'Georgette Embroidered', seller: 'Jaipur Crafts Emporium',
  city: 'Jaipur, RJ', price: 1250, unit: 'mtr', moq: 25, gsm: '90 GSM', width: '44"',
  work: 'Zari', rating: 4.9, reviews: 67, badge: 'bestseller', verified: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1a15cecc6-1766283014372.png",
  alt: 'Pink georgette with gold zari embroidery on mannequin',
  dispatch: '3-5d', gst: true
},
{
  id: 'mp4', name: 'Banarasi Silk Brocade', seller: 'Varanasi Silk Traders',
  city: 'Varanasi, UP', price: 3200, unit: 'mtr', moq: 10, gsm: '200 GSM', width: '44"',
  work: 'Zari Brocade', rating: 5.0, reviews: 43, badge: 'premium', verified: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_13e79a640-1775554509083.png",
  alt: 'Deep red Banarasi silk with intricate gold brocade pattern',
  dispatch: '5-7d', gst: true
},
{
  id: 'mp5', name: 'Polyester Crepe Fabric', seller: 'Mumbai Fabric Zone',
  city: 'Mumbai, MH', price: 320, unit: 'mtr', moq: 200, gsm: '140 GSM', width: '58"',
  work: 'Solid', rating: 4.4, reviews: 201, badge: null, verified: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1dfa765bb-1772211451367.png",
  alt: 'Colorful polyester fabric rolls stacked in bright warehouse',
  dispatch: '1-2d', gst: false
},
{
  id: 'mp6', name: 'Handloom Khadi Cotton', seller: 'Kutch Khadi Gramodyog',
  city: 'Bhuj, GJ', price: 450, unit: 'mtr', moq: 50, gsm: '160 GSM', width: '36"',
  work: 'Block Print Ready', rating: 4.7, reviews: 56, badge: 'new', verified: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_11953b441-1772872649342.png",
  alt: 'Natural khadi cotton on traditional wooden loom, artisan weaving',
  dispatch: '4-6d', gst: true
},
{
  id: 'mp7', name: 'Velvet Crush Fabric', seller: 'Ludhiana Velvet House',
  city: 'Ludhiana, PB', price: 680, unit: 'mtr', moq: 30, gsm: '280 GSM', width: '44"',
  work: 'Crushed Velvet', rating: 4.5, reviews: 38, badge: null, verified: false,
  image: "https://images.unsplash.com/photo-1556354148-58e886e0c4ec",
  alt: 'Deep purple crushed velvet fabric with rich light-reflecting texture',
  dispatch: '2-4d', gst: true
},
{
  id: 'mp8', name: 'Organza Sequence Fabric', seller: 'Surat Zari Works',
  city: 'Surat, GJ', price: 980, unit: 'mtr', moq: 20, gsm: '60 GSM', width: '44"',
  work: 'Sequence', rating: 4.8, reviews: 91, badge: 'bestseller', verified: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1807e8cd1-1771579098647.png",
  alt: 'Sheer white organza with gold sequence embroidery on dark background',
  dispatch: '3-4d', gst: true
},
{
  id: 'mp9', name: 'Linen Slub Fabric', seller: 'Kolkata Linen Co.',
  city: 'Kolkata, WB', price: 560, unit: 'mtr', moq: 75, gsm: '180 GSM', width: '58"',
  work: 'Natural Slub', rating: 4.3, reviews: 29, badge: null, verified: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_186b88c42-1772146413683.png",
  alt: 'Natural linen slub fabric with visible texture weave in warm beige tones',
  dispatch: '3-5d', gst: true
},
{
  id: 'mp10', name: 'Chiffon Digital Print', seller: 'Ahmedabad Print House',
  city: 'Ahmedabad, GJ', price: 420, unit: 'mtr', moq: 50, gsm: '70 GSM', width: '44"',
  work: 'Digital Print', rating: 4.6, reviews: 112, badge: 'new', verified: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_12cbc1d6c-1780173991466.png",
  alt: 'Flowing chiffon fabric with vibrant digital floral print, light airy setting',
  dispatch: '2-3d', gst: true
},
{
  id: 'mp11', name: 'Wool Blend Suiting', seller: 'Ludhiana Suiting Mills',
  city: 'Ludhiana, PB', price: 1800, unit: 'mtr', moq: 20, gsm: '320 GSM', width: '58"',
  work: 'Woven Stripe', rating: 4.7, reviews: 44, badge: null, verified: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_138ab1587-1781344617013.png",
  alt: 'Charcoal grey wool suiting fabric with fine stripe weave, professional setting',
  dispatch: '5-7d', gst: true
},
{
  id: 'mp12', name: 'Denim Stretch Fabric', seller: 'Ahmedabad Denim Works',
  city: 'Ahmedabad, GJ', price: 380, unit: 'mtr', moq: 150, gsm: '260 GSM', width: '60"',
  work: 'Stretch Twill', rating: 4.5, reviews: 78, badge: null, verified: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_19faec2de-1775604046124.png",
  alt: 'Indigo blue stretch denim fabric rolls in factory setting, bright industrial light',
  dispatch: '2-4d', gst: false
}];


const sortOptions = [
{ value: 'relevance', label: 'Relevance' },
{ value: 'price-asc', label: 'Price: Low to High' },
{ value: 'price-desc', label: 'Price: High to Low' },
{ value: 'rating', label: 'Highest Rated' },
{ value: 'moq', label: 'Lowest MOQ' },
{ value: 'dispatch', label: 'Fastest Dispatch' },
{ value: 'newest', label: 'Newest First' }];


export default function MarketplaceGrid() {
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState('relevance');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-700 text-foreground">{allProducts.length}</span> products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input-base px-3 py-2 text-sm rounded-xl pr-8">
            
            {sortOptions.map((opt) =>
            <option key={opt.value} value={opt.value}>{opt.label}</option>
            )}
          </select>
          <div className="flex items-center border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`p-2 transition-colors ${view === 'grid' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:text-foreground'}`}>
              
              <Icon name="Squares2X2Icon" size={16} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 transition-colors ${view === 'list' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:text-foreground'}`}>
              
              <Icon name="ListBulletIcon" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Select Bar */}
      {selected.length > 0 &&
      <div className="mb-4 flex items-center justify-between bg-primary/10 border border-primary/25 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon name="ShoppingCartIcon" size={18} className="text-primary" />
            <span className="text-sm font-600 text-primary">{selected.length} products selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected([])} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Clear</button>
            <Link href="/product-detail" className="btn-primary px-4 py-2 text-xs rounded-lg">
              Add to Order Request
            </Link>
          </div>
        </div>
      }

      {/* Grid */}
      {view === 'grid' ?
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {allProducts.map((p, i) =>
        <div
          key={p.id}
          className="product-card border border-border group relative"
          style={{ animationDelay: `${i * 40}ms` }}>
          
              <button
            onClick={() => toggleSelect(p.id)}
            className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
            selected.includes(p.id) ? 'bg-primary border-primary' : 'bg-white/80 border-border opacity-0 group-hover:opacity-100'}`
            }
            aria-label={`Select ${p.name}`}>
            
                {selected.includes(p.id) && <Icon name="CheckIcon" size={10} className="text-white" />}
              </button>

              {p.badge &&
          <div className="absolute top-2 right-2 z-10">
                  {p.badge === 'bestseller' && <span className="tag-bestseller">Best Seller</span>}
                  {p.badge === 'new' && <span className="tag-new">New</span>}
                  {p.badge === 'premium' &&
            <span className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white text-[0.6rem] font-800 px-2 py-0.5 rounded-full uppercase">Premium</span>
            }
                </div>
          }

              <Link href="/product-detail" className="block aspect-square overflow-hidden bg-muted">
                <AppImage src={p.image} alt={p.alt} width={250} height={250} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </Link>

              <div className="p-3">
                <div className="flex items-center gap-1 mb-1">
                  {p.verified && <Icon name="ShieldCheckIcon" size={11} className="text-success shrink-0" />}
                  <span className="text-xs text-muted-foreground truncate">{p.city}</span>
                  {p.gst && <span className="badge-gstin ml-auto shrink-0">GST</span>}
                </div>
                <Link href="/product-detail">
                  <h3 className="text-xs font-700 text-foreground line-clamp-2 mb-1.5 hover:text-primary transition-colors leading-snug">{p.name}</h3>
                </Link>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{p.gsm}</span>
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{p.width}</span>
                </div>
                <div className="flex items-center gap-1 mb-1.5">
                  <Icon name="StarIcon" size={11} className="text-amber-400" variant="solid" />
                  <span className="text-xs font-700">{p.rating}</span>
                  <span className="text-xs text-muted-foreground">({p.reviews})</span>
                </div>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <span className="text-sm font-800 text-primary">₹{p.price.toLocaleString('en-IN')}</span>
                    <span className="text-xs text-muted-foreground ml-1">/{p.unit}</span>
                  </div>
                  <span className="badge-moq">MOQ:{p.moq}</span>
                </div>
                <Link href="/product-detail" className="btn-primary w-full py-1.5 text-xs rounded-lg block text-center">
                  Request Order
                </Link>
              </div>
            </div>
        )}
        </div> :

      <div className="space-y-3">
          {allProducts.map((p) =>
        <div key={p.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4 hover:card-shadow-hover transition-all">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0">
                <AppImage src={p.image} alt={p.alt} width={80} height={80} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {p.verified && <Icon name="ShieldCheckIcon" size={12} className="text-success" />}
                  <span className="text-xs text-muted-foreground">{p.seller} · {p.city}</span>
                  {p.badge === 'bestseller' && <span className="tag-bestseller">Best Seller</span>}
                </div>
                <Link href="/product-detail">
                  <h3 className="text-sm font-700 text-foreground hover:text-primary transition-colors mb-1">{p.name}</h3>
                </Link>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{p.gsm}</span><span>·</span><span>{p.width}</span><span>·</span><span>{p.work}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-800 text-primary">₹{p.price.toLocaleString('en-IN')}<span className="text-xs text-muted-foreground font-500">/{p.unit}</span></p>
                <p className="text-xs text-muted-foreground mb-2">MOQ: {p.moq} mtrs</p>
                <Link href="/product-detail" className="btn-primary px-3 py-1.5 text-xs rounded-lg inline-block">Request</Link>
              </div>
            </div>
        )}
        </div>
      }

      {/* Pagination */}
      <div className="mt-8 flex items-center justify-center gap-2">
        {[1, 2, 3, '...', 12].map((page, i) =>
        <button
          key={i}
          className={`w-9 h-9 rounded-lg text-sm font-600 transition-all ${
          page === 1 ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:border-primary hover:text-primary'}`
          }>
          
            {page}
          </button>
        )}
      </div>
    </div>);

}