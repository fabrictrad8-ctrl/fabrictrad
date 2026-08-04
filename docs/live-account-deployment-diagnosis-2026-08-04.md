# FabricTrad live account deployment diagnosis

Date: 2026-08-04

## What was tested

The production custom domain `https://fabrictrad.com` was tested from GitHub-hosted runners rather than inferred from a local build.

Public pages returned HTTP 200:

- `/`
- `/login`
- `/buyer-registration`
- `/seller-registration`
- `/account`

The account-lifecycle APIs that exist in the current `main` source all returned the Next.js HTML 404 page in production:

- `POST /api/auth/password-login`
- `GET /api/auth/session-destination`
- `GET /api/account/onboarding-draft?flow=buyer`
- `PUT /api/account/onboarding-draft`
- `POST /api/account/delete/request`
- `POST /api/account/delete/confirm`

A second production verification checked the four key APIs 60 times over ten minutes. Every request remained HTTP 404. This proves the custom domain is serving an older Worker build that predates the account-lifecycle routes.

## Deployment diagnosis

A push-context GitHub status check tested whether `CLOUDFLARE_API_TOKEN` was available without printing or exposing its value. The status was:

- `fabrictrad/cloudflare-deploy-credentials`: `failure`
- reason: `CLOUDFLARE_API_TOKEN` is missing from repository Actions secrets

The Cloudflare account ID is now configured directly in the deployment workflow because an account ID is not an authentication secret. The remaining required credential is the Cloudflare API token.

## Repairs already committed

- Added a force-deploy workflow that builds the current OpenNext Worker, deploys it with Wrangler and verifies the production account APIs.
- Added production DNS and custom-domain diagnostics.
- Added continuous live checks for password login, session destination, resumable onboarding drafts and account deletion authorization.
- Preserved the known Cloudflare account ID `aa4ff7a482130e543f176e2d73c93f45` in the deploy workflow.
- Left PR #78 open as the post-deployment production verification gate.

## Remaining external dependency

Restore the repository Actions secret named `CLOUDFLARE_API_TOKEN`, then run the workflow named **Force deploy current FabricTrad Worker**. The workflow will deploy current `main` and will not pass until the real production account endpoints return their expected authentication responses.
