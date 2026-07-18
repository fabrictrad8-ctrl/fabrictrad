import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type UserRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';

const isUserRole = (role: string | null): role is UserRole =>
  role === 'buyer' || role === 'seller' || role === 'admin_staff' || role === 'super_admin';

const getRequestedRole = (request: NextRequest, roleParam: string | null): 'buyer' | 'seller' => {
  if (roleParam === 'seller' || roleParam === 'buyer') return roleParam;

  const roleCookie = request.cookies.get('fabrictrad_oauth_role')?.value;
  if (roleCookie === 'seller' || roleCookie === 'buyer') return roleCookie;

  return 'buyer';
};

const redirectAfterAuth = (url: string) => {
  const response = NextResponse.redirect(url);
  response.cookies.set('fabrictrad_oauth_role', '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
};

const getOAuthProfileData = (user: any, fallbackRole: 'buyer' | 'seller') => {
  const metadata = user?.user_metadata || {};
  const fullName =
    metadata.full_name ||
    metadata.name ||
    [metadata.given_name, metadata.family_name].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    '';
  const avatarUrl = metadata.avatar_url || metadata.picture || '';

  return {
    id: user.id,
    email: String(user.email || '').toLowerCase(),
    full_name: fullName,
    avatar_url: avatarUrl,
    role: fallbackRole,
  };
};

const isFreshOAuthUser = (createdAt?: string) => {
  if (!createdAt) return false;
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) return false;
  return Date.now() - createdAtMs < 10 * 60 * 1000;
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const requestedRole = getRequestedRole(request, searchParams.get('role'));

  if (error) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', errorDescription || error);
    return redirectAfterAuth(loginUrl.toString());
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // After OAuth, check if user needs to add phone number
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, email, full_name, avatar_url, phone, role')
          .eq('id', user.id)
          .maybeSingle();

        const profileData = getOAuthProfileData(user, requestedRole);
        let resolvedRole: UserRole = isUserRole(profile?.role) ? profile.role : requestedRole;

        if (!profile) {
          const { error: insertError } = await supabase.from('user_profiles').insert(profileData);
          if (insertError) {
            const loginUrl = new URL('/login', origin);
            loginUrl.searchParams.set('error', 'profile_setup_failed');
            return redirectAfterAuth(loginUrl.toString());
          }
          resolvedRole = requestedRole;
        } else {
          const shouldApplyRequestedRole =
            !profile.phone &&
            profile.role === 'buyer' &&
            requestedRole === 'seller' &&
            isFreshOAuthUser(user.created_at);

          resolvedRole = shouldApplyRequestedRole ? requestedRole : resolvedRole;

          await supabase
            .from('user_profiles')
            .update({
              email: profileData.email || profile.email,
              full_name: profile.full_name || profileData.full_name,
              avatar_url: profile.avatar_url || profileData.avatar_url,
              role: resolvedRole,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        }

        // If no phone, redirect to phone collection
        if (!profile?.phone) {
          return redirectAfterAuth(`${origin}/auth/phone?role=${resolvedRole}`);
        }

        // Route based on the existing account role. Google login should not create a second
        // buyer/seller identity for the same email.
        if (resolvedRole === 'seller') {
          return redirectAfterAuth(`${origin}/seller-dashboard`);
        }

        if (resolvedRole === 'super_admin' || resolvedRole === 'admin_staff') {
          return redirectAfterAuth(`${origin}/admin-portal`);
        }

        return redirectAfterAuth(`${origin}/buyer-dashboard`);
      }
    } else {
      const loginUrl = new URL('/login', origin);
      loginUrl.searchParams.set('error', error.message || 'auth_failed');
      return redirectAfterAuth(loginUrl.toString());
    }
  }

  return redirectAfterAuth(`${origin}/login?error=auth_failed`);
}
