'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AdminPortalLayout from '@/app/admin-portal/components/AdminPortalLayout';

export default function AdminPortalPage() {
  const router = useRouter();
  const supabase = createClient();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase?.auth?.getSession()?.then(({ data: { session } }) => {
      if (!session?.user) {
        router?.replace('/admin-login');
        return;
      }
      supabase
        ?.from('user_profiles')
        ?.select('role')
        ?.eq('id', session?.user?.id)
        ?.maybeSingle()
        ?.then(({ data }) => {
          if (data?.role === 'super_admin' || data?.role === 'admin_staff') {
            setAuthorized(true);
          } else {
            router?.replace('/admin-login');
          }
          setChecking(false);
        });
    });
  }, []);

  if (checking) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--foreground)' }}
      >
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: 'var(--foreground)' }}
        >
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AdminPortalLayout />
    </Suspense>
  );
}
