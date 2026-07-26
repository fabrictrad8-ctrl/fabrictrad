import { createClient } from '@supabase/supabase-js';
import { constants, createCipheriv, publicEncrypt, randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
const credentialsOutput = required('SELLER_CREDENTIALS_OUTPUT');

const email = 'fabrictrad8+seller9038746562@gmail.com';
const phone = '9038746562';
const fullName = 'WhatsApp Catalog Test Seller';
const businessName = 'WhatsApp Catalog Test Textiles';
const password = `Ft!${randomBytes(18).toString('base64url')}9A`;
const now = new Date().toISOString();
const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlTu0Ihg3X7plFENMXOHT
ilsVtnvh5Hjj8lApYfRpSqmJKmOqPvt+cFEw1MNCfR+qEJFbwsOetklAM8KaAJWB
/qTMKRewJTkdiDqaA9JEyf8ovzZGy0hLTDkNz6aiI63QL3+QQjsLSk1o+fzOLWSJ
GwIbs1pV+ugIzFRGZHv0HgI5MvJ1tSgwmQt6DWKlyWdiQGoOEHH4k8ct/4xvl9H4
dC4MJZ0TGK/sAOrma9GDtmxEd66b6/38UPBit/JHOcdL8yetNYbY5cwWMWJZHwWi
IAm9WUD39e4ue2c7+aIShlybM94sRpM+xyGruxePFzkq6E57YVat05x7XFzB2/KH
ywIDAQAB
-----END PUBLIC KEY-----`;

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').slice(-10);
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const findUserByEmail = async () => {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
};

const existingByEmail = await findUserByEmail();
const { data: phoneProfiles, error: phoneLookupError } = await admin
  .from('user_profiles')
  .select('id,phone')
  .not('phone', 'is', null)
  .limit(2000);
if (phoneLookupError) throw phoneLookupError;

const phoneOwner = (phoneProfiles || []).find((profile) => normalizePhone(profile.phone) === phone);
if (phoneOwner && phoneOwner.id !== existingByEmail?.id) {
  throw new Error('The requested phone is already linked to another FabricTrad account.');
}

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
      full_name: fullName,
      role: 'seller',
      business_name: businessName,
    },
  });
  if (error) throw error;
  authUser = data.user;
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'seller', test_account: true },
    user_metadata: { full_name: fullName, role: 'seller', business_name: businessName },
  });
  if (error) throw error;
  authUser = data.user;
}
if (!authUser) throw new Error('Supabase did not return the seller user.');

const { error: profileError } = await admin.from('user_profiles').upsert(
  {
    id: authUser.id,
    email,
    full_name: fullName,
    phone,
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
  seller_ref: `SEL-${phone}`,
  legal_business_name: businessName,
  display_name: businessName,
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

let sellerId;
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
    phone,
    owner_name: fullName,
    email,
    business_name: businessName,
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

const loginClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: loginData, error: loginError } = await loginClient.auth.signInWithPassword({
  email,
  password,
});
if (loginError || !loginData.user) {
  throw new Error(`Seller login verification failed: ${loginError?.message || 'No user returned.'}`);
}
await loginClient.auth.signOut();

let whatsappAccountMatchVerified = false;
const { data: resolvedSeller, error: resolveError } = await admin.rpc('resolve_whatsapp_seller', {
  p_phone: phone,
});
if (!resolveError) {
  const resolved = Array.isArray(resolvedSeller) ? resolvedSeller[0] : resolvedSeller;
  whatsappAccountMatchVerified = resolved?.seller_id === sellerId;
}

const credentials = JSON.stringify({
  email,
  password,
  phone,
  role: 'seller',
  businessName,
  sellerId,
  loginVerified: true,
  registrationReady,
  whatsappAccountMatchVerified,
  provisionedAt: now,
});

const aesKey = randomBytes(32);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
const ciphertext = Buffer.concat([cipher.update(credentials, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const encryptedKey = publicEncrypt(
  {
    key: publicKey,
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  },
  aesKey
);

await writeFile(
  credentialsOutput,
  JSON.stringify(
    {
      algorithm: 'RSA-OAEP-SHA256+A256GCM',
      encryptedKey: encryptedKey.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    },
    null,
    2
  ),
  { mode: 0o600 }
);

console.info('Verified seller account provisioned and credentials encrypted successfully.');
console.info(`WhatsApp account resolver verified: ${whatsappAccountMatchVerified ? 'yes' : 'not available'}.`);
