import React from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const testimonials = [
{
  name: 'Rajesh Mehta',
  company: 'Mehta Garments, Mumbai',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_11142d9f7-1784314859003.png",
  text: 'FabricTrad ne hamara sourcing time 60% reduce kar diya. Verified sellers, GST invoices, aur real-time tracking — sab kuch ek jagah.',
  rating: 5,
  orders: '142 orders'
},
{
  name: 'Priya Nair',
  company: 'Nair Textiles, Coimbatore',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_16223caed-1766569810669.png",
  text: 'The WhatsApp catalog upload is a game-changer. I just send fabric details and photos, and within hours my products are live on the platform.',
  rating: 5,
  orders: '89 orders'
},
{
  name: 'Arjun Sharma',
  company: 'Sharma Brothers, Surat',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1eb083132-1766402243614.png",
  text: 'Settlement is transparent and on-time. Commission structure is fair. Best B2B platform for textile trade in India.',
  rating: 5,
  orders: '310 orders'
}];


const trustBadges = [
{ icon: 'ShieldCheckIcon', label: 'GST Verified Sellers', color: 'text-success' },
{ icon: 'LockClosedIcon', label: 'Secure Razorpay Payments', color: 'text-blue-600' },
{ icon: 'TruckIcon', label: 'Shiprocket Logistics', color: 'text-purple-600' },
{ icon: 'DocumentTextIcon', label: 'Legal T&C Compliant', color: 'text-primary' },
{ icon: 'CpuChipIcon', label: 'AI-Powered Automation', color: 'text-amber-600' },
{ icon: 'BuildingStorefrontIcon', label: 'Multi-Vendor Marketplace', color: 'text-secondary' }];


export default function TrustSection() {
  return (
    <section className="py-12 md:py-16 bg-muted/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-700 text-primary uppercase tracking-widest mb-2">Trusted by Businesses</p>
          <h2 className="text-section-title text-foreground">Why Textile Businesses Choose FabricTrad</h2>
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
          {trustBadges.map((badge) =>
          <div key={badge.label} className="bg-card rounded-xl p-4 border border-border text-center card-shadow">
              <Icon name={badge.icon as 'ShieldCheckIcon'} size={24} className={`${badge.color} mx-auto mb-2`} />
              <p className="text-xs font-600 text-foreground leading-tight">{badge.label}</p>
            </div>
          )}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t) =>
          <div key={t.name} className="bg-card rounded-2xl p-6 border border-border card-shadow">
              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: t.rating }).map((_, i) =>
              <Icon key={i} name="StarIcon" size={14} className="text-amber-400" variant="solid" />
              )}
              </div>
              <p className="text-sm text-foreground leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                  <AppImage src={t.avatar} alt={`${t.name} profile photo`} width={40} height={40} className="object-cover" />
                </div>
                <div>
                  <p className="text-sm font-700 text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.company}</p>
                </div>
                <span className="ml-auto text-xs text-primary font-600 shrink-0">{t.orders}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>);

}