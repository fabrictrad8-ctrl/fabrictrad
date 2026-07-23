import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const ADMIN_EMAIL = 'fabrictrad8@gmail.com';

export default async function AuthRoutePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const normalizedEmail = user.email?.trim().toLowerCase();
  if (normalizedEmail === ADMIN_EMAIL) {
    await supabase.rpc('claim_fabrictrad_admin').catch(() => undefined);
    redirect('/admin-portal');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/login?error=profile_not_found');
  if (!profile.is_active) redirect('/login?error=account_inactive');
  if (profile.role === 'seller') redirect('/seller-dashboard');
  if (profile.role === 'admin_staff' || profile.role === 'super_admin') redirect('/admin-portal');
  redirect('/buyer-dashboard');
}
