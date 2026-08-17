import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const ai2dConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
  const threeDProviderConfigured = Boolean(process.env.TRIAL_ROOM_3D_PROVIDER_URL);

  return NextResponse.json(
    {
      currentExperience: 'ai_2d_image_try_on',
      ai2dConfigured,
      threeDAssetPipeline: true,
      threeDProviderConfigured,
      threeDStatus: threeDProviderConfigured ? 'provider_configured' : 'architecture_ready_provider_pending',
      supportedFutureAssets: ['fabric_texture', 'normal_map', 'roughness_map', 'garment_glb', 'garment_usdz'],
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
