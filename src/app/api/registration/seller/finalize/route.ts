import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { ensureAccountProvisioned } from '@/lib/accountProvisioning';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DOCUMENT_TYPES = [
  'gst_certificate',
  'pan_card',
  'cancelled_cheque',
  'business_proof',
  'address_proof',
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number];

type SellerPayload = {
  ownerName?: string;
  phone?: string;
  businessName?: string;
  businessType?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
  categories?: string[];
  monthlyCapacity?: string;
  gstin?: string;
  pan?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankAccountName?: string;
  bankName?: string;
};

type SignupDocument = {
  documentType: DocumentType;
  storagePath: string;
  fileName: string;
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const clean = (value: unknown, max = 500) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, max);

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

const validateDocument = (file: File) => {
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds the 10 MB limit.`);
  if (!(file.type === 'application/pdf' || file.type.startsWith('image/'))) {
    throw new Error(`${file.name} must be a PDF or image.`);
  }
};

async function resolveUser(
  request: NextRequest,
  formData: FormData,
  serverClient: SupabaseClient,
  admin: SupabaseClient | null
): Promise<{ user: User | null; nonceAuthenticated: boolean }> {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';

  if (token) {
    const { data, error } = await serverClient.auth.getUser(token);
    if (!error && data.user) return { user: data.user, nonceAuthenticated: false };
  }

  const { data: sessionData, error: sessionError } = await serverClient.auth.getUser();
  if (!sessionError && sessionData.user) {
    return { user: sessionData.user, nonceAuthenticated: false };
  }

  const userId = clean(formData.get('userId'), 64);
  const nonce = clean(formData.get('registrationNonce'), 128);
  if (!admin || !userId || !nonce) return { user: null, nonceAuthenticated: false };

  const { data, error } = await admin.auth.admin.getUserById(userId);
  const candidate = error ? null : data.user;
  const fresh = candidate?.created_at
    ? new Date(candidate.created_at).getTime() > Date.now() - 2 * 60 * 60 * 1000
    : false;
  if (!candidate || !fresh || candidate.user_metadata?.registration_nonce !== nonce) {
    return { user: null, nonceAuthenticated: false };
  }
  return { user: candidate, nonceAuthenticated: true };
}

async function finalizeWithSignupNonce(
  serverClient: SupabaseClient,
  formData: FormData,
  payload: SellerPayload,
  userId: string,
  nonce: string
) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || nonce.length < 20) {
    return json({ error: 'Registration verification expired or invalid.' }, 401);
  }

  const documents: SignupDocument[] = [];
  try {
    for (const documentType of DOCUMENT_TYPES) {
      const file = formData.get(`document_${documentType}`);
      if (!(file instanceof File) || file.size === 0) continue;
      validateDocument(file);

      const storagePath = `${userId}/${nonce}/${documentType}-${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await serverClient.storage
        .from('seller-registration-documents')
        .upload(storagePath, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: '3600',
        });
      if (uploadError) throw uploadError;
      documents.push({ documentType, storagePath, fileName: file.name });
    }

    const { data, error } = await serverClient.rpc('submit_seller_registration_with_nonce', {
      p_user_id: userId,
      p_nonce: nonce,
      p_payload: payload,
      p_documents: documents,
    });
    if (error) {
      return json(
        { error: error.message || 'Seller application could not be saved.' },
        error.code === '42501' ? 401 : 500
      );
    }
    if (!data || typeof data !== 'object') {
      return json({ error: 'Seller application could not be confirmed.' }, 500);
    }
    return json(data as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Seller application could not be saved.';
    if ((error as { code?: string } | null)?.code === '23505' && /phone|mobile/i.test(message)) {
      return json(
        {
          error:
            'That mobile number already belongs to an active FabricTrad account. Sign in to that account and activate selling there instead.',
          code: 'PHONE_ALREADY_IN_USE',
        },
        409
      );
    }
    return json({ error: message }, 500);
  }
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Invalid seller registration submission.' }, 400);
  }

  let payload: SellerPayload;
  try {
    payload = JSON.parse(clean(formData.get('payload'), 30_000)) as SellerPayload;
  } catch {
    return json({ error: 'Seller registration details are invalid.' }, 400);
  }

  const serverClient = await createClient();
  const admin = adminClientOrNull();
  const { user, nonceAuthenticated } = await resolveUser(request, formData, serverClient, admin);

  if (!user) {
    const userId = clean(formData.get('userId'), 64);
    const nonce = clean(formData.get('registrationNonce'), 128);
    if (userId && nonce) {
      return finalizeWithSignupNonce(serverClient, formData, payload, userId, nonce);
    }
    return json({ error: 'Authentication is required to submit the seller application.' }, 401);
  }

  const { data: sellerAccess, error: sellerAccessError } = await serverClient
    .from('user_profiles')
    .select('role,is_active,can_sell')
    .eq('id', user.id)
    .maybeSingle();
  if (sellerAccessError) {
    return json({ error: 'Seller access could not be verified right now.' }, 503);
  }
  if (sellerAccess?.is_active === false) {
    return json({ error: 'This account is inactive.' }, 403);
  }
  if (!sellerAccess || (sellerAccess.role !== 'seller' && sellerAccess.can_sell !== true)) {
    return json({ error: 'This account is not registered as a seller.' }, 403);
  }

  const client = admin || serverClient;
  try {
    const provisioned = await ensureAccountProvisioned(client, user);
    if (!provisioned.sellerProfileId) throw new Error('Seller profile could not be prepared.');

    const sellerRef = `FT-SLR-${user.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const accountDigits = clean(payload.bankAccountNumber, 32).replace(/\D/g, '');
    const maskedAccount = accountDigits ? `****${accountDigits.slice(-4)}` : null;
    const submittedAt = new Date().toISOString();

    const registrationValues = {
      user_id: user.id,
      seller_id: sellerRef,
      phone: clean(payload.phone, 10),
      owner_name: clean(payload.ownerName, 160) || null,
      email: user.email?.toLowerCase() || null,
      business_name: clean(payload.businessName, 200) || null,
      business_type: clean(payload.businessType, 100) || null,
      city: clean(payload.city, 120) || null,
      state: clean(payload.state, 120) || null,
      pincode: clean(payload.pincode, 6) || null,
      address: clean(payload.address, 1000) || null,
      categories: Array.isArray(payload.categories)
        ? payload.categories.map((item) => clean(item, 100)).filter(Boolean).slice(0, 30)
        : [],
      monthly_capacity: clean(payload.monthlyCapacity, 100) || null,
      gstin: clean(payload.gstin, 15).toUpperCase() || null,
      pan: clean(payload.pan, 10).toUpperCase() || null,
      bank_account_number: maskedAccount,
      bank_ifsc: clean(payload.bankIfsc, 11).toUpperCase() || null,
      bank_account_name: clean(payload.bankAccountName, 200) || null,
      bank_name: clean(payload.bankName, 200) || null,
      submitted_at: submittedAt,
      updated_at: submittedAt,
    };

    const { data: existingRegistration, error: registrationReadError } = await client
      .from('seller_registrations')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (registrationReadError) throw registrationReadError;

    let registrationId: string;
    if (existingRegistration?.id) {
      const { data, error } = await client
        .from('seller_registrations')
        .update(registrationValues)
        .eq('id', existingRegistration.id)
        .eq('user_id', user.id)
        .select('id')
        .single();
      if (error) throw error;
      registrationId = String(data.id);
    } else {
      const { data, error } = await client
        .from('seller_registrations')
        .insert({ ...registrationValues, registration_status: 'pending' })
        .select('id')
        .single();
      if (error) throw error;
      registrationId = String(data.id);
    }

    const { data: existingBank, error: bankReadError } = await client
      .from('seller_bank_profiles')
      .select('id')
      .eq('seller_id', provisioned.sellerProfileId)
      .maybeSingle();
    if (bankReadError) throw bankReadError;

    const bankValues = {
      seller_id: provisioned.sellerProfileId,
      account_holder_name: clean(payload.bankAccountName, 200) || clean(payload.ownerName, 160),
      bank_name: clean(payload.bankName, 200) || 'Pending verification',
      account_number_masked: maskedAccount,
      ifsc_code: clean(payload.bankIfsc, 11).toUpperCase() || null,
      account_type: 'current',
      is_verified: false,
      updated_at: submittedAt,
    };
    if (existingBank?.id) {
      const { error } = await client
        .from('seller_bank_profiles')
        .update(bankValues)
        .eq('id', existingBank.id)
        .eq('seller_id', provisioned.sellerProfileId);
      if (error) throw error;
    } else if (bankValues.account_holder_name) {
      const { error } = await client.from('seller_bank_profiles').insert(bankValues);
      if (error) throw error;
    }

    let uploadedDocuments = 0;
    for (const documentType of DOCUMENT_TYPES) {
      const file = formData.get(`document_${documentType}`);
      if (!(file instanceof File) || file.size === 0) continue;
      validateDocument(file);

      const storagePath = `${user.id}/${registrationId}/${documentType}-${safeFileName(file.name)}`;
      const { error: uploadError } = await client.storage
        .from('seller-registration-documents')
        .upload(storagePath, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
      if (uploadError) throw uploadError;

      const { error: documentError } = await client
        .from('seller_registration_documents')
        .upsert(
          {
            registration_id: registrationId,
            document_type: documentType,
            file_url: storagePath,
            file_name: file.name,
            upload_status: 'uploaded',
            updated_at: submittedAt,
          },
          { onConflict: 'registration_id,document_type' }
        );
      if (documentError) throw documentError;
      uploadedDocuments += 1;
    }

    if (admin) {
      await admin
        .from('seller_registrations')
        .update({
          registration_status: uploadedDocuments ? 'documents_uploaded' : 'pending',
          updated_at: submittedAt,
        })
        .eq('id', registrationId);
      await admin
        .from('seller_profiles')
        .update({
          verification_status: uploadedDocuments ? 'documents_submitted' : 'profile_incomplete',
          updated_at: submittedAt,
        })
        .eq('id', provisioned.sellerProfileId);
    }

    if (nonceAuthenticated && admin) {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata || {}), registration_nonce: null },
      });
    }

    return json({
      submitted: true,
      sellerProfileId: provisioned.sellerProfileId,
      registrationId,
      sellerRef,
      uploadedDocuments,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Seller application could not be saved.';
    return json({ error: message }, 500);
  }
}
