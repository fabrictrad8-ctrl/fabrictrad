from pathlib import Path
import re

path = Path('scripts/verify-mobile-whatsapp.mjs')
text = path.read_text()

anchor = "const webhook = 'src/app/api/integrations/whatsapp/webhook/route.ts';\n"
addition = """const webhook = 'src/app/api/integrations/whatsapp/webhook/route.ts';
const sellerCatalog = 'src/lib/whatsappSellerCatalog.ts';
const sellerContactApi = 'src/app/api/seller/contact-identity/route.ts';
const sellerCatalogIdentityMigration = 'supabase/migrations/20260904080000_seller_whatsapp_catalog_identity.sql';
const buyerSellerEditGuardMigration = 'supabase/migrations/20260904080500_buyer_profile_seller_identity_guard.sql';
"""
if "const sellerCatalog = 'src/lib/whatsappSellerCatalog.ts';" not in text:
    if anchor not in text:
        raise SystemExit('Webhook constant anchor missing in WhatsApp verifier.')
    text = text.replace(anchor, addition, 1)

old_pattern = re.compile(
    r"// WhatsApp catalogue ingestion uses Gupshup v2 callbacks, a private shared\n"
    r"// header, asynchronous processing and seller-scoped persistence\..*?"
    r"requireText\(inboxUi, 'SELLER CATALOG UPLOAD'\);",
    re.S,
)
new_block = """// Seller catalogue ingestion accepts the live public Gupshup v3/v2 callback,
// gives an exact registered seller WhatsApp identity priority over buyer chat,
// requires the strict FabricTrad field format, and persists seller-scoped media/products.
requireText(webhook, 'isGupshupV3Webhook');
requireText(webhook, 'normalizeGupshupV3');
requireText(webhook, 'normalizeGupshupMessage');
requireText(webhook, 'after(async () =>');
requireText(webhook, 'tryHandleSellerCatalogMessage');
requireText(webhook, 'sellerHandled = await ingestSellerMessage');
requireText(webhook, 'if (sellerHandled) return');
forbidText(webhook, "request.headers.get('x-fabrictrad-webhook-token')");
forbidText(webhook, 'GUPSHUP_WEBHOOK_SECRET');
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
requireText(inboxUi, 'Save seller WhatsApp identity');"""

text, count = old_pattern.subn(new_block, text, count=1)
if count != 1:
    raise SystemExit(f'Expected one legacy seller WhatsApp verifier block, found {count}.')

# Current Gupshup webhook is intentionally public and acknowledges with an empty 204.
text = text.replace(
    "requireText(readiness, 'WhatsApp forged-token probe');",
    "requireText(readiness, 'WhatsApp public callback probe');",
)

# Ensure the newly required resources are included in the read/existence sweep.
needle = "  webhook,\n"
insert = "  webhook,\n  sellerCatalog,\n  sellerContactApi,\n  sellerCatalogIdentityMigration,\n  buyerSellerEditGuardMigration,\n"
if "  sellerCatalog,\n" not in text:
    if needle not in text:
        raise SystemExit('Verifier resource sweep anchor missing.')
    text = text.replace(needle, insert, 1)

path.write_text(text)
print('WhatsApp regression verifier aligned with strict seller FORMAT flow and public callback.')
