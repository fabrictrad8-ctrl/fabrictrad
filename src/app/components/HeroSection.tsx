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
  { name: 'Pure Silk', icon: 'SparklesIcon', color: 'bg-rose-50 border-rose-200' },
  { name: 'Cotton Fabric', icon: 'Squares2X2Icon', color: 'bg-emerald-50 border-emerald-200' },
  { name: 'Net & Netting', icon: 'BoltIcon', color: 'bg-amber-50 border-amber-200' },
  { name: 'Georgette', icon: 'SwatchIcon', color: 'bg-pink-50 border-pink-200' },
  { name: 'Embroidered', icon: 'PaintBrushIcon', color: 'bg-purple-50 border-purple-200' },
  { name: 'Wholesale', icon: 'ArchiveBoxIcon', color: 'bg-blue-50 border-blue-200' },
];

const englishTagline =
  "The textile market's smartest and most trustworthy B2B network platform. From sourcing to shipping, everything is automated.";

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
                <span className="text-xs font-600 text-primary">Buyer Procurement Workspace</span>
              </div>

              <h1 className="text-hero-xl text-foreground mb-4 max-w-xl">
                Source verified textiles with
                <span className="text-primary"> buyer-first</span> fulfilment
              </h1>
              <p className="text-base text-muted-foreground mb-6 max-w-md leading-relaxed">
                {englishTagline}
              </p>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2 mb-6 max-w-lg">
                <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                  <Icon
                    name="MagnifyingGlassIcon"
                    size={18}
                    className="text-muted-foreground shrink-0"
                  />
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
                    <Icon name={cat?.icon as 'SparklesIcon'} size={13} className="text-primary" />
                    <span className="text-foreground">{cat?.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column — row-span-2 stacked cards */}
          <div className="flex flex-col gap-4">
            {/* Buyer Sourcing Card */}
            <div className="bg-card rounded-2xl p-5 border border-border card-shadow flex-1">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl gradient-saffron flex items-center justify-center shrink-0">
                  <Icon name="ClipboardDocumentCheckIcon" size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-700 text-foreground">Smart Sourcing</p>
                  <p className="text-xs text-muted-foreground">Requirements matched to suppliers</p>
                </div>
              </div>
              <div className="bg-muted rounded-xl p-3 text-xs space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Requirement</span>
                  <span className="font-700 text-foreground">Soft netting, 500 mtrs</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Matched sellers</span>
                  <span className="font-700 text-primary">8 verified</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Best quote</span>
                  <span className="font-700 text-primary">₹840 / mtr</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 border-t border-border pt-2">
                  <span className="w-4 h-4 rounded-full bg-success flex items-center justify-center">
                    <Icon name="CheckIcon" size={10} className="text-white" />
                  </span>
                  <span className="text-xs text-success font-600">
                    Account-specific recommendations
                  </span>
                </div>
              </div>
            </div>

            {/* Buyer Trust Card */}
            <div className="bg-secondary rounded-2xl p-5 text-white flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="ShieldCheckIcon" size={20} className="text-gold" />
                <span className="text-sm font-700">Protected Buyer Flow</span>
              </div>
              <p className="text-xs text-white/70 mb-3 leading-relaxed">
                Compare GST-verified sellers, track orders, monitor payments, and manage disputes
                from your buyer account only.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['ReceiptPercentIcon', 'Payment receipts'],
                  ['TruckIcon', 'Shipment tracking'],
                  ['SparklesIcon', 'AI drape preview'],
                  ['ChatBubbleLeftRightIcon', 'Seller messages'],
                ].map(([icon, label]) => (
                  <div key={label} className="rounded-xl bg-white/10 px-3 py-2">
                    <Icon name={icon as 'TruckIcon'} size={15} className="mb-1 text-gold" />
                    <p className="text-[0.68rem] font-700 leading-4 text-white/85">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden overflow-hidden rounded-2xl border border-border bg-card card-shadow md:block">
              <AppImage
                src="https://images.unsplash.com/photo-1582738411706-bfc8e691d1c2?auto=format&fit=crop&w=900&q=80"
                alt="Buyer reviewing textile samples and fabric swatches"
                width={500}
                height={180}
                className="h-36 w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-4">
                <div className="flex items-center gap-2 text-white">
                  <Icon name="MagnifyingGlassCircleIcon" size={18} />
                  <span className="text-xs font-800">Discover fabric by need, not noise</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row — col-span-2 */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {heroStats?.map((stat) => (
              <div
                key={stat?.label}
                className="bg-card rounded-xl p-4 border border-border card-shadow text-center"
              >
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
                <p className="text-white font-700 text-sm">
                  Buyer orders, payment records, tracking
                </p>
                <p className="text-white/60 text-xs">
                  Purchases and seller communication appear only inside your account
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href="/buyer-requirements"
                className="bg-primary hover:bg-saffron-light text-white px-4 py-2 rounded-xl text-sm font-600 transition-colors"
              >
                Post Requirement
              </Link>
              <Link
                href="/buyer-dashboard"
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-600 transition-colors border border-white/20"
              >
                My Orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
