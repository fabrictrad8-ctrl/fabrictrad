import { createAdminClient } from '@/lib/supabase/admin';

export type ShiprocketCredentials = {
  email: string;
  password: string;
  webhookToken: string;
  source: 'vault' | 'environment';
};

export async function getShiprocketCredentials(): Promise<ShiprocketCredentials | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('get_server_shiprocket_credentials');
    const row = Array.isArray(data) ? data[0] : data;
    const email = typeof row?.api_email === 'string' ? row.api_email.trim() : '';
    const password = typeof row?.api_password === 'string' ? row.api_password.trim() : '';
    const webhookToken = typeof row?.webhook_token === 'string' ? row.webhook_token.trim() : '';

    if (!error && email && password) {
      return { email, password, webhookToken, source: 'vault' };
    }
  } catch (error) {
    console.warn('Shiprocket Vault credential lookup failed; falling back to Worker secrets.', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
  }

  const email = process.env.SHIPROCKET_EMAIL?.trim() || '';
  const password = process.env.SHIPROCKET_PASSWORD?.trim() || '';
  const webhookToken = process.env.SHIPROCKET_WEBHOOK_TOKEN?.trim() || '';
  if (!email || !password) return null;

  return { email, password, webhookToken, source: 'environment' };
}

export async function getShiprocketWebhookToken(): Promise<string> {
  try {
    const credentials = await getShiprocketCredentials();
    if (credentials?.webhookToken) return credentials.webhookToken;
  } catch {
    // Fall through to the dedicated environment variable below.
  }
  return process.env.SHIPROCKET_WEBHOOK_TOKEN?.trim() || '';
}
