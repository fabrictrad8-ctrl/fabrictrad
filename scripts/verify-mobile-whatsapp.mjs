import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (relative) => {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing required file: ${relative}`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
};
const requireText = (relative, needle) => {
  if (!read(relative).includes(needle)) failures.push(`${relative} must contain: ${needle}`);
};
const forbidText = (relative, needle) => {
  if (read(relative).includes(needle)) failures.push(`${relative} must not contain: ${needle}`);
};

const onboarding = 'src/lib/hooks/useOnboardingDraft.ts';
const onboardingApi = 'src/app/api/account/onboarding-draft/route.ts';
const sellerVerification = 'src/app/api/seller/verification-status/route.ts';
const composer = 'src/lib/hooks/useCatalogComposerDraft.ts';
const mediaDraft = 'src/lib/hooks/useCatalogMediaDraft.ts';
const catalogUi = 'src/app/seller-dashboard/components/SellerCatalogAssistant.tsx';
const productDraftMigration = 'supabase/migrations/20260821165000_seller_product_composer_drafts.sql';
const flexibleProductMigration = 'supabase/migrations/20260822043000_flexible_product_taxonomy_units.sql';
const webhook = 'src/app/api/integrations/whatsapp/webhook/route.ts';
const status = 'src/app/api/whatsapp/status/route.ts';
const inboxApi = 'src/app/api/whatsapp/catalog-inbox/route.ts';
const inboxUi = 'src/app/seller-dashboard/components/WhatsAppCatalogPanel.tsx';
const migration = 'supabase/migrations/20260817143000_whatsapp_catalog_ingestion.sql';
const trialMigration = 'supabase/migrations/20260817150000_trial_room_asset_pipeline.sql';
const trialStatus = 'src/app/api/ai/trial-room/status/route.ts';
const drapeApi = 'src/app/api/ai/drape-on/route.ts';
const drapeUi = 'src/app/product-detail/components/HybridVirtualDrapeStudio.tsx';
const drapeRoute = 'src/app/product-detail/components/ModernFabricDrapeViewer.tsx';
const drape3d = 'src/app/product-detail/components/InteractiveFabricMannequin3D.tsx';
const drapeStyle = 'src/lib/drapeProductStyle.ts';
const pageContinuity = 'src/components/PageContinuity.tsx';
const authContext = 'src/contexts/AuthContext.tsx';
const legacyDrape = 'src/app/product-detail/components/FabricDrapeViewer.tsx';
const manifest = 'src/app/manifest.ts';
const readiness = '.github/workflows/integration-readiness.yml';

[
  onboarding,
  onboardingApi,
  sellerVerification,
  composer,
  mediaDraft,
  catalogUi,
  productDraftMigration,
  flexibleProductMigration,
  webhook,
  status,
  inboxApi,
  inboxUi,
  migration,
  trialMigration,
  trialStatus,
  drapeApi,
  drapeUi,
  drapeRoute,
  drape3d,
  drapeStyle,
  pageContinuity,
  authContext,
  legacyDrape,
  manifest,
  readiness,
].forEach(read);

requireText(onboarding, "document.addEventListener('visibilitychange'");
requireText(onboarding, "window.addEventListener('pagehide'");
requireText(onboarding, 'keepalive');
requireText(onboarding, 'window.localStorage.setItem');
requireText(onboarding, 'window.sessionStorage.setItem');
requireText(onboarding, 'saveNow(true)');
requireText(onboarding, 'scopeFor(userId)');
requireText(onboarding, 'headers.Authorization');
requireText(onboarding, 'supabase.auth.getSession()');
requireText(onboardingApi, 'bearerToken');
requireText(onboardingApi, 'createAdminClient');
requireText(onboardingApi, ".eq('user_id', user.id)");
requireText(sellerVerification, 'bearerToken');
requireText(sellerVerification, 'Authorization: `Bearer ${token}`');

requireText(composer, 'ownerKey');
requireText(composer, 'window.localStorage.setItem');
requireText(composer, "document.visibilityState === 'hidden'");
requireText(mediaDraft, 'indexedDB.open');
requireText(mediaDraft, 'navigator.storage?.persist');
requireText(mediaDraft, 'MAX_PERSISTED_BYTES');
requireText(mediaDraft, 'draftKey(owner)');
requireText(catalogUi, 'useCatalogComposerDraft');
requireText(catalogUi, 'useCatalogMediaDraft');
requireText(catalogUi, "from('seller_product_drafts')");
requireText(catalogUi, 'Auto-recovery on this device');
requireText(catalogUi, 'Draft saved to FabricTrad');
requireText(productDraftMigration, 'create table if not exists public.seller_product_drafts');
requireText(productDraftMigration, 'enable row level security');
requireText(productDraftMigration, 'seller_product_drafts_owner_update');

requireText(catalogUi, 'Fabric name');
requireText(catalogUi, 'Type any fabric name');
requireText(catalogUi, 'Product type / format');
requireText(catalogUi, 'Measurement unit');
requireText(catalogUi, 'farma');
requireText(catalogUi, '+ Add product URL (optional)');
requireText(catalogUi, 'Custom attributes');
requireText(catalogUi, 'unit_label: customUnitLabel');
requireText(catalogUi, 'custom_attributes: attributes');
requireText(catalogUi, 'product_url: form.productUrl.trim() || null');
requireText(flexibleProductMigration, 'add column if not exists product_url text');
requireText(flexibleProductMigration, 'add column if not exists fabric_name text');
requireText(flexibleProductMigration, 'add column if not exists quality text');
requireText(flexibleProductMigration, 'add column if not exists product_type text');
requireText(flexibleProductMigration, 'add column if not exists unit_label text');
requireText(flexibleProductMigration, "'yard'::text,'farma'::text,'custom'::text");
requireText(flexibleProductMigration, 'check (char_length(trim(package_format)) between 1 and 160)');

requireText(webhook, "request.headers.get('x-hub-signature-256')");
requireText(webhook, "createHmac('sha256'");
requireText(webhook, 'timingSafeEqual');
requireText(webhook, 'after(async () =>');
requireText(webhook, 'WHATSAPP_APP_SECRET');
requireText(webhook, 'WHATSAPP_ACCESS_TOKEN');
requireText(webhook, 'WHATSAPP_VERIFY_TOKEN');
requireText(webhook, 'parseCatalogMessage');
requireText(webhook, "from('whatsapp_catalog_ingestions')");
requireText(webhook, "from(MEDIA_BUCKET)");
forbidText(webhook, 'WHATSAPP_ACCESS_TOKEN =');
forbidText(webhook, 'WHATSAPP_APP_SECRET =');
requireText(migration, "'seller-whatsapp-inbox'");
requireText(migration, 'ENABLE ROW LEVEL SECURITY');
requireText(migration, 'user_id = (SELECT auth.uid())');
requireText(inboxApi, ".eq('user_id', user.id)");
requireText(inboxApi, 'createSignedUrl');
requireText(inboxUi, 'WhatsApp → FabricTrad dashboard');

requireText(drapeRoute, "export { default } from './HybridVirtualDrapeStudio';");
requireText(drapeUi, 'inferDrapeProductStyle');
requireText(drapeUi, 'Detected from this seller listing');
requireText(drapeUi, 'InteractiveFabricMannequin3D');
requireText(drapeUi, 'Interactive 3D');
requireText(drapeUi, 'Try on my photo');
requireText(drapeUi, "setAvatarGender('woman')");
requireText(drapeUi, "setAvatarGender('man')");
requireText(drapeUi, 'Upload photo');
requireText(drapeUi, 'Use camera');
requireText(drapeUi, 'Generate AI try-on');
requireText(drapeUi, 'indexedDB.open');
requireText(drapeUi, 'productId: product.rawProductId');
requireText(drapeUi, 'variantId: product.selectedVariantId');
requireText(drapeUi, 'navigator.mediaDevices.getUserMedia');
requireText(drapeUi, 'drapeProductStyleApiId(productStyle)');
requireText(drapeUi, 'drapeProductStylePrompt(productStyle)');
forbidText(drapeUi, 'DEFAULT_MODEL_IMAGE');
forbidText(drapeUi, 'Studio model');
forbidText(drapeUi, 'Choose the garment');

requireText(drape3d, "export type DrapeAvatarGender = 'woman' | 'man'");
requireText(drape3d, "avatarGender === 'woman'");
requireText(drape3d, 'Human head + visible facial cues');
requireText(drape3d, "await import('three')");
requireText(drape3d, 'createClothShell');
requireText(drape3d, 'new THREE.CapsuleGeometry');
requireText(drape3d, 'pointerdown');
requireText(drape3d, 'wheel');
requireText(drape3d, '3D {avatarLabel} · drag 360°');
requireText(drape3d, 'Live seller textile mapped onto the selected human avatar');
forbidText(drape3d, 'around the mannequin');
requireText(drapeStyle, 'inferDrapeProductStyle');
requireText(drapeStyle, "return 'fabric'");

requireText(drapeApi, 'resolveListingFabric');
requireText(drapeApi, ".from('seller_products')");
requireText(drapeApi, ".from('seller_product_variants')");
requireText(drapeApi, ".from('seller_product_media')");
requireText(drapeApi, "p_feature: 'ai_drape'");
requireText(drapeApi, "fetch('https://api.openai.com/v1/images/edits'");
requireText(drapeApi, "form.append('image[]', person.blob");
requireText(drapeApi, "form.append('image[]', fabric.blob");
requireText(drapeApi, "mode: 'real_ai_image_try_on'");
forbidText(drapeUi, 'OPENAI_API_KEY');
forbidText(drapeUi, 'GEMINI_API_KEY');
requireText(legacyDrape, "export { default } from './HybridVirtualDrapeStudio';");
forbidText(legacyDrape, "blend: 'multiply'");

requireText(trialMigration, 'garment_glb');
requireText(trialMigration, 'garment_usdz');
requireText(trialMigration, 'fabric_texture');
requireText(trialStatus, "currentExperience: 'interactive_3d_human_avatar_plus_ai_personal_photo_try_on'");
requireText(trialStatus, 'interactiveThreeDHumanAvatar: true');
requireText(trialStatus, "avatarChoices: ['woman', 'man']");
requireText(trialStatus, "personalPhotoInput: ['upload', 'camera']");
requireText(trialStatus, "'procedural_webgl_human_avatar_live'");

requireText(pageContinuity, "document.addEventListener('visibilitychange'");
requireText(pageContinuity, "window.addEventListener('pagehide'");
requireText(pageContinuity, 'sessionStorage.setItem');
forbidText(pageContinuity, 'window.location.reload');
forbidText(pageContinuity, 'router.refresh');
requireText(authContext, "event === 'TOKEN_REFRESHED'");
requireText(authContext, 'must not re-fetch the whole profile');

requireText(manifest, "display: 'standalone'");
requireText(manifest, "start_url: '/'");
requireText(manifest, "categories: ['business', 'shopping', 'productivity']");
requireText(status, 'configured');
requireText(readiness, "fetch_json 'WhatsApp catalog readiness'");
requireText(readiness, 'WhatsApp forged-signature probe');
requireText(readiness, '/api/integrations/whatsapp/webhook');

if (failures.length) {
  console.error(`Mobile/WhatsApp verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.info('Mobile persistence, flexible seller catalogue, human 3D and personal-photo AI try-on verification passed.');
