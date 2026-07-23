import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

const DEFAULT_ADMIN_EMAIL = 'fabrictrad8@gmail.com';

export const configuredAdminEmail = () =>
  (process.env.ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL);

export const isConfiguredAdminEmail = (email?: string | null) =>
  Boolean(email && email.trim().toLowerCase() === configuredAdminEmail());

const findUserByEmail = async (email: string): Promise<User | null> => {
  const admin = createAdminClient();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }

  return null;
};

export const ensureConfiguredAdminAccount = async (emailInput?: string | null) => {
  const email = emailInput?.trim().toLowerCase();
  if (!email || !isConfiguredAdminEmail(email)) return null;

  const admin = createAdminClient();
  const existingUser = await findUserByEmail(email);
  const fullName = 'FabricTrad Administrator';

  let user: User | null = existingUser;

  if (existingUser) {
    const { data, error } = await admin.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      app_metadata: {
        ...(existingUser.app_metadata || {}),
        role: 'super_admin',
      },
      user_metadata: {
        ...(existingUser.user_metadata || {}),
        full_name: existingUser.user_metadata?.full_name || fullName,
      },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role: 'super_admin' },
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
  }

  if (!user) throw new Error('Unable to prepare the administrator account.');

  const { error: profileError } = await admin.from('user_profiles').upsert(
    {
      id: user.id,
      email,
      full_name: user.user_metadata?.full_name || fullName,
      role: 'super_admin',
      is_active: true,
      phone_verified: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (profileError) throw profileError;
  return user;
};
