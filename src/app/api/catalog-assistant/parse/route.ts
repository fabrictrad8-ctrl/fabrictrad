import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeAiCatalogDraft,
  parseCatalogMessage,
  type ParsedCatalogDraft,
} from '@/lib/catalogAssistant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TEXT_LENGTH = 12_000;
const MODEL = process.env.OPENAI_CATALOG_MODEL || 'gpt-4.1-mini';

const CATALOG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'catalogKey',
    'name',
    'fabric',
    'category',
    'widthInches',
    'workType',
    'pricePerUnit',
    'unit',
    'moq',
    'availableQuantity',
    'gsm',
    'description',
    'saleChannel',
    'packageFormat',
    'variants',
  ],
  properties: {
    catalogKey: { type: 'string' },
    name: { type: 'string' },
    fabric: { type: 'string' },
    category: { type: 'string' },
    widthInches: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    workType: { type: 'string' },
    pricePerUnit: { type: 'number' },
    unit: { type: 'string', enum: ['mtr', 'kg', 'piece', 'roll'] },
    moq: { type: 'number' },
    availableQuantity: { type: 'number' },
    gsm: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    description: { type: 'string' },
    saleChannel: { type: 'string', enum: ['b2b', 'retail', 'both'] },
    packageFormat: {
      type: 'string',
      enum: [
        'Fabric Only',
        'Full Set',
        'Top',
        'Bottom',
        'Top & Bottom',
        'Additional Accessory',
        'Other',
      ],
    },
    variants: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'colorName',
          'colorHex',
          'designName',
          'description',
          'pricePerUnit',
          'unit',
          'availableQuantity',
          'moq',
          'mediaLabel',
        ],
        properties: {
          colorName: { type: 'string' },
          colorHex: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          designName: { type: 'string' },
          description: { type: 'string' },
          pricePerUnit: { type: 'number' },
          unit: { type: 'string', enum: ['mtr', 'kg', 'piece', 'roll'] },
          availableQuantity: { type: 'number' },
          moq: { type: 'number' },
          mediaLabel: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
    },
  },
} as const;

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const record = part as Record<string, unknown>;
      if (record.type === 'output_text' && typeof record.text === 'string') return record.text;
    }
  }
  return '';
}

async function parseWithOpenAi(text: string): Promise<ParsedCatalogDraft | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text:
                'You extract a textile seller catalogue into structured data. Preserve seller-provided names, rates, stock, colours, designs, MOQ, width and GSM. Infer a useful category when absent. saleChannel means b2b, retail or both. packageFormat must be one of Fabric Only, Full Set, Top, Bottom, Top & Bottom, Additional Accessory or Other. Never invent stock or prices. Use 0 when stock is absent and the parent price for a variant when its price is absent.',
            },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'fabrictrad_catalog',
          strict: true,
          schema: CATALOG_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as Record<string, unknown>;
  const textOutput = outputText(payload);
  if (!textOutput) return null;

  try {
    return normalizeAiCatalogDraft(JSON.parse(textOutput), text);
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json(
    {
      available: true,
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_API_KEY ? MODEL : null,
      fallback: 'deterministic textile parser',
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}

export async function POST(request: NextRequest) {
  let body: { text?: unknown };
  try {
    body = (await request.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'Describe the product before asking the assistant.' }, { status: 400 });
  }

  const text = body.text.trim().slice(0, MAX_TEXT_LENGTH);
  let draft: ParsedCatalogDraft | null = null;
  let provider: 'openai' | 'rules' = 'rules';

  try {
    draft = await parseWithOpenAi(text);
    if (draft) provider = 'openai';
  } catch {
    draft = null;
  }

  if (!draft) draft = parseCatalogMessage(text);
  if (!draft) {
    return NextResponse.json(
      {
        error:
          'I need at least a product or fabric name and a positive rate. Add colour blocks when the product has variants.',
      },
      { status: 422 }
    );
  }

  return NextResponse.json(
    {
      draft,
      provider,
      message:
        provider === 'openai'
          ? 'AI organised the product details. Review them before publishing.'
          : 'The built-in textile parser organised the details. Review them before publishing.',
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
