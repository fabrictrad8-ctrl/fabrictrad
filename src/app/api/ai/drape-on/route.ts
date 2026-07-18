import { NextRequest, NextResponse } from 'next/server';
import { imageEdit } from '@rocketnew/llm-sdk';

type DrapeRequest = {
  fabricImage?: string;
  modelImage?: string;
  fabricName?: string;
  styleName?: string;
  settings?: {
    opacity?: number;
    blend?: string;
    scale?: number;
    rotation?: number;
  };
};

function getMimeExtension(mime: string) {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'png';
}

async function inputToBlob(input: string, fallbackMime = 'image/png') {
  if (input.startsWith('data:')) {
    const [meta, base64] = input.split(',');
    const mime = meta.match(/data:(.*?);base64/)?.[1] || fallbackMime;
    return {
      blob: new Blob([Buffer.from(base64, 'base64')], { type: mime }),
      extension: getMimeExtension(mime),
    };
  }

  const response = await fetch(input, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to fetch image: ${response.status}`);
  }

  const blob = await response.blob();
  const mime = blob.type || fallbackMime;
  return { blob, extension: getMimeExtension(mime) };
}

export async function POST(request: NextRequest) {
  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!openAiKey && !geminiKey) {
    return NextResponse.json(
      {
        error: 'AI image API key is not configured',
        details: 'Set GEMINI_API_KEY or OPENAI_API_KEY to enable AI drape-on image generation.',
      },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as DrapeRequest;
    if (!body.fabricImage || !body.modelImage) {
      return NextResponse.json(
        { error: 'fabricImage and modelImage are required' },
        { status: 400 }
      );
    }

    const [fabric, model] = await Promise.all([
      inputToBlob(body.fabricImage),
      inputToBlob(body.modelImage),
    ]);

    const prompt = [
      'Create a realistic fashion try-on image for an ecommerce textile product page.',
      'Use the first image as the person/model identity, pose, face, body shape, and background reference.',
      'Use the second image only as the fabric, pattern, embroidery, texture, and color reference.',
      `Drape the fabric as: ${body.styleName || 'premium Indian outfit drape'}.`,
      `Fabric/product name: ${body.fabricName || 'selected textile fabric'}.`,
      'Keep the model natural and preserve facial identity. Make the fabric fall realistic with folds, shadows, scale, and textile sheen.',
      'Do not add text, watermarks, product labels, extra people, or distorted limbs.',
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

    let lastError: unknown = null;
    let imageData: Awaited<ReturnType<typeof imageEdit>> | null = null;
    let providerUsed = '';

    for (const provider of providers) {
      try {
        imageData = await imageEdit({
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
        lastError = error;
      }
    }

    if (!imageData) {
      return NextResponse.json(
        {
          error:
            lastError instanceof Error ? lastError.message : 'AI drape image generation failed',
        },
        { status: 502 }
      );
    }

    const firstImage = imageData?.data?.[0];
    const image = firstImage?.b64_json
      ? `data:image/png;base64,${firstImage.b64_json}`
      : firstImage?.url;

    if (!image) {
      return NextResponse.json(
        { error: 'AI did not return an image', details: imageData },
        { status: 502 }
      );
    }

    return NextResponse.json({
      image,
      provider: providerUsed,
      analysis: `${providerUsed} generated a realistic drape preview using ${body.fabricName || 'the selected fabric'} and the chosen model/photo. Review the fabric fall, surface texture, and color balance before confirming bulk sampling.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to generate AI drape',
      },
      { status: 500 }
    );
  }
}
