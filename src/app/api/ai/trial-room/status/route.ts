import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

  return NextResponse?.json(
    {
      currentExperience: 'dual_ai_virtual_drape',
      configured: openAiConfigured || geminiConfigured,
      provider: openAiConfigured ? 'OpenAI GPT Image' : geminiConfigured ? 'Gemini Image' : null,
      apiUsed: openAiConfigured ? 'OpenAI Images API' : geminiConfigured ? 'Gemini Image API' : null,
      model: openAiConfigured
        ? process.env.OPENAI_DRAPE_IMAGE_MODEL || 'gpt-image-2'
        : geminiConfigured
          ? process.env.GEMINI_DRAPE_IMAGE_MODEL || 'gemini/gemini-2.5-flash-image'
          : null,
      credentialLocation: 'server_only',
      usesLiveSellerTextileReferences: true,
      subjectModes: [
        {
          id: 'own_photo',
          label: 'Use my own photo',
          inputs: ['upload', 'camera'],
          description: 'AI dresses the buyer photo using the approved seller textile references.',
        },
        {
          id: 'ai_model',
          label: 'AI-generated model',
          modelGenders: ['woman', 'man'],
          description: 'AI creates a photorealistic model wearing the approved seller textile.',
        },
      ],
      proceduralThreeDFlagship: false,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
