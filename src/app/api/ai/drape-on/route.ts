import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { imageEdit } from '@rocketnew/llm-sdk';
import { createClient } from '@/lib/supabase/server';

type DrapeRequest = {
  productId?: string;
  variantId?: string | null;
  modelImage?: string;
  garmentId?: string;
  fit?: string;
  // Kept only for older clients/demo tooling. The buyer product page uses productId/variantId.
  fabricImage?: string;
  fabricName?: string;
  styleName?: string;
};

type ImageInput = {
  blob: Blob;
  extension: 'jpg' | 'png' | 'webp';
  mime: string;
};

type FabricReference = {
  name: string;
  variantName: string | null;
  details: string;
  imageUrls: string[];
};

type GeneratedDrape = {
  image: string;
  provider: string;
  model: string;
};

type OpenAIImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
    moderation_details?: {
      moderation_stage?: string;
      categories?: string[];
    };
  };
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_FABRIC_REFERENCES = 2;
const DEMO_COOKIE_NAME = 'fabrictrad_demo_role';
const USAGE_COOKIE_NAME = 'fabrictrad_ai_drape_usage';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_REMOTE_HOSTS = new Set([
  'images.unsplash.com',
  'images.pexels.com',
  'images.pixabay.com',
  'img.rocket.new',
]);

const GARMENTS: Record<string, string> = {
  saree:
    'a complete six-yard saree with a fitted blouse, realistic waist pleats and a naturally falling pallu',
  lehenga:
    'a complete lehenga with a fitted blouse, full skirt and coordinated dupatta, with realistic tailoring and textile fall',
  kurta:
    'a properly tailored long-sleeve kurta with a finished neckline, side seams and natural fabric folds',
  shirt:
    'a premium long-sleeve shirt with a structured collar, buttons, cuffs and anatomically correct seams',
  dress:
    'a modern midi dress with a finished neckline, sleeves and clean tailoring that follows the body naturally',
  dupatta:
    'a full-length dupatta draped naturally over both shoulders and the existing outfit with realistic folds and gravity',
};

const FITS: Record<string, string> = {
  relaxed: 'relaxed',
  regular: 'regular',
  tailored: 'tailored',
};

class DrapeClientError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'DrapeClientError';
    this.status = status;
  }
}

const safeInteger = (
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
};

const allowedRemoteHosts = () => {
  const configured = (process.env.AI_IMAGE_SOURCE_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  const supabaseHosts = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL]
    .map((value) => {
      if (!value) return null;
      try {
        return new URL(value).hostname.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value));

  return new Set([...DEFAULT_REMOTE_HOSTS, ...configured, ...supabaseHosts]);
};

const extensionFor = (mime: string): ImageInput['extension'] => {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'png';
};

async function inputToBlob(input: string): Promise<ImageInput> {
  if (input.startsWith('data:')) {
    const match = input.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new DrapeClientError('Unsupported image data.');
    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.byteLength < 1 || buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new DrapeClientError('Image must be smaller than 8 MB.');
    }
    return {
      blob: new Blob([buffer], { type: mime }),
      extension: extensionFor(mime),
      mime,
    };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new DrapeClientError('Invalid image URL.');
  }

  if (url.protocol !== 'https:' || !allowedRemoteHosts().has(url.hostname.toLowerCase())) {
    throw new DrapeClientError('Image host is not allowed.');
  }

  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new DrapeClientError('Unable to fetch image.');

  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) throw new DrapeClientError('Unsupported image type.');

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new DrapeClientError('Image must be smaller than 8 MB.');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 1 || buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new DrapeClientError('Image must be smaller than 8 MB.');
  }

  return {
    blob: new Blob([buffer], { type: mime }),
    extension: extensionFor(mime),
    mime,
  };
}

function uniqueUrls(values: unknown[]) {
  return [
    ...new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ),
  ];
}

function mediaPriority(viewType: unknown) {
  if (viewType === 'front') return 0;
  if (viewType === 'detail') return 1;
  if (viewType === 'back') return 2;
  return 3;
}

