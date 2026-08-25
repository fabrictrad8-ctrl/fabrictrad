import { createAdminClient } from '@/lib/supabase/admin';

export type ShiprocketCredentials = {
  email: string;
  password: string;
  webhookToken: string;
  source: 'vault' | 'environment';
};

export async function getShiprocketCredentials(): Promise<ShiprocketCredentials | null> {
  // Restore the original production contract: Cloudflare Worker secrets are authoritative.
  // The vault remains a fallback so current marketplace features do not regress.
  const environmentEmail = process.env.SHIPROCKET_EMAIL?.trim() || '';
  const environmentPassword = process.env.SHIPROCKET_PASSWORD?.trim() || '';
  const environmentWebhookToken = process.env.SHIPROCKET_WEBHOOK_TOKEN?.trim() || '';
  if (environmentEmail && environmentPassword) {
    return {
      email: environmentEmail,
      password: environmentPassword,
      webhookToken: environmentWebhookToken,
      source: 'environment',
    };
  }

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
    console.warn('Shiprocket Vault fallback lookup failed.', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
  }

  return null;
}

export async function getShiprocketWebhookToken(): Promise<string> {
  const environmentWebhookToken = process.env.SHIPROCKET_WEBHOOK_TOKEN?.trim() || '';
  if (environmentWebhookToken) return environmentWebhookToken;

  try {
    const credentials = await getShiprocketCredentials();
    return credentials?.webhookToken || '';
  } catch {
    return '';
  }
}
