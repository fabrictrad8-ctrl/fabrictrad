import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  const catalogOrderId = request.nextUrl.searchParams.get('catalogOrderId')?.trim();
  const invoiceId = request.nextUrl.searchParams.get('invoiceId')?.trim();
  if (!catalogOrderId && !invoiceId) {
    return json({ error: 'Provide an invoice or catalogue order reference.' }, 400);
  }

  let query = supabase.from('seller_tax_invoices').select('*');
  query = invoiceId ? query.eq('id', invoiceId) : query.eq('catalog_order_id', catalogOrderId!);
  const { data, error } = await query.maybeSingle();
  if (error) return json({ error: 'The seller invoice could not be loaded.' }, 503);
  if (!data) return json({ invoice: null }, 200);
  return json({ invoice: data });
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

  return json({ invoice: data }, 201);
}
