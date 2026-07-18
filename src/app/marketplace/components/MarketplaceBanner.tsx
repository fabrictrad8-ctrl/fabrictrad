import React from 'react';
import Icon from '@/components/ui/AppIcon';

const categories = [
  'All Fabrics',
  'Silk',
  'Cotton',
  'Net & Netting',
  'Georgette',
  'Polyester',
  'Handloom',
  'Velvet',
  'Organza',
  'Linen',
  'Denim',
  'Wool',
];

export default function MarketplaceBanner() {
  return (
    <div className="bg-secondary border-b border-secondary/80">
      {/* Category Nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin py-2">
          {categories?.map((cat, i) => (
            <button
              key={cat}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-600 transition-all whitespace-nowrap ${
                i === 0
                  ? 'bg-primary text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      {/* Hero Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-800 text-white mb-1">FabricTrad Marketplace</h1>
            <p className="text-white/60 text-sm">
              14,200+ verified textile products from 12,400+ GST-verified sellers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
              <Icon name="MapPinIcon" size={14} className="text-gold" />
              <span className="text-xs text-white font-500">Delivering to All India</span>
            </div>
            <div className="flex items-center gap-2 bg-success/20 border border-success/30 rounded-xl px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-white font-500">Live Marketplace</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
