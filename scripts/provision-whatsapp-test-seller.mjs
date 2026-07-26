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

const client = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: signupData, error: signupError } = await client.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: fullName,
      role: 'seller',
      business_name: businessName,
      phone,
    },
    emailRedirectTo: 'https://fabrictrad.com/auth/callback?next=/seller-dashboard',
  },
});

if (signupError) throw signupError;
if (!signupData.user) throw new Error('Supabase did not return the seller user.');

let profileReady = false;
let sellerProfileReady = false;
let registrationReady = false;
let loginVerified = false;
let sellerId = null;
const confirmationRequired = !signupData.session;

if (signupData.session) {
  const userId = signupData.user.id;
  const { error: profileError } = await client.from('user_profiles').upsert(
    {
      id: userId,
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
  profileReady = true;

  const { data: existingSeller, error: sellerLookupError } = await client
    .from('seller_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (sellerLookupError) throw sellerLookupError;

  const sellerValues = {
    user_id: userId,
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

  if (existingSeller?.id) {
    const { data, error } = await client
      .from('seller_profiles')
      .update(sellerValues)
      .eq('id', existingSeller.id)
      .select('id')
      .single();
    if (error) throw error;
    sellerId = data.id;
  } else {
    const { data, error } = await client
      .from('seller_profiles')
      .insert(sellerValues)
      .select('id')
      .single();
    if (error) throw error;
    sellerId = data.id;
  }
  sellerProfileReady = true;

  const { error: registrationError } = await client.from('seller_registrations').upsert(
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

  await client.auth.signOut();
  const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (loginError || !loginData.user) {
    throw new Error(`Seller login verification failed: ${loginError?.message || 'No user returned.'}`);
  }
  loginVerified = true;
  await client.auth.signOut();
}

const credentials = JSON.stringify({
  email,
  password,
  phone,
  role: 'seller',
  businessName,
  userId: signupData.user.id,
  sellerId,
  confirmationRequired,
  profileReady,
  sellerProfileReady,
  registrationReady,
  loginVerified,
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

console.info('Seller signup completed and credentials encrypted successfully.');
console.info(`Email confirmation required: ${confirmationRequired ? 'yes' : 'no'}.`);
console.info(`Seller profile ready: ${sellerProfileReady ? 'yes' : 'pending confirmation'}.`);