async function resolveListingFabric(
  supabase: SupabaseClient,
  productId: string,
  variantId?: string | null
): Promise<FabricReference> {
  if (!UUID_PATTERN.test(productId)) {
    throw new DrapeClientError('Invalid product reference.');
  }
  if (variantId && !UUID_PATTERN.test(variantId)) {
    throw new DrapeClientError('Invalid colour variant reference.');
  }

  const { data: product, error: productError } = await supabase
    .from('seller_products')
    .select(
      'id,name,gsm,work_type,image_url,image_urls,status,approval_status,seller_id'
    )
    .eq('id', productId)
    .eq('status', 'active')
    .eq('approval_status', 'approved')
    .maybeSingle();

  if (productError) {
    console.error('AI drape product lookup failed', productError.message);
    throw new DrapeClientError('Unable to load this product for AI try-on.', 500);
  }
  if (!product) {
    throw new DrapeClientError('This product is no longer available for AI try-on.', 404);
  }

  let variant: Record<string, unknown> | null = null;
  if (variantId) {
    const { data, error } = await supabase
      .from('seller_product_variants')
      .select(
        'id,product_id,color_name,design_name,description,image_url,image_urls,status,approval_status'
      )
      .eq('id', variantId)
      .eq('product_id', productId)
      .eq('status', 'active')
      .eq('approval_status', 'approved')
      .maybeSingle();
    if (error) {
      console.error('AI drape variant lookup failed', error.message);
      throw new DrapeClientError('Unable to load this colour for AI try-on.', 500);
    }
    if (!data) {
      throw new DrapeClientError('The selected colour is no longer available for AI try-on.', 404);
    }
    variant = data as Record<string, unknown>;
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from('seller_product_media')
    .select('variant_id,media_type,view_type,public_url,sort_order')
    .eq('product_id', productId)
    .eq('media_type', 'image')
    .order('sort_order', { ascending: true });

  if (mediaError) {
    console.warn('AI drape media lookup failed; falling back to listing images', mediaError.message);
  }

  const sortedMedia = [...(mediaRows || [])].sort(
    (a, b) => mediaPriority(a.view_type) - mediaPriority(b.view_type)
  );
  const variantMedia = variantId
    ? sortedMedia.filter((row) => String(row.variant_id || '') === variantId)
    : [];
  const parentMedia = sortedMedia.filter((row) => !row.variant_id);

  const imageUrls = uniqueUrls([
    variantMedia.map((row) => row.public_url),
    variant?.image_url,
    variant?.image_urls,
    parentMedia.map((row) => row.public_url),
    product.image_url,
    product.image_urls,
  ]).slice(0, MAX_FABRIC_REFERENCES);

  if (!imageUrls.length) {
    throw new DrapeClientError('This listing does not have a usable fabric photo.', 400);
  }

  const variantName = variant
    ? [variant.color_name, variant.design_name].filter(Boolean).map(String).join(' · ')
    : null;
  const details = [
    product.gsm ? `${Number(product.gsm)} GSM` : '',
    variant?.color_name ? `colour ${String(variant.color_name)}` : '',
    variant?.design_name ? `design ${String(variant.design_name)}` : '',
    product.work_type ? `work ${String(product.work_type)}` : '',
    variant?.description ? String(variant.description).slice(0, 160) : '',
  ]
    .filter(Boolean)
    .join('; ');

  return {
    name: String(product.name || 'Selected fabric').slice(0, 160),
    variantName: variantName || null,
    details: details.slice(0, 300),
    imageUrls,
  };
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

async function signUsage(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Buffer.from(signature).toString('base64url');
}

async function readUsageCookie(request: NextRequest, secret: string) {
  const value = request.cookies.get(USAGE_COOKIE_NAME)?.value;
  if (!value) return 0;

  const [encodedPayload, suppliedSignature] = value.split('.');
  if (!encodedPayload || !suppliedSignature) return 0;

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return 0;
  }

  const expectedSignature = await signUsage(payload, secret);
  if (expectedSignature !== suppliedSignature) return 0;

  const [day, rawCount] = payload.split(':');
  if (day !== todayUtc()) return 0;
  return safeInteger(rawCount, 0, 0, 100);
}

async function writeUsageCookie(response: NextResponse, count: number, secret: string) {
  const payload = `${todayUtc()}:${count}`;
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = await signUsage(payload, secret);
  response.cookies.set(USAGE_COOKIE_NAME, `${encodedPayload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 30,
  });
}

function resolveGarment(body: DrapeRequest) {
  const garmentId = String(body.garmentId || '').toLowerCase();
  const fitKey = String(body.fit || '').toLowerCase();
  if (GARMENTS[garmentId]) {
    return `${FITS[fitKey] || 'regular'} fit ${GARMENTS[garmentId]}`;
  }
  // Legacy clients may still send styleName. Keep it tightly bounded.
  const legacy = String(body.styleName || '').trim().slice(0, 180);
  return legacy || `regular fit ${GARMENTS.kurta}`;
}

function buildPrompt(fabric: FabricReference, styleName: string, referenceCount: number) {
  return [
    'Create one photorealistic virtual try-on photograph for a premium textile marketplace.',
    'IMAGE 1 is the person reference. Preserve this exact adult person’s facial identity, skin tone, hair, expression, body proportions, pose, hands, camera angle, lighting, framing and background as closely as possible.',
    referenceCount > 1
      ? `IMAGES 2-${referenceCount + 1} are reference views of the SAME textile. Use them only to understand the textile itself.`
      : 'IMAGE 2 is the fabric reference. Use it only to understand the textile itself.',
    `The textile listing is “${fabric.name}”${fabric.variantName ? `, selected variant “${fabric.variantName}”` : ''}${fabric.details ? ` (${fabric.details})` : ''}.`,
    'Reproduce the textile colour, print, weave, embroidery, texture, sheen and pattern scale faithfully. Do not copy any person, mannequin, hand, hanger, room or background that may appear in a fabric-reference image.',
    `Dress the person in ${styleName}.`,
    'Replace the person’s visible clothing only where appropriate for the requested garment. Construct a genuinely wearable garment with correct neckline, sleeves, seams, hems, pleats, folds, fabric thickness, gravity, shadows and body occlusion.',
    'The garment must conform naturally to the body and pose. Keep hands and limbs anatomically correct and visible when they were visible in the person reference.',
    'Do not make a flat texture overlay, pasted colour region, floating cloth, polygon, bib, cape or generic shawl unless the requested garment is specifically a dupatta.',
    'Do not change the person’s face, hair, age, body shape or skin tone. Do not add another person, jewellery, text, logos, labels, borders, watermarks or a comparison collage.',
    'Output one finished ecommerce-style try-on photograph only.',
  ].join(' ');
}

async function generateWithOpenAI(
  person: ImageInput,
  fabrics: ImageInput[],
  prompt: string,
  apiKey: string
): Promise<GeneratedDrape> {
  const model = process.env.OPENAI_DRAPE_IMAGE_MODEL || 'gpt-image-2';
  const size = process.env.OPENAI_DRAPE_IMAGE_SIZE || '1024x1536';
  const quality = process.env.OPENAI_DRAPE_IMAGE_QUALITY || 'medium';

  const form = new FormData();
  form.append('model', model);
  form.append('image[]', person.blob, `person.${person.extension}`);
  fabrics.forEach((fabric, index) => {
    form.append('image[]', fabric.blob, `fabric-${index + 1}.${fabric.extension}`);
  });
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
  form.append('output_format', 'jpeg');
  form.append('output_compression', '90');
  form.append('moderation', 'auto');

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(115_000),
  });

  const requestId = response.headers.get('x-request-id');
  const payload = (await response.json().catch(() => ({}))) as OpenAIImageResponse;
  if (!response.ok) {
    console.error('OpenAI virtual try-on failed', {
      status: response.status,
      requestId,
      code: payload.error?.code,
      type: payload.error?.type,
      moderation: payload.error?.moderation_details,
    });
    if (payload.error?.code === 'moderation_blocked') {
      throw new DrapeClientError(
        'The selected photo could not be processed. Try a clear, fully clothed adult photo.',
        400
      );
    }
    throw new Error(payload.error?.message || 'OpenAI image generation failed.');
  }

  const base64Image = payload.data?.[0]?.b64_json;
  if (!base64Image) throw new Error('OpenAI returned no generated image.');

  return {
    image: `data:image/jpeg;base64,${base64Image}`,
    provider: 'OpenAI',
    model,
  };
}

async function generateWithGemini(
  person: ImageInput,
  fabrics: ImageInput[],
  prompt: string,
  apiKey: string
): Promise<GeneratedDrape> {
  const model = process.env.GEMINI_DRAPE_IMAGE_MODEL || 'gemini/gemini-2.5-flash-image';
  const output = await imageEdit({
    model,
    image: [person.blob, ...fabrics.map((item) => item.blob)],
    prompt,
    size: process.env.GEMINI_DRAPE_IMAGE_SIZE || '1024x1536',
    api_key: apiKey,
    response_format: 'b64_json',
    quality: 'high',
  });

  const firstImage = output?.data?.[0];
  const image = firstImage?.b64_json
    ? `data:image/png;base64,${firstImage.b64_json}`
    : firstImage?.url;
  if (!image) throw new Error('Gemini returned no generated image.');

  return { image, provider: 'Gemini', model };
}

export async function GET() {
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  return NextResponse.json(
    {
      configured: openAiConfigured || geminiConfigured,
      mode: 'real_ai_image_try_on',
      usesListingMedia: true,
      provider: openAiConfigured ? 'OpenAI GPT Image' : geminiConfigured ? 'Gemini Image' : null,
      model: openAiConfigured
        ? process.env.OPENAI_DRAPE_IMAGE_MODEL || 'gpt-image-2'
        : geminiConfigured
          ? process.env.GEMINI_DRAPE_IMAGE_MODEL || 'gemini/gemini-2.5-flash-image'
          : null,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!openAiKey && !geminiKey) {
    return NextResponse.json({ error: 'AI image service is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const demoRole = request.cookies.get(DEMO_COOKIE_NAME)?.value;
  const isDemoBuyer = !user && demoRole === 'buyer';

  if (!user && !isDemoBuyer) {
    return NextResponse.json({ error: 'Buyer authentication is required.' }, { status: 401 });
  }

  if (user) {
    const { data: buyerAccess, error: accessError } = await supabase
      .from('user_profiles')
      .select('can_buy,is_active')
      .eq('id', user.id)
      .maybeSingle();
    if (accessError || !buyerAccess?.is_active || !buyerAccess?.can_buy) {
      return NextResponse.json({ error: 'Buyer access is required for AI try-on.' }, { status: 403 });
    }
  }

  try {
    const body = (await request.json()) as DrapeRequest;
    if (!body.modelImage) {
      throw new DrapeClientError('Choose or upload a person photo first.');
    }

    let fabricReference: FabricReference;
    if (body.productId) {
      fabricReference = await resolveListingFabric(supabase, body.productId, body.variantId);
    } else if (body.fabricImage) {
      fabricReference = {
        name: String(body.fabricName || 'Selected textile').slice(0, 160),
        variantName: null,
        details: '',
        imageUrls: [body.fabricImage],
      };
    } else {
      throw new DrapeClientError('Select a live FabricTrad product before generating a try-on.');
    }

    const [person, ...fabricInputs] = await Promise.all([
      inputToBlob(body.modelImage),
      ...fabricReference.imageUrls.map((url) => inputToBlob(url)),
    ]);
    if (!fabricInputs.length) {
      throw new DrapeClientError('This listing does not have a usable fabric photo.');
    }

    // Consume quota only after the request, listing and image inputs are valid.
    const cookieSecret = process.env.AI_DRAPE_COOKIE_SECRET || openAiKey || geminiKey!;
    let cookieQuotaUsed = false;
    let usageCount = 0;

    if (user) {
      const { data: quotaAllowed, error: quotaError } = await supabase.rpc('consume_api_quota', {
        p_feature: 'ai_drape',
        p_daily_limit: safeInteger(process.env.AI_DRAPE_DAILY_LIMIT, 10, 1, 100),
      });
      if (quotaError) {
        console.warn('AI drape database quota unavailable; using signed browser quota.', quotaError.message);
        cookieQuotaUsed = true;
      } else if (!quotaAllowed) {
        return NextResponse.json({ error: 'Daily AI image limit reached.' }, { status: 429 });
      }
    } else {
      cookieQuotaUsed = true;
    }

    if (cookieQuotaUsed) {
      usageCount = await readUsageCookie(request, cookieSecret);
      const cookieLimit = isDemoBuyer
        ? safeInteger(process.env.AI_DRAPE_DEMO_DAILY_LIMIT, 2, 1, 5)
        : safeInteger(process.env.AI_DRAPE_FALLBACK_DAILY_LIMIT, 3, 1, 10);
      if (usageCount >= cookieLimit) {
        return NextResponse.json(
          { error: 'Daily AI image limit reached for this browser.' },
          { status: 429 }
        );
      }
    }

    const styleName = resolveGarment(body);
    const prompt = buildPrompt(fabricReference, styleName, fabricInputs.length);
    const providerErrors: string[] = [];
    let generated: GeneratedDrape | null = null;

    if (openAiKey) {
      try {
        generated = await generateWithOpenAI(person, fabricInputs, prompt, openAiKey);
      } catch (error) {
        if (error instanceof DrapeClientError) throw error;
        const message = error instanceof Error ? error.message : 'OpenAI image generation failed.';
        providerErrors.push(message);
        console.error('OpenAI drape generation failed:', error);
      }
    }

    if (!generated && geminiKey) {
      try {
        generated = await generateWithGemini(person, fabricInputs, prompt, geminiKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gemini image generation failed.';
        providerErrors.push(message);
        console.error('Gemini drape generation failed:', error);
      }
    }

    if (!generated) {
      return NextResponse.json(
        { error: 'AI virtual try-on generation failed. Please try another clear photo.' },
        { status: 502 }
      );
    }

    const response = NextResponse.json(
      {
        image: generated.image,
        provider: generated.provider,
        model: generated.model,
        fabricReference: {
          name: fabricReference.name,
          variantName: fabricReference.variantName,
          imageCount: fabricInputs.length,
        },
        analysis: `${generated.provider} generated a ${styleName} using the live FabricTrad listing “${fabricReference.name}”${fabricReference.variantName ? ` (${fabricReference.variantName})` : ''}. This is a visual sourcing preview; confirm the physical textile before production.`,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );

    if (cookieQuotaUsed) {
      await writeUsageCookie(response, usageCount + 1, cookieSecret);
    }
    return response;
  } catch (error) {
    if (error instanceof DrapeClientError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('AI drape request failed:', error);
    return NextResponse.json({ error: 'Unable to generate AI virtual try-on.' }, { status: 500 });
  }
}
