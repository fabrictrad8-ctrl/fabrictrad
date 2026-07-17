'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const heroStats = [
  { value: '12,400+', label: 'Verified Sellers' },
  { value: '₹4.2Cr+', label: 'Monthly GMV' },
  { value: '340+', label: 'Cities Covered' },
  { value: '98.2%', label: 'GST Compliance' },
];

const quickCategories = [
  { name: 'Pure Silk', emoji: '🥻', color: 'bg-rose-50 border-rose-200' },
  { name: 'Cotton Fabric', emoji: '🌿', color: 'bg-emerald-50 border-emerald-200' },
  { name: 'Net & Netting', emoji: '✨', color: 'bg-amber-50 border-amber-200' },
  { name: 'Georgette', emoji: '🌸', color: 'bg-pink-50 border-pink-200' },
  { name: 'Embroidered', emoji: '🧵', color: 'bg-purple-50 border-purple-200' },
  { name: 'Wholesale', emoji: '📦', color: 'bg-blue-50 border-blue-200' },
];

export default function HeroSection() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <section className="relative pt-16 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-20 left-0 w-96 h-96 blob-primary pointer-events-none" />
      <div className="absolute top-40 right-0 w-80 h-80 blob-secondary pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        {/* Bento Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Main Hero Card — col-span-2 */}
          <div className="lg:col-span-2 gradient-hero rounded-2xl p-8 md:p-10 border border-border card-shadow relative overflow-hidden fabric-pattern-bg">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-600 text-primary">India's #1 B2B Textile Network</span>
              </div>

              <h1 className="text-hero-xl text-foreground mb-4 max-w-xl">
                Bulk Textile Sourcing,
                <span className="text-primary"> Verified Sellers</span>,
                Automated Fulfilment
              </h1>
              <p className="text-base text-muted-foreground mb-6 max-w-md leading-relaxed">
                Textile market ka sabse smart aur bharosemand B2B network platform. From sourcing to shipping, it's all automated.
              </p>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2 mb-6 max-w-lg">
                <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                  <Icon name="MagnifyingGlassIcon" size={18} className="text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e?.target?.value)}
                    placeholder="Search fabric, silk, cotton, netting..."
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground min-w-0"
                  />
                </div>
                <Link
                  href="/marketplace"
                  className="btn-primary px-5 py-3 text-sm rounded-xl shrink-0 text-center"
                >
                  Search
                </Link>
              </div>

              {/* Quick Category Pills */}
              <div className="flex flex-wrap gap-2">
                {quickCategories?.map((cat) => (
                  <Link
                    key={cat?.name}
                    href="/marketplace"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-600 border ${cat?.color} hover:shadow-sm transition-all`}
                  >
                    <span>{cat?.emoji}</span>
                    <span className="text-foreground">{cat?.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column — row-span-2 stacked cards */}
          <div className="flex flex-col gap-4">
            {/* WhatsApp Upload Card */}
            <div className="bg-card rounded-2xl p-5 border border-border card-shadow flex-1">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl gradient-saffron flex items-center justify-center shrink-0">
                  <Icon name="ChatBubbleLeftRightIcon" size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-700 text-foreground">WhatsApp Auto-Upload</p>
                  <p className="text-xs text-muted-foreground">AI processes your catalog</p>
                </div>
              </div>
              {/* Simulated WhatsApp message */}
              <div className="bg-muted rounded-xl p-3 text-xs space-y-1">
                <p className="text-muted-foreground text-xs">Forwarded</p>
                <p className="font-500 text-foreground">Fabric = pure dyable soft nett</p>
                <p className="text-muted-foreground">Width = 44 · Work = handwork all over</p>
                <p className="font-700 text-primary">Rate = ₹840 per mtr</p>
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
                  <span className="w-4 h-4 rounded-full bg-success flex items-center justify-center">
                    <Icon name="CheckIcon" size={10} className="text-white" />
                  </span>
                  <span className="text-xs text-success font-600">AI processed & uploaded</span>
                </div>
              </div>
            </div>

            {/* Verification Badge Card */}
            <div className="bg-secondary rounded-2xl p-5 text-white flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="ShieldCheckIcon" size={20} className="text-gold" />
                <span className="text-sm font-700">GST Verified Sellers</span>
              </div>
              <p className="text-xs text-white/70 mb-3 leading-relaxed">
                Every seller is KYC + GST verified before listing. Buy with confidence.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
                    'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop&crop=face',
                    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face',
                  ]?.map((src, i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-secondary overflow-hidden">
                      <AppImage src={src} alt={`Verified seller ${i + 1}`} width={28} height={28} className="object-cover" />
                    </div>
                  ))}
                </div>
                <span className="text-xs text-white/80">+12,400 verified</span>
              </div>
            </div>
          </div>

          {/* Stats Row — col-span-2 */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {heroStats?.map((stat) => (
              <div key={stat?.label} className="bg-card rounded-xl p-4 border border-border card-shadow text-center">
                <p className="text-xl font-800 text-primary">{stat?.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5 font-500">{stat?.label}</p>
              </div>
            ))}
          </div>

          {/* CTA Banner — col-span-full */}
          <div className="lg:col-span-3 gradient-navy rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Icon name="TruckIcon" size={20} className="text-gold" />
              </div>
              <div>
                <p className="text-white font-700 text-sm">Shiprocket · Local Couriers · 5km Quick Delivery</p>
                <p className="text-white/60 text-xs">Automated shipment creation after payment confirmation</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/buyer-registration" className="bg-primary hover:bg-saffron-light text-white px-4 py-2 rounded-xl text-sm font-600 transition-colors">
                Start Buying
              </Link>
              <Link href="/seller-dashboard" className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-600 transition-colors border border-white/20">
                Sell on FabricTrad
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}