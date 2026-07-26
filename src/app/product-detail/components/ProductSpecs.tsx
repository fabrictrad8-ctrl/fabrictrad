'use client';

import Icon from '@/components/ui/AppIcon';
import { useProduct } from '@/lib/hooks/useProduct';

const careInstructions = [
  'Confirm washing and care instructions with the seller',
  'Order a sample before bulk purchase',
  'Store away from direct sunlight and moisture',
];

export default function ProductSpecs() {
  const { product, loading } = useProduct();
  const selectedVariant = product.variants?.find(
    (variant) => variant.id === product.selectedVariantId
  );

  const specs = [
    { label: 'Fabric / Category', value: product.category },
    { label: 'Width', value: product.width },
    { label: 'GSM', value: product.gsm ? `${product.gsm} GSM` : 'Not specified' },
    { label: 'Work / Design', value: selectedVariant?.designName || product.work },
    { label: 'Colour', value: selectedVariant?.colorName || product.colors?.join(', ') || 'See product photos' },
    { label: 'Variant SKU', value: selectedVariant?.code || product.sku || 'Not specified' },
    { label: 'Variant stock', value: selectedVariant ? `${selectedVariant.available} ${selectedVariant.unit}` : `${product.available} ${product.unit}` },
    { label: 'Minimum order', value: `${selectedVariant?.moq || product.moq} ${selectedVariant?.unit || product.unit}` },
    { label: 'Dispatch', value: `${product.dispatchDays} business day${product.dispatchDays === 1 ? '' : 's'}` },
    { label: 'Country of origin', value: `India${product.city ? ` · ${product.city}` : ''}` },
    { label: 'GST invoice', value: product.gst ? 'Available' : 'Confirm with seller' },
    { label: 'Catalogue variations', value: product.variantCount ? `${product.variantCount} colour/design options` : 'Single listing' },
  ];

  if (loading) {
    return <div className="h-80 animate-pulse rounded-2xl border border-border bg-muted" />;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-base font-800 text-foreground">
        <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
        Product specifications
      </h2>

      <div className="mb-5 rounded-xl border border-success/20 bg-success/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success">
            <Icon name="ShieldCheckIcon" size={16} className="text-white" />
          </div>
          <div>
            <p className="mb-1 text-xs font-700 text-success">Live seller catalogue data</p>
            <p className="text-xs leading-5 text-muted-foreground">
              The colour, design, rate and available quantity update from the selected catalogue
              variation. Confirm final shade and stock with the seller before payment.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 overflow-hidden rounded-xl border border-border sm:grid-cols-2">
        {specs.map((spec, index) => (
          <div
            key={spec.label}
            className={`flex gap-3 border-b border-border px-4 py-3 ${
              index % 2 === 0 ? 'bg-muted/50' : 'bg-card'
            }`}
          >
            <span className="w-36 shrink-0 text-xs font-500 text-muted-foreground">
              {spec.label}
            </span>
            <span className="text-xs font-700 text-foreground">{spec.value}</span>
          </div>
        ))}
      </div>

      {product.description && (
        <div className="mb-5 rounded-xl bg-muted/50 p-4">
          <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Description</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">
            {product.description}
          </p>
        </div>
      )}

      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-700 text-foreground">
          <Icon name="SparklesIcon" size={16} className="text-primary" /> Buyer checks
        </p>
        <div className="flex flex-wrap gap-2">
          {careInstructions.map((instruction) => (
            <span
              key={instruction}
              className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
            >
              {instruction}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
