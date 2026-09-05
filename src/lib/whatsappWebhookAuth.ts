import { timingSafeEqual } from 'node:crypto';

// Configure the same secret on the provider callback (header preferred, or
// webhook_token on its HTTPS callback URL). Public app/phone fields are not proof
// that a request came from the provider.
export function whatsappWebhookAuthorized(request: Request, secret: string | undefined) {
  if (!secret || secret.length < 32) return false;
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supplied = bearer || request.headers.get('x-fabrictrad-webhook-token') ||
    new URL(request.url).searchParams.get('webhook_token') || '';
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
