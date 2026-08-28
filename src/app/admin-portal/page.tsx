import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isConfiguredAdminEmail } from '@/lib/adminAccess';
import AdminPortalLayout from '@/app/admin-portal/components/AdminPortalLayout';

function AdminLoading() {
  return (
    <div className="ft-shell flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default async function AdminPortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/admin-login');

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) redirect('/admin-login?error=authorization_unavailable');

  const authorisedAdministrator =
    isConfiguredAdminEmail(user.email) &&
    profile?.is_active === true &&
    (profile.role === 'super_admin' || profile.role === 'admin_staff');

  if (!authorisedAdministrator) {
    await supabase.auth.signOut().catch(() => undefined);
    redirect('/admin-login?error=not_authorised');
  }

  return (
    <div className="ft-shell" data-role-shell="admin">
      <Suspense fallback={<AdminLoading />}>
        <AdminPortalLayout />
      </Suspense>
    </div>
  );
}
