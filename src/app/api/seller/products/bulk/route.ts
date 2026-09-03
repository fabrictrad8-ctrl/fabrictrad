import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 500;

const REQUIRED_HEADERS = ['name', 'sku', 'price', 'available', 'moq'] as const;
const ALLOWED_STATUSES = new Set(['draft', 'active', 'archived']);
const ALLOWED_SALE_CHANNELS = new Set(['b2b', 'retail', 'both']);

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field.trim());
      field = '';
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  row.push(field.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function unitCode(value: string) {
  const normalized = value.trim().toLowerCase();
  if (/^(m|mtr|metre|meter|metres|meters)$/.test(normalized)) return 'mtr';
  if (/^(kg|kgs|kilogram|kilograms|kilo|kilos)$/.test(normalized)) return 'kg';
  if (/^(yd|yard|yards)$/.test(normalized)) return 'yard';
  if (/^farma$/.test(normalized)) return 'farma';
  if (/^(piece|pieces|pc|pcs)$/.test(normalized)) return 'piece';
  if (/^(roll|rolls)$/.test(normalized)) return 'roll';
  return 'custom';
}

function finiteNumber(value: string, fallback?: number) {
  if (!value.trim() && fallback !== undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalPositiveNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function validOptionalUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_FILE_BYTES) {
    return json({ error: 'CSV is larger than the 2 MB upload limit.' }, 413);
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authError ? null : authData.user;
  if (!user) return json({ error: 'Sign in to a seller account before importing products.' }, 401);

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role,can_sell')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) return json({ error: 'Could not verify seller access.' }, 500);
  if (!(profile?.can_sell ?? profile?.role === 'seller')) {
    return json({ error: 'Seller access is required for bulk product imports.' }, 403);
  }

  const { data: seller, error: sellerError } = await supabase
    .from('seller_profiles')
    .select('id,city,state')
    .eq('user_id', user.id)
    .maybeSingle();

  if (sellerError || !seller?.id) {
    return json({ error: 'Your seller profile is not ready. Complete seller setup and try again.' }, 409);
  }

  let text = '';
  try {
    text = await request.text();
  } catch {
    return json({ error: 'Could not read the CSV file.' }, 400);
  }

  if (!text.trim()) return json({ error: 'The CSV file is empty.' }, 400);
  if (Buffer.byteLength(text, 'utf8') > MAX_FILE_BYTES) {
    return json({ error: 'CSV is larger than the 2 MB upload limit.' }, 413);
  }

  let rows: string[][];
  try {
    rows = parseCsv(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'CSV could not be parsed.' }, 400);
  }

  if (rows.length < 2) return json({ error: 'The CSV does not contain any product rows.' }, 400);
  if (rows.length - 1 > MAX_ROWS) {
    return json({ error: `A single import can contain at most ${MAX_ROWS} product rows.` }, 413);
  }

  const headers = rows[0].map(normalizeHeader);
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length) {
    return json({ error: `Duplicate CSV columns: ${[...new Set(duplicateHeaders)].join(', ')}.` }, 400);
  }

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    return json({ error: `Missing required columns: ${missingHeaders.join(', ')}.` }, 400);
  }

  const accepted: Record<string, unknown>[] = [];
  const errors: Array<{ row: number; sku: string; message: string }> = [];
  const seenSkus = new Set<string>();

  rows.slice(1).forEach((values, rowIndex) => {
    const csvRowNumber = rowIndex + 2;
    const source = Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])) as Record<string, string>;
    const name = (source.name || '').trim();
    const sku = (source.sku || '').trim().toUpperCase();
    const price = finiteNumber(source.price || '');
    const available = finiteNumber(source.available || '');
    const moq = finiteNumber(source.moq || '');
    const minStock = finiteNumber(source.min_stock || '', 0);
    const gsm = optionalPositiveNumber(source.gsm || '');
    const width = optionalPositiveNumber(source.width || '');
    const dispatchDays = finiteNumber(source.dispatch_days || '', 3);
    const retailMin = finiteNumber(source.retail_store_min_quantity || '', moq ?? 1);
    const retailMax = optionalPositiveNumber(source.retail_store_max_quantity || '');
    const endUserMin = finiteNumber(source.end_user_min_quantity || '', 1);
    const endUserMax = optionalPositiveNumber(source.end_user_max_quantity || '');
    const status = (source.status || 'draft').trim().toLowerCase();
    const saleChannel = (source.sale_channel || 'b2b').trim().toLowerCase();
    const unitLabel = (source.unit || 'metre').trim() || 'metre';
    const imageUrl = (source.image_url || '').trim();

    const rowErrors: string[] = [];
    if (!name) rowErrors.push('name is required');
    if (!sku) rowErrors.push('sku is required');
    if (sku && seenSkus.has(sku)) rowErrors.push('SKU is duplicated in this CSV');
    if (price === null || price <= 0) rowErrors.push('price must be greater than 0');
    if (available === null || available < 0) rowErrors.push('available must be 0 or greater');
    if (moq === null || moq < 1) rowErrors.push('moq must be at least 1');
    if (minStock === null || minStock < 0) rowErrors.push('min_stock must be 0 or greater');
    if (Number.isNaN(gsm)) rowErrors.push('gsm must be a non-negative number');
    if (Number.isNaN(width)) rowErrors.push('width must be a non-negative number');
    if (dispatchDays === null || !Number.isInteger(dispatchDays) || dispatchDays < 0) rowErrors.push('dispatch_days must be a non-negative whole number');
    if (!ALLOWED_STATUSES.has(status)) rowErrors.push('status must be draft, active, or archived');
    if (!ALLOWED_SALE_CHANNELS.has(saleChannel)) rowErrors.push('sale_channel must be b2b, retail, or both');
    if (!validOptionalUrl(imageUrl)) rowErrors.push('image_url must be a valid http:// or https:// URL');
    if (retailMin === null || retailMin < 0) rowErrors.push('retail_store_min_quantity must be 0 or greater');
    if (Number.isNaN(retailMax) || (retailMax !== null && retailMin !== null && retailMax < retailMin)) rowErrors.push('retail_store_max_quantity must be blank or at least the minimum');
    if (endUserMin === null || endUserMin < 0) rowErrors.push('end_user_min_quantity must be 0 or greater');
    if (Number.isNaN(endUserMax) || (endUserMax !== null && endUserMin !== null && endUserMax < endUserMin)) rowErrors.push('end_user_max_quantity must be blank or at least the minimum');

    if (rowErrors.length) {
      errors.push({ row: csvRowNumber, sku, message: rowErrors.join('; ') });
      return;
    }

    seenSkus.add(sku);
    const personalEnabled = saleChannel !== 'b2b';
    accepted.push({
      seller_id: seller.id,
      name,
      sku,
      category: (source.category || 'Other').trim() || 'Other',
      description: (source.description || '').trim() || null,
      price_per_unit: price,
      unit: unitCode(unitLabel),
      unit_label: unitLabel,
      available_quantity: available,
      reserved_quantity: 0,
      min_stock: minStock,
      moq,
      gsm,
      width_inches: width,
      work_type: (source.work_type || 'Plain').trim() || 'Plain',
      image_url: imageUrl || null,
      dispatch_days: dispatchDays,
      origin_city: (source.origin_city || '').trim() || seller.city || null,
      origin_state: (source.origin_state || '').trim() || seller.state || null,
      status,
      sale_channel: saleChannel,
      retail_store_min_quantity: retailMin,
      retail_store_max_quantity: retailMax,
      end_user_enabled: personalEnabled,
      end_user_limit_mode: personalEnabled ? 'custom' : 'disabled',
      end_user_min_quantity: personalEnabled ? endUserMin : null,
      end_user_max_quantity: personalEnabled ? endUserMax : null,
      updated_at: new Date().toISOString(),
    });
  });

  if (!accepted.length) {
    return json({
      error: 'No valid product rows were found.',
      imported: 0,
      rejected: errors.length,
      errors,
    }, 422);
  }

  const { error: upsertError } = await supabase
    .from('seller_products')
    .upsert(accepted, { onConflict: 'seller_id,sku' });

  if (upsertError) {
    return json({ error: `Products could not be saved: ${upsertError.message}` }, 500);
  }

  return json({
    imported: accepted.length,
    rejected: errors.length,
    total: rows.length - 1,
    errors,
    message: errors.length
      ? `${accepted.length} product rows imported; ${errors.length} rejected.`
      : `${accepted.length} product rows imported successfully.`,
  });
}
