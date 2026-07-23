import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminPortalLayout from '@/app/admin-portal/components/AdminPortalLayout';

const ADMIN_EMAIL = 'fabrictrad8@gmail.com';

function AdminLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07111f]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
    </div>
  );
}

export default async function AdminPortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const normalizedEmail = user.email?.trim().toLowerCase();
  if (normalizedEmail === ADMIN_EMAIL) {
    await supabase.rpc('claim_fabrictrad_admin').catch(() => undefined);
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  const authorisedByEmail = normalizedEmail === ADMIN_EMAIL;
  const authorisedByRole =
    profile?.is_active !== false &&
    (profile?.role === 'super_admin' || profile?.role === 'admin_staff');

  if (!authorisedByEmail && !authorisedByRole) redirect('/auth/route');

  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminPortalLayout />
    </Suspense>
  );
}
