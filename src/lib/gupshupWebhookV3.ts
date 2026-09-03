export type NormalizedWhatsAppMessage = {
  id?: string;
  appName?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
  video?: { id?: string; caption?: string; mime_type?: string };
  document?: { id?: string; caption?: string; filename?: string; mime_type?: string };
};

export type NormalizedGupshupDeliveryEvent = {
  app?: string;
  timestamp?: number;
  version?: number;
  type: 'message-event';
  payload: {
    id?: string;
    gsId?: string;
    source?: string;
    destination?: string;
    type?: string;
    payload?: {
      whatsappMessageId?: string;
      code?: string | number;
      reason?: string;
    };
  };
};

type NormalizeOptions = {
  appName?: string;
  expectedSourceNumber?: string;
};

type NormalizedV3Webhook = {
  appId: string | null;
  messages: NormalizedWhatsAppMessage[];
  deliveryEvents: NormalizedGupshupDeliveryEvent[];
};

const DELIVERY_STATES = new Set(['enqueued', 'failed', 'sent', 'delivered', 'read', 'deleted']);

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const stringValue = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value
        .map(record)
        .filter((item): item is Record<string, unknown> => item !== null)
    : [];
const digits = (value: unknown) => stringValue(value).replace(/\D/g, '');

const epochMs = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return Date.now();
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
};

const normalizedMedia = (
  message: Record<string, unknown>,
  key: 'image' | 'video' | 'document'
) => {
  const media = record(message[key]);
  if (!media) return null;
  const url = stringValue(media.url);
  const id = url || stringValue(media.id);
  if (!id) return null;
  return {
    id,
    caption: stringValue(media.caption) || undefined,
    mime_type: stringValue(media.mime_type) || undefined,
    filename: stringValue(media.filename) || undefined,
  };
};

const interactiveText = (message: Record<string, unknown>) => {
  const interactive = record(message.interactive);
  if (interactive) {
    const buttonReply = record(interactive.button_reply);
    const listReply = record(interactive.list_reply);
    const reply = buttonReply || listReply;
    if (reply) return stringValue(reply.title) || stringValue(reply.id);
  }
  const button = record(message.button);
  if (button) return stringValue(button.text) || stringValue(button.payload);
  return '';
};

const normalizeMessage = (
  message: Record<string, unknown>,
  appName: string
): NormalizedWhatsAppMessage | null => {
  const id = stringValue(message.id);
  const from = stringValue(message.from);
  if (!id || !from) return null;

  const type = stringValue(message.type).toLowerCase();
  const common = { id, from, appName: appName || undefined };

  if (type === 'text') {
    const text = record(message.text);
    return { ...common, type: 'text', text: { body: stringValue(text?.body) } };
  }

  if (type === 'image') {
    const media = normalizedMedia(message, 'image');
    return media
      ? {
          ...common,
          type: 'image',
          image: {
            id: media.id,
            caption: media.caption,
            mime_type: media.mime_type || 'image/jpeg',
          },
        }
      : { ...common, type: 'image' };
  }

  if (type === 'video') {
    const media = normalizedMedia(message, 'video');
    return media
      ? {
          ...common,
          type: 'video',
          video: {
            id: media.id,
            caption: media.caption,
            mime_type: media.mime_type || 'video/mp4',
          },
        }
      : { ...common, type: 'video' };
  }

  if (type === 'document') {
    const media = normalizedMedia(message, 'document');
    return media
      ? {
          ...common,
          type: 'document',
          document: {
            id: media.id,
            caption: media.caption,
            filename: media.filename,
            mime_type: media.mime_type || 'application/octet-stream',
          },
        }
      : { ...common, type: 'document' };
  }

  if (type === 'interactive' || type === 'button') {
    return { ...common, type: 'text', text: { body: interactiveText(message) } };
  }

  return { ...common, type: type || 'unknown' };
};

const normalizeDeliveryEvent = (
  status: Record<string, unknown>,
  appName: string
): NormalizedGupshupDeliveryEvent | null => {
  const state = (stringValue(status.status) || stringValue(status.type)).toLowerCase();
  if (!DELIVERY_STATES.has(state)) return null;

  const whatsappMessageId = stringValue(status.id);
  const providerMessageId = stringValue(status.gs_id) || stringValue(status.gsId);
  if (!whatsappMessageId && !providerMessageId) return null;

  const errors = records(status.errors);
  const firstError = errors[0] || null;
  const code = firstError?.code ?? status.code;
  const reason =
    stringValue(firstError?.title) ||
    stringValue(firstError?.message) ||
    stringValue(status.reason) ||
    undefined;

  return {
    app: appName || undefined,
    timestamp: epochMs(status.timestamp),
    version: 2,
    type: 'message-event',
    payload: {
      id: whatsappMessageId || providerMessageId,
      gsId: providerMessageId || undefined,
      type: state,
      payload: {
        whatsappMessageId: whatsappMessageId || undefined,
        code: code as string | number | undefined,
        reason,
      },
    },
  };
};

export const isGupshupV3Webhook = (value: unknown) => {
  const root = record(value);
  return root?.object === 'whatsapp_business_account' && Array.isArray(root.entry);
};

export function normalizeGupshupV3(
  value: unknown,
  options: NormalizeOptions = {}
): NormalizedV3Webhook {
  const root = record(value);
  const result: NormalizedV3Webhook = {
    appId: root ? stringValue(root.gs_app_id) || null : null,
    messages: [],
    deliveryEvents: [],
  };
  if (!root || root.object !== 'whatsapp_business_account') return result;

  const expectedSource = digits(options.expectedSourceNumber);
  const appName = stringValue(options.appName);

  for (const entry of records(root.entry)) {
    for (const change of records(entry.changes)) {
      if (stringValue(change.field) !== 'messages') continue;
      const changeValue = record(change.value);
      if (!changeValue || stringValue(changeValue.messaging_product) !== 'whatsapp') continue;

      const metadata = record(changeValue.metadata);
      const displayNumber = digits(metadata?.display_phone_number);
      if (expectedSource && displayNumber && displayNumber !== expectedSource) continue;

      for (const message of records(changeValue.messages)) {
        const normalized = normalizeMessage(message, appName);
        if (normalized) result.messages.push(normalized);
      }

      for (const status of records(changeValue.statuses)) {
        const normalized = normalizeDeliveryEvent(status, appName);
        if (normalized) result.deliveryEvents.push(normalized);
      }
    }
  }

  return result;
}
