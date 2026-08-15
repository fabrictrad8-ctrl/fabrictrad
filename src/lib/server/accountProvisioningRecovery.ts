import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  ensureAccountProvisioned,
  ensureAuthenticatedAccountProvisioned,
  type AuthenticatedProvisionedAccount,
  type CommerceRole,
} from '@/lib/accountProvisioning';
import { createAdminClient } from '@/lib/supabase/admin';

type ProvisioningAttempt = {
  account: AuthenticatedProvisionedAccount;
  recovered: boolean;
};

const errorCode = (error: unknown) =>
  typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined;

const phonePresentFor = async (client: SupabaseClient, userId: string) => {
  const { data, error } = await client
    .from('user_profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.phone && String(data.phone).trim());
};

/**
 * Provision the currently authenticated account without creating duplicate
 * identities. The user-scoped SECURITY DEFINER RPC remains the primary path.
 * If legacy data or a transient RLS/schema mismatch prevents that path from
 * completing, the server may repair only the exact authenticated user through
 * the service-role client.
 */
export async function provisionAuthenticatedAccountWithRecovery(
  userClient: SupabaseClient,
  user: User,
  requestedRole: CommerceRole
): Promise<ProvisioningAttempt> {
  try {
    const account = await ensureAuthenticatedAccountProvisioned(userClient, requestedRole);
    return { account, recovered: false };
  } catch (primaryError) {
    let admin: SupabaseClient;
    try {
      admin = createAdminClient() as SupabaseClient;
    } catch (adminClientError) {
      console.error('Account provisioning recovery client unavailable', {
        userId: user.id,
        requestedRole,
        primaryCode: errorCode(primaryError),
        fallbackCode: errorCode(adminClientError),
      });
      throw primaryError;
    }

    try {
      const provisioned = await ensureAccountProvisioned(admin, user);
      const phonePresent = await phonePresentFor(admin, user.id);
      return {
        recovered: true,
        account: {
          ...provisioned,
          ready: true,
          requestedRole,
          phonePresent,
        },
      };
    } catch (fallbackError) {
      console.error('Account provisioning recovery failed', {
        userId: user.id,
        requestedRole,
        primaryCode: errorCode(primaryError),
        fallbackCode: errorCode(fallbackError),
      });
      throw fallbackError;
    }
  }
}
