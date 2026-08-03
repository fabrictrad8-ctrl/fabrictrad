import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ReviewAction = 'approve' | 'reject' | 'pause';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Administrator sign-in required.' }, 401);

  const { data: administrator } = await supabase
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin =
    administrator?.is_active === true &&
    (administrator.role === 'super_admin' || administrator.role === 'admin_staff');
  if (!isAdmin) return json({ error: 'Administrator access required.' }, 403);

  const payload = (await request.json().catch(() => ({}))) as {
    action?: ReviewAction;
    notes?: string;
  };
  if (!payload.action || !['approve', 'reject', 'pause'].includes(payload.action)) {
    return json({ error: 'A valid product review action is required.' }, 400);
  }
  const notes = String(payload.notes || '').trim().slice(0, 1000);
  if (payload.action === 'reject' && notes.length < 5) {
    return json({ error: 'Add a clear rejection reason for the seller.' }, 400);
  }

  const { id } = await context.params;
  const { data: product } = await supabase
    .from('seller_products')
    .select('id,seller_id,status,approval_status')
    .eq('id', id)
    .maybeSingle();
  if (!product) return json({ error: 'Product not found.' }, 404);

  if (payload.action === 'approve') {
    const { data: seller } = await supabase
      .from('seller_profiles')
      .select('verification_status,gstin_verified,is_active')
      .eq('id', product.seller_id)
      .maybeSingle();
    if (
      !seller ||
      seller.is_active !== true ||
      seller.gstin_verified !== true ||
      seller.verification_status !== 'verified'
    ) {
      return json(
        {
          error:
            'This listing cannot go live until the seller is active and GST verification is approved.',
        },
        409
      );
    }
  }

  const patch =
    payload.action === 'approve'
      ? {
          approval_status: 'approved',
          status: 'active',
          admin_review_notes: notes || null,
          updated_at: new Date().toISOString(),
        }
      : payload.action === 'reject'
        ? {
            approval_status: 'rejected',
            status: 'rejected',
            admin_review_notes: notes,
            updated_at: new Date().toISOString(),
          }
        : {
            approval_status: product.approval_status || 'approved',
            status: 'paused',
            admin_review_notes: notes || 'Paused by FabricTrad administration.',
            updated_at: new Date().toISOString(),
          };

  const { error } = await supabase.from('seller_products').update(patch).eq('id', id);
  if (error) {
    console.error('Administrator product review failed', {
      code: error.code,
      message: error.message,
    });
    return json({ error: 'The product review could not be saved.' }, 503);
  }

  return json({ updated: true, action: payload.action, productId: id });
}
