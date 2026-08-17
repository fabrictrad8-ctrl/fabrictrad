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
const webhook = 'src/app/api/whatsapp/webhook/route.ts';
const status = 'src/app/api/whatsapp/status/route.ts';
const inboxApi = 'src/app/api/whatsapp/catalog-inbox/route.ts';
const inboxUi = 'src/app/seller-dashboard/components/WhatsAppCatalogPanel.tsx';
const migration = 'supabase/migrations/20260817143000_whatsapp_catalog_ingestion.sql';
const readiness = '.github/workflows/integration-readiness.yml';

[
  onboarding,
  webhook,
  status,
  inboxApi,
  inboxUi,
  migration,
  readiness,
].forEach(read);

// Onboarding must survive app backgrounding, gallery/file picker switches and
// mobile tab eviction without waiting for the debounce timer.
requireText(onboarding, "document.addEventListener('visibilitychange'");
requireText(onboarding, "window.addEventListener('pagehide'");
requireText(onboarding, 'keepalive');
requireText(onboarding, 'window.localStorage.setItem');
requireText(onboarding, 'window.sessionStorage.setItem');
requireText(onboarding, 'saveNow(true)');

// Meta webhook verification and incoming messages must never trust unsigned
// internet requests or expose provider credentials in the browser.
requireText(webhook, "request.headers.get('x-hub-signature-256')");
requireText(webhook, "createHmac('sha256'");
requireText(webhook, 'timingSafeEqual');
requireText(webhook, 'WHATSAPP_APP_SECRET');
requireText(webhook, 'WHATSAPP_ACCESS_TOKEN');
requireText(webhook, 'WHATSAPP_VERIFY_TOKEN');
requireText(webhook, 'parseCatalogMessage');
requireText(webhook, "from('whatsapp_catalog_ingestions')");
requireText(webhook, "from('seller-whatsapp-inbox')");
forbidText(webhook, 'WHATSAPP_ACCESS_TOKEN =');
forbidText(webhook, 'WHATSAPP_APP_SECRET =');

// Inbox media is private and dashboard rows are scoped to the authenticated
// seller; the seller cannot forge ingestion records through RLS.
requireText(migration, "'seller-whatsapp-inbox'");
requireText(migration, 'false,');
requireText(migration, 'ENABLE ROW LEVEL SECURITY');
requireText(migration, 'user_id = (SELECT auth.uid())');
requireText(migration, 'GRANT SELECT ON TABLE public.whatsapp_catalog_ingestions TO authenticated');
forbidText(migration, 'GRANT INSERT ON TABLE public.whatsapp_catalog_ingestions TO authenticated');
requireText(inboxApi, "eq('user_id', user.id)");
requireText(inboxApi, 'createSignedUrl');
requireText(inboxUi, 'WhatsApp → FabricTrad dashboard');
requireText(inboxUi, '/api/whatsapp/catalog-inbox');
requireText(inboxUi, '/api/whatsapp/status');

// Production readiness must continuously tell us whether the external Meta
// number/credentials have actually been connected.
requireText(status, 'configured');
requireText(readiness, "fetch_json 'WhatsApp catalog readiness'");
requireText(readiness, 'WhatsApp forged-signature probe');

if (failures.length) {
  console.error(`Mobile/WhatsApp verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.info('Mobile persistence and WhatsApp ingestion verification passed.');
