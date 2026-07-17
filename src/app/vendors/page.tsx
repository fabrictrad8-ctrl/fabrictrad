import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

const vendors = [
{
  id: 'v1',
  name: 'Surat Textile Mills Pvt Ltd',
  city: 'Surat, Gujarat',
  type: 'Manufacturer',
  categories: ['Net Fabric', 'Embroidered', 'Georgette'],
  rating: 4.8,
  reviews: 124,
  products: 48,
  verified: true,
  gstin: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_18c66c46c-1763301780768.png",
  alt: 'Surat Textile Mills seller profile photo',
  badge: 'Top Seller'
},
{
  id: 'v2',
  name: 'Bhiwandi Weave House',
  city: 'Bhiwandi, Maharashtra',
  type: 'Wholesaler',
  categories: ['Cotton', 'Cambric', 'Linen'],
  rating: 4.6,
  reviews: 89,
  products: 32,
  verified: true,
  gstin: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_140561897-1774719752264.png",
  alt: 'Bhiwandi Weave House fabric warehouse',
  badge: null
},
{
  id: 'v3',
  name: 'Jaipur Crafts Emporium',
  city: 'Jaipur, Rajasthan',
  type: 'Manufacturer',
  categories: ['Georgette', 'Embroidered', 'Block Print'],
  rating: 4.9,
  reviews: 67,
  products: 56,
  verified: true,
  gstin: true,
  image: "https://images.unsplash.com/photo-1593803572349-239cb116819c",
  alt: 'Jaipur Crafts Emporium embroidered fabric display',
  badge: 'Best Rated'
},
{
  id: 'v4',
  name: 'Varanasi Silk Traders',
  city: 'Varanasi, Uttar Pradesh',
  type: 'Trader',
  categories: ['Banarasi Silk', 'Brocade', 'Zari'],
  rating: 5.0,
  reviews: 43,
  products: 24,
  verified: true,
  gstin: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_125302a3b-1772157972644.png",
  alt: 'Varanasi Silk Traders showroom with brocade fabrics',
  badge: 'Premium'
},
{
  id: 'v5',
  name: 'Kutch Khadi Gramodyog',
  city: 'Bhuj, Gujarat',
  type: 'Manufacturer',
  categories: ['Khadi', 'Handloom', 'Natural Fibre'],
  rating: 4.7,
  reviews: 56,
  products: 18,
  verified: true,
  gstin: true,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_145f6658f-1766611006562.png",
  alt: 'Kutch Khadi artisan weaving on traditional loom',
  badge: null
},
{
  id: 'v6',
  name: 'Ahmedabad Denim Works',
  city: 'Ahmedabad, Gujarat',
  type: 'Manufacturer',
  categories: ['Denim', 'Stretch Fabric', 'Twill'],
  rating: 4.5,
  reviews: 78,
  products: 22,
  verified: true,
  gstin: false,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1b71e654a-1767339934944.png",
  alt: 'Ahmedabad Denim Works factory floor with denim rolls',
  badge: null
}];


export default function VendorsPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16">
        {/* Banner */}
        <div className="bg-gradient-to-br from-secondary to-secondary/80 text-white py-12 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Link href="/" className="text-white/60 hover:text-white text-sm transition-colors">Home</Link>
              <span className="text-white/40">/</span>
              <span className="text-white text-sm font-500">Verified Vendors</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-800 mb-3">Verified Textile Vendors</h1>
            <p className="text-white/80 text-base max-w-xl mx-auto">
              All vendors on FabricTrad are GST-registered, document-verified, and approved by our team before going live.
            </p>
          </div>
        </div>

        {/* Vendor Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {vendors?.map((vendor) =>
            <Link
              key={vendor?.id}
              href={`/marketplace?seller=${vendor?.id}`}
              className="group bg-card rounded-2xl border border-border p-5 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
              
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
                    <img src={vendor?.image} alt={vendor?.alt} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {vendor?.verified &&
                    <span className="inline-flex items-center gap-1 text-xs font-600 text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                          ✓ Verified
                        </span>
                    }
                      {vendor?.badge &&
                    <span className="text-xs font-700 text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                          {vendor?.badge}
                        </span>
                    }
                    </div>
                    <h3 className="font-700 text-sm text-foreground group-hover:text-primary transition-colors leading-snug">
                      {vendor?.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{vendor?.city} · {vendor?.type}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {vendor?.categories?.map((cat) =>
                <span key={cat} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-lg">
                      {cat}
                    </span>
                )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                  <div className="flex items-center gap-1">
                    <span className="text-amber-400">★</span>
                    <span className="font-700 text-foreground">{vendor?.rating}</span>
                    <span>({vendor?.reviews} reviews)</span>
                  </div>
                  <span className="font-600 text-primary">{vendor?.products} products</span>
                </div>
              </Link>
            )}
          </div>

          {/* Become a Seller CTA */}
          <div className="mt-10 text-center bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl p-8">
            <h2 className="text-xl font-800 text-foreground mb-2">Are you a textile manufacturer or wholesaler?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Join 500+ verified vendors on FabricTrad. Get GST-verified, list your products, and reach B2B buyers across India.
            </p>
            <Link href="/become-a-seller" className="btn-primary px-6 py-2.5 text-sm rounded-xl inline-block">
              Apply as a Vendor
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </main>);

}