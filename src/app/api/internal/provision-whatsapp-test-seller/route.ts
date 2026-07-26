import { createClient } from '@supabase/supabase-js';
import { constants, createCipheriv, publicEncrypt, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELLER_EMAIL = 'seller9038746562@fabrictrad.com';
const SELLER_PHONE = '9038746562';
const SELLER_FULL_NAME = 'WhatsApp Catalog Test Seller';
const SELLER_BUSINESS_NAME = 'WhatsApp Catalog Test Textiles';
const RECEIPT_KEY = 'whatsapp_test_seller_encrypted_receipt';
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlTu0Ihg3X7plFENMXOHT
ilsVtnvh5Hjj8lApYfRpSqmJKmOqPvt+cFEw1MNCfR+qEJFbwsOetklAM8KaAJWB
/qTMKRewJTkdiDqaA9JEyf8ovzZGy0hLTDkNz6aiI63QL3+QQjsLSk1o+fzOLWSJ
GwIbs1pV+ugIzFRGZHv0HgI5MvJ1tSgwmQt6DWKlyWdiQGoOEHH4k8ct/4xvl9H4
dC4MJZ0TGK/sAOrma9GDtmxEd66b6/38UPBit/JHOcdL8yetNYbY5cwWMWJZHwWi
IAm9WUD39e4ue2c7+aIShlybM94sRpM+xyGruxePFzkq6E57YVat05x7XFzB2/KH
ywIDAQAB
-----END PUBLIC KEY-----`;

type EncryptedReceipt = {
  algorithm: string;
  encryptedKey: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
  });

const normalizePhone = (value: string | null | undefined) =>
  (value || '').replace(/\D/g, '').slice(-10);

function encryptCredentials(credentials: Record<string, unknown>): EncryptedReceipt {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const encryptedKey = publicEncrypt(
    {
      key: PUBLIC_KEY,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey
  );

  return {
    algorithm: 'RSA-OAEP-SHA256+A256GCM',
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
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

export async function GET() {
  try {
    const admin = createAdminClient();
    const existingByEmail = await findUserByEmail(admin);
    const storedReceipt = existingByEmail?.app_metadata?.[RECEIPT_KEY] as
      | EncryptedReceipt
      | undefined;

    if (storedReceipt?.encryptedKey && storedReceipt.ciphertext) {
      return json({ created: true, reused: true, receipt: storedReceipt });
    }

    const { data: phoneProfiles, error: phoneLookupError } = await admin
      .from('user_profiles')
      .select('id,phone')
      .not('phone', 'is', null)
      .limit(2000);
    if (phoneLookupError) throw phoneLookupError;

    const phoneOwner = (phoneProfiles || []).find(
      (profile) => normalizePhone(profile.phone) === SELLER_PHONE
    );
    if (phoneOwner && phoneOwner.id !== existingByEmail?.id) {
      return json({ error: 'The requested phone is already linked to another account.' }, 409);
    }

    const password = `Ft!${randomBytes(18).toString('base64url')}9A`;
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

    let registrationReady = false;
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
    registrationReady = !registrationError;

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

    let whatsappAccountMatchVerified = false;
    const { data: resolvedSeller, error: resolveError } = await admin.rpc(
      'resolve_whatsapp_seller',
      { p_phone: SELLER_PHONE }
    );
    if (!resolveError) {
      const resolved = Array.isArray(resolvedSeller) ? resolvedSeller[0] : resolvedSeller;
      whatsappAccountMatchVerified = resolved?.seller_id === sellerId;
    }

    const receipt = encryptCredentials({
      email: SELLER_EMAIL,
      password,
      phone: SELLER_PHONE,
      role: 'seller',
      businessName: SELLER_BUSINESS_NAME,
      sellerId,
      loginVerified: true,
      registrationReady,
      whatsappAccountMatchVerified,
      provisionedAt: now,
    });

    const { error: receiptError } = await admin.auth.admin.updateUserById(authUser.id, {
      app_metadata: {
        ...(authUser.app_metadata || {}),
        role: 'seller',
        test_account: true,
        [RECEIPT_KEY]: receipt,
      },
    });
    if (receiptError) throw receiptError;

    return json({ created: true, reused: false, receipt });
  } catch (error) {
    console.error('Encrypted seller provisioning failed', error);
    return json(
      { error: error instanceof Error ? error.message : 'Seller provisioning failed.' },
      500
    );
  }
}
