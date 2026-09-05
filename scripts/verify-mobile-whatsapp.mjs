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
const sellerCatalog = 'src/lib/whatsappSellerCatalog.ts';
const sellerContactApi = 'src/app/api/seller/contact-identity/route.ts';
const sellerCatalogIdentityMigration = 'supabase/migrations/20260904080000_seller_whatsapp_catalog_identity.sql';
const buyerSellerEditGuardMigration = 'supabase/migrations/20260904080500_buyer_profile_seller_identity_guard.sql';
const whatsappProvider = 'src/lib/gupshupWhatsApp.ts';
const whatsappV3 = 'src/lib/gupshupWebhookV3.ts';
const buyerAutomation = 'src/lib/whatsappBuyerAutomation.ts';
const bespokeFollowUps = 'src/lib/bespokeFollowUps.ts';
const bespokePaymentReconciliation = 'src/lib/server/bespokePaymentReconciliation.ts';
const razorpayWebhook = 'src/app/api/razorpay/webhook/route.ts';
const bespokePaymentVerify = 'src/app/api/bespoke/payment/verify/route.ts';
const bespokeAdminTransition = 'src/app/api/admin/bespoke/orders/[id]/transition/route.ts';
const bespokePaymentMigration = 'supabase/migrations/20260901020000_harden_bespoke_payment_webhooks.sql';
const bespokeIndexMigration = 'supabase/migrations/20260901020100_index_bespoke_whatsapp_foreign_keys.sql';
const whatsappIdentityMigration = 'supabase/migrations/20260901020200_unique_active_whatsapp_phone_identity.sql';
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
const publicLanding = 'src/app/components/PublicAccessLanding.tsx';
const header = 'src/components/Header.tsx';
const authContext = 'src/contexts/AuthContext.tsx';
const manifest = 'src/app/manifest.ts';
const readiness = '.github/workflows/integration-readiness.yml';
const productionDeploy = '.github/workflows/force-deploy-current-worker.yml';
const whatsappSync = '.github/workflows/sync-whatsapp-production.yml';
const environmentExample = '.env.example';

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
  sellerCatalog,
  sellerContactApi,
  sellerCatalogIdentityMigration,
  buyerSellerEditGuardMigration,
  whatsappProvider,
  whatsappV3,
  buyerAutomation,
  bespokeFollowUps,
  bespokePaymentReconciliation,
  razorpayWebhook,
  bespokePaymentVerify,
  bespokeAdminTransition,
  bespokePaymentMigration,
  bespokeIndexMigration,
  whatsappIdentityMigration,
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
  publicLanding,
  header,
  authContext,
  manifest,
  readiness,
  productionDeploy,
  whatsappSync,
  environmentExample,
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

