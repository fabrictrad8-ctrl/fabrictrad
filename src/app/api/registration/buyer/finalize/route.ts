import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { ensureAccountProvisioned } from '@/lib/accountProvisioning';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  lastFour,
  normalizeGstin,
  normalizePan,
  panFromGstin,
  validateGstinChecksum,
  validateGstinFormat,
  validatePan,
} from '@/lib/commerceIdentifiers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type BuyerType = 'retail_store' | 'end_user';
type IdentityMethod = 'pan' | 'aadhaar_offline';
type GstRegistrationStatus = 'registered' | 'unregistered';
type DocumentType =
  | 'gst_certificate'
  | 'pan_card' |'aadhaar_offline_ekyc' |'business_proof' |'address_proof';

type BuyerPayload = {
  buyerType?: BuyerType;
  fullName?: string;
  phone?: string;
  businessName?: string;
  gstRegistrationStatus?: GstRegistrationStatus;
  gstin?: string;
  pan?: string;
  identityMethod?: IdentityMethod;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

const DOCUMENT_TYPES: DocumentType[] = [
  'gst_certificate',
  'pan_card',
  'aadhaar_offline_ekyc',
  'business_proof',
  'address_proof',
];

const clean = (value: unknown, max = 500) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, max);

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const safeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-100) || 'document';

const adminClientOrNull = () => {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
};

