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

type ExistingProfile = {
  full_name: string | null;
  phone: string | null;
  business_name: string | null;
  gstin: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
};

type ExistingSeller = {
  id: string;
  legal_business_name: string | null;
  display_name: string | null;
  business_type: string | null;
  gstin: string | null;
  pan: string | null;
};

type ExistingRegistration = {
  owner_name: string | null;
  phone: string | null;
  business_name: string | null;
  business_type: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  address: string | null;
  categories: string[] | null;
  monthly_capacity: string | null;
  gstin: string | null;
  pan: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
};

type ExistingBank = {
  account_holder_name: string | null;
  bank_name: string | null;
  account_number_masked: string | null;
  ifsc_code: string | null;
  is_verified: boolean | null;
};

const clean = (value: unknown, max = 500) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, max);

const digits = (value: unknown, max = 32) => clean(value, max).replace(/\D/g, '');

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
  const draftOnly = formData.get('draftOnly') === '1';

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(clean(formData.get('payload'), 30_000)) as Record<string, unknown>;
  } catch {
    return json({ error: 'Seller details are invalid.' }, 400);
  }

  const [{ data: profileData }, { data: sellerData }, { data: registrationData }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('full_name,phone,business_name,gstin,address_line1,city,state,pincode')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('seller_profiles')
      .select('id,legal_business_name,display_name,business_type,gstin,pan')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('seller_registrations')
      .select('owner_name,phone,business_name,business_type,city,state,pincode,address,categories,monthly_capacity,gstin,pan,bank_account_number,bank_ifsc,bank_account_name,bank_name')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const existingProfile = (profileData as ExistingProfile | null) ?? null;
  const existingSeller = (sellerData as ExistingSeller | null) ?? null;
  const existingRegistration = (registrationData as ExistingRegistration | null) ?? null;

  const gstin = (
    clean(input.gstin, 15) ||
    clean(existingRegistration?.gstin, 15) ||
    clean(existingSeller?.gstin, 15) ||
    clean(existingProfile?.gstin, 15)
  ).toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    return json({ error: 'Enter a valid GSTIN to continue the seller application.' }, 400);
  }

  const businessName =
    clean(input.businessName, 200) ||
    clean(existingRegistration?.business_name, 200) ||
    clean(existingSeller?.legal_business_name, 200) ||
    clean(existingSeller?.display_name, 200) ||
    clean(existingProfile?.business_name, 200);
  const ownerName =
    clean(input.ownerName, 160) ||
    clean(existingRegistration?.owner_name, 160) ||
    clean(existingProfile?.full_name, 160);
  const phone =
    digits(input.phone, 32).slice(-10) ||
    digits(existingRegistration?.phone, 32).slice(-10) ||
    digits(existingProfile?.phone, 32).slice(-10);

  if (!businessName || !ownerName || !/^[6-9]\d{9}$/.test(phone)) {
    return json(
      {
        error:
          'Your saved seller profile is incomplete. Add the business name, owner name and mobile number once; FabricTrad will keep them for the remaining steps.',
      },
      400
    );
  }

  let existingBank: ExistingBank | null = null;
  if (existingSeller?.id) {
    const { data } = await supabase
      .from('seller_bank_profiles')
      .select('account_holder_name,bank_name,account_number_masked,ifsc_code,is_verified')
      .eq('seller_id', existingSeller.id)
      .maybeSingle();
    existingBank = (data as ExistingBank | null) ?? null;
  }

  const accountDigits = digits(input.bankAccountNumber, 32);
  const bankIfsc = (
    clean(input.bankIfsc, 11) ||
    clean(existingRegistration?.bank_ifsc, 11) ||
    clean(existingBank?.ifsc_code, 11)
  ).toUpperCase();
  const bankAccountName =
    clean(input.bankAccountName, 200) ||
    clean(existingRegistration?.bank_account_name, 200) ||
    clean(existingBank?.account_holder_name, 200);
  const bankName =
    clean(input.bankName, 200) ||
    clean(existingRegistration?.bank_name, 200) ||
    clean(existingBank?.bank_name, 200);
  const bankAccountNumberMasked = accountDigits
    ? `****${accountDigits.slice(-4)}`
    : clean(existingRegistration?.bank_account_number, 32) ||
      clean(existingBank?.account_number_masked, 32);

  if (accountDigits && !/^\d{9,18}$/.test(accountDigits)) {
    return json({ error: 'Enter a valid bank account number containing 9 to 18 digits.' }, 400);
  }
  if (!bankAccountNumberMasked || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)) {
    return json({ error: 'Add a valid settlement account number and IFSC code.' }, 400);
  }
  if (!bankAccountName || !bankName) {
    return json({ error: 'Add the account-holder name and bank name.' }, 400);
  }

  const businessType =
    clean(input.businessType, 100) ||
    clean(existingRegistration?.business_type, 100) ||
    clean(existingSeller?.business_type, 100) ||
    'Business seller';
  const city =
    clean(input.city, 120) ||
    clean(existingRegistration?.city, 120) ||
    clean(existingProfile?.city, 120);
  const state =
    clean(input.state, 120) ||
    clean(existingRegistration?.state, 120) ||
    clean(existingProfile?.state, 120);
  const pincode =
    clean(input.pincode, 6) ||
    clean(existingRegistration?.pincode, 6) ||
    clean(existingProfile?.pincode, 6);
  const address =
    clean(input.address, 1000) ||
    clean(existingRegistration?.address, 1000) ||
    clean(existingProfile?.address_line1, 1000);
  const categoriesFromInput = Array.isArray(input.categories)
    ? input.categories.map((item) => clean(item, 100)).filter(Boolean).slice(0, 30)
    : [];
  const categories = categoriesFromInput.length
    ? categoriesFromInput
    : (existingRegistration?.categories || []).map((item) => clean(item, 100)).filter(Boolean).slice(0, 30);
  const monthlyCapacity =
    clean(input.monthlyCapacity, 100) || clean(existingRegistration?.monthly_capacity, 100);
  const pan = (
    clean(input.pan, 10) ||
    clean(existingRegistration?.pan, 10) ||
    clean(existingSeller?.pan, 10) ||
    gstin.slice(2, 12)
  ).toUpperCase();

  if (pan !== gstin.slice(2, 12)) {
    return json({ error: 'The PAN must match characters 3–12 of the GSTIN.' }, 400);
  }

  const payload = {
    ownerName,
    phone,
    businessName,
    businessType,
    city,
    state,
    pincode,
    address,
    categories,
    monthlyCapacity,
    gstin,
    pan,
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

  const bankWasChanged = Boolean(
    accountDigits ||
      (clean(input.bankIfsc, 11) && clean(input.bankIfsc, 11).toUpperCase() !== clean(existingBank?.ifsc_code, 11).toUpperCase()) ||
      (clean(input.bankAccountName, 200) && clean(input.bankAccountName, 200) !== clean(existingBank?.account_holder_name, 200)) ||
      (clean(input.bankName, 200) && clean(input.bankName, 200) !== clean(existingBank?.bank_name, 200))
  );

  const { error: bankSaveError } = await admin
    .from('seller_bank_profiles')
    .upsert(
      {
        seller_id: sellerProfileId,
        account_holder_name: bankAccountName,
        bank_name: bankName,
        account_number_masked: bankAccountNumberMasked,
        ifsc_code: bankIfsc,
        is_verified: bankWasChanged ? false : Boolean(existingBank?.is_verified),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'seller_id' }
    );
  if (bankSaveError) {
    return json(
      {
        saved: true,
        applicationSubmitted: false,
        sellerProfileId,
        registrationId,
        sellerRef,
        warning: 'Business details were saved, but the settlement account could not be saved. Please retry.',
      },
      207
    );
  }

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

  if (draftOnly) {
    return json({
      saved: true,
      applicationSubmitted: false,
      sellerProfileId,
      registrationId,
      sellerRef,
      uploadedDocuments,
      missingDocuments: [],
      message: 'Your documents are saved. Review will start only when you submit the application.',
    });
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
