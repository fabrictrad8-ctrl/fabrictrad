import { NextRequest, NextResponse } from 'next/server';
import { imageEdit } from '@rocketnew/llm-sdk';
import { createClient } from '@/lib/supabase/server';

type DrapeRequest = {
  fabricImage?: string;
  modelImage?: string;
  fabricName?: string;
  styleName?: string;
};

type ImageInput = {
  blob: Blob;
  extension: 'jpg' | 'png' | 'webp';
  mime: string;
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
const MAX_REQUEST_BYTES = 22 * 1024 * 1024;
const DEMO_COOKIE_NAME = 'fabrictrad_demo_role';
const USAGE_COOKIE_NAME = 'fabrictrad_ai_drape_usage';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_REMOTE_HOSTS = new Set([
  'images.unsplash.com',
  'images.pexels.com',
  'images.pixabay.com',
  'img.rocket.new',
]);

const safeInteger = (value: string | undefined, fallback: number, minimum: number, maximum: number) => {
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
    if (!match) throw new Error('Unsupported image data.');
    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.byteLength < 1 || buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('Image must be smaller than 8 MB.');
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
    throw new Error('Invalid image URL.');
  }

  if (url.protocol !== 'https:' || !allowedRemoteHosts().has(url.hostname.toLowerCase())) {
    throw new Error('Image host is not allowed.');
  }

  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('Unable to fetch image.');

  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) throw new Error('Unsupported image type.');

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error('Image must be smaller than 8 MB.');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 1 || buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Image must be smaller than 8 MB.');
  }

  return {
    blob: new Blob([buffer], { type: mime }),
    extension: extensionFor(mime),
    mime,
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

function buildPrompt(fabricName: string, styleName: string) {
  return [
    'Create one photorealistic AI virtual try-on image for a premium textile marketplace.',
    'IMAGE 1 is the person reference. Preserve that exact adult person’s facial identity, skin tone, hair, expression, body shape, pose, hands, camera angle, lighting, framing and background as closely as possible.',
    'IMAGE 2 is the fabric reference. Use it only for the exact textile colour, print, weave, embroidery, texture, sheen and pattern scale.',
    `Dress the person in this garment specification: ${styleName}.`,
    `The selected textile is: ${fabricName}.`,
    'Replace the visible clothing with a properly constructed, wearable garment made from the reference fabric.',
    'This must look like a real garment worn on the body, with correct neckline, sleeves, seams, pleats, folds, gravity, fabric thickness, shadows and occlusion.',
    'Do not create a flat colour block, polygon, pasted overlay, floating cloth, bib, cape or generic shawl unless the requested garment is specifically a dupatta.',
    'Keep the face and hair unobstructed. Preserve natural anatomy and realistic hands. Do not add extra limbs, extra people, jewellery, text, logos, labels, borders, watermarks or a collage.',
    'Output a single finished ecommerce-style try-on photograph, not a comparison layout.',
  ].join(' ');
}

async function generateWithOpenAI(
  person: ImageInput,
  fabric: ImageInput,
  prompt: string,
  apiKey: string
): Promise<GeneratedDrape> {
  const model = process.env.OPENAI_DRAPE_IMAGE_MODEL || 'gpt-image-2';
  const size = process.env.OPENAI_DRAPE_IMAGE_SIZE || '1024x1536';
  const quality = process.env.OPENAI_DRAPE_IMAGE_QUALITY || 'medium';

  const form = new FormData();
  form.append('model', model);
  form.append('image[]', person.blob, `person.${person.extension}`);
  form.append('image[]', fabric.blob, `fabric.${fabric.extension}`);
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
  form.append('output_format', 'jpeg');
  form.append('output_compression', '90');
  form.append('moderation', 'auto');

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
    signal: AbortSignal.timeout(110_000),
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
      throw new Error('The selected image could not be processed. Try a clear, fully clothed adult photo.');
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
  fabric: ImageInput,
  prompt: string,
  apiKey: string
): Promise<GeneratedDrape> {
  const model = process.env.GEMINI_DRAPE_IMAGE_MODEL || 'gemini/gemini-2.5-flash-image';
  const output = await imageEdit({
    model,
    image: [person.blob, fabric.blob],
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

  return {
    image,
    provider: 'Gemini',
    model,
  };
}

export async function GET() {
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  return NextResponse.json(
    {
      configured: openAiConfigured || geminiConfigured,
      provider: openAiConfigured ? 'OpenAI GPT Image' : geminiConfigured ? 'Gemini Image' : null,
      model: openAiConfigured
        ? process.env.OPENAI_DRAPE_IMAGE_MODEL || 'gpt-image-2'
        : geminiConfigured
          ? process.env.GEMINI_DRAPE_IMAGE_MODEL || 'gemini/gemini-2.5-flash-image'
          : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
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
      return NextResponse.json({ error: 'Daily AI image limit reached for this browser.' }, { status: 429 });
    }
  }

  try {
    const body = (await request.json()) as DrapeRequest;
    if (!body.fabricImage || !body.modelImage) {
      return NextResponse.json(
        { error: 'fabricImage and modelImage are required.' },
        { status: 400 }
      );
    }

    const [person, fabric] = await Promise.all([
      inputToBlob(body.modelImage),
      inputToBlob(body.fabricImage),
    ]);

    const safeFabricName = String(body.fabricName || 'selected textile fabric').slice(0, 180);
    const safeStyleName = String(body.styleName || 'regular-fit premium garment').slice(0, 180);
    const prompt = buildPrompt(safeFabricName, safeStyleName);

    const providerErrors: string[] = [];
    let generated: GeneratedDrape | null = null;

    if (openAiKey) {
      try {
        generated = await generateWithOpenAI(person, fabric, prompt, openAiKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'OpenAI image generation failed.';
        providerErrors.push(message);
        console.error('OpenAI drape generation failed:', error);
      }
    }

    if (!generated && geminiKey) {
      try {
        generated = await generateWithGemini(person, fabric, prompt, geminiKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gemini image generation failed.';
        providerErrors.push(message);
        console.error('Gemini drape generation failed:', error);
      }
    }

    if (!generated) {
      const safeMessage = providerErrors.find((message) =>
        message.startsWith('The selected image could not be processed.')
      );
      return NextResponse.json(
        { error: safeMessage || 'AI virtual try-on generation failed. Please try another photo.' },
        { status: 502 }
      );
    }

    const response = NextResponse.json(
      {
        image: generated.image,
        provider: generated.provider,
        model: generated.model,
        analysis: `${generated.provider} generated a realistic ${safeStyleName} using ${safeFabricName}. Use this as a visual sourcing preview and confirm the physical fabric sample before production.`,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );

    if (cookieQuotaUsed) {
      await writeUsageCookie(response, usageCount + 1, cookieSecret);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate AI drape.';
    const safeClientErrors = new Set([
      'Unsupported image data.',
      'Image must be smaller than 8 MB.',
      'Invalid image URL.',
      'Image host is not allowed.',
      'Unable to fetch image.',
      'Unsupported image type.',
    ]);

    if (safeClientErrors.has(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('AI drape request failed:', error);
    return NextResponse.json({ error: 'Unable to generate AI virtual try-on.' }, { status: 500 });
  }
}
