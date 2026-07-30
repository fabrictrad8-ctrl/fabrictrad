import type { SupabaseClient, User } from '@supabase/supabase-js';

export type AccountRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';

export type ProvisionedAccount = {
  role: AccountRole;
  userProfileId: string;
  buyerProfileId: string | null;
  sellerProfileId: string | null;
  canBuy: boolean;
  canSell: boolean;
};

type UserProfileRow = {
  id: string;
  role: AccountRole | null;
  is_active: boolean | null;
  can_buy?: boolean | null;
  can_sell?: boolean | null;
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const nullableText = (value: unknown) => text(value) || null;

const roleFromUser = (user: User): 'buyer' | 'seller' => {
  const appRole = user.app_metadata?.role;
  const userRole = user.user_metadata?.role;
  return appRole === 'seller' || userRole === 'seller' ? 'seller' : 'buyer';
};

const accountReference = (prefix: 'BYR' | 'SLR', userId: string) =>
  `FT-${prefix}-${userId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;

const addressFromMetadata = (metadata: Record<string, unknown>) => {
  const address = {
    line1: nullableText(metadata.address_line1),
    line2: nullableText(metadata.address_line2),
    city: nullableText(metadata.city),
    state: nullableText(metadata.state),
    pincode: nullableText(metadata.pincode),
    country: 'India',
  };
  return Object.values(address).some((value) => value && value !== 'India') ? address : null;
};

export async function ensureAccountProvisioned(
  client: SupabaseClient,
  user: User
): Promise<ProvisionedAccount> {
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const requestedRole = roleFromUser(user);
  const email = text(user.email).toLowerCase();
  if (!email) throw new Error('The authenticated account does not have an email address.');

  const { data: existingProfile, error: profileReadError } = await client
    .from('user_profiles')
    .select('id,role,is_active,can_buy,can_sell')
    .eq('id', user.id)
    .maybeSingle();
  if (profileReadError) throw profileReadError;

  const existing = existingProfile as UserProfileRow | null;
  const existingRole = existing?.role;
  const role: AccountRole =
    existingRole === 'seller' || existingRole === 'buyer' ||
    existingRole === 'admin_staff' || existingRole === 'super_admin'
      ? existingRole
      : requestedRole;
  const isAdmin = role === 'admin_staff' || role === 'super_admin';
  const requestedSeller = requestedRole === 'seller' || Boolean(text(metadata.gstin));
  const canBuy = !isAdmin && (existing?.can_buy ?? true);
  const canSell = !isAdmin && Boolean(existing?.can_sell || requestedSeller);

  const userProfilePayload = {
    id: user.id,
    email,
    full_name: text(metadata.full_name) || email.split('@')[0],
    avatar_url: nullableText(metadata.avatar_url),
    phone: nullableText(metadata.phone),
    role,
    business_name: nullableText(metadata.business_name),
    gstin: nullableText(metadata.gstin)?.toUpperCase() || null,
    address_line1: nullableText(metadata.address_line1),
    address_line2: nullableText(metadata.address_line2),
    city: nullableText(metadata.city),
    state: nullableText(metadata.state),
    pincode: nullableText(metadata.pincode),
    preferred_language: text(metadata.preferred_language) || 'en',
    preferred_theme: text(metadata.preferred_theme) || 'system',
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await client.from('user_profiles').update(userProfilePayload).eq('id', user.id);
    if (error) throw error;
  } else {
    const { error } = await client.from('user_profiles').insert({
      ...userProfilePayload,
      can_buy: canBuy,
      can_sell: canSell,
      account_kind: canSell ? 'business' : 'individual',
      verification_method: canSell ? 'gstin' : text(metadata.verification_method) || 'none',
      verification_status: canSell || text(metadata.verification_method) ? 'pending' : 'unverified',
      identity_reference_last4: nullableText(metadata.identity_reference_last4),
      is_active: true,
    });
    if (error) throw error;
  }

  if (isAdmin) {
    return { role, userProfileId: user.id, buyerProfileId: null, sellerProfileId: null, canBuy: false, canSell: false };
  }

  const { data: existingBuyer, error: buyerReadError } = await client
    .from('buyer_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (buyerReadError) throw buyerReadError;
  const buyerPayload = {
    user_id: user.id,
    business_name: nullableText(metadata.business_name),
    business_type: canSell ? nullableText(metadata.business_type) : 'Individual buyer',
    gstin: nullableText(metadata.gstin)?.toUpperCase() || null,
    billing_address: addressFromMetadata(metadata),
    updated_at: new Date().toISOString(),
  };
  let buyerProfileId = existingBuyer?.id ? String(existingBuyer.id) : null;
  if (buyerProfileId) {
    const { error } = await client.from('buyer_profiles').update(buyerPayload).eq('id', buyerProfileId).eq('user_id', user.id);
    if (error) throw error;
  } else {
    const { data, error } = await client.from('buyer_profiles').insert({
      ...buyerPayload,
      buyer_ref: accountReference('BYR', user.id),
      gstin_verified: false,
      is_active: true,
    }).select('id').single();
    if (error) throw error;
    buyerProfileId = String(data.id);
  }

  let sellerProfileId: string | null = null;
  if (canSell) {
    const { data: existingSeller, error: sellerReadError } = await client
      .from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle();
    if (sellerReadError) throw sellerReadError;
    const sellerPayload = {
      user_id: user.id,
      legal_business_name: text(metadata.business_name) || text(metadata.full_name) || email.split('@')[0],
      display_name: text(metadata.business_name) || text(metadata.full_name) || email.split('@')[0],
      business_type: nullableText(metadata.business_type),
      gstin: nullableText(metadata.gstin)?.toUpperCase() || null,
      pan: nullableText(metadata.pan)?.toUpperCase() || null,
      pickup_address: addressFromMetadata(metadata),
      updated_at: new Date().toISOString(),
    };
    sellerProfileId = existingSeller?.id ? String(existingSeller.id) : null;
    if (sellerProfileId) {
      const { error } = await client.from('seller_profiles').update(sellerPayload).eq('id', sellerProfileId).eq('user_id', user.id);
      if (error) throw error;
    } else {
      const { data, error } = await client.from('seller_profiles').insert({
        ...sellerPayload,
        seller_ref: accountReference('SLR', user.id),
        verification_status: 'registration_started',
        gstin_verified: false,
        settlement_eligible: false,
        is_active: true,
      }).select('id').single();
      if (error) throw error;
      sellerProfileId = String(data.id);
    }
  }

  return { role, userProfileId: user.id, buyerProfileId, sellerProfileId, canBuy, canSell };
}
