#!/usr/bin/env bash
set -euo pipefail

config="${1:-wrangler.jsonc}"
output="${WRANGLER_OUTPUT_FILE_PATH:-/tmp/fabrictrad-wrangler-output.ndjson}"
rm -f "$output"

# FabricTrad's production hostnames are already attached to the `fabrictrad`
# Worker in Cloudflare. Uploading a version and promoting it changes production
# traffic without requiring Zone > Workers Routes permissions on the CI token.
export WRANGLER_OUTPUT_FILE_PATH="$output"

npx wrangler versions upload --config "$config" --keep-vars 2>&1 | tee /tmp/fabrictrad-version-upload.log

version_id=$(node - "$output" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
if (!fs.existsSync(path)) process.exit(2);
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);
let versionId = '';
for (const line of lines) {
  try {
    const event = JSON.parse(line);
    if (event && (event.type === 'version-upload' || event.type === 'deploy') && event.version_id) {
      versionId = String(event.version_id);
    }
  } catch {
    // Ignore non-JSON lines; Wrangler's output file is expected to be NDJSON.
  }
}
if (!versionId) process.exit(3);
process.stdout.write(versionId);
NODE
)

if [ -z "$version_id" ]; then
  echo '::error::Wrangler uploaded the Worker but did not report a version ID.'
  exit 1
fi

echo "Promoting Worker version ${version_id} to 100% of production traffic."
npx wrangler versions deploy "${version_id}@100%" --config "$config" --yes 2>&1 | tee /tmp/fabrictrad-version-deploy.log

# Prove the active deployment references the version we just promoted.
npx wrangler deployments status --config "$config" --json > /tmp/fabrictrad-deployment-status.json
node - "$version_id" <<'NODE'
const fs = require('node:fs');
const expected = process.argv[2];
const raw = fs.readFileSync('/tmp/fabrictrad-deployment-status.json', 'utf8');
const status = JSON.parse(raw);
const serialized = JSON.stringify(status);
if (!serialized.includes(expected)) {
  console.error(`Active deployment does not reference promoted version ${expected}.`);
  process.exit(1);
}
console.log(`Active deployment includes ${expected}.`);
NODE

# `wrangler versions upload` and `versions deploy` publish code only. Cron
# schedules and routes are Worker *settings*, and the versions API does not
# touch them — so the `triggers.crons` entry in wrangler.jsonc reaches
# production only through `wrangler deploy` or this command. Every scheduled
# job the Worker runs (the seller WhatsApp retry queue, bespoke follow-ups and
# the undelivered-invoice email sweep) is silently dead if the schedule was
# never registered, and nothing in the release output would say so.
#
# Idempotent: re-registering an unchanged schedule is a no-op.
#
# `wrangler triggers deploy` cannot do this job. It applies routes AND cron
# schedules in one command, and its first call is to the zone-scoped
# /zones/<zone>/workers/routes endpoint, which this CI token may not touch —
# the same "Authentication error [code: 10000]" that made this script switch to
# `versions upload` in the first place. It aborts there and never reaches the
# schedules, so no cron is ever registered.
#
# Cron schedules are account-scoped, so write them directly. The token already
# proved it holds account-level Workers Scripts edit rights by uploading and
# promoting the version above. Routes need no action here: both custom domains
# are already attached to this Worker.
#
# Deliberately non-fatal: the code is live by this point and failing the step
# would not roll it back. But it must be loud, and it must report what is
# ACTUALLY registered rather than assuming the write took — a silently missing
# cron is how three scheduled jobs went unnoticed for nine days.
crons=$(node - "$config" <<'NODE'
const fs = require('node:fs');
const raw = fs.readFileSync(process.argv[2], 'utf8');
const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
process.stdout.write(JSON.stringify((JSON.parse(stripped).triggers || {}).crons || []));
NODE
)
script_name=$(node - "$config" <<'NODE'
const fs = require('node:fs');
const raw = fs.readFileSync(process.argv[2], 'utf8');
const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
process.stdout.write(JSON.parse(stripped).name);
NODE
)

if [ "$crons" = "[]" ] || [ -z "$crons" ]; then
  echo "No cron triggers declared in ${config}; skipping schedule registration."
elif [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ] || [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo '::warning::CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is unset; Worker cron schedules were not registered.'
else
  schedules_api="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${script_name}/schedules"
  body=$(node -e 'process.stdout.write(JSON.stringify(JSON.parse(process.argv[1]).map(cron => ({ cron }))))' "$crons")
  echo "Registering Worker cron schedules ${crons} on ${script_name}."
  if curl --silent --show-error --fail --request PUT "$schedules_api" \
      --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      --header 'Content-Type: application/json' \
      --data "$body" > /tmp/fabrictrad-schedules-put.json; then
    echo 'Cron schedule write accepted.'
  else
    echo '::warning::Could not register Worker cron schedules. Scheduled jobs (WhatsApp retries, bespoke follow-ups, invoice email retries) will not run.'
  fi

  # Read the schedules back. This is the only line in the release that proves a
  # cron exists; never infer it from the PUT's exit status.
  if curl --silent --show-error --fail "$schedules_api" \
      --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" > /tmp/fabrictrad-schedules-get.json; then
    active=$(node -e 'const d=require("/tmp/fabrictrad-schedules-get.json");process.stdout.write(JSON.stringify(((d.result && d.result.schedules) || []).map(s => s.cron)))')
    echo "Cron schedules currently active on ${script_name}: ${active}"
    if [ "$active" = "[]" ]; then
      echo '::warning::Cloudflare reports NO active cron schedules on this Worker. Scheduled jobs are not running.'
    fi
  else
    echo '::warning::Could not read back Worker cron schedules; registration is unverified.'
  fi
fi
