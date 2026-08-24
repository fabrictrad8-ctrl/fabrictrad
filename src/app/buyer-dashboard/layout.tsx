import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BuyerDashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?role=buyer');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,is_active,can_buy')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.is_active === false) redirect('/login?error=account_inactive');
  if (profile?.role === 'seller') redirect('/seller-dashboard');
  if (profile?.role === 'admin_staff' || profile?.role === 'super_admin') {
    redirect('/admin-portal');
  }
  if (!profile || profile.can_buy === false) redirect('/marketplace');

  return children;
}
