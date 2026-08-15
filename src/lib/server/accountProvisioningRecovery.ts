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

const normalizedPhone = (value: unknown) => {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  const phone = digits.slice(-10);
  return /^[6-9][0-9]{9}$/.test(phone) ? phone : '';
};

const phonePresentFor = async (client: SupabaseClient, userId: string) => {
  const { data, error } = await client
    .from('user_profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.phone && String(data.phone).trim());
};

const userWithSafeMetadataPhone = async (admin: SupabaseClient, user: User): Promise<User> => {
  const metadata = { ...(user.user_metadata || {}) } as Record<string, unknown>;
  const phone = normalizedPhone(metadata.phone);
  if (!phone) {
    metadata.phone = '';
    return { ...user, user_metadata: metadata } as User;
  }

  // `.like('%<last10>')` also catches legacy +91-prefixed values that predate
  // the current ten-digit storage rule.
  const { data: conflict, error } = await admin
    .from('user_profiles')
    .select('id')
    .like('phone', `%${phone}`)
    .neq('id', user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  // Authentication metadata can outlive a deleted/abandoned registration or
  // carry a number already claimed by another profile. Never let that stale
  // value block workspace repair and never transfer it automatically.
  metadata.phone = conflict?.id ? '' : phone;
  return { ...user, user_metadata: metadata } as User;
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
      const recoveryUser = await userWithSafeMetadataPhone(admin, user);
      const provisioned = await ensureAccountProvisioned(admin, recoveryUser);
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
