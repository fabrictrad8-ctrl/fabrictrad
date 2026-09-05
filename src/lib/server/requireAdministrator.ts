import { createClient } from '@/lib/supabase/server';

export async function requireAdministrator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.from('user_profiles')
    .select('role,is_active').eq('id', user.id).maybeSingle();
  return !error && data?.is_active === true && ['super_admin', 'admin_staff'].includes(data.role);
}
