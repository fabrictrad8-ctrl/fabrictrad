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

  const email = user.email?.trim().toLowerCase() || '';
  if (isConfiguredAdminEmail(email)) {
    if (!user.email_confirmed_at) {
      return noStoreJson({ error: 'Verify the email code before continuing.' }, 403);
    }
    return noStoreJson({ role: 'super_admin' });
  }

  // Password sign-in already loads the current profile before calling this route. Reading the
  // signed user claims avoids a second database round trip; middleware still enforces active status
  // and the authoritative profile role on the destination request.
  const role = isAccountRole(user.app_metadata?.role)
    ? user.app_metadata.role
    : isAccountRole(user.user_metadata?.role)
      ? user.user_metadata.role
      : 'buyer';

  return noStoreJson({ role });
}
