import { readLimitedBody } from '@/lib/limitedBody';

const GUPSHUP_MESSAGE_URL = 'https://api.gupshup.io/wa/api/v1/msg';
const GUPSHUP_TEMPLATE_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';

export const FABRICTRAD_GUPSHUP_APP_NAME = 'Fabrictrad';

const env = (name: string) => String(process.env[name] || '').trim();
const configuredAppName = () => env('GUPSHUP_APP_NAME') || FABRICTRAD_GUPSHUP_APP_NAME;

export const gupshupRuntimeConfig = {
  configured: Boolean(env('GUPSHUP_API_KEY') && configuredAppName() && env('GUPSHUP_SOURCE_NUMBER')),
  appNameConfigured: Boolean(configuredAppName()),
  appNameSource: env('GUPSHUP_APP_NAME') ? 'environment' : 'application_config',
  appIdConfigured: Boolean(env('GUPSHUP_APP_ID')),
  sourceNumberConfigured: Boolean(env('GUPSHUP_SOURCE_NUMBER')),
  wabaIdConfigured: Boolean(env('GUPSHUP_WABA_ID')),
};

const normalizeDestination = (value: unknown) => {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  if (!digits) return '';
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  return digits.slice(-15);
};

type GupshupSendResult = {
  status?: string;
  messageId?: string;
  message?: string;
};

async function postGupshupForm(
  url: string,
  destinationRaw: string,
  extra: Record<string, string>,
  appNameOverride?: string | null
) {
  const apiKey = env('GUPSHUP_API_KEY');
  const source = normalizeDestination(env('GUPSHUP_SOURCE_NUMBER'));
  const appName = String(appNameOverride || configuredAppName()).trim();
  const destination = normalizeDestination(destinationRaw);
  if (!apiKey || !source || !appName) throw new Error('gupshup_not_configured');
  if (!destination) throw new Error('gupshup_destination_invalid');

  const body = new URLSearchParams({
    channel: 'whatsapp',
    source,
    destination,
    'src.name': appName,
    ...extra,
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response) throw new Error('gupshup_provider_unreachable');
  const payload = (await response.json().catch(() => ({}))) as GupshupSendResult;
  const messageId = String(payload.messageId || '').trim();
  const status = String(payload.status || '').trim().toLowerCase();
  if (!response.ok || status !== 'submitted' || !messageId) {
    throw new Error(
      String(payload.message || `gupshup_provider_${response.status || 0}_${status || 'invalid'}`).slice(0, 1000)
    );
  }
  return { sent: true as const, messageId, status: 'submitted' as const };
}

export async function sendGupshupText(
  destination: string,
  text: string,
  previewUrl = true,
  appNameOverride?: string | null
) {
  return postGupshupForm(
    GUPSHUP_MESSAGE_URL,
    destination,
    {
      message: JSON.stringify({
        type: 'text',
        text: text.slice(0, 4096),
        previewUrl,
      }),
    },
    appNameOverride
  );
}

export async function sendGupshupTemplate(
  destination: string,
  templateId: string,
  parameters: string[],
  appNameOverride?: string | null
) {
  const id = String(templateId || '').trim();
  if (!id) throw new Error('gupshup_template_id_missing');
  return postGupshupForm(
    GUPSHUP_TEMPLATE_URL,
    destination,
    {
      template: JSON.stringify({
        id,
        params: parameters.map((value) => String(value).slice(0, 1024)),
      }),
    },
    appNameOverride
  );
}

const isAllowedMediaUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && (host === 'gupshup.io' || host.endsWith('.gupshup.io'));
  } catch {
    return false;
  }
};

export async function downloadGupshupMedia(mediaUrl: string, maxBytes: number) {
  if (!isAllowedMediaUrl(mediaUrl)) throw new Error('gupshup_media_url_invalid');
  let currentUrl = mediaUrl;
  let response: Response | null = null;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    if (!isAllowedMediaUrl(currentUrl)) throw new Error('gupshup_media_redirect_invalid');
    response = await fetch(currentUrl, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('gupshup_media_redirect_missing');
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    break;
  }

  if (!response || [301, 302, 303, 307, 308].includes(response.status)) {
    throw new Error('gupshup_media_redirect_limit');
  }
  if (!response.ok) throw new Error(`gupshup_media_download_${response.status}`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new Error('media_too_large');
  const bytes = await readLimitedBody(response.body, Math.min(maxBytes, 20 * 1024 * 1024));
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!buffer.length || buffer.length > maxBytes) throw new Error('media_too_large');
  const mime = String(response.headers.get('content-type') || 'application/octet-stream')
    .split(';')[0]
    .trim()
    .toLowerCase();
  return { buffer, mime };
}
