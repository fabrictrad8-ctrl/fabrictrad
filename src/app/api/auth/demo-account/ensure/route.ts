import type { User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type DemoRole = 'buyer' | 'seller';

type DemoAccount = {
  email: string;
  password: string;
  role: DemoRole;
  fullName: string;
  phone: string;
  businessName?: string;
};

const DEMO_ACCOUNTS: Record<string, DemoAccount> = {
  'demo.buyer@fabrictrad.com': {
    email: 'demo.buyer@fabrictrad.com',
    password: 'FabricDemo@2026',
    role: 'buyer',
    fullName: 'FabricTrad Demo Buyer',
    phone: '9000000001',
  },
  'demo.seller@fabrictrad.com': {
    email: 'demo.seller@fabrictrad.com',
    password: 'FabricDemo@2026',
    role: 'seller',
    fullName: 'FabricTrad Demo Seller',
    phone: '9000000002',
    businessName: 'FabricTrad Demo Textiles',
  },
};

const noStoreJson = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const findUserByEmail = async (email: string): Promise<User | null> => {
  const admin = createAdminClient();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }

  return null;
};

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };

  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return noStoreJson({ error: 'Invalid request body.' }, 400);
  }

  if (typeof body.email !== 'string' || typeof body.password !== 'string') {
    return noStoreJson({ error: 'Email and password are required.' }, 400);
  }

  const email = body.email.trim().toLowerCase();
  const account = DEMO_ACCOUNTS[email];

  if (!account || body.password !== account.password) {
    return noStoreJson({ error: 'Invalid login credentials.' }, 401);
  }

  try {
    const admin = createAdminClient();
    const existingUser = await findUserByEmail(account.email);
    let user: User | null = existingUser;

    if (existingUser) {
      const { data, error } = await admin.auth.admin.updateUserById(existingUser.id, {
        password: account.password,
        email_confirm: true,
        app_metadata: {
          ...(existingUser.app_metadata || {}),
          role: account.role,
        },
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          full_name: account.fullName,
          role: account.role,
          business_name: account.businessName || '',
        },
      });
      if (error) throw error;
      user = data.user;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        app_metadata: { role: account.role },
        user_metadata: {
          full_name: account.fullName,
          role: account.role,
          business_name: account.businessName || '',
        },
      });
      if (error) throw error;
      user = data.user;
    }

    if (!user) throw new Error('Unable to prepare the demo account.');

    const { data: existingProfile, error: profileReadError } = await admin
      .from('user_profiles')
      .select('phone, full_name, business_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profileReadError) throw profileReadError;

    const { error: profileError } = await admin.from('user_profiles').upsert(
      {
        id: user.id,
        email: account.email,
        full_name: existingProfile?.full_name || account.fullName,
        phone: existingProfile?.phone || account.phone,
        phone_verified: true,
        role: account.role,
        is_active: true,
        business_name:
          existingProfile?.business_name || account.businessName || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (profileError) throw profileError;

    return noStoreJson({ ready: true, role: account.role });
  } catch (error) {
    console.error('Unable to prepare demo account', error);
    return noStoreJson({ error: 'Unable to prepare this account right now.' }, 500);
  }
}
