import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deliverIssuedInvoiceEmail } from '@/lib/server/automaticInvoice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const choices = [
    ['invoiceId', 'id'], ['catalogOrderId', 'catalog_order_id'],
    ['bulkOrderId', 'bulk_order_id'], ['bespokeOrderId', 'bespoke_order_id'],
  ] as const;
  const provided = choices.map(([key, column]) => ({ column, value: request.nextUrl.searchParams.get(key)?.trim() }))
    .filter(item => item.value);
  if (provided.length !== 1 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(provided[0].value!)) {
    return json({ error: 'Provide one valid invoice or order reference.' }, 400);
  }
  // The authenticated client retains invoice RLS for buyers, sellers and OTP admins.
  const { data, error } = await supabase.from('seller_tax_invoices').select('*')
    .eq(provided[0].column, provided[0].value!).order('issued_at', { ascending: false }).limit(100);
  if (error) return json({ error: 'Order documents could not be loaded.' }, 503);
  return json({ invoice: data?.[0] || null, invoices: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Seller authentication required.' }, 401);

  let body: {
    catalogOrderId?: unknown;
    reverseCharge?: unknown;
    irn?: unknown;
    acknowledgementNumber?: unknown;
    acknowledgementDate?: unknown;
    signedQrData?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid invoice request.' }, 400);
  }

  const catalogOrderId = typeof body.catalogOrderId === 'string' ? body.catalogOrderId.trim() : '';
  if (!catalogOrderId) return json({ error: 'Catalogue order reference is required.' }, 400);

  const acknowledgementDate =
    typeof body.acknowledgementDate === 'string' && body.acknowledgementDate.trim()
      ? body.acknowledgementDate.trim()
      : null;

  const { data, error } = await supabase.rpc('issue_catalog_tax_invoice', {
    p_catalog_order_id: catalogOrderId,
    p_reverse_charge: body.reverseCharge === true,
    p_irn: typeof body.irn === 'string' ? body.irn.trim() || null : null,
    p_acknowledgement_number:
      typeof body.acknowledgementNumber === 'string'
        ? body.acknowledgementNumber.trim() || null
        : null,
    p_acknowledgement_date: acknowledgementDate,
    p_signed_qr_data:
      typeof body.signedQrData === 'string' ? body.signedQrData.trim() || null : null,
  });

  if (error) {
    const message = error.message || 'The GST invoice could not be issued.';
    const status = /required|missing|not found|fully paid|HSN|IRN/i.test(message) ? 409 : 403;
    return json({ error: message }, status);
  }

  // Issuing the record is not the same as the buyer receiving it. This path only
  // created the invoice, so a manually issued one sat unsent indefinitely while
  // the seller's screen reported it as queued. Delivery failures must not fail
  // the issue itself — the invoice is valid either way and the helper records
  // its own delivery state for retry.
  const issued = data as { id?: string } | null;
  let emailed = false;
  let emailError: string | null = null;
  if (issued?.id) {
    try {
      const delivery = await deliverIssuedInvoiceEmail(createAdminClient(), issued.id);
      emailed = delivery.emailed;
      emailError = delivery.error;
    } catch (caught) {
      emailError = caught instanceof Error ? caught.message : 'Invoice email could not be attempted.';
    }
  }

  return json({ invoice: data, emailed, emailError }, 201);
}
