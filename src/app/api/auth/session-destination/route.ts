import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { provisionAuthenticatedAccountWithRecovery } from '@/lib/server/accountProvisioningRecovery';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AccountRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';
type ProfileRow = {
  role: string | null;
  is_active: boolean | null;
  can_buy: boolean | null;
  can_sell: boolean | null;
};

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

const accountRole = (profile: ProfileRow | null, fallback: AccountRole): AccountRole =>
  profile?.role === 'seller' ||
  profile?.role === 'admin_staff' ||
  profile?.role === 'super_admin' ||
  profile?.role === 'buyer'
    ? profile.role
    : fallback;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return json({ authenticated: false }, 401);

  const fallbackRole = metadataRole(user);
  const requestedRole = fallbackRole === 'seller' ? 'seller' : 'buyer';

  const loadWorkspace = async () => {
    const profileResult = await supabase
      .from('user_profiles')
      .select('role,is_active,can_buy,can_sell')
      .eq('id', user.id)
      .maybeSingle();
    const profile = profileResult.data as ProfileRow | null;
    if (profileResult.error || !profile) {
      return { profile: null, role: fallbackRole, complete: false, error: profileResult.error };
    }

    const role = accountRole(profile, fallbackRole);
    if (role === 'admin_staff' || role === 'super_admin') {
      return { profile, role, complete: true, error: null };
    }

    const canBuy = profile.can_buy ?? true;
    const canSell = profile.can_sell ?? role === 'seller';
    const [buyerResult, sellerResult] = await Promise.all([
      canBuy
        ? supabase.from('buyer_profiles').select('id').eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: { id: 'not-required' }, error: null }),
      canSell
        ? supabase.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: { id: 'not-required' }, error: null }),
    ]);

    return {
      profile,
      role,
      complete:
        !buyerResult.error &&
        !sellerResult.error &&
        Boolean(buyerResult.data?.id) &&
        Boolean(sellerResult.data?.id),
      error: buyerResult.error || sellerResult.error || null,
    };
  };

  let workspace = await loadWorkspace();
  let recovered = false;
  if (!workspace.complete) {
    try {
      const recovery = await provisionAuthenticatedAccountWithRecovery(supabase, user, requestedRole);
      recovered = recovery.recovered;
      workspace = await loadWorkspace();
    } catch {
      // The account repair page provides a safe retry without destroying session state.
    }
  }

  if (!workspace.profile || !workspace.complete) {
    return json({
      authenticated: true,
      ready: false,
      destination: `/auth/setup?role=${requestedRole}&reason=profile_setup`,
      code: 'profile_setup_required',
    });
  }

  if (workspace.profile.is_active === false) {
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

  const requestedNext = safeNextPath(request.nextUrl.searchParams.get('next'));
  return json({
    authenticated: true,
    ready: true,
    recovered,
    role: workspace.role,
    canBuy: workspace.profile.can_buy ?? (workspace.role !== 'admin_staff' && workspace.role !== 'super_admin'),
    canSell: workspace.profile.can_sell ?? workspace.role === 'seller',
    destination: destinationFor(workspace.role, requestedNext),
  });
}
