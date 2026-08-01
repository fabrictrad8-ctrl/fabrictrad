import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  gstinStateCode,
  normalizeGstin,
  type GstinStatus,
  type GstinVerificationResult,
  validateGstinChecksum,
  validateGstinFormat,
} from '@/lib/commerceIdentifiers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WINDOW_MS = 60_000;
const MAX_PREFLIGHTS_PER_WINDOW = 12;
const preflightWindows = new Map<string, { startedAt: number; count: number }>();

type SubjectType = 'buyer' | 'seller';
type ProviderPayload = Record<string, unknown>;
type ProfileReference = { id: string; user_id: string; buyer_type?: string | null };

type ProviderResult = {
  status: GstinStatus;
  legalName: string | null;
  tradeName: string | null;
  stateCode: string | null;
  taxpayerType: string | null;
  registrationDate: string | null;
  cancellationDate: string | null;
  principalPlace: string | null;
  provider: string;
  providerReference: string | null;
  raw: ProviderPayload;
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const textFrom = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const dateFrom = (record: Record<string, unknown>, keys: string[]) => {
  const value = textFrom(record, keys);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const providerRecord = (payload: ProviderPayload) => {
  const data = asRecord(payload.data);
  const result = asRecord(payload.result);
  const taxpayer = asRecord(payload.taxpayer);
  return Object.keys(data).length
    ? data
    : Object.keys(result).length
      ? result
      : Object.keys(taxpayer).length
        ? taxpayer
        : payload;
};

const classifyStatus = (value: string | null): GstinStatus => {
  const normalized = (value || '').trim().toLowerCase();
  if (['active', 'act', 'valid', 'registered'].includes(normalized)) return 'active';
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('inactive') || normalized.includes('suspend')) return 'inactive';
  if (normalized.includes('invalid')) return 'invalid';
  return 'manual_review';
};

const limitedPreflight = (request: NextRequest) => {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const key = forwarded || request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const current = preflightWindows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    preflightWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  preflightWindows.set(key, current);
  return current.count > MAX_PREFLIGHTS_PER_WINDOW;
};

const bearerToken = (request: NextRequest) => {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
};

async function resolveUser(request: NextRequest, client: SupabaseClient): Promise<User | null> {
  const token = bearerToken(request);
  if (token) {
    const { data, error } = await client.auth.getUser(token);
    if (!error && data.user) return data.user;
  }
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

const adminClientOrNull = () => {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
};

async function queryConfiguredProvider(gstin: string): Promise<ProviderResult | null> {
  const template = process.env.GSTIN_VERIFICATION_API_URL?.trim();
  const apiKey = process.env.GSTIN_VERIFICATION_API_KEY?.trim();
  if (!template || !apiKey) return null;

  const method = (process.env.GSTIN_VERIFICATION_API_METHOD || 'GET').toUpperCase();
  const keyHeader = process.env.GSTIN_VERIFICATION_API_KEY_HEADER || 'x-api-key';
  const providerName = process.env.GSTIN_VERIFICATION_PROVIDER_NAME || 'configured_gsp';
  const endpoint = template.includes('{gstin}')
    ? template.replace('{gstin}', encodeURIComponent(gstin))
    : `${template}${template.includes('?') ? '&' : '?'}gstin=${encodeURIComponent(gstin)}`;

  const response = await fetch(endpoint, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [keyHeader]: apiKey,
    },
    body: method === 'GET' ? undefined : JSON.stringify({ gstin }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  const payload = (await response.json().catch(() => ({}))) as ProviderPayload;
  if (!response.ok) {
    throw new Error(
      textFrom(asRecord(payload), ['message', 'error', 'error_description']) ||
        `GST verification provider returned ${response.status}.`
    );
  }

  const record = providerRecord(payload);
  const rawStatus = textFrom(record, [
    'status',
    'gstinStatus',
    'gstin_status',
    'sts',
    'registrationStatus',
  ]);
  return {
    status: classifyStatus(rawStatus),
    legalName: textFrom(record, ['legalName', 'legal_name', 'lgnm', 'legalBusinessName']),
    tradeName: textFrom(record, ['tradeName', 'trade_name', 'tradeNam', 'tradeBusinessName']),
    stateCode: textFrom(record, ['stateCode', 'state_code']) || gstin.slice(0, 2),
    taxpayerType: textFrom(record, ['taxpayerType', 'taxpayer_type', 'dty', 'constitutionOfBusiness']),
    registrationDate: dateFrom(record, ['registrationDate', 'registration_date', 'rgdt']),
    cancellationDate: dateFrom(record, ['cancellationDate', 'cancellation_date', 'cxdt']),
    principalPlace: textFrom(record, ['principalPlace', 'principal_place', 'principalPlaceOfBusiness', 'pradr']),
    provider: providerName,
    providerReference: textFrom(record, ['referenceId', 'reference_id', 'requestId', 'request_id']),
    raw: payload,
  };
}

async function persistResult(
  client: SupabaseClient,
  result: GstinVerificationResult,
  subjectType: SubjectType,
  userId: string,
  rawResponse: ProviderPayload
) {
  const table = subjectType === 'seller' ? 'seller_profiles' : 'buyer_profiles';
  const selectColumns = subjectType === 'seller' ? 'id,user_id' : 'id,user_id,buyer_type';
  const { data: rawProfile, error: profileError } = await client
    .from(table)
    .select(selectColumns)
    .eq('user_id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  const profile = rawProfile as unknown as ProfileReference | null;
  if (!profile?.id) throw new Error(`${subjectType === 'seller' ? 'Seller' : 'Buyer'} profile is not ready.`);
  if (subjectType === 'buyer' && profile.buyer_type !== 'retail_store') {
    throw new Error('GSTIN is available only on the Retail Store buying profile.');
  }

  const checkedAt = result.checkedAt;
  const profileValues = {
    gstin: result.gstin,
    gstin_verified: result.status === 'active',
    gstin_status: result.status,
    gstin_legal_name: result.legalName,
    gstin_trade_name: result.tradeName,
    gstin_state_code: result.stateCode,
    gstin_taxpayer_type: result.taxpayerType,
    gstin_registration_date: result.registrationDate,
    gstin_cancellation_date: result.cancellationDate,
    gstin_last_checked_at: checkedAt,
    gstin_verification_provider: result.provider,
    updated_at: checkedAt,
    ...(subjectType === 'buyer'
      ? { gst_registration_status: 'registered', business_kyc_status: 'pending' }
      : {}),
  };
  const { error: updateError } = await client.from(table).update(profileValues).eq('id', profile.id);
  if (updateError) throw updateError;

  const { error: verificationError } = await client.from('gstin_verifications').upsert(
    {
      owner_user_id: userId,
      subject_type: subjectType,
      subject_profile_id: profile.id,
      gstin: result.gstin,
      format_valid: result.formatValid,
      checksum_valid: result.checksumValid,
      verification_status: result.status,
      legal_name: result.legalName,
      trade_name: result.tradeName,
      state_code: result.stateCode,
      taxpayer_type: result.taxpayerType,
      registration_date: result.registrationDate,
      cancellation_date: result.cancellationDate,
      principal_place: result.principalPlace,
      provider: result.provider,
      provider_reference: result.providerReference,
      raw_response: rawResponse,
      checked_at: checkedAt,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: checkedAt,
    },
    { onConflict: 'owner_user_id,subject_type,gstin' }
  );
  if (verificationError) throw verificationError;
}

export async function POST(request: NextRequest) {
  let input: { gstin?: unknown; subjectType?: unknown; persist?: unknown };
  try {
    input = (await request.json()) as typeof input;
  } catch {
    return json({ error: 'Enter a GSTIN to verify.' }, 400);
  }

  const gstin = normalizeGstin(input.gstin);
  const subjectType: SubjectType = input.subjectType === 'seller' ? 'seller' : 'buyer';
  const formatValid = validateGstinFormat(gstin);
  const checksumValid = validateGstinChecksum(gstin);
  if (!formatValid || !checksumValid) {
    return json(
      {
        verified: false,
        status: 'invalid',
        gstin,
        formatValid,
        checksumValid,
        message: !formatValid
          ? 'GSTIN format is invalid.'
          : 'GSTIN check digit is invalid. Recheck the number on the GST certificate.',
      },
      422
    );
  }

  const serverClient = await createClient();
  const user = await resolveUser(request, serverClient);
  const shouldPersist = input.persist === true;
  if (!user && shouldPersist) return json({ error: 'Sign in before saving GST verification.' }, 401);
  if (!user && limitedPreflight(request)) return json({ error: 'Too many verification attempts. Try again shortly.' }, 429);

  const checkedAt = new Date().toISOString();
  let providerData: ProviderResult | null = null;
  let providerWarning = '';
  try {
    providerData = await queryConfiguredProvider(gstin);
  } catch (error) {
    providerWarning = error instanceof Error ? error.message : 'GST provider lookup was unavailable.';
  }

  const status: GstinStatus = providerData?.status || 'manual_review';
  const result: GstinVerificationResult = {
    gstin,
    formatValid,
    checksumValid,
    status,
    legalName: providerData?.legalName || null,
    tradeName: providerData?.tradeName || null,
    stateCode: providerData?.stateCode || gstinStateCode(gstin),
    taxpayerType: providerData?.taxpayerType || null,
    registrationDate: providerData?.registrationDate || null,
    cancellationDate: providerData?.cancellationDate || null,
    principalPlace: providerData?.principalPlace || null,
    provider: providerData?.provider || 'manual_gst_portal',
    providerReference: providerData?.providerReference || null,
    checkedAt,
    message:
      status === 'active'
        ? 'GSTIN is active. The legal business details have been matched.'
        : providerData
          ? `GST registration status returned as ${status}. Selling and B2B tax benefits remain restricted until active.`
          : 'The GSTIN format and check digit are valid. Official status is queued for GST portal or authorised GSP review.',
  };

  if (user && shouldPersist) {
    try {
      const persistenceClient = adminClientOrNull() || serverClient;
      await persistResult(persistenceClient, result, subjectType, user.id, providerData?.raw || {});
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'GST verification could not be saved.' }, 400);
    }
  }

  return json({
    verified: status === 'active',
    persisted: Boolean(user && shouldPersist),
    ...result,
    providerWarning: providerWarning || undefined,
    taxNotice:
      'A GSTIN does not remove GST. An active buyer GSTIN is printed on a B2B tax invoice and may support eligible input tax credit, subject to GST law.',
  });
}
