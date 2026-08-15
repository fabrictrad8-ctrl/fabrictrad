import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { provisionAuthenticatedAccountWithRecovery } from '@/lib/server/accountProvisioningRecovery';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AccountRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  });

const safeNextPath = (value: string | null) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const parsed = new URL(value, 'https://fabrictrad.com');
    if (parsed.origin !== 'https://fabrictrad.com') return null;
    if (parsed.pathname === '/login' || parsed.pathname.startsWith('/auth/')) return null;
    if (parsed.pathname.startsWith('/admin-')) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

const destinationFor = (role: AccountRole, requestedNext: string | null) => {
  if (role === 'admin_staff' || role === 'super_admin') return '/admin-portal';
  if (requestedNext) return requestedNext;
  return role === 'seller' ? '/account' : '/marketplace';
};

const metadataRole = (user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): AccountRole => {
  const value = user.app_metadata?.role || user.user_metadata?.role;
  return value === 'seller' || value === 'admin_staff' || value === 'super_admin'
    ? value
    : 'buyer';
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return json({ authenticated: false }, 401);
  }

  const requestedRole = metadataRole(user) === 'seller' ? 'seller' : 'buyer';
  let { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role,is_active,can_buy,can_sell')
    .eq('id', user.id)
    .maybeSingle();

  let recovered = false;
  if (profileError || !profile) {
    try {
      const recovery = await provisionAuthenticatedAccountWithRecovery(
        supabase,
        user,
        requestedRole
      );
      recovered = recovery.recovered;
      const refreshed = await supabase
        .from('user_profiles')
        .select('role,is_active,can_buy,can_sell')
        .eq('id', user.id)
        .maybeSingle();
      profile = refreshed.data;
      profileError = refreshed.error;
    } catch {
      profile = null;
    }
  }

  if (profileError || !profile) {
    return json({
      authenticated: true,
      ready: false,
      destination: `/auth/setup?role=${requestedRole}&reason=profile_setup`,
      code: 'profile_setup_required',
    });
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut().catch(() => undefined);
    return json(
      {
        authenticated: false,
        ready: false,
        error: 'This account is inactive.',
      },
      403
    );
  }

  const role: AccountRole =
    profile.role === 'seller' ||
    profile.role === 'admin_staff' ||
    profile.role === 'super_admin' ||
    profile.role === 'buyer'
      ? profile.role
      : metadataRole(user);
  const requestedNext = safeNextPath(request.nextUrl.searchParams.get('next'));

  return json({
    authenticated: true,
    ready: true,
    recovered,
    role,
    canBuy: profile.can_buy ?? (role !== 'admin_staff' && role !== 'super_admin'),
    canSell: profile.can_sell ?? role === 'seller',
    destination: destinationFor(role, requestedNext),
  });
}
