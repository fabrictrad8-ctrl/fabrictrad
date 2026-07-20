import { NextRequest, NextResponse } from 'next/server';
import { imageEdit } from '@rocketnew/llm-sdk';
import { createClient } from '@/lib/supabase/server';

type DrapeRequest = {
  fabricImage?: string;
  modelImage?: string;
  fabricName?: string;
  styleName?: string;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_REMOTE_HOSTS = new Set([
  'images.unsplash.com',
  'images.pexels.com',
  'images.pixabay.com',
  'img.rocket.new',
]);

const allowedRemoteHosts = () => {
  const configured = (process.env.AI_IMAGE_SOURCE_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_REMOTE_HOSTS, ...configured]);
};

const extensionFor = (mime: string) => {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'png';
};

async function inputToBlob(input: string) {
  if (input.startsWith('data:')) {
    const match = input.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new Error('Unsupported image data.');
    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.byteLength < 1 || buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('Image must be smaller than 8 MB.');
    }
    return { blob: new Blob([buffer], { type: mime }), extension: extensionFor(mime) };
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
    signal: AbortSignal.timeout(10_000),
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
  return { blob: new Blob([buffer], { type: mime }), extension: extensionFor(mime) };
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 22 * 1024 * 1024) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { data: quotaAllowed, error: quotaError } = await supabase.rpc('consume_api_quota', {
    p_feature: 'ai_drape',
    p_daily_limit: Number(process.env.AI_DRAPE_DAILY_LIMIT || 10),
  });
  if (quotaError) {
    console.error('AI drape quota check failed:', quotaError.message);
    return NextResponse.json({ error: 'AI image service is temporarily unavailable.' }, { status: 503 });
  }
  if (!quotaAllowed) {
    return NextResponse.json({ error: 'Daily AI image limit reached.' }, { status: 429 });
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!openAiKey && !geminiKey) {
    return NextResponse.json({ error: 'AI image service is not configured.' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as DrapeRequest;
    if (!body.fabricImage || !body.modelImage) {
      return NextResponse.json(
        { error: 'fabricImage and modelImage are required.' },
        { status: 400 }
      );
    }

    const [fabric, model] = await Promise.all([
      inputToBlob(body.fabricImage),
      inputToBlob(body.modelImage),
    ]);

    const safeFabricName = String(body.fabricName || 'selected textile fabric').slice(0, 100);
    const safeStyleName = String(body.styleName || 'premium Indian outfit drape').slice(0, 100);
    const prompt = [
      'Create a realistic fashion try-on image for an ecommerce textile product page.',
      'Use the first image as the person, pose, face, body shape and background reference.',
      'Use the second image only as the fabric pattern, embroidery, texture and colour reference.',
      `Drape the fabric as: ${safeStyleName}.`,
      `Fabric name: ${safeFabricName}.`,
      'Preserve facial identity and natural anatomy. Use realistic folds, shadows and textile scale.',
      'Do not add text, watermarks, labels, extra people or distorted limbs.',
    ].join(' ');

    const providers = [
      ...(geminiKey
        ? [
            {
              name: 'Gemini',
              model: process.env.GEMINI_DRAPE_IMAGE_MODEL || 'gemini/gemini-2.5-flash-image',
              apiKey: geminiKey,
              size: process.env.GEMINI_DRAPE_IMAGE_SIZE || '1024x1024',
            },
          ]
        : []),
      ...(openAiKey
        ? [
            {
              name: 'OpenAI',
              model: process.env.OPENAI_DRAPE_IMAGE_MODEL || 'gpt-image-1',
              apiKey: openAiKey,
              size: process.env.OPENAI_DRAPE_IMAGE_SIZE || '1024x1536',
            },
          ]
        : []),
    ];

    let output: Awaited<ReturnType<typeof imageEdit>> | null = null;
    let providerUsed = '';
    for (const provider of providers) {
      try {
        output = await imageEdit({
          model: provider.model,
          image: [model.blob, fabric.blob],
          prompt,
          size: provider.size,
          api_key: provider.apiKey,
          response_format: 'b64_json',
          quality: 'high',
        });
        providerUsed = provider.name;
        break;
      } catch (error) {
        console.error(`${provider.name} drape generation failed:`, error);
      }
    }

    const firstImage = output?.data?.[0];
    const image = firstImage?.b64_json
      ? `data:image/png;base64,${firstImage.b64_json}`
      : firstImage?.url;
    if (!image) {
      return NextResponse.json({ error: 'AI image generation failed.' }, { status: 502 });
    }

    return NextResponse.json(
      {
        image,
        provider: providerUsed,
        analysis: `${providerUsed} generated a drape preview using ${safeFabricName}. Review colour, surface texture and fall before confirming a bulk sample.`,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
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
    return NextResponse.json({ error: 'Unable to generate AI drape.' }, { status: 500 });
  }
}
