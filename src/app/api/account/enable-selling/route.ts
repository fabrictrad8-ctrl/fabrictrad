import { NextRequest, NextResponse } from 'next/server';
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

const REQUIRED_DOCUMENT_TYPES = new Set(['gst_certificate', 'pan_card', 'cancelled_cheque']);

type SellerAccessRow = {
  seller_profile_id: string;
  registration_id: string;
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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: 'Sign in to activate selling on this account.' }, 401);

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
    return json({ error: 'Enter a valid GSTIN to unlock selling access.' }, 400);
  }

  const businessName = clean(input.businessName, 200);
  const ownerName = clean(input.ownerName, 160);
  const phone = clean(input.phone, 10).replace(/\D/g, '');
  if (!businessName || !ownerName || !/^[6-9]\d{9}$/.test(phone)) {
    return json({ error: 'Business name, owner name and a valid mobile number are required.' }, 400);
  }

  const missingRequiredDocument = [...REQUIRED_DOCUMENT_TYPES].find((type) => {
    const file = formData.get(`document_${type}`);
    return !(file instanceof File) || file.size === 0;
  });
  if (missingRequiredDocument) {
    return json({ error: 'Upload the GST certificate, PAN card and cancelled cheque before submitting.' }, 400);
  }

  const accountDigits = clean(input.bankAccountNumber, 32).replace(/\D/g, '');
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
    bankAccountNumberMasked: accountDigits ? `****${accountDigits.slice(-4)}` : '',
    bankIfsc: clean(input.bankIfsc, 11).toUpperCase(),
    bankAccountName: clean(input.bankAccountName, 200),
    bankName: clean(input.bankName, 200),
  };

  const { data: upgraded, error: upgradeError } = await supabase
    .rpc('request_seller_access', { p_payload: payload })
    .single();
  if (upgradeError || !upgraded) {
    return json({ error: upgradeError?.message || 'Seller access could not be activated.' }, 500);
  }

  const access = upgraded as SellerAccessRow;
  const sellerProfileId = String(access.seller_profile_id);
  const registrationId = String(access.registration_id);
  const sellerRef = `FT-SLR-${user.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  let uploadedDocuments = 0;

  try {
    for (const documentType of DOCUMENT_TYPES) {
      const file = formData.get(`document_${documentType}`);
      if (!(file instanceof File) || file.size === 0) continue;
      if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds the 10 MB limit.`);
      if (!(file.type === 'application/pdf' || file.type.startsWith('image/'))) {
        throw new Error(`${file.name} must be a PDF or image.`);
      }

      const storagePath = `${user.id}/${registrationId}/${documentType}-${safeFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('seller-registration-documents')
        .upload(storagePath, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600',
        });
      if (uploadError) throw uploadError;

      const { error: documentError } = await supabase
        .from('seller_registration_documents')
        .upsert(
          {
            registration_id: registrationId,
            document_type: documentType,
            file_url: storagePath,
            file_name: file.name,
            upload_status: 'uploaded',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'registration_id,document_type' }
        );
      if (documentError) throw documentError;
      uploadedDocuments += 1;
    }

    const { error: reviewError } = await supabase.rpc('mark_seller_application_documents_uploaded');
    if (reviewError) throw reviewError;
  } catch (error) {
    return json(
      {
        activated: true,
        sellerProfileId,
        registrationId,
        sellerRef,
        warning: error instanceof Error ? error.message : 'Seller access is active, but document review setup failed.',
      },
      207
    );
  }

  return json({
    activated: true,
    sellerProfileId,
    registrationId,
    sellerRef,
    uploadedDocuments,
    message: 'Buying remains active and seller tools are now available on this same account.',
  });
}
