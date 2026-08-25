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

const credentialMode = (keyId: string) =>
  keyId.startsWith('rzp_live_') ? 'live' : keyId.startsWith('rzp_test_') ? 'test' : 'unknown';

export async function getRazorpayCredentials(
  options?: RazorpayCredentialOptions
): Promise<RazorpayCredentials | null> {
  const candidates: RazorpayCredentials[] = [];

  // Deployment secrets are intentionally considered first so credential rotations
  // can take effect without being shadowed by an older database-vault copy.
  const environmentKeyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const environmentKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  if (environmentKeyId && environmentKeySecret) {
    candidates.push({
      keyId: environmentKeyId,
      keySecret: environmentKeySecret,
      source: 'environment',
    });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('get_server_razorpay_credentials');
    const row = Array.isArray(data) ? data[0] : data;
    const keyId = typeof row?.key_id === 'string' ? row.key_id.trim() : '';
    const keySecret = typeof row?.key_secret === 'string' ? row.key_secret.trim() : '';
    if (!error && keyId && keySecret) {
      candidates.push({ keyId, keySecret, source: 'vault' });
    }
  } catch (error) {
    console.warn('Razorpay Vault credential lookup failed.', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
  }

  if (candidates.length === 0) return null;

  if (process.env.NODE_ENV === 'production') {
    // A real live credential always wins over any stale test credential,
    // irrespective of whether it came from Worker secrets or the DB vault.
    const live = candidates.find((candidate) => credentialMode(candidate.keyId) === 'live');
    if (live) return live;

    if (options?.allowTestInProduction === true) return candidates[0];

    console.error('Blocked non-live Razorpay credentials from a production commerce route.', {
      availableSources: candidates.map((candidate) => candidate.source),
      modes: candidates.map((candidate) => credentialMode(candidate.keyId)),
    });
    return null;
  }

  return candidates[0];
}
