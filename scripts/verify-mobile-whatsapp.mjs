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
const drapeApi = 'src/app/api/ai/drape-on/route.ts';
const drapeUi = 'src/app/product-detail/components/FlagshipVirtualDrapeStudio.tsx';
const drapeRoute = 'src/app/product-detail/components/ModernFabricDrapeViewer.tsx';
const legacyDrape = 'src/app/product-detail/components/FabricDrapeViewer.tsx';
const trialStatus = 'src/app/api/ai/trial-room/status/route.ts';
const drapeStyle = 'src/lib/drapeProductStyle.ts';
const pageContinuity = 'src/components/PageContinuity.tsx';
const authContext = 'src/contexts/AuthContext.tsx';
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
  drapeApi,
  drapeUi,
  drapeRoute,
  legacyDrape,
  trialStatus,
  drapeStyle,
  pageContinuity,
  authContext,
  manifest,
  readiness,
].forEach(read);

// Onboarding persistence and authenticated server restore.
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

// Seller catalogue draft persistence and flexible product fields.
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

// WhatsApp catalogue ingestion remains signed, asynchronous and seller-scoped.
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

// Flagship Virtual Drape must expose exactly two fully AI experiences.
requireText(drapeRoute, "export { default } from './FlagshipVirtualDrapeStudio';");
requireText(legacyDrape, "export { default } from './FlagshipVirtualDrapeStudio';");
requireText(drapeUi, "type SubjectMode = 'own_photo' | 'ai_model';");
requireText(drapeUi, "type ModelGender = 'woman' | 'man';");
requireText(drapeUi, 'Use my own photo');
requireText(drapeUi, 'AI-generated model');
requireText(drapeUi, "chooseMode('own_photo')");
requireText(drapeUi, "chooseMode('ai_model')");
requireText(drapeUi, 'Generate on my photo');
requireText(drapeUi, 'Generate on AI ${modelGender} model');
requireText(drapeUi, 'navigator.mediaDevices.getUserMedia');
requireText(drapeUi, 'productId: product.rawProductId');
requireText(drapeUi, 'variantId: product.selectedVariantId');
requireText(drapeUi, 'subjectMode,');
requireText(drapeUi, "modelGender: subjectMode === 'ai_model' ? modelGender : undefined");
requireText(drapeUi, "modelImage: subjectMode === 'own_photo' ? personImage : undefined");
requireText(drapeUi, 'drapeProductStyleApiId(productStyle)');
requireText(drapeUi, 'drapeProductStylePrompt(productStyle)');
requireText(drapeUi, 'OpenAI API connected');
requireText(drapeUi, 'Server key: connected securely');
requireText(drapeUi, 'API: {apiUsed');
forbidText(drapeUi, 'InteractiveFabricMannequin3D');
forbidText(drapeUi, 'Experimental 3D fabric preview');
forbidText(drapeUi, 'OPENAI_API_KEY');
forbidText(drapeUi, 'GEMINI_API_KEY');

// Server route must use live seller media and server-only AI credentials for both modes.
requireText(drapeApi, "type SubjectMode = 'own_photo' | 'ai_model';");
requireText(drapeApi, "type ModelGender = 'woman' | 'man';");
requireText(drapeApi, 'resolveListingFabric');
requireText(drapeApi, ".from('seller_products')");
requireText(drapeApi, ".from('seller_product_variants')");
requireText(drapeApi, ".from('seller_product_media')");
requireText(drapeApi, "p_feature: 'ai_drape'");
requireText(drapeApi, "fetch('https://api.openai.com/v1/images/edits'");
requireText(drapeApi, "headers: { Authorization: `Bearer ${apiKey}` }");
requireText(drapeApi, "subjectMode === 'own_photo'");
requireText(drapeApi, "subjectMode === 'ai_model'");
requireText(drapeApi, 'modelGender');
requireText(drapeApi, "subjectModes: ['own_photo', 'ai_model']");
requireText(drapeApi, "modelGenders: ['woman', 'man']");
requireText(drapeApi, "apiUsed: openAiConfigured ? 'OpenAI Images API'");
requireText(drapeApi, "credentialLocation: 'server_only'");
requireText(drapeApi, "mode: 'real_ai_image_try_on'");
requireText(drapeApi, 'usesListingMedia: true');
requireText(drapeApi, 'form.append(\'image[]\', person.blob');
requireText(drapeApi, 'form.append(\'image[]\', fabric.blob');
requireText(drapeApi, 'Create a new photorealistic adult ${modelGender} fashion model from scratch.');
requireText(drapeApi, 'Do not make a flat texture overlay, pasted photograph');
requireText(drapeStyle, 'inferDrapeProductStyle');
requireText(drapeStyle, "return 'fabric'");

// Trial-room status must describe the current AI experience accurately rather than the retired procedural 3D flagship.
requireText(trialStatus, "currentExperience: 'dual_ai_virtual_drape'");
requireText(trialStatus, "id: 'own_photo'");
requireText(trialStatus, "id: 'ai_model'");
requireText(trialStatus, "modelGenders: ['woman', 'man']");
requireText(trialStatus, "proceduralThreeDFlagship: false");
requireText(trialStatus, "credentialLocation: 'server_only'");

// Page continuity, token refresh and PWA behavior.
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
  console.error(`Mobile/WhatsApp/AI verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.info('Mobile persistence, flexible seller catalogue, WhatsApp ingestion and dual fully-AI Virtual Drape verification passed.');
