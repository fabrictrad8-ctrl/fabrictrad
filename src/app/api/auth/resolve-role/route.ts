import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isConfiguredAdminEmail } from '@/lib/adminAccess';

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
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return noStoreJson({ error: 'Authentication is required.' }, 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return noStoreJson({ error: 'Account access could not be verified right now.' }, 503);
  }

  if (!profile || !isAccountRole(profile.role)) {
    return noStoreJson(
      { error: 'Account setup is incomplete.', code: 'profile_setup_required' },
      409
    );
  }
  if (profile.is_active === false) {
    return noStoreJson({ error: 'This account is inactive.' }, 403);
  }

  const email = user.email?.trim().toLowerCase() || '';
  const adminRole = profile.role === 'admin_staff' || profile.role === 'super_admin';
  if (adminRole && (!isConfiguredAdminEmail(email) || !user.email_confirmed_at)) {
    return noStoreJson({ error: 'Administrator access could not be verified.' }, 403);
  }

  const role = profile.role;

  return noStoreJson({ role });
}
