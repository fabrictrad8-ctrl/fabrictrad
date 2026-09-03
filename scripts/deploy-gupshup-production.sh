#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://fabrictrad.com"
WEBHOOK_PATH="/api/integrations/whatsapp/webhook"

: "${GUPSHUP_SOURCE_NUMBER:=917977286898}"
export GUPSHUP_SOURCE_NUMBER

required=(CLOUDFLARE_API_TOKEN GUPSHUP_API_KEY GUPSHUP_SOURCE_NUMBER)
missing=0
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "::error::Required deployment value ${name} is missing."
    missing=1
  else
    echo "${name}=present"
  fi
done
[ "$missing" -eq 0 ]

if grep -q 'x-fabrictrad-webhook-token' src/app/api/integrations/whatsapp/webhook/route.ts; then
  echo '::error::Private callback token remains in the Gupshup webhook.'
  exit 1
fi
grep -q 'export async function GET()' src/app/api/integrations/whatsapp/webhook/route.ts
grep -q 'return noContent()' src/app/api/integrations/whatsapp/webhook/route.ts
grep -q 'processDeliveryEvent' src/app/api/integrations/whatsapp/webhook/route.ts

echo 'Installing dependencies...'
npm install --no-audit --no-fund --package-lock=false --legacy-peer-deps

echo 'Type-checking...'
npm run type-check

echo 'Linting Gupshup runtime...'
npx eslint \
  src/lib/gupshupWhatsApp.ts \
  src/lib/whatsappBuyerAutomation.ts \
  src/lib/bespokeFollowUps.ts \
  src/app/api/integrations/whatsapp/webhook/route.ts \
  src/app/api/whatsapp/status/route.ts

echo 'Building Cloudflare/OpenNext Worker...'
npm run build:sites
test -s .open-next/worker.js
grep -q 'GUPSHUP_API_KEY' .open-next/worker.js
grep -q 'api.gupshup.io' .open-next/worker.js

put_secret() {
  local name="$1"
  local value="${!name:-}"
  if [ -n "$value" ]; then
    printf '%s' "$value" | npx wrangler secret put "$name" >/dev/null
    echo "${name}=synced"
  fi
}

put_secret GUPSHUP_API_KEY
put_secret GUPSHUP_APP_NAME
put_secret GUPSHUP_SOURCE_NUMBER
put_secret GUPSHUP_WABA_ID
put_secret WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER
put_secret WHATSAPP_TEMPLATE_PAYMENT_REMINDER
put_secret WHATSAPP_TEMPLATE_TRIAL_REMINDER
put_secret WHATSAPP_TEMPLATE_DELIVERY_UPDATE
put_secret WHATSAPP_TEMPLATE_REVIEW_REQUEST
put_secret WHATSAPP_TEMPLATE_POST_DELIVERY_FOLLOW_UP

npx wrangler secret list > /tmp/fabrictrad-cloudflare-secrets.json
python3 - <<'PY'
import json
with open('/tmp/fabrictrad-cloudflare-secrets.json', encoding='utf-8') as handle:
    payload = json.load(handle)
names = {str(item.get('name', '')) for item in payload if isinstance(item, dict)}
required = {'GUPSHUP_API_KEY', 'GUPSHUP_SOURCE_NUMBER'}
missing = sorted(required - names)
if missing:
    raise SystemExit('Missing required Cloudflare bindings: ' + ', '.join(missing))
print('Required callback/runtime Gupshup bindings verified.')
PY

echo 'Deploying FabricTrad Worker...'
npx wrangler deploy

echo 'Waiting for production propagation...'
sleep 12

for attempt in 1 2 3 4 5 6; do
  status_code=$(curl -sS --connect-timeout 10 --max-time 30 -o /tmp/fabrictrad-wa-status.json -w '%{http_code}' "$BASE_URL/api/whatsapp/status" || true)
  get_code=$(curl -sS --connect-timeout 10 --max-time 30 -o /tmp/fabrictrad-wa-get.out -w '%{http_code}' "$BASE_URL$WEBHOOK_PATH" || true)
  post_code=$(curl -sS --connect-timeout 10 --max-time 30 -o /tmp/fabrictrad-wa-post.out -w '%{http_code}' -H 'Content-Type: application/json' --data '{"type":"user-event","version":2,"app":"__fabrictrad_registration_probe__","payload":{"type":"sandbox-start"}}' "$BASE_URL$WEBHOOK_PATH" || true)

  echo "Live check ${attempt}: status=${status_code}; webhook GET=${get_code}; webhook POST=${post_code}"
  if [ "$status_code" = '200' ] \
    && [ "$get_code" = '204' ] \
    && [ "$post_code" = '204' ] \
    && [ ! -s /tmp/fabrictrad-wa-get.out ] \
    && [ ! -s /tmp/fabrictrad-wa-post.out ] \
    && grep -q '"provider":"gupshup"' /tmp/fabrictrad-wa-status.json \
    && grep -q '"webhookReady":true' /tmp/fabrictrad-wa-status.json; then
    echo "GUPSHUP_WEBHOOK_LIVE=${BASE_URL}${WEBHOOK_PATH}"
    exit 0
  fi
  sleep 10
done

cat /tmp/fabrictrad-wa-status.json || true
echo
echo '::error::Production Gupshup callback did not become registration-ready.'
exit 1
