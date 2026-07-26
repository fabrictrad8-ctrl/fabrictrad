import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUTHORIZATION_HASH = '1b103819ac742d5dc35a00ca4b2f51c798e67ad65f01f24e5eb60929b3450418';
const SELLER_EMAIL = 'seller9038746562@fabrictrad.com';
const SELLER_PHONE = '9038746562';
const SELLER_FULL_NAME = 'WhatsApp Catalog Test Seller';
const SELLER_BUSINESS_NAME = 'WhatsApp Catalog Test Textiles';

const response = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function normalizePhone(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '').slice(-10);
}

function generatePassword() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes)
    .map((byte) => byte.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 24);
  return `Ft!${random}9A`;
}

async function findUserByEmail(admin: ReturnType<typeof createAdminClient>) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === SELLER_EMAIL);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') || '';
  const suppliedHash = await sha256(key);
  if (!timingSafeEqual(suppliedHash, AUTHORIZATION_HASH)) {
    return response({ error: 'Not found.' }, 404);
  }

  try {
    const admin = createAdminClient();
    const { data: phoneProfiles, error: phoneLookupError } = await admin
      .from('user_profiles')
      .select('id,email,phone,role')
      .not('phone', 'is', null)
      .limit(2000);
    if (phoneLookupError) throw phoneLookupError;

    const phoneOwner = (phoneProfiles || []).find(
      (profile) => normalizePhone(profile.phone) === SELLER_PHONE
    );
    const existingByEmail = await findUserByEmail(admin);

    if (phoneOwner && phoneOwner.id !== existingByEmail?.id) {
      return response(
        {
          error: 'This phone number is already linked to a different FabricTrad account.',
          existingRole: phoneOwner.role,
          existingEmail: phoneOwner.email,
        },
        409
      );
    }

    const password = generatePassword();
    let authUser;

    if (existingByEmail) {
      const { data, error } = await admin.auth.admin.updateUserById(existingByEmail.id, {
        password,
        email_confirm: true,
        app_metadata: {
          ...(existingByEmail.app_metadata || {}),
          role: 'seller',
          test_account: true,
        },
        user_metadata: {
          ...(existingByEmail.user_metadata || {}),
          full_name: SELLER_FULL_NAME,
          role: 'seller',
          business_name: SELLER_BUSINESS_NAME,
        },
      });
      if (error) throw error;
      authUser = data.user;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: SELLER_EMAIL,
        password,
        email_confirm: true,
        app_metadata: { role: 'seller', test_account: true },
        user_metadata: {
          full_name: SELLER_FULL_NAME,
          role: 'seller',
          business_name: SELLER_BUSINESS_NAME,
        },
      });
      if (error) throw error;
      authUser = data.user;
    }

    if (!authUser) throw new Error('Supabase did not return the seller user.');

    const now = new Date().toISOString();
    const { error: profileError } = await admin.from('user_profiles').upsert(
      {
        id: authUser.id,
        email: SELLER_EMAIL,
        full_name: SELLER_FULL_NAME,
        phone: SELLER_PHONE,
        phone_verified: true,
        role: 'seller',
        is_active: true,
        updated_at: now,
      },
      { onConflict: 'id' }
    );
    if (profileError) throw profileError;

    const { data: existingSeller, error: sellerLookupError } = await admin
      .from('seller_profiles')
      .select('id')
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (sellerLookupError) throw sellerLookupError;

    const sellerValues = {
      user_id: authUser.id,
      seller_ref: `SEL-${SELLER_PHONE}`,
      legal_business_name: SELLER_BUSINESS_NAME,
      display_name: SELLER_BUSINESS_NAME,
      business_type: 'Textile wholesaler',
      verification_status: 'verified',
      pickup_address: {
        address_line1: 'FabricTrad WhatsApp catalogue test account',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395003',
        country: 'India',
      },
      is_active: true,
      updated_at: now,
    };

    let sellerId: string;
    if (existingSeller?.id) {
      const { data, error } = await admin
        .from('seller_profiles')
        .update(sellerValues)
        .eq('id', existingSeller.id)
        .select('id')
        .single();
      if (error) throw error;
      sellerId = data.id;
    } else {
      const { data, error } = await admin
        .from('seller_profiles')
        .insert(sellerValues)
        .select('id')
        .single();
      if (error) throw error;
      sellerId = data.id;
    }

    const { error: registrationError } = await admin.from('seller_registrations').upsert(
      {
        seller_id: sellerId,
        phone: SELLER_PHONE,
        owner_name: SELLER_FULL_NAME,
        email: SELLER_EMAIL,
        business_name: SELLER_BUSINESS_NAME,
        business_type: 'Textile wholesaler',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395003',
        address: 'FabricTrad WhatsApp catalogue test account',
        categories: ['Fabrics', 'Textiles'],
        registration_status: 'approved',
        submitted_at: now,
        approved_at: now,
        updated_at: now,
      },
      { onConflict: 'seller_id' }
    );
    if (registrationError) throw registrationError;

    const { data: resolvedSeller, error: resolveError } = await admin.rpc(
      'resolve_whatsapp_seller',
      { p_phone: SELLER_PHONE }
    );
    if (resolveError) throw resolveError;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) throw new Error('Public Supabase configuration is incomplete.');

    const loginClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: loginData, error: loginError } = await loginClient.auth.signInWithPassword({
      email: SELLER_EMAIL,
      password,
    });
    if (loginError || !loginData.user) {
      throw new Error(`Seller login verification failed: ${loginError?.message || 'No user returned.'}`);
    }
    await loginClient.auth.signOut();

    const resolved = Array.isArray(resolvedSeller) ? resolvedSeller[0] : resolvedSeller;
    if (!resolved?.seller_id || resolved.seller_id !== sellerId) {
      throw new Error('WhatsApp sender-to-seller resolution verification failed.');
    }

    return response({
      created: true,
      loginVerified: true,
      whatsappAccountMatchVerified: true,
      email: SELLER_EMAIL,
      password,
      phone: SELLER_PHONE,
      role: 'seller',
      sellerId,
      businessName: SELLER_BUSINESS_NAME,
    });
  } catch (error) {
    console.error('One-time seller provisioning failed', error);
    return response(
      {
        error: error instanceof Error ? error.message : 'Seller provisioning failed.',
      },
      500
    );
  }
}
