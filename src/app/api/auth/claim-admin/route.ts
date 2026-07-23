import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ADMIN_EMAIL = 'fabrictrad8@gmail.com';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (user.email?.trim().toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'This account is not authorised for administration.' }, { status: 403 });
  }

  try {
    const admin = createAdminClient();
    const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, role: 'super_admin' },
    });
    if (metadataError) throw metadataError;

    const { error: profileError } = await admin.from('user_profiles').upsert(
      {
        id: user.id,
        email: ADMIN_EMAIL,
        full_name: user.user_metadata?.full_name || 'FabricTrad Administrator',
        role: 'super_admin',
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (profileError) throw profileError;

    return NextResponse.json({ role: 'super_admin' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Admin claim failed:', error);
    return NextResponse.json(
      { error: 'Administrator access is not configured on the server.' },
      { status: 503 }
    );
  }
}
