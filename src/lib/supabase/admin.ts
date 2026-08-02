import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

export class SupabaseServerConfigurationError extends Error {
  constructor(message = 'Supabase server authentication is not configured.') {
    super(message);
    this.name = 'SupabaseServerConfigurationError';
  }
}

export function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // Supabase secret keys (sb_secret_...) are the recommended replacement for
  // legacy service-role JWTs. Accept both so existing deployments remain
  // compatible while production can rotate to the newer server-only key.
  const serverSecret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new SupabaseServerConfigurationError(
      'NEXT_PUBLIC_SUPABASE_URL is missing from the production environment.'
    );
  }

  if (!serverSecret) {
    throw new SupabaseServerConfigurationError(
      'Add SUPABASE_SECRET_KEY as a server-only production secret.'
    );
  }

  if (!adminClient) {
    adminClient = createClient(supabaseUrl, serverSecret, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
