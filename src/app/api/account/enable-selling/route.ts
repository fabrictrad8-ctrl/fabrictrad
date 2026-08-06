import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DOCUMENT_TYPES = [
  'gst_certificate',
  'pan_card',
  'cancelled_cheque',
  'business_proof',
  'address_proof',
] as const;

const REQUIRED_DOCUMENT_TYPES = [
  'gst_certificate',
  'pan_card',
  'cancelled_cheque',
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number];

type SellerAccessRow = {
  seller_profile_id: string;
  registration_id: string;
};

type ExistingBank = {
  account_holder_name: string | null;
  bank_name: string | null;
  account_number_masked: string | null;
  ifsc_code: string | null;
};

const clean = (value: unknown, max = 500) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, max);

const safeFilename = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-100) || 'document';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const validateFile = (file: File) => {
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds the 10 MB limit.`);
  if (!(file.type === 'application/pdf' || file.type.startsWith('image/'))) {
    throw new Error(`${file.name} must be a PDF or image.`);
  }
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: 'Sign in to continue the seller application.' }, 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Invalid seller application.' }, 400);
  }

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(clean(formData.get('payload'), 30_000)) as Record<string, unknown>;
  } catch {
    return json({ error: 'Seller details are invalid.' }, 400);
  }

  const gstin = clean(input.gstin, 15).toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    return json({ error: 'Enter a valid GSTIN to continue the seller application.' }, 400);
  }

  const businessName = clean(input.businessName, 200);
  const ownerName = clean(input.ownerName, 160);
  const phone = clean(input.phone, 10).replace(/\D/g, '');
  if (!businessName || !ownerName || !/^[6-9]\d{9}$/.test(phone)) {
    return json({ error: 'Business name, owner name and a valid mobile number are required.' }, 400);
  }

  const { data: existingSeller } = await supabase
    .from('seller_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  let existingBank: ExistingBank | null = null;
  if (existingSeller?.id) {
    const { data } = await supabase
      .from('seller_bank_profiles')
      .select('account_holder_name,bank_name,account_number_masked,ifsc_code')
      .eq('seller_id', existingSeller.id)
      .maybeSingle();
    existingBank = (data as ExistingBank | null) ?? null;
  }

  const accountDigits = clean(input.bankAccountNumber, 32).replace(/\D/g, '');
  const bankIfsc = clean(input.bankIfsc, 11).toUpperCase() || existingBank?.ifsc_code || '';
  const bankAccountName =
    clean(input.bankAccountName, 200) || existingBank?.account_holder_name || '';
  const bankName = clean(input.bankName, 200) || existingBank?.bank_name || '';
  const bankAccountNumberMasked = accountDigits
    ? `****${accountDigits.slice(-4)}`
    : existingBank?.account_number_masked || '';

  if (accountDigits && !/^\d{9,18}$/.test(accountDigits)) {
    return json({ error: 'Enter a valid bank account number containing 9 to 18 digits.' }, 400);
  }
  if (!bankAccountNumberMasked || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)) {
    return json({ error: 'Add a valid settlement account number and IFSC code.' }, 400);
  }
  if (!bankAccountName || !bankName) {
    return json({ error: 'Add the account-holder name and bank name.' }, 400);
  }

  const payload = {
    ownerName,
    phone,
    businessName,
    businessType: clean(input.businessType, 100),
    city: clean(input.city, 120),
    state: clean(input.state, 120),
    pincode: clean(input.pincode, 6),
    address: clean(input.address, 1000),
    categories: Array.isArray(input.categories)
      ? input.categories.map((item) => clean(item, 100)).filter(Boolean).slice(0, 30)
      : [],
    monthlyCapacity: clean(input.monthlyCapacity, 100),
    gstin,
    pan: clean(input.pan, 10).toUpperCase(),
    bankAccountNumberMasked,
    bankIfsc,
    bankAccountName,
    bankName,
  };

  const { data: upgraded, error: upgradeError } = await supabase
    .rpc('request_seller_access', { p_payload: payload })
    .single();
  if (upgradeError || !upgraded) {
    return json({ error: upgradeError?.message || 'Seller application details could not be saved.' }, 500);
  }

  const access = upgraded as SellerAccessRow;
  const sellerProfileId = String(access.seller_profile_id);
  const registrationId = String(access.registration_id);
  const sellerRef = `FT-SLR-${user.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const admin = createAdminClient();
  let uploadedDocuments = 0;

  try {
    for (const documentType of DOCUMENT_TYPES) {
      const file = formData.get(`document_${documentType}`);
      if (!(file instanceof File) || file.size === 0) continue;
      validateFile(file);

      const storagePath = `${user.id}/${registrationId}/${documentType}-${safeFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('seller-registration-documents')
        .upload(storagePath, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600',
        });
      if (uploadError) throw uploadError;

      // The authenticated upload proves ownership. Metadata is reset through the
      // service client so a rejected document can safely re-enter review without
      // giving sellers direct access to administrator review fields.
      const { error: documentError } = await admin
        .from('seller_registration_documents')
        .upsert(
          {
            registration_id: registrationId,
            document_type: documentType,
            file_url: storagePath,
            file_name: file.name,
            upload_status: 'uploaded',
            rejection_reason: null,
            reviewed_by: null,
            reviewed_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'registration_id,document_type' }
        );
      if (documentError) throw documentError;
      uploadedDocuments += 1;
    }
  } catch (error) {
    return json(
      {
        saved: true,
        applicationSubmitted: false,
        sellerProfileId,
        registrationId,
        sellerRef,
        warning:
          error instanceof Error
            ? error.message
            : 'Business and bank details were saved, but a document upload failed.',
      },
      207
    );
  }

  const { data: documentRows, error: documentReadError } = await supabase
    .from('seller_registration_documents')
    .select('document_type,upload_status')
    .eq('registration_id', registrationId)
    .in('upload_status', ['uploaded', 'under_review', 'approved']);
  if (documentReadError) {
    return json(
      {
        saved: true,
        applicationSubmitted: false,
        sellerProfileId,
        registrationId,
        sellerRef,
        warning: 'Details were saved, but document completeness could not be confirmed.',
      },
      207
    );
  }

  const availableTypes = new Set(
    (documentRows || []).map((row) => String(row.document_type) as DocumentType)
  );
  const missingDocuments = REQUIRED_DOCUMENT_TYPES.filter((type) => !availableTypes.has(type));
  if (missingDocuments.length > 0) {
    return json(
      {
        saved: true,
        applicationSubmitted: false,
        sellerProfileId,
        registrationId,
        sellerRef,
        uploadedDocuments,
        missingDocuments,
        message: 'Your progress is saved. Upload the remaining required documents to enter review.',
      },
      202
    );
  }

  const { error: reviewError } = await supabase.rpc('mark_seller_application_documents_uploaded');
  if (reviewError) {
    return json(
      {
        saved: true,
        applicationSubmitted: false,
        sellerProfileId,
        registrationId,
        sellerRef,
        warning: reviewError.message || 'Documents were saved, but the review queue could not be updated.',
      },
      207
    );
  }

  return json({
    activated: true,
    saved: true,
    applicationSubmitted: true,
    sellerProfileId,
    registrationId,
    sellerRef,
    uploadedDocuments,
    missingDocuments: [],
    message:
      'Seller application submitted for GSTIN, document and settlement-account review. Buying remains active on this account.',
  });
}
