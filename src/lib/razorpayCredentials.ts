import { createAdminClient } from '@/lib/supabase/admin';

export type RazorpayCredentials = {
  keyId: string;
  keySecret: string;
  source: 'vault' | 'environment';
};

type RazorpayCredentialOptions = {
  /** Diagnostics may inspect test credentials, but commerce routes must never use them in production. */
  allowTestInProduction?: boolean;
};

const productionCredentialAllowed = (keyId: string, options?: RazorpayCredentialOptions) => {
  if (process.env.NODE_ENV !== 'production') return true;
  if (options?.allowTestInProduction === true) return true;
  return keyId.startsWith('rzp_live_');
};

export async function getRazorpayCredentials(
  options?: RazorpayCredentialOptions
): Promise<RazorpayCredentials | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('get_server_razorpay_credentials');
    const row = Array.isArray(data) ? data[0] : data;
    const keyId = typeof row?.key_id === 'string' ? row.key_id.trim() : '';
    const keySecret = typeof row?.key_secret === 'string' ? row.key_secret.trim() : '';

    if (!error && keyId && keySecret) {
      if (!productionCredentialAllowed(keyId, options)) {
        console.error('Blocked non-live Razorpay credentials from a production commerce route.', {
          source: 'vault',
          mode: keyId.startsWith('rzp_test_') ? 'test' : 'unknown',
        });
        return null;
      }
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
  if (!productionCredentialAllowed(keyId, options)) {
    console.error('Blocked non-live Razorpay credentials from a production commerce route.', {
      source: 'environment',
      mode: keyId.startsWith('rzp_test_') ? 'test' : 'unknown',
    });
    return null;
  }

  return { keyId, keySecret, source: 'environment' };
}
