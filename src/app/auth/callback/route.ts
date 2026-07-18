import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const role = searchParams.get('role') ?? 'buyer';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // After OAuth, check if user needs to add phone number
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('phone, role')
          .eq('id', user.id)
          .maybeSingle();

        // If no phone, redirect to phone collection
        if (!profile?.phone) {
          return NextResponse.redirect(`${origin}/auth/phone?role=${role}`);
        }

        // Route based on role
        const userRole = profile?.role || role;
        if (userRole === 'seller') {
          return NextResponse.redirect(`${origin}/seller-dashboard`);
        }
        return NextResponse.redirect(`${origin}/buyer-dashboard`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
