import { createAdminClient } from '@/lib/supabase/admin';
import { tryHandleSellerCatalogMessage } from '@/lib/whatsappSellerCatalog';
import { sendGupshupText } from '@/lib/gupshupWhatsApp';
import { SELLER_WHATSAPP_ONLY_MESSAGE } from '@/lib/commercePolicy';

export type WhatsAppMessage = {
  id?: string;
  appName?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
  video?: { id?: string; caption?: string; mime_type?: string };
  document?: { id?: string; caption?: string; filename?: string; mime_type?: string };
};

const extractText = (message: WhatsAppMessage) => {
  if (message.type === 'text') return String(message.text?.body || '').trim();
  if (message.type === 'image') return String(message.image?.caption || '').trim();
  if (message.type === 'video') return String(message.video?.caption || '').trim();
  if (message.type === 'document') return String(message.document?.caption || '').trim();
  return '';
};

const extractMedia = (message: WhatsAppMessage) => {
  if (message.type === 'image' && message.image?.id) {
    return { id: message.image.id, mime: message.image.mime_type || 'image/jpeg' };
  }
  if (message.type === 'video' && message.video?.id) {
    return { id: message.video.id, mime: message.video.mime_type || 'video/mp4' };
  }
  if (message.type === 'document' && message.document?.id) {
    return { id: message.document.id, mime: message.document.mime_type || 'application/pdf' };
  }
  return null;
};

async function acknowledgeSeller(
  to: string,
  text: string,
  appNameOverride?: string | null
) {
  try {
    await sendGupshupText(to, text, false, appNameOverride);
    return true;
  } catch (error) {
    console.error('Seller WhatsApp acknowledgement failed', {
      code: error instanceof Error ? error.message : 'provider_error',
    });
    return false;
  }
}

async function ingestSellerMessage(message: WhatsAppMessage): Promise<boolean> {
  const media = extractMedia(message);
  const result = await tryHandleSellerCatalogMessage({
    id: String(message.id || '').trim(),
    from: String(message.from || '').trim(),
    appName: message.appName || null,
    type: String(message.type || 'unknown'),
    text: extractText(message),
    mediaUrl: media?.id || null,
    mediaMimeType: media?.mime || null,
  });
  return result.handled;
}

async function processMessage(message: WhatsAppMessage) {
  // No buyer automation or buyer account provisioning runs on this number.
  const sellerHandled = await ingestSellerMessage(message);
  if (sellerHandled) return;
  await acknowledgeSeller(String(message.from || ''), SELLER_WHATSAPP_ONLY_MESSAGE, message.appName);
}


export async function enqueueSellerWhatsAppMessages(messages: WhatsAppMessage[]) {
  if (!messages.length) return;
  const { error } = await createAdminClient().from('seller_whatsapp_jobs').upsert(
    messages.map((message) => ({ message_id: message.id, sender: message.from, payload: message })),
    { onConflict: 'message_id', ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function processSellerWhatsAppQueue(messageId?: string) {
  const admin = createAdminClient();
  let processed = 0;
  for (let index = 0; index < (messageId ? 1 : 5); index += 1) {
    const { data: job, error: claimError } = await admin.rpc('claim_seller_whatsapp_job', { p_message_id: messageId || null });
    if (claimError) throw claimError;
    if (!job) break;
    try {
      await processMessage(job.payload as WhatsAppMessage);
      const { error } = await admin.from('seller_whatsapp_jobs')
        .update({ status: 'completed', locked_until: null, last_error: null, updated_at: new Date().toISOString() })
        .eq('message_id', job.message_id).eq('attempts', job.attempts);
      if (error) throw error;
      processed += 1;
    } catch (error) {
      const { error: storeError } = await admin.from('seller_whatsapp_jobs').update({
        status: 'failed', locked_until: null,
        last_error: (error instanceof Error ? error.message : 'Processing failed').slice(0, 1000),
        next_attempt_at: new Date(Date.now() + 60_000 * Math.pow(2, job.attempts)).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('message_id', job.message_id).eq('attempts', job.attempts);
      if (storeError) throw storeError;
    }
  }
  return { processed };
}
