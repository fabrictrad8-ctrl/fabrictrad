export const BESPOKE_STAGES = [
  'catalogue',
  'product',
  'reference_image',
  'fabric',
  'customization',
  'measurement',
  'appointment',
  'quotation',
  'advance_or_full_payment',
  'stitching',
  'embroidery',
  'trial',
  'alteration',
  'final_approval',
  'balance_payment',
  'delivery_or_pickup',
  'review',
  'follow_up',
  'completed',
] as const;

export type BespokeStage = (typeof BESPOKE_STAGES)[number];

export const BESPOKE_STAGE_LABELS: Record<BespokeStage, string> = {
  catalogue: 'Catalogue',
  product: 'Product',
  reference_image: 'Reference image',
  fabric: 'Fabric',
  customization: 'Customization',
  measurement: 'Measurement',
  appointment: 'Appointment',
  quotation: 'Quotation',
  advance_or_full_payment: 'Advance / full payment',
  stitching: 'Stitching',
  embroidery: 'Embroidery',
  trial: 'Trial',
  alteration: 'Alteration',
  final_approval: 'Final approval',
  balance_payment: 'Balance payment',
  delivery_or_pickup: 'Delivery / pickup',
  review: 'Review',
  follow_up: 'Automated follow-up',
  completed: 'Completed',
};

export const HUMAN_HANDOFF_BY_STAGE: Partial<
  Record<BespokeStage, 'physical_measurement' | 'design_approval' | 'trial_fitting' | 'alteration' | 'customer_service'>
> = {
  measurement: 'physical_measurement',
  trial: 'trial_fitting',
  alteration: 'alteration',
};

export const isBespokeStage = (value: unknown): value is BespokeStage =>
  typeof value === 'string' && (BESPOKE_STAGES as readonly string[]).includes(value);

export const nextBespokeStage = (stage: BespokeStage): BespokeStage => {
  const index = BESPOKE_STAGES.indexOf(stage);
  return BESPOKE_STAGES[Math.min(index + 1, BESPOKE_STAGES.length - 1)];
};

export const canMoveToStage = (from: BespokeStage, to: BespokeStage) => {
  const fromIndex = BESPOKE_STAGES.indexOf(from);
  const toIndex = BESPOKE_STAGES.indexOf(to);
  // Allow the next stage, the same stage (idempotent save), and one step back
  // for customer edits. Operational staff can use service-role tools to repair
  // exceptional records without weakening the buyer API.
  return toIndex >= Math.max(0, fromIndex - 1) && toIndex <= fromIndex + 1;
};

export const publicWhatsAppNumber = () =>
  String(process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER || '917977286898').replace(/\D/g, '');

export const whatsappStartUrl = (message = 'CATALOGUE') =>
  `https://wa.me/${publicWhatsAppNumber()}?text=${encodeURIComponent(message)}`;
