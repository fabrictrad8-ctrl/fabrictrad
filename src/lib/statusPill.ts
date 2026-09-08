export type PillTone = 'neutral' | 'pending' | 'active' | 'progress' | 'success' | 'critical';

const TONE_MAP: Record<string, PillTone> = {
  draft: 'neutral',
  quote_sent: 'pending',
  pending: 'pending',
  pending_seller_confirmation: 'pending',
  under_review: 'pending',
  manual_review: 'pending',
  additional_docs_required: 'pending',
  registration_started: 'pending',
  open: 'pending',
  confirmed: 'active',
  seller_accepted: 'active',
  paid: 'active',
  accepted: 'active',
  in_transit: 'progress',
  out_for_delivery: 'progress',
  shipped: 'progress',
  dispatched: 'progress',
  picked_up: 'progress',
  manifested: 'progress',
  delivered: 'success',
  fulfilled: 'success',
  approved: 'success',
  verified: 'success',
  resolved: 'success',
  active: 'success',
  closed: 'neutral',
  cancelled: 'critical',
  canceled: 'critical',
  rejected: 'critical',
  seller_rejected: 'critical',
  failed: 'critical',
  disputed: 'critical',
  escalated: 'critical',
  rto: 'critical',
  rto_delivered: 'critical',
};

export function pillToneForStatus(status?: string | null): PillTone {
  if (!status) return 'neutral';
  return TONE_MAP[status.toLowerCase().trim()] || 'neutral';
}

export function pillClassForStatus(status?: string | null): string {
  return `ft-pill ft-pill-${pillToneForStatus(status)}`;
}

export function pillLabel(status?: string | null): string {
  return String(status || 'unknown').replaceAll('_', ' ');
}