const validateDocument = (file: File, documentType: DocumentType) => {
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds the 10 MB limit.`);
  const commonAllowed =
    file.type === 'application/pdf' || file.type.startsWith('image/') ||
    (documentType === 'aadhaar_offline_ekyc' &&
      ['application/xml', 'text/xml', 'application/zip', 'application/x-zip-compressed'].includes(file.type));
  if (!commonAllowed) {
    throw new Error(
      documentType === 'aadhaar_offline_ekyc'
        ? `${file.name} must be the UIDAI Offline e-KYC XML/ZIP, PDF or supported image.`
        : `${file.name} must be a PDF or supported image.`
    );
  }
};

async function resolveUser(
  request: NextRequest,
  formData: FormData,
  serverClient: SupabaseClient,
  admin: SupabaseClient | null
): Promise<User | null> {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (token) {
    const { data, error } = await serverClient.auth.getUser(token);
    if (!error && data.user) return data.user;
  }

  const { data, error } = await serverClient.auth.getUser();
  if (!error && data.user) return data.user;

  const userId = clean(formData.get('userId'), 64);
  const nonce = clean(formData.get('registrationNonce'), 128);
  if (!admin || !userId || !nonce) return null;
  const { data: adminUser, error: adminError } = await admin.auth.admin.getUserById(userId);
  const candidate = adminError ? null : adminUser.user;
  const fresh = candidate?.created_at
    ? new Date(candidate.created_at).getTime() > Date.now() - 2 * 60 * 60 * 1000
    : false;
  return candidate && fresh && candidate.user_metadata?.registration_nonce === nonce ? candidate : null;
}

const requiredFiles = (
  buyerType: BuyerType,
  gstRegistrationStatus: GstRegistrationStatus,
  identityMethod: IdentityMethod
) => {
  if (buyerType === 'end_user') return [] as DocumentType[];
  const required: DocumentType[] = ['business_proof'];
  required.push(identityMethod === 'pan' ? 'pan_card' : 'aadhaar_offline_ekyc');
  if (gstRegistrationStatus === 'registered') required.push('gst_certificate');
  return required;
};

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Invalid buyer registration submission.' }, 400);
  }

  let payload: BuyerPayload;
  try {
    payload = JSON.parse(clean(formData.get('payload'), 30_000)) as BuyerPayload;
  } catch {
    return json({ error: 'Buyer details are invalid.' }, 400);
  }

  const buyerType: BuyerType = payload.buyerType === 'retail_store' ? 'retail_store' : 'end_user';
  const identityMethod: IdentityMethod = payload.identityMethod === 'aadhaar_offline' ? 'aadhaar_offline' : 'pan';
  const gstRegistrationStatus: GstRegistrationStatus =
    payload.gstRegistrationStatus === 'registered' ? 'registered' : 'unregistered';
  const businessName = clean(payload.businessName, 200);
  const gstin = normalizeGstin(payload.gstin);
  const pan = normalizePan(payload.pan);

  if (buyerType === 'retail_store') {
    if (!businessName) return json({ error: 'Enter the shop or legal business name.' }, 400);
    if (gstRegistrationStatus === 'registered') {
      if (!validateGstinFormat(gstin) || !validateGstinChecksum(gstin)) {
        return json({ error: 'Enter the GSTIN exactly as shown on the GST certificate.' }, 400);
      }
      if (identityMethod === 'pan' && pan && pan !== panFromGstin(gstin)) {
        return json({ error: 'The PAN does not match characters 3–12 of the GSTIN.' }, 400);
      }
    }
    if (identityMethod === 'pan' && !validatePan(pan)) {
      return json({ error: 'Enter a valid PAN in the format AAAAA9999A.' }, 400);
    }

    for (const documentType of requiredFiles(buyerType, gstRegistrationStatus, identityMethod)) {
      const file = formData.get(`document_${documentType}`);
      if (!(file instanceof File) || file.size === 0) {
        const labels: Record<DocumentType, string> = {
          gst_certificate: 'GST registration certificate',
          pan_card: 'PAN card',
          aadhaar_offline_ekyc: 'UIDAI Offline e-KYC file',
          business_proof: 'shop or business proof',
          address_proof: 'address proof',
        };
        return json({ error: `Upload the ${labels[documentType]} before continuing.` }, 400);
      }
    }
  }

  const serverClient = await createClient();
  const admin = adminClientOrNull();
  const user = await resolveUser(request, formData, serverClient, admin);
  if (!user) return json({ error: 'Authentication or registration verification is required.' }, 401);

  // A FabricTrad seller is also allowed to buy. Do not reject an existing
  // seller login here: the same authenticated account may upgrade its buyer
  // profile to Retail Store without creating another email/mobile identity.
  const client = admin || serverClient;
  try {
    await ensureAccountProvisioned(client, user);
    const { data: buyerProfile, error: buyerReadError } = await client
      .from('buyer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (buyerReadError || !buyerProfile?.id) throw buyerReadError || new Error('Buyer profile is not ready.');

    const now = new Date().toISOString();
    let gstinStatus = 'not_provided';
    let gstinDetails: Record<string, unknown> = {};
    if (buyerType === 'retail_store' && gstRegistrationStatus === 'registered') {
      const { data: existingCheck } = await client
        .from('gstin_verifications')
        .select('verification_status,legal_name,trade_name,state_code,taxpayer_type,registration_date,cancellation_date,provider,checked_at')
        .eq('owner_user_id', user.id)
        .eq('subject_type', 'buyer')
        .eq('gstin', gstin)
        .maybeSingle();
      gstinStatus = String(existingCheck?.verification_status || 'manual_review');
      gstinDetails = existingCheck || {};
    }

    const { error: buyerUpdateError } = await client
      .from('buyer_profiles')
      .update({
        buyer_type: buyerType,
        business_name: buyerType === 'retail_store' ? businessName : null,
        business_type: buyerType === 'retail_store' ? 'Retail Store' : 'Individual buyer',
        gstin: buyerType === 'retail_store' && gstRegistrationStatus === 'registered' ? gstin : null,
        gstin_verified: gstinStatus === 'active',
        gst_registration_status: buyerType === 'retail_store' ? gstRegistrationStatus : 'not_declared',
        business_kyc_status: buyerType === 'retail_store' ? 'pending' : 'not_required',
        pan_last4: buyerType === 'retail_store' && identityMethod === 'pan' ? lastFour(pan) : null,
        gstin_status: gstinStatus,
        gstin_legal_name: gstinDetails.legal_name || null,
        gstin_trade_name: gstinDetails.trade_name || null,
        gstin_state_code: gstinDetails.state_code || (gstin ? gstin.slice(0, 2) : null),
        gstin_taxpayer_type: gstinDetails.taxpayer_type || null,
        gstin_registration_date: gstinDetails.registration_date || null,
        gstin_cancellation_date: gstinDetails.cancellation_date || null,
        gstin_last_checked_at: gstinDetails.checked_at || (gstin ? now : null),
        gstin_verification_provider: gstinDetails.provider || (gstin ? 'manual_gst_portal' : null),
        billing_address: {
          line1: clean(payload.addressLine1, 300),
          line2: clean(payload.addressLine2, 300),
          city: clean(payload.city, 120),
          state: clean(payload.state, 120),
          pincode: clean(payload.pincode, 6),
          country: 'India',
        },
        updated_at: now,
      })
      .eq('id', buyerProfile.id);
    if (buyerUpdateError) throw buyerUpdateError;

    const { error: profileUpdateError } = await client
      .from('user_profiles')
      .update({
        full_name: clean(payload.fullName, 160) || user.user_metadata?.full_name || user.email?.split('@')[0],
        phone: clean(payload.phone, 10).replace(/\D/g, '') || null,
        account_kind: buyerType === 'retail_store' ? 'business' : 'individual',
        business_name: buyerType === 'retail_store' ? businessName : null,
        gstin: buyerType === 'retail_store' && gstRegistrationStatus === 'registered' ? gstin : null,
        verification_method: buyerType === 'retail_store' ? identityMethod : 'none',
        verification_status: buyerType === 'retail_store' ? 'pending' : 'unverified',
        identity_reference_last4:
          buyerType === 'retail_store' && identityMethod === 'pan' ? lastFour(pan) : null,
        address_line1: clean(payload.addressLine1, 300) || null,
        address_line2: clean(payload.addressLine2, 300) || null,
        city: clean(payload.city, 120) || null,
        state: clean(payload.state, 120) || null,
        pincode: clean(payload.pincode, 6) || null,
        updated_at: now,
      })
      .eq('id', user.id);
    if (profileUpdateError) throw profileUpdateError;

    let uploadedDocuments = 0;
    if (buyerType === 'retail_store') {
      for (const documentType of DOCUMENT_TYPES) {
        const file = formData.get(`document_${documentType}`);
        if (!(file instanceof File) || file.size === 0) continue;
        validateDocument(file, documentType);
        const storagePath = `${user.id}/${buyerProfile.id}/${documentType}-${Date.now()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await client.storage
          .from('business-kyc-documents')
          .upload(storagePath, file, {
            upsert: false,
            contentType: file.type || 'application/octet-stream',
            cacheControl: '3600',
          });
        if (uploadError) throw uploadError;

        const { data: existingDocument } = await client
          .from('business_kyc_documents')
          .select('id')
          .eq('owner_user_id', user.id)
          .eq('buyer_profile_id', buyerProfile.id)
          .eq('document_type', documentType)
          .maybeSingle();
        const documentValues = {
          owner_user_id: user.id,
          buyer_profile_id: buyerProfile.id,
          seller_profile_id: null,
          document_type: documentType,
          storage_path: storagePath,
          original_filename: file.name,
          mime_type: file.type || 'application/octet-stream',
          file_size: file.size,
          verification_status: 'pending',
          updated_at: now,
        };
        const { error: documentError } = existingDocument?.id
          ? await client.from('business_kyc_documents').update(documentValues).eq('id', existingDocument.id)
          : await client.from('business_kyc_documents').insert(documentValues);
        if (documentError) throw documentError;
        uploadedDocuments += 1;
      }
    }

    if (admin && user.user_metadata?.registration_nonce) {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata || {}), registration_nonce: null },
      });
    }

    return json({
      completed: true,
      buyerType,
      buyerProfileId: buyerProfile.id,
      uploadedDocuments,
      gstinStatus,
      businessKycStatus: buyerType === 'retail_store' ? 'pending' : 'not_required',
      message:
        buyerType === 'retail_store' ?'Business buyer profile submitted. Buying is available while business documents are reviewed; B2B tax-invoice benefits require an active GSTIN.' :'Personal buyer profile created. No PAN, Aadhaar or GST documents are required.',
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Buyer registration could not be completed.' }, 500);
  }
}
