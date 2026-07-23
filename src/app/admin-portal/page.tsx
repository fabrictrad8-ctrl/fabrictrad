import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminPortalLayout from '@/app/admin-portal/components/AdminPortalLayout';

function AdminLoading() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--foreground)' }}
    >
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default async function AdminPortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (
    error ||
    !profile?.is_active ||
    (profile.role !== 'super_admin' && profile.role !== 'admin_staff')
  ) {
    redirect('/login');
  }

  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminPortalLayout />
    </Suspense>
  );
}
