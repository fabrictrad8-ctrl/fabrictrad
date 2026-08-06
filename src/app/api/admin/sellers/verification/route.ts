import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REQUIRED_DOCUMENT_TYPES = [
  'gst_certificate',
  'pan_card',
  'cancelled_cheque',
] as const;

type ReviewAction =
  | 'confirm_gstin'
  | 'approve_document'
  | 'reject_document'
  | 'verify_bank'
  | 'approve_seller'
  | 'reject_seller';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

async function requireAdministrator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: json({ error: 'Administrator sign-in required.' }, 401) };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .maybeSingle();
  const allowed =
    profile?.is_active === true &&
    (profile.role === 'super_admin' || profile.role === 'admin_staff');
  if (!allowed) return { error: json({ error: 'Administrator access required.' }, 403) };
  return { user };
}

const sellerBlockers = (input: {
  phone?: string | null;
  gstinVerified?: boolean;
  gstinStatus?: string | null;
  documents?: Array<{ document_type: string; upload_status: string }>;
  bankVerified?: boolean;
  bankPresent?: boolean;
}) => {
  const blockers: string[] = [];
  if (!input.phone) blockers.push('Seller mobile number is missing.');
  if (!input.gstinVerified || input.gstinStatus !== 'active') {
    blockers.push('GSTIN has not been confirmed Active.');
  }
  for (const documentType of REQUIRED_DOCUMENT_TYPES) {
    const document = input.documents?.find((item) => item.document_type === documentType);
    if (!document) blockers.push(`${documentType.replaceAll('_', ' ')} is missing.`);
    else if (document.upload_status !== 'approved') {
      blockers.push(`${documentType.replaceAll('_', ' ')} is not approved.`);
    }
  }
  if (!input.bankPresent) blockers.push('Settlement account has not been submitted.');
  else if (!input.bankVerified) blockers.push('Settlement account has not been verified.');
  return blockers;
};

