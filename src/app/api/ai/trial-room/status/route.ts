import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const ai2dConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
  const threeDProviderConfigured = Boolean(process.env.TRIAL_ROOM_3D_PROVIDER_URL);

  return NextResponse.json(
    {
      currentExperience: 'interactive_3d_human_avatar_plus_ai_personal_photo_try_on',
      ai2dConfigured,
      interactiveThreeDHumanAvatar: true,
      avatarChoices: ['woman', 'man'],
      personalPhotoExperience: 'ai_2d_image_try_on',
      personalPhotoInput: ['upload', 'camera'],
      threeDAssetPipeline: true,
      threeDProviderConfigured,
      threeDStatus: threeDProviderConfigured
        ? 'external_asset_provider_configured'
        : 'procedural_webgl_human_avatar_live',
      supportedFutureAssets: [
        'fabric_texture',
        'normal_map',
        'roughness_map',
        'garment_glb',
        'garment_usdz',
      ],
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
