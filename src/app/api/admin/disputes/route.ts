import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isConfiguredAdminEmail } from '@/lib/adminAccess';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DisputeStatus = 'open' | 'under_review' | 'escalated' | 'resolved' | 'closed';

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
  if (!user || !isConfiguredAdminEmail(user.email)) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,is_active,full_name')
    .eq('id', user.id)
    .maybeSingle();
  const authorised =
    profile?.is_active === true &&
    (profile.role === 'super_admin' || profile.role === 'admin_staff');
  return authorised ? { user, profile } : null;
}

export async function GET() {
  const administrator = await requireAdministrator();
  if (!administrator) return json({ error: 'Administrator access required.' }, 403);

  const admin = createAdminClient();
  const { data: disputes, error } = await admin
    .from('disputes')
    .select(
      'id,order_id,buyer_id,buyer_user_id,seller_id,bulk_order_id,catalog_order_id,product_name,dispute_type,status,description,has_unboxing_video,requested_refund_amount,resolution_notes,created_at,updated_at,resolved_at'
    )
    .order('updated_at', { ascending: false })
    .limit(250);
  if (error) return json({ error: 'The dispute queue could not be loaded.' }, 503);

  const disputeIds = (disputes || []).map((row) => row.id);
  const buyerIds = new Set<string>();
  const sellerIds = new Set<string>();
  (disputes || []).forEach((row) => {
    if (row.buyer_user_id) buyerIds.add(String(row.buyer_user_id));
    if (row.seller_id) sellerIds.add(String(row.seller_id));
  });

  const [messagesResult, buyersResult, sellersResult] = await Promise.all([
    disputeIds.length
      ? admin
          .from('dispute_messages')
          .select(
            'id,dispute_id,sender_type,sender_id,sender_name,message_text,file_url,file_name,file_type,created_at'
          )
          .in('dispute_id', disputeIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    buyerIds.size
      ? admin
          .from('user_profiles')
          .select('id,full_name,email,business_name,phone')
          .in('id', [...buyerIds])
      : Promise.resolve({ data: [], error: null }),
    sellerIds.size
      ? admin
          .from('seller_profiles')
          .select('id,user_id,display_name,legal_business_name,gstin')
          .in('id', [...sellerIds])
      : Promise.resolve({ data: [], error: null }),
  ]);
  const queryError = messagesResult.error || buyersResult.error || sellersResult.error;
  if (queryError) return json({ error: 'Dispute participants could not be loaded.' }, 503);

  const messages = new Map<string, NonNullable<typeof messagesResult.data>>();
  (messagesResult.data || []).forEach((message) => {
    messages.set(message.dispute_id, [...(messages.get(message.dispute_id) || []), message]);
  });
  const buyers = new Map((buyersResult.data || []).map((row) => [String(row.id), row]));
  const sellers = new Map((sellersResult.data || []).map((row) => [String(row.id), row]));

  return json({
    generatedAt: new Date().toISOString(),
    disputes: (disputes || []).map((row) => ({
      ...row,
      buyer: row.buyer_user_id ? buyers.get(String(row.buyer_user_id)) || null : null,
      seller: row.seller_id ? sellers.get(String(row.seller_id)) || null : null,
      messages: messages.get(row.id) || [],
    })),
  });
}

export async function POST(request: NextRequest) {
  const administrator = await requireAdministrator();
  if (!administrator) return json({ error: 'Administrator access required.' }, 403);

  let body: {
    action?: unknown;
    disputeId?: unknown;
    message?: unknown;
    status?: unknown;
    resolutionNotes?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid dispute request.' }, 400);
  }

  const action = body.action === 'message' || body.action === 'status' ? body.action : null;
  const disputeId = typeof body.disputeId === 'string' ? body.disputeId.trim() : '';
  if (!action || !disputeId) return json({ error: 'Action and dispute reference are required.' }, 400);

  const admin = createAdminClient();
  const { data: dispute } = await admin
    .from('disputes')
    .select('id,status')
    .eq('id', disputeId)
    .maybeSingle();
  if (!dispute) return json({ error: 'Dispute not found.' }, 404);

  if (action === 'message') {
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length < 1 || message.length > 3000) {
      return json({ error: 'Administrator message must contain 1–3000 characters.' }, 400);
    }
    if (!['open', 'under_review', 'escalated'].includes(String(dispute.status))) {
      return json({ error: 'Closed disputes cannot receive participant messages.' }, 409);
    }
    const { error } = await admin.from('dispute_messages').insert({
      dispute_id: disputeId,
      sender_type: 'admin',
      sender_id: administrator.user.id,
      sender_name: administrator.profile.full_name || 'FabricTrad Administrator',
      message_text: message,
    });
    if (error) return json({ error: 'Administrator message could not be stored.' }, 503);
    await admin
      .from('disputes')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', disputeId);
    return json({ stored: true });
  }

  const nextStatus: DisputeStatus | null =
    typeof body.status === 'string' &&
    ['open', 'under_review', 'escalated', 'resolved', 'closed'].includes(body.status)
      ? (body.status as DisputeStatus)
      : null;
  const resolutionNotes =
    typeof body.resolutionNotes === 'string' ? body.resolutionNotes.trim() : '';
  if (!nextStatus) return json({ error: 'A valid dispute status is required.' }, 400);
  if (['resolved', 'closed'].includes(nextStatus) && resolutionNotes.length < 10) {
    return json({ error: 'Resolution notes of at least 10 characters are required.' }, 400);
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from('disputes')
    .update({
      status: nextStatus,
      resolution_notes: resolutionNotes || null,
      resolved_at: ['resolved', 'closed'].includes(nextStatus) ? now : null,
      updated_at: now,
    })
    .eq('id', disputeId);
  if (error) return json({ error: 'Dispute resolution could not be stored.' }, 503);

  return json({ stored: true, status: nextStatus });
}
