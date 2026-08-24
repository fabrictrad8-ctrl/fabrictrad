import { createClient } from '@/lib/supabase/server';
import type { AuthenticatedProvisionedAccount } from '@/lib/accountProvisioning';
import { provisionAuthenticatedAccountWithRecovery } from '@/lib/server/accountProvisioningRecovery';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type BuyerType = 'retail_store' | 'end_user';

const ADMIN_EMAIL = 'fabrictrad8@gmail.com';

const getRequestedRole = (request: NextRequest, roleParam: string | null): 'buyer' | 'seller' => {
  if (roleParam === 'seller' || roleParam === 'buyer') return roleParam;
  const roleCookie = request.cookies.get('fabrictrad_oauth_role')?.value;
  return roleCookie === 'seller' || roleCookie === 'buyer' ? roleCookie : 'buyer';
};

const getBuyerType = (request: NextRequest): BuyerType | null => {
  const value = request.cookies.get('fabrictrad_buyer_type')?.value;
  return value === 'retail_store' || value === 'end_user' ? value : null;
};

const redirectAfterAuth = (url: string) => {
  const response = NextResponse.redirect(url);
  for (const cookieName of ['fabrictrad_oauth_role', 'fabrictrad_buyer_type']) {
    response.cookies.set(cookieName, '', {
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
};

const loginErrorUrl = (origin: string, code: string) => {
  const loginUrl = new URL('/login', origin);
  loginUrl.searchParams.set('error', code);
  return loginUrl.toString();
};

const setupRecoveryUrl = (origin: string, requestedRole: 'buyer' | 'seller') => {
  const setupUrl = new URL('/auth/setup', origin);
  setupUrl.searchParams.set('role', requestedRole);
  setupUrl.searchParams.set('reason', 'profile_setup');
  return setupUrl.toString();
};

const destinationForAccount = (
  origin: string,
  requestedRole: 'buyer' | 'seller',
  account: AuthenticatedProvisionedAccount
) => {
  if (account.role === 'admin_staff' || account.role === 'super_admin') return `${origin}/admin-portal`;

  const sellerSession = account.role === 'seller' || requestedRole === 'seller';
  if (sellerSession && !account.phonePresent) {
    const phoneUrl = new URL('/auth/phone', origin);
    phoneUrl.searchParams.set('role', 'seller');
    phoneUrl.searchParams.set('returnTo', '/seller-registration?resume=1');
    return phoneUrl.toString();
  }
  if (sellerSession && !account.canSell) return `${origin}/seller-registration?resume=1`;
  if (sellerSession) return `${origin}/seller-dashboard`;

  return `${origin}/marketplace`;
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const providerError = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const requestedRole = getRequestedRole(request, searchParams.get('role'));
  const buyerType = getBuyerType(request);

  if (providerError) {
    return redirectAfterAuth(loginErrorUrl(origin, errorDescription || providerError));
  }
  if (!code) return redirectAfterAuth(loginErrorUrl(origin, 'auth_failed'));

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return redirectAfterAuth(loginErrorUrl(origin, 'auth_failed'));

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return redirectAfterAuth(loginErrorUrl(origin, 'auth_failed'));

  const normalizedEmail = user.email?.trim().toLowerCase() || '';
  if (normalizedEmail === ADMIN_EMAIL && user.email_confirmed_at) {
    try {
      await provisionAuthenticatedAccountWithRecovery(supabase, user, 'buyer');
    } catch (error) {
      console.error('Administrator profile bootstrap failed', {
        userId: user.id,
        code: typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined,
      });
      return redirectAfterAuth(setupRecoveryUrl(origin, 'buyer'));
    }
    return redirectAfterAuth(`${origin}/admin-portal`);
  }

  let account: AuthenticatedProvisionedAccount;
  try {
    const provisioning = await provisionAuthenticatedAccountWithRecovery(
      supabase,
      user,
      requestedRole
    );
    account = provisioning.account;
  } catch (error) {
    console.error('OAuth account provisioning failed', {
      userId: user.id,
      requestedRole,
      code: typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined,
    });
    return redirectAfterAuth(setupRecoveryUrl(origin, requestedRole));
  }

  // Buyer-type setup is only meaningful for buyer-primary accounts. A stale
  // buyer cookie must never push a seller-primary Google login into buyer onboarding.
  if (buyerType && account.role !== 'seller') {
    const { error: buyerTypeError } = await supabase
      .from('buyer_profiles')
      .update({ buyer_type: buyerType, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (buyerTypeError) {
      console.error('Unable to persist OAuth buyer type', {
        userId: user.id,
        buyerType,
        code: buyerTypeError.code,
      });
    }

    if (buyerType === 'retail_store') {
      const { error: accountKindError } = await supabase
        .from('user_profiles')
        .update({ account_kind: 'business', updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (accountKindError) {
        console.error('Unable to persist OAuth business account kind', {
          userId: user.id,
          code: accountKindError.code,
        });
      }
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('is_active,role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return redirectAfterAuth(setupRecoveryUrl(origin, requestedRole));
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    return redirectAfterAuth(loginErrorUrl(origin, 'account_inactive'));
  }

  if (profile.role === 'seller') {
    return redirectAfterAuth(destinationForAccount(origin, 'seller', account));
  }

  if (buyerType) {
    return redirectAfterAuth(`${origin}/buyer-registration?resume=1&oauth=1`);
  }

  return redirectAfterAuth(destinationForAccount(origin, requestedRole, account));
}
