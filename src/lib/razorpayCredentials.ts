import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export type RazorpayCredentials = {
  keyId: string;
  keySecret: string;
  source: 'vault' | 'environment';
};

export async function getRazorpayCredentials(): Promise<RazorpayCredentials | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('get_server_razorpay_credentials');
    const row = Array.isArray(data) ? data[0] : data;
    const keyId = typeof row?.key_id === 'string' ? row.key_id.trim() : '';
    const keySecret = typeof row?.key_secret === 'string' ? row.key_secret.trim() : '';

    if (!error && keyId && keySecret) {
      return { keyId, keySecret, source: 'vault' };
    }
  } catch (error) {
    console.warn('Razorpay Vault credential lookup failed; falling back to Worker secrets.', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  if (!keyId || !keySecret) return null;

  return { keyId, keySecret, source: 'environment' };
}
