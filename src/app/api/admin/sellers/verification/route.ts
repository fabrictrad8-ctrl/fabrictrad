import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
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
  | 'reject_gstin'
  | 'approve_document'
  | 'reject_document'
  | 'verify_bank'
  | 'reject_bank'
  | 'approve_seller'
  | 'reject_seller';

type SellerRow = {
  id: string;
  user_id: string;
  legal_business_name: string | null;
  display_name: string | null;
  business_type: string | null;
  gstin: string | null;
  gstin_status: string | null;
  gstin_verified: boolean;
  verification_status: string;
  settlement_eligible: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  can_sell: boolean;
};

type RegistrationRow = {
  id: string;
  user_id: string;
  business_name: string | null;
  business_type: string | null;
  gstin: string | null;
  pan: string | null;
  gstin_verified: boolean;
  bank_verified: boolean;
  registration_status: string;
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  updated_at: string;
};

type BankRow = {
  id: string;
  seller_id: string;
  account_holder_name: string | null;
  bank_name: string | null;
  account_number_masked: string | null;
  ifsc_code: string | null;
  is_verified: boolean;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  registration_id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  upload_status: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

type ApplicationRow = {
  sellerId: string;
  userId: string;
  seller: SellerRow;
  user: UserRow | null;
  registration: RegistrationRow | null;
  bank: BankRow | null;
  documents: Array<DocumentRow & { signedUrl: string | null }>;
  blockers: string[];
  reviewBlockers: string[];
  applicationSubmitted: boolean;
  readyForApproval: boolean;
};

type AdminAccess =
  | { user: User; error?: never }
  | { user?: never; error: NextResponse };

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

async function requireAdministrator(): Promise<AdminAccess> {
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

const submissionBlockers = (input: {
  phone?: string | null;
  gstin?: string | null;
  documents?: Array<{ document_type: string; upload_status: string }>;
  bank?: BankRow | null;
}) => {
  const blockers: string[] = [];
  if (!input.phone?.trim()) blockers.push('Mobile number is missing.');
  if (!input.gstin?.trim()) blockers.push('GSTIN is missing.');

  for (const documentType of REQUIRED_DOCUMENT_TYPES) {
    const document = input.documents?.find((item) => item.document_type === documentType);
    if (!document || !['uploaded', 'under_review', 'approved'].includes(document.upload_status)) {
      blockers.push(`${documentType.replaceAll('_', ' ')} is missing.`);
    }
  }

  if (!input.bank || !input.bank.account_number_masked?.trim() || !input.bank.ifsc_code?.trim()) {
    blockers.push('Settlement account details are missing.');
  }
  return blockers;
};

const verificationBlockers = (input: {
  seller: SellerRow;
  registration: RegistrationRow | null;
  documents: DocumentRow[];
  bank: BankRow | null;
}) => {
  const blockers: string[] = [];
  if (
    input.seller.gstin_verified !== true ||
    input.seller.gstin_status !== 'active' ||
    input.registration?.gstin_verified !== true
  ) {
    blockers.push('GSTIN review is pending.');
  }
  for (const documentType of REQUIRED_DOCUMENT_TYPES) {
    const document = input.documents.find((item) => item.document_type === documentType);
    if (!document || document.upload_status !== 'approved') {
      blockers.push(`${documentType.replaceAll('_', ' ')} review is pending.`);
    }
  }
  if (input.bank?.is_verified !== true || input.registration?.bank_verified !== true) {
    blockers.push('Settlement bank review is pending.');
  }
  return blockers;
};

async function loadApplications(): Promise<ApplicationRow[]> {
  const admin = createAdminClient();
  const { data: sellerData, error: sellerError } = await admin
    .from('seller_profiles')
    .select(
      'id,user_id,legal_business_name,display_name,business_type,gstin,gstin_status,gstin_verified,verification_status,settlement_eligible,is_active,created_at,updated_at'
    )
    .order('updated_at', { ascending: false });
  if (sellerError) throw sellerError;

  const sellers = (sellerData || []) as SellerRow[];
  if (sellers.length === 0) return [];

  const userIds = sellers.map((seller) => seller.user_id);
  const sellerIds = sellers.map((seller) => seller.id);

  const [
    { data: userData, error: userError },
    { data: registrationData, error: registrationError },
    { data: bankData, error: bankError },
  ] = await Promise.all([
    admin
      .from('user_profiles')
      .select('id,full_name,email,phone,is_active,can_sell')
      .in('id', userIds),
    admin
      .from('seller_registrations')
      .select(
        'id,user_id,business_name,business_type,gstin,pan,gstin_verified,bank_verified,registration_status,submitted_at,approved_at,rejection_reason,updated_at'
      )
      .in('user_id', userIds)
      .order('updated_at', { ascending: false }),
    admin
      .from('seller_bank_profiles')
      .select(
        'id,seller_id,account_holder_name,bank_name,account_number_masked,ifsc_code,is_verified,updated_at'
      )
      .in('seller_id', sellerIds),
  ]);

  if (userError) throw userError;
  if (registrationError) throw registrationError;
  if (bankError) throw bankError;

  const users = (userData || []) as UserRow[];
  const registrations = (registrationData || []) as RegistrationRow[];
  const banks = (bankData || []) as BankRow[];

  const latestRegistrationByUser = new Map<string, RegistrationRow>();
  for (const registration of registrations) {
    if (!latestRegistrationByUser.has(registration.user_id)) {
      latestRegistrationByUser.set(registration.user_id, registration);
    }
  }

  const registrationIds = [...latestRegistrationByUser.values()].map((item) => item.id);
  let documentRows: DocumentRow[] = [];
  if (registrationIds.length > 0) {
    const { data, error } = await admin
      .from('seller_registration_documents')
      .select(
        'id,registration_id,document_type,file_url,file_name,upload_status,rejection_reason,reviewed_at,updated_at'
      )
      .in('registration_id', registrationIds)
      .order('created_at', { ascending: true });
    if (error) throw error;
    documentRows = (data || []) as DocumentRow[];
  }

  const documentsWithUrls = await Promise.all(
    documentRows.map(async (document) => {
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

  return sellers.map((seller) => {
    const user = users.find((item) => item.id === seller.user_id) || null;
    const registration = latestRegistrationByUser.get(seller.user_id) || null;
    const bank = banks.find((item) => item.seller_id === seller.id) || null;
    const documents = documentsWithUrls.filter(
      (item) => item.registration_id === registration?.id
    );
    const blockers = submissionBlockers({
      phone: user?.phone,
      gstin: seller.gstin || registration?.gstin,
      documents,
      bank,
    });
    const reviewBlockers = verificationBlockers({ seller, registration, documents, bank });
    const applicationSubmitted = Boolean(registration?.submitted_at && blockers.length === 0);

    return {
      sellerId: seller.id,
      userId: seller.user_id,
      seller,
      user,
      registration,
      bank,
      documents,
      blockers,
      reviewBlockers,
      applicationSubmitted,
      readyForApproval:
        applicationSubmitted &&
        reviewBlockers.length === 0 &&
        seller.verification_status !== 'verified',
    };
  });
}

export async function GET() {
  const access = await requireAdministrator();
  if (access.error) return access.error;

  try {
    return json({ applications: await loadApplications() });
  } catch (error) {
    console.error('Administrator seller verification queue failed', error);
    return json({ error: 'Seller verification queue could not be loaded.' }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireAdministrator();
  if (access.error) return access.error;

  const payload = (await request.json().catch(() => ({}))) as {
    action?: ReviewAction;
    sellerId?: string;
    documentId?: string;
    reason?: string;
  };
  const action = payload.action;
  const sellerId = String(payload.sellerId || '').trim();
  const documentId = String(payload.documentId || '').trim() || null;
  const reason = String(payload.reason || '').trim().slice(0, 1000) || null;

  if (!sellerId || !action) return json({ error: 'Seller and review action are required.' }, 400);

  const supported: ReviewAction[] = [
    'confirm_gstin',
    'reject_gstin',
    'approve_document',
    'reject_document',
    'verify_bank',
    'reject_bank',
    'approve_seller',
    'reject_seller',
  ];
  if (!supported.includes(action)) return json({ error: 'Unsupported seller review action.' }, 400);

  if (['reject_gstin', 'reject_document', 'reject_bank', 'reject_seller'].includes(action) && (!reason || reason.length < 5)) {
    return json({ error: 'Add a clear rejection reason.' }, 400);
  }
  if (['approve_document', 'reject_document'].includes(action) && !documentId) {
    return json({ error: 'Choose the document to review.' }, 400);
  }

  const admin = createAdminClient();
  const { data: seller, error: sellerReadError } = await admin
    .from('seller_profiles')
    .select('id,user_id,verification_status')
    .eq('id', sellerId)
    .maybeSingle();
  if (sellerReadError) return json({ error: 'Seller application could not be loaded.' }, 503);
  if (!seller) return json({ error: 'Seller application not found.' }, 404);

  try {
    if (action === 'approve_seller') {
      if (seller.verification_status === 'verified') {
        return json({ updated: true, action, sellerId, alreadyApproved: true });
      }

      const applications = await loadApplications();
      const current = applications.find((item) => item.sellerId === sellerId);
      if (!current?.applicationSubmitted) {
        return json(
          {
            error: 'This application is not complete enough to approve yet.',
            blockers: current?.blockers || ['Seller application is incomplete.'],
          },
          409
        );
      }
      if (!current.readyForApproval) {
        return json(
          {
            error: 'Complete all GSTIN, document and bank checks before final approval.',
            blockers: current.reviewBlockers,
          },
          409
        );
      }

      const { data, error } = await admin.rpc('admin_approve_seller', {
        p_seller_id: sellerId,
        p_admin_id: access.user.id,
      });
      if (error) throw error;
      return json({ updated: true, action, sellerId, approval: data });
    }

    const { data, error } = await admin.rpc('admin_review_seller_stage', {
      p_seller_id: sellerId,
      p_admin_id: access.user.id,
      p_action: action,
      p_document_id: documentId,
      p_reason: reason,
    });
    if (error) throw error;
    return json({ updated: true, action, sellerId, review: data });
  } catch (error) {
    console.error('Administrator seller verification update failed', error);
    const message = error instanceof Error ? error.message : '';
    return json(
      { error: message || 'Seller verification update could not be saved.' },
      503
    );
  }
}
