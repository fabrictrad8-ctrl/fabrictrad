import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isConfiguredAdminEmail } from '@/lib/adminAccess';
import AdminPortalLayout from '@/app/admin-portal/components/AdminPortalLayout';

const DEMO_COOKIE_NAME = 'fabrictrad_demo_role';

function AdminLoading() {
  return (
    <div className="ft-shell flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default async function AdminPortalPage() {
  const cookieStore = await cookies();
  const isAuditAdmin =
    process.env.FABRICTRAD_ENABLE_AUDIT_ADMIN === 'true' &&
    cookieStore.get(DEMO_COOKIE_NAME)?.value === 'admin';

  if (!isAuditAdmin) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect('/admin-login');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    const authorisedAdministrator =
      isConfiguredAdminEmail(user.email) &&
      profile?.is_active === true &&
      (profile.role === 'super_admin' || profile.role === 'admin_staff');

    if (!authorisedAdministrator) {
      await supabase.auth.signOut();
      redirect('/admin-login?error=not_authorised');
    }
  }

  return (
    <div className="ft-shell" data-role-shell="admin">
      <Suspense fallback={<AdminLoading />}>
        <AdminPortalLayout />
      </Suspense>
    </div>
  );
}
