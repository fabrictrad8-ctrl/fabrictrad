import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureConfiguredAdminAccount, isConfiguredAdminEmail } from '@/lib/adminAccess';

type AccountRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';

const isAccountRole = (role: unknown): role is AccountRole =>
  role === 'buyer' || role === 'seller' || role === 'admin_staff' || role === 'super_admin';

const noStoreJson = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return noStoreJson({ error: 'Authentication is required.' }, 401);
  }

  const email = user.email?.trim().toLowerCase() || '';

  try {
    if (isConfiguredAdminEmail(email)) {
      if (!user.email_confirmed_at) {
        return noStoreJson({ error: 'Verify the email code before continuing.' }, 403);
      }

      await ensureConfiguredAdminAccount(email);
      return noStoreJson({ role: 'super_admin' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return noStoreJson({ error: 'This email is not linked to a FabricTrad account.' }, 403);
    }
    if (profile.is_active === false) {
      return noStoreJson({ error: 'This account is inactive. Please contact FabricTrad support.' }, 403);
    }

    const role = isAccountRole(profile.role)
      ? profile.role
      : isAccountRole(user.app_metadata?.role)
        ? user.app_metadata.role
        : isAccountRole(user.user_metadata?.role)
          ? user.user_metadata.role
          : 'buyer';

    return noStoreJson({ role });
  } catch (caughtError: unknown) {
    const message = caughtError instanceof Error ? caughtError.message : 'Unable to resolve this account.';
    return noStoreJson({ error: message }, 500);
  }
}