// Seller catalogue ingestion accepts the live public Gupshup v3/v2 callback,
// gives an exact registered seller WhatsApp identity priority over buyer chat,
// requires the strict FabricTrad field format, and persists seller-scoped media/products.
requireText(webhook, 'isGupshupV3Webhook');
requireText(webhook, 'normalizeGupshupV3');
requireText(webhook, 'normalizeGupshupMessage');
requireText(webhook, 'MAX_WEBHOOK_BYTES');
requireText(webhook, 'readWebhookBody');
requireText(webhook, 'event.app !== expectedApp');
requireText(webhook, "event.type === 'message'");
requireText(webhook, 'event.payload?.destination');
requireText(webhook, "event.type === 'message-event' && event.payload?.source");
requireText(webhook, 'expectedSourceNumber: process.env.GUPSHUP_SOURCE_NUMBER');
requireText(webhook, 'expectedAppId: process.env.GUPSHUP_APP_ID');
requireText(webhook, 'after(async () =>');
requireText(webhook, 'enqueueSellerWhatsAppMessages');
requireText(webhook, 'processSellerWhatsAppQueue');
requireText(webhook, 'whatsappWebhookAuthorized');
requireText(webhook, 'GUPSHUP_WEBHOOK_SECRET');
forbidText(webhook, 'handleBuyerWhatsAppMessage');
requireText('src/lib/server/sellerWhatsappQueue.ts', 'tryHandleSellerCatalogMessage');
requireText('src/lib/commercePolicy.ts', 'BUYER_WHATSAPP_ENABLED = false');
requireText(buyerAutomation, 'if (!BUYER_WHATSAPP_ENABLED)');
requireText(bespokeFollowUps, 'if (!BUYER_WHATSAPP_ENABLED)');
requireText(sellerCatalog, 'SELLER_CATALOG_REQUIRED_FIELDS');
requireText(sellerCatalog, 'SELLER_CATALOG_OPTIONAL_FIELDS');
requireText(sellerCatalog, 'SELLER_CATALOG_FORMAT_MESSAGE');
requireText(sellerCatalog, 'parseSellerCatalogFormat');
requireText(sellerCatalog, 'validateSellerCatalogDraft');
requireText(sellerCatalog, "from('whatsapp_seller_catalog_sessions')");
requireText(sellerCatalog, "from('whatsapp_catalog_ingestions')");
requireText(sellerCatalog, "from('seller_products')");
requireText(sellerCatalog, "from('seller_product_media')");
requireText(sellerCatalog, "from(MEDIA_BUCKET).upload");
requireText(sellerCatalog, "onConflict: 'storage_path'");
requireText(sellerCatalog, "source: 'whatsapp'");
requireText(sellerCatalog, "status: merged.status || 'draft'");
requireText(sellerCatalog, 'duplicate_sku');
requireText(sellerCatalog, 'Nothing was added yet');
requireText(sellerCatalog, 'Send ONE product at a time');
requireText(sellerContactApi, 'seller_identity_conflicts');
requireText(sellerContactApi, 'Seller WhatsApp cannot be the same as the buyer/account phone/WhatsApp');
requireText(sellerCatalogIdentityMigration, 'whatsapp_seller_catalog_sessions');
requireText(sellerCatalogIdentityMigration, 'enforce_seller_buyer_identity_separation');
requireText(sellerCatalogIdentityMigration, 'seller_identity_conflicts');
requireText(buyerSellerEditGuardMigration, 'enforce_user_profile_seller_identity_separation');
requireText(whatsappProvider, 'https://api.gupshup.io/wa/api/v1/msg');
requireText(whatsappProvider, 'https://api.gupshup.io/wa/api/v1/template/msg');
requireText(whatsappProvider, "apikey: apiKey");
requireText(whatsappProvider, "host.endsWith('.gupshup.io')");
requireText(whatsappV3, 'expectedAppId');
requireText(whatsappV3, 'if (!result.appId) return result');
requireText(whatsappV3, 'displayNumber !== expectedSource');
requireText(buyerAutomation, 'sendGupshupText');
requireText(bespokeFollowUps, 'sendGupshupTemplate');
forbidText(webhook, 'graph.facebook.com');
forbidText(buyerAutomation, 'graph.facebook.com');
forbidText(bespokeFollowUps, 'graph.facebook.com');
requireText(inboxApi, ".eq('user_id', user.id)");
requireText(inboxApi, 'createSignedUrl');
requireText(inboxUi, 'WhatsApp → FabricTrad dashboard');
requireText(inboxUi, 'Open WhatsApp with FORMAT');
requireText(inboxUi, 'Predefined product format');
requireText(inboxUi, 'Save seller WhatsApp identity');

// Buyer WhatsApp routing is explicit, stateful and connected to the complete
// bespoke workflow without stealing dual-role seller catalogue uploads.
requireText(buyerAutomation, "menuChoice === '1'");
requireText(buyerAutomation, "menuChoice === '4'");
requireText(buyerAutomation, 'naturalCommand');
requireText(buyerAutomation, "text === '__STORE_MENU__'");
requireText(buyerAutomation, "typedProfile?.can_sell === true && !explicitBuyerIntent");
requireText(buyerAutomation, 'ambiguous_active_phone_identity');
requireText(buyerAutomation, "if (session) await admin.from('whatsapp_buyer_sessions').delete()");
requireText(buyerAutomation, "from('buyer_stores')");
requireText(buyerAutomation, "from('bespoke_orders')");
requireText(buyerAutomation, "from('bespoke_appointments')");
requireText(buyerAutomation, "from('bespoke_follow_up_jobs')");
requireText(buyerAutomation, "stage === 'balance_payment'");
requireText(buyerAutomation, "stage === 'delivery_or_pickup'");
requireText(buyerAutomation, "stage === 'review'");
requireText(buyerAutomation, 'Browse the live catalogue without losing your active custom order');
forbidText(publicLanding, 'whatsappStartUrl');
forbidText(publicLanding, 'wa.me');
requireText(header, "href: '/custom-order'");
requireText(header, "'/custom-order'");

