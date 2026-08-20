import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { configuredAdminEmail } from '@/lib/adminAccess';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Administrator sign-in required.' }, 401);

  const { data: administrator } = await supabase
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin =
    administrator?.is_active === true &&
    (administrator.role === 'super_admin' || administrator.role === 'admin_staff');
  if (!isAdmin) return json({ error: 'Administrator access required.' }, 403);

  const { id } = await context.params;
  const { data: target } = await supabase
    .from('user_profiles')
    .select('id,email,role,is_active')
    .eq('id', id)
    .maybeSingle();
  if (!target) return json({ error: 'Account not found.' }, 404);
  if (!target.email) return json({ error: 'This account has no registered email address.' }, 400);

  const targetIsAdmin = target.role === 'super_admin' || target.role === 'admin_staff';
  if (targetIsAdmin) {
    if (administrator.role !== 'super_admin') {
      return json({ error: 'Only a super administrator can manage another administrator.' }, 403);
    }
    return json({ error: 'Administrator passwords use the separate admin recovery flow.' }, 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !publishableKey) {
    return json({ error: 'Password recovery is not configured.' }, 503);
  }

  const redirectBase =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || request.nextUrl.origin;
  const recoveryClient = createSupabaseClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await recoveryClient.auth.resetPasswordForEmail(target.email, {
    redirectTo: `${redirectBase}/auth/reset-password`,
  });

  if (error) {
    if (error.status === 429) {
      return json(
        { error: 'A password reset was requested recently. Wait a minute and try again.' },
        429
      );
    }
    console.error('Admin-triggered password recovery failed', {
      targetId: target.id,
      code: error.code,
      status: error.status,
      message: error.message,
    });
    return json({ error: 'The password reset email could not be sent.' }, 503);
  }

  return json({ sent: true, id: target.id, email: target.email });
}
