import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail, normalizeIndianPhone, validateIndianPhone } from '@/lib/authValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });

export async function POST(request: NextRequest) {
  let body: { email?: unknown; phone?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid registration check.' }, 400);
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const phone = typeof body.phone === 'string' ? normalizeIndianPhone(body.phone) : '';
  if (!email || !email.includes('@')) return json({ error: 'Enter a valid email address.' }, 400);

  const phoneResult = validateIndianPhone(phone);
  if (!phoneResult.valid) return json({ error: phoneResult.message }, 400);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .rpc('check_identity_conflict', { input_email: email, input_phone: phone })
      .maybeSingle();
    if (error) throw error;

    const conflict = (data || {}) as {
      email_used?: boolean;
      phone_used?: boolean;
    };
    return json({
      checked: true,
      emailUsed: Boolean(conflict.email_used),
      phoneUsed: Boolean(conflict.phone_used),
    });
  } catch (error) {
    console.error('Registration identity preflight failed', {
      code: typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined,
    });
    return json(
      {
        error: 'FabricTrad could not safely check the account details. Please retry in a moment.',
        recoverable: true,
      },
      503
    );
  }
}
