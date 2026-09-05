import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const clean = (value: unknown, max = 300) =>
  (typeof value === 'string' ? value.trim() : '').replace(/\s+/g, ' ').slice(0, max);
const phone = (value: unknown) => clean(value, 40).replace(/\D/g, '').slice(-10);
const email = (value: unknown) => clean(value, 320).toLowerCase();
const validPhone = (value: string) => /^[6-9][0-9]{9}$/.test(value);
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

async function authSeller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const [{ data: profile }, { data: seller }] = await Promise.all([
    admin.from('user_profiles').select('id,email,full_name,phone,can_sell,is_active').eq('id', user.id).maybeSingle(),
    admin.from('seller_profiles').select('id,user_id,contact_name,contact_email,contact_phone,whatsapp_no,is_active').eq('user_id', user.id).maybeSingle(),
  ]);
  if (!profile?.id || !seller?.id || profile.is_active !== true || profile.can_sell !== true || seller.is_active !== true) return null;
  return { user, profile, seller, admin };
}

export async function GET() {
  const auth = await authSeller();
  if (!auth) return json({ error: 'Active seller access is required.' }, 403);
  return json({
    contactName: auth.seller.contact_name || '',
    contactEmail: auth.seller.contact_email || '',
    contactPhone: auth.seller.contact_phone || '',
    whatsappNo: auth.seller.whatsapp_no || '',
    ready: Boolean(auth.seller.contact_name && auth.seller.contact_email && auth.seller.contact_phone && auth.seller.whatsapp_no),
    whatsappCatalogFormatCommand: 'FORMAT',
  });
}

export async function POST(request: NextRequest) {
  const auth = await authSeller();
  if (!auth) return json({ error: 'Active seller access is required.' }, 403);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: 'Invalid seller contact details.' }, 400);

  const contactName = clean(body.contactName, 160);
  const contactEmail = email(body.contactEmail);
  const contactPhone = phone(body.contactPhone);
  const whatsappNo = phone(body.whatsappNo);
  if (!contactName) return json({ error: 'Enter a seller contact/display name.' }, 400);
  if (!validEmail(contactEmail)) return json({ error: 'Enter a valid seller email address.' }, 400);
  if (!validPhone(contactPhone)) return json({ error: 'Enter a valid 10 digit seller phone number.' }, 400);
  if (!validPhone(whatsappNo)) return json({ error: 'Enter a valid 10 digit seller WhatsApp number.' }, 400);

  const buyerName = clean(auth.profile.full_name, 160).toLowerCase();
  const buyerEmail = email(auth.profile.email);
  const buyerPhone = phone(auth.profile.phone);
  if (contactName.toLowerCase() === buyerName) return json({ error: 'Seller name cannot be the same as the buyer/account name. Use a different seller contact/display name.' }, 409);
  if (contactEmail === buyerEmail) return json({ error: 'Seller email cannot be the same as the buyer/account email. Use a different seller email.' }, 409);
  if (contactPhone === buyerPhone) return json({ error: 'Seller phone cannot be the same as the buyer/account phone. Use a different seller phone.' }, 409);
  if (whatsappNo === buyerPhone) return json({ error: 'Seller WhatsApp cannot be the same as the buyer/account phone/WhatsApp. Use a different seller WhatsApp number.' }, 409);

  const { data: conflicts, error: conflictError } = await auth.admin.rpc('seller_identity_conflicts', {
    p_contact_name: contactName,
    p_contact_email: contactEmail,
    p_contact_phone: contactPhone,
    p_whatsapp_no: whatsappNo,
  });
  if (conflictError) return json({ error: 'Seller identity could not be checked. Please retry.' }, 500);
  const conflictFields = Array.isArray(conflicts) ? conflicts.map(String) : [];
  if (conflictFields.length) {
    return json({
      error: `Seller ${conflictFields.join(', ')} already matches a buyer identity. Change ${conflictFields.length === 1 ? 'it' : 'those fields'} before saving.`,
      conflicts: conflictFields,
    }, 409);
  }

  const { error: updateError } = await auth.admin
    .from('seller_profiles')
    .update({
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      whatsapp_no: whatsappNo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auth.seller.id);
  if (updateError) {
    const message = String(updateError.message || '');
    if (message.includes('IDENTITY_CONFLICT') || message.includes('duplicate key')) {
      return json({ error: 'One of these seller identity fields is already used. Use a different name, email, phone or WhatsApp number.' }, 409);
    }
    return json({ error: 'Seller contact details could not be saved.' }, 500);
  }

  return json({ saved: true, ready: true, contactName, contactEmail, contactPhone, whatsappNo });
}