// Follow-ups respect Meta's 24-hour customer-service window and use approved
// templates outside it.
requireText(bespokeFollowUps, 'CUSTOMER_WINDOW_MS');
requireText(bespokeFollowUps, 'customerWindowOpen');
requireText(bespokeFollowUps, 'templatePayload');
requireText(bespokeFollowUps, 'WHATSAPP_TEMPLATE_PAYMENT_REMINDER');
requireText(bespokeFollowUps, "job.job_type === 'delivery_update'");
requireText(bespokeFollowUps, 'stale_processing_claim_recovered');

// Bespoke payments reconcile from both the browser and Razorpay webhooks. The
// refund ledger and unique active-appointment index make provider retries safe.
requireText(razorpayWebhook, 'findBespokePaymentByOrder');
requireText(razorpayWebhook, 'recordBespokePaymentCapture');
requireText(razorpayWebhook, 'recordBespokePaymentFailure');
requireText(razorpayWebhook, 'recordBespokeRefund');
requireText(bespokePaymentVerify, 'recordBespokePaymentCapture');
requireText(bespokePaymentReconciliation, 'reconcileBespokeOrderPayments');
requireText(bespokePaymentReconciliation, "['captured', 'partially_refunded', 'refunded']");
requireText(bespokePaymentReconciliation, "currentStage === 'balance_payment' && fullyPaid");
requireText(bespokePaymentMigration, 'CREATE TABLE IF NOT EXISTS public.bespoke_refunds');
requireText(bespokePaymentMigration, 'razorpay_refund_id text NOT NULL UNIQUE');
requireText(bespokePaymentMigration, 'bespoke_appointments_one_active_type_idx');
requireText(bespokePaymentMigration, 'ENABLE ROW LEVEL SECURITY');
requireText(bespokeIndexMigration, 'bespoke_follow_up_jobs_order_idx');
requireText(bespokeIndexMigration, 'bespoke_refunds_user_idx');
requireText(bespokeIndexMigration, 'whatsapp_buyer_sessions_order_idx');
requireText(whatsappIdentityMigration, 'user_profiles_active_phone_identity_unique_idx');
requireText(bespokeAdminTransition, "String(order.stage) !== 'quotation'");
requireText(bespokeAdminTransition, "completedAppointmentExists('trial_fitting')");
requireText(bespokeAdminTransition, "completedAppointmentExists('alteration')");

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
requireText(drapeUi, 'AI preview available');
requireText(drapeUi, 'photoConsent:');
requireText(drapeUi, 'generationRef.current !== controller');
requireText(drapeApi, 'PHOTO_CONSENT_REQUIRED');
requireText(drapeApi, 'AI_QUOTA_UNAVAILABLE');
forbidText(drapeApi, 'fabrictrad_demo_role');
forbidText(drapeApi, 'readUsageCookie');
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
requireText(status, 'automationReady');
requireText(status, 'templatesReady');
requireText(status, 'WHATSAPP_TEMPLATE_POST_DELIVERY_FOLLOW_UP');
requireText(readiness, "fetch_json 'WhatsApp catalog readiness'");
requireText(readiness, 'WhatsApp public callback probe');
requireText(readiness, '/api/integrations/whatsapp/webhook');
requireText(productionDeploy, 'GUPSHUP_API_KEY');
requireText(productionDeploy, 'GUPSHUP_SOURCE_NUMBER');
forbidText(productionDeploy, 'WHATSAPP_ACCESS_TOKEN');
requireText(whatsappSync, 'GUPSHUP_API_KEY');
requireText(whatsappSync, 'GUPSHUP_SOURCE_NUMBER');
forbidText(whatsappSync, 'WHATSAPP_PHONE_NUMBER_ID');
requireText(environmentExample, 'GUPSHUP_API_KEY=');
requireText(environmentExample, 'GUPSHUP_SOURCE_NUMBER=917977286898');
forbidText(environmentExample, 'WHATSAPP_ACCESS_TOKEN=');

if (failures.length) {
  console.error(`Mobile/WhatsApp/AI verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.info('Mobile persistence, flexible seller catalogue, WhatsApp ingestion and dual fully-AI Virtual Drape verification passed.');