async function loadApplications() {
  const admin = createAdminClient();
  const { data: sellers, error: sellerError } = await admin
    .from('seller_profiles')
    .select(
      'id,user_id,legal_business_name,display_name,business_type,gstin,gstin_status,gstin_verified,verification_status,settlement_eligible,is_active,created_at,updated_at'
    )
    .order('updated_at', { ascending: false });
  if (sellerError) throw sellerError;

  const userIds = (sellers || []).map((seller) => seller.user_id);
  const sellerIds = (sellers || []).map((seller) => seller.id);

  const [{ data: users }, { data: registrations }, { data: banks }] = await Promise.all([
    userIds.length
      ? admin
          .from('user_profiles')
          .select('id,full_name,email,phone,is_active,can_sell')
          .in('id', userIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? admin
          .from('seller_registrations')
          .select(
            'id,user_id,business_name,business_type,gstin,pan,registration_status,submitted_at,approved_at,rejection_reason,updated_at'
          )
          .in('user_id', userIds)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    sellerIds.length
      ? admin
          .from('seller_bank_profiles')
          .select(
            'id,seller_id,account_holder_name,bank_name,account_number_masked,ifsc_code,is_verified,updated_at'
          )
          .in('seller_id', sellerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const latestRegistrationByUser = new Map<string, (typeof registrations)[number]>();
  for (const registration of registrations || []) {
    if (!latestRegistrationByUser.has(registration.user_id)) {
      latestRegistrationByUser.set(registration.user_id, registration);
    }
  }
  const registrationIds = [...latestRegistrationByUser.values()].map((item) => item.id);
  const { data: documentRows } = registrationIds.length
    ? await admin
        .from('seller_registration_documents')
        .select(
          'id,registration_id,document_type,file_url,file_name,upload_status,rejection_reason,reviewed_at,updated_at'
        )
        .in('registration_id', registrationIds)
        .order('created_at', { ascending: true })
    : { data: [] };

  const documentsWithUrls = await Promise.all(
    (documentRows || []).map(async (document) => {
      let signedUrl: string | null = null;
      if (document.file_url) {
        const { data } = await admin.storage
          .from('seller-registration-documents')
          .createSignedUrl(document.file_url, 10 * 60);
        signedUrl = data?.signedUrl || null;
      }
      return { ...document, signedUrl };
    })
  );

  return (sellers || []).map((seller) => {
    const user = (users || []).find((item) => item.id === seller.user_id) || null;
    const registration = latestRegistrationByUser.get(seller.user_id) || null;
    const bank = (banks || []).find((item) => item.seller_id === seller.id) || null;
    const documents = documentsWithUrls.filter(
      (item) => item.registration_id === registration?.id
    );
    const blockers = sellerBlockers({
      phone: user?.phone,
      gstinVerified: seller.gstin_verified === true,
      gstinStatus: seller.gstin_status,
      documents,
      bankPresent: Boolean(bank),
      bankVerified: bank?.is_verified === true,
    });
    const requiredUploaded = REQUIRED_DOCUMENT_TYPES.filter((type) =>
      documents.some(
        (document) =>
          document.document_type === type &&
          ['uploaded', 'under_review', 'approved'].includes(document.upload_status)
      )
    ).length;
    const applicationSubmitted = Boolean(
      registration?.submitted_at && bank && requiredUploaded === REQUIRED_DOCUMENT_TYPES.length
    );

    return {
      sellerId: seller.id,
      userId: seller.user_id,
      seller,
      user,
      registration,
      bank,
      documents,
      blockers,
      applicationSubmitted,
      readyForApproval: applicationSubmitted && blockers.length === 0,
    };
  });
}

export async function GET() {
  const access = await requireAdministrator();
  if ('error' in access) return access.error;
  try {
    return json({ applications: await loadApplications() });
  } catch (error) {
    console.error('Administrator seller verification queue failed', error);
    return json({ error: 'Seller verification queue could not be loaded.' }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireAdministrator();
  if ('error' in access) return access.error;

  const payload = (await request.json().catch(() => ({}))) as {
    action?: ReviewAction;
    sellerId?: string;
    documentId?: string;
    reason?: string;
  };
  const action = payload.action;
  const sellerId = String(payload.sellerId || '');
  const reason = String(payload.reason || '').trim().slice(0, 1000);
  if (!action || !sellerId) return json({ error: 'Seller and review action are required.' }, 400);
  if (
    ![
      'confirm_gstin',
      'approve_document',
      'reject_document',
      'verify_bank',
      'approve_seller',
      'reject_seller',
    ].includes(action)
  ) {
    return json({ error: 'Unsupported seller review action.' }, 400);
  }
  if ((action === 'reject_document' || action === 'reject_seller') && reason.length < 5) {
    return json({ error: 'Add a clear rejection reason.' }, 400);
  }

  const admin = createAdminClient();
  const { data: seller } = await admin
    .from('seller_profiles')
    .select('id,user_id,gstin,gstin_status,gstin_verified,verification_status')
    .eq('id', sellerId)
    .maybeSingle();
  if (!seller) return json({ error: 'Seller application not found.' }, 404);

  const { data: registration } = await admin
    .from('seller_registrations')
    .select('id,user_id,registration_status,submitted_at')
    .eq('user_id', seller.user_id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const now = new Date().toISOString();

  try {
    if (action === 'confirm_gstin') {
      if (!seller.gstin) return json({ error: 'The seller has not submitted a GSTIN.' }, 409);
      await Promise.all([
        admin
          .from('seller_profiles')
          .update({ gstin_status: 'active', gstin_verified: true, gstin_verified_at: now, updated_at: now })
          .eq('id', sellerId),
        registration
          ? admin
              .from('seller_registrations')
              .update({ gstin_verified: true, gstin_verified_at: now, updated_at: now })
              .eq('id', registration.id)
          : Promise.resolve(),
      ]);
    }

    if (action === 'approve_document' || action === 'reject_document') {
      const documentId = String(payload.documentId || '');
      if (!registration || !documentId) {
        return json({ error: 'Select a submitted seller document.' }, 400);
      }
      const { data: document } = await admin
        .from('seller_registration_documents')
        .select('id,registration_id')
        .eq('id', documentId)
        .eq('registration_id', registration.id)
        .maybeSingle();
      if (!document) return json({ error: 'Seller document not found.' }, 404);
      const { error } = await admin
        .from('seller_registration_documents')
        .update({
          upload_status: action === 'approve_document' ? 'approved' : 'rejected',
          rejection_reason: action === 'approve_document' ? null : reason,
          reviewed_by: access.user.id,
          reviewed_at: now,
          updated_at: now,
        })
        .eq('id', documentId);
      if (error) throw error;
    }

    if (action === 'verify_bank') {
      const { data: bank } = await admin
        .from('seller_bank_profiles')
        .select('id')
        .eq('seller_id', sellerId)
        .maybeSingle();
      if (!bank) return json({ error: 'The seller has not submitted a settlement account.' }, 409);
      await Promise.all([
        admin
          .from('seller_bank_profiles')
          .update({ is_verified: true, updated_at: now })
          .eq('id', bank.id),
        registration
          ? admin
              .from('seller_registrations')
              .update({ bank_verified: true, bank_verified_at: now, updated_at: now })
              .eq('id', registration.id)
          : Promise.resolve(),
      ]);
    }

    if (action === 'approve_seller') {
      const applications = await loadApplications();
      const current = applications.find((item) => item.sellerId === sellerId);
      if (!current?.applicationSubmitted) {
        return json(
          { error: 'The seller has not completed and submitted the application.', blockers: current?.blockers || [] },
          409
        );
      }
      if (!current.readyForApproval) {
        return json(
          { error: 'Complete all GSTIN, document and bank checks before final approval.', blockers: current.blockers },
          409
        );
      }
      await Promise.all([
        admin
          .from('seller_profiles')
          .update({
            verification_status: 'verified',
            settlement_eligible: true,
            is_active: true,
            updated_at: now,
          })
          .eq('id', sellerId),
        registration
          ? admin
              .from('seller_registrations')
              .update({
                registration_status: 'approved',
                approved_at: now,
                rejection_reason: null,
                updated_at: now,
              })
              .eq('id', registration.id)
          : Promise.resolve(),
      ]);
    }

    if (action === 'reject_seller') {
      await Promise.all([
        admin
          .from('seller_profiles')
          .update({
            verification_status: 'rejected',
            settlement_eligible: false,
            updated_at: now,
          })
          .eq('id', sellerId),
        registration
          ? admin
              .from('seller_registrations')
              .update({
                registration_status: 'rejected',
                rejection_reason: reason,
                updated_at: now,
              })
              .eq('id', registration.id)
          : Promise.resolve(),
      ]);
    }

    return json({ updated: true, action, sellerId });
  } catch (error) {
    console.error('Administrator seller verification update failed', error);
    return json({ error: 'Seller verification update could not be saved.' }, 503);
  }
}
