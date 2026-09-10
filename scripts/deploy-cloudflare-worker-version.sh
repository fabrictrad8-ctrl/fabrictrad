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
# Deliberately non-fatal. A CI token without Workers Scripts:Edit for triggers
# must not fail a release whose code deployed correctly — but it must be loud,
# because the failure mode is invisible in production.
echo 'Registering Worker triggers (cron schedules) from the config.'
if npx wrangler triggers deploy --config "$config" 2>&1 | tee /tmp/fabrictrad-triggers-deploy.log; then
  echo 'Worker cron schedules registered.'
else
  echo '::warning::Could not register Worker cron schedules. Scheduled jobs (WhatsApp retries, bespoke follow-ups, invoice email retries) may not run. Check the CI token permissions, then run: npx wrangler triggers deploy'
fi
