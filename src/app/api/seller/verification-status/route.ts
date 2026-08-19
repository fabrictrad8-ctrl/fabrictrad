import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const bearerToken = (request: NextRequest) => {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
};

const requestClient = async (request: NextRequest): Promise<{ client: SupabaseClient; token: string }> => {
  const token = bearerToken(request);
  if (!token) return { client: await createServerClient(), token: '' };

  return {
    token,
    client: createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    ),
  };
};

export async function GET(request: NextRequest) {
  const { client: supabase, token } = await requestClient(request);
  const {
    data: { user },
    error: userError,
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
  if (userError || !user) return json({ error: 'Seller sign-in required.' }, 401);

  const { data: readiness, error: readinessError } = await supabase.rpc(
    'ensure_current_seller_verification_state'
  );
  if (readinessError || !readiness) {
    return json(
      { error: readinessError?.message || 'Seller verification status could not be loaded.' },
      503
    );
  }

  const readinessRecord = readiness as Record<string, unknown>;
  const registrationId = String(readinessRecord.registrationId || '');

  let registration: {
    owner_name: string | null;
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
    registration_status: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    rejection_reason: string | null;
    updated_at: string | null;
  } | null = null;

  if (registrationId) {
    const { data } = await supabase
      .from('seller_registrations')
      .select(
        'owner_name,business_name,business_type,city,state,pincode,address,categories,monthly_capacity,gstin,pan,bank_account_number,bank_ifsc,bank_account_name,bank_name,registration_status,submitted_at,approved_at,rejection_reason,updated_at'
      )
      .eq('id', registrationId)
      .eq('user_id', user.id)
      .maybeSingle();
    registration = data;
  }

  const { data: seller } = await supabase
    .from('seller_profiles')
    .select(
      'legal_business_name,display_name,business_type,gstin,gstin_status,gstin_verified,verification_status,settlement_eligible,is_active'
    )
    .eq('user_id', user.id)
    .maybeSingle();

  let documents: Array<{
    id: string;
    document_type: string;
    file_name: string | null;
    upload_status: string;
    rejection_reason: string | null;
    reviewed_at: string | null;
    updated_at: string | null;
  }> = [];
  if (registrationId) {
    const { data } = await supabase
      .from('seller_registration_documents')
      .select('id,document_type,file_name,upload_status,rejection_reason,reviewed_at,updated_at')
      .eq('registration_id', registrationId)
      .order('created_at', { ascending: true });
    documents = data || [];
  }

  const uploadedDocumentTypes = new Set(
    documents
      .filter((item) => ['uploaded', 'under_review', 'approved'].includes(item.upload_status))
      .map((item) => item.document_type)
  );
  const requiredDocumentTypes = ['gst_certificate', 'pan_card', 'cancelled_cheque'];
  const missingDocuments = requiredDocumentTypes.filter((type) => !uploadedDocumentTypes.has(type));
  const registrationStatus = String(
    registration?.registration_status || readinessRecord.registrationStatus || ''
  );
  const applicationSubmitted = Boolean(
    registrationStatus &&
      registrationStatus !== 'pending' &&
      readinessRecord.bankDetailsPresent === true &&
      missingDocuments.length === 0
  );

  return json({
    ...readinessRecord,
    applicationSubmitted,
    missingDocuments,
    application: {
      ownerName: registration?.owner_name || null,
      businessName:
        registration?.business_name || seller?.legal_business_name || seller?.display_name || null,
      businessType: registration?.business_type || seller?.business_type || null,
      city: registration?.city || null,
      state: registration?.state || null,
      pincode: registration?.pincode || null,
      address: registration?.address || null,
      categories: registration?.categories || [],
      monthlyCapacity: registration?.monthly_capacity || null,
      gstin: registration?.gstin || seller?.gstin || null,
      pan: registration?.pan || null,
      bankAccountMasked: registration?.bank_account_number || readinessRecord.bankAccountMasked || null,
      bankIfsc: registration?.bank_ifsc || readinessRecord.bankIfsc || null,
      bankAccountName:
        registration?.bank_account_name || readinessRecord.bankAccountName || null,
      bankName: registration?.bank_name || readinessRecord.bankName || null,
      registrationStatus,
      submittedAt: registration?.submitted_at || null,
      approvedAt: registration?.approved_at || null,
      rejectionReason: registration?.rejection_reason || null,
      updatedAt: registration?.updated_at || null,
    },
    documents,
  });
}
