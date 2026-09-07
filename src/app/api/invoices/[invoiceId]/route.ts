import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderInvoiceDocument } from '@/lib/invoiceDocument';
import type { SellerTaxInvoice } from '@/lib/sellerTaxInvoice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId)) return NextResponse.json({ error: 'Invoice reference is required.' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/invoices/${invoiceId}`)}`, _request.url));

  const { data: invoice, error } = await supabase
    .from('seller_tax_invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle();
  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found or access is not permitted.' }, { status: 404 });

  const html = await renderInvoiceDocument(invoice as SellerTaxInvoice);

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'self'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
