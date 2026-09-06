import { createClient } from '@/lib/supabase/server';

export async function requireAdministrator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.from('user_profiles')
    .select('role,is_active').eq('id', user.id).maybeSingle();
  if (error || data?.is_active !== true || !['super_admin', 'admin_staff'].includes(data.role)) return false;
  // Use the database's authoritative email-OTP policy before any service-role read/write.
  const { data: adminSession, error: sessionError } = await supabase.rpc('is_admin');
  return !sessionError && adminSession === true;
}
