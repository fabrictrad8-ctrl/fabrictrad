import React from 'react';
import Icon from '@/components/ui/AppIcon';

const specs = [
  { label: 'Fabric Type', value: 'Pure Dyeable Soft Nett' },
  { label: 'Width', value: '44 inches' },
  { label: 'GSM', value: '120 GSM' },
  { label: 'Work Type', value: 'Handwork All Over' },
  { label: 'Material Composition', value: '100% Nylon Net' },
  { label: 'Colour', value: 'Off-White / Dyeable' },
  { label: 'Pattern', value: 'Floral Embroidery' },
  { label: 'Finish', value: 'Soft Hand Feel' },
  { label: 'Stretch', value: 'Minimal Stretch' },
  { label: 'Opacity', value: 'Semi-Transparent' },
  { label: 'Intended Use', value: 'Lehenga, Saree, Dupatta, Dress Material' },
  { label: 'Season', value: 'All Season' },
  { label: 'Roll Length', value: '50 mtrs / roll' },
  { label: 'Country of Origin', value: 'India (Surat, Gujarat)' },
  { label: 'HSN Code', value: '5804 10 00' },
  { label: 'GST Rate', value: '5%' },
  { label: 'Sample Available', value: 'Yes — ₹150 per sample' },
  { label: 'Customisation', value: 'Available (Min 200 mtrs)' },
];

const careInstructions = [
  'Dry clean recommended',
  'Do not wring or twist',
  'Store away from direct sunlight',
  'Iron on low heat with cloth barrier',
];

export default function ProductSpecs() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <h2 className="text-base font-800 text-foreground mb-4 flex items-center gap-2">
        <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
        Product Specifications
      </h2>
      {/* Buyer Verification Reference */}
      <div className="mb-5 rounded-xl border border-success/20 bg-success/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success">
            <Icon name="ShieldCheckIcon" size={16} className="text-white" />
          </div>
          <div>
            <p className="mb-1 text-xs font-700 text-success">Buyer Specification Check</p>
            <div className="space-y-1 rounded-lg border border-success/15 bg-white p-2 text-xs text-foreground">
              <p>Verified seller GST and KYC before order confirmation.</p>
              <p>
                Fabric width, GSM, work type, MOQ, and dispatch window are shown before payment.
              </p>
              <p>Use sample ordering and AI drape preview before placing a bulk order.</p>
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-success">
              <Icon name="CheckCircleIcon" size={12} />
              Product details are visible to buyers; seller upload workflow stays in seller tools.
            </p>
          </div>
        </div>
      </div>
      {/* Specs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 rounded-xl overflow-hidden border border-border mb-5">
        {specs?.map((spec, i) => (
          <div
            key={spec?.label}
            className={`flex gap-3 px-4 py-3 ${i % 2 === 0 ? 'bg-muted/50' : 'bg-card'} border-b border-border last:border-b-0`}
          >
            <span className="text-xs text-muted-foreground w-36 shrink-0 font-500">
              {spec?.label}
            </span>
            <span className="text-xs font-700 text-foreground">{spec?.value}</span>
          </div>
        ))}
      </div>
      {/* Care Instructions */}
      <div>
        <p className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
          <Icon name="SparklesIcon" size={16} className="text-primary" />
          Care Instructions
        </p>
        <div className="flex flex-wrap gap-2">
          {careInstructions?.map((c) => (
            <span
              key={c}
              className="text-xs bg-muted border border-border rounded-full px-3 py-1 text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
