'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';

type ParsedVariant = {
  colorName?: string;
  designName?: string;
  pricePerUnit?: number;
  availableQuantity?: number;
  unit?: string;
};

type ParsedDraft = {
  name?: string;
  category?: string;
  pricePerUnit?: number;
  availableQuantity?: number;
  unit?: string;
  moq?: number;
  variants?: ParsedVariant[];
};

type InboxItem = {
  id: string;
  wa_message_id: string;
  message_type: string;
  message_text: string | null;
  media_mime_type: string | null;
  parsed_draft: ParsedDraft | null;
  product_id: string | null;
  status: string;
  error_message: string | null;
  received_at: string;
  mediaUrl: string | null;
};

type StatusPayload = {
  configured?: boolean;
  channelReady?: boolean;
  webhookReady?: boolean;
  mediaReady?: boolean;
  businessNumber?: string | null;
};

const money = (value: unknown) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0
    ? `₹${amount.toLocaleString('en-IN')}`
    : 'Rate pending';
};

export default function WhatsAppCatalogPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statusResponse, inboxResponse] = await Promise.all([
        fetch('/api/whatsapp/status', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/whatsapp/catalog-inbox', { cache: 'no-store', credentials: 'same-origin' }),
      ]);
      const statusPayload = (await statusResponse.json().catch(() => ({}))) as StatusPayload;
      const inboxPayload = (await inboxResponse.json().catch(() => ({}))) as {
        items?: InboxItem[];
        error?: string;
      };
      setStatus(statusPayload);
      if (inboxResponse.ok) setItems(inboxPayload.items || []);
      else if (inboxResponse.status !== 403) setError(inboxPayload.error || 'WhatsApp sync could not be loaded.');
    } catch {
      setError('WhatsApp sync could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 20_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  const whatsappUrl = useMemo(() => {
    const number = status?.businessNumber?.replace(/\D/g, '');
    if (!number) return null;
    const text = [
      'SELLER CATALOG UPLOAD',
      'FabricTrad catalogue upload',
      'Product = ',
      'Fabric = ',
      'Category = ',
      'Rate = ',
      'MOQ = ',
      'Stock = ',
      'Colour = ',
      'Design = ',
      '',
      'Attach product photos or a short reel with this message.',
    ].join('\n');
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  }, [status?.businessNumber]);

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#25D366]/25 bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border bg-[#25D366]/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#25D366] text-white shadow-sm">
            <Icon name="ChatBubbleLeftRightIcon" size={21} />
          </div>
          <div>
            <p className="text-xs font-800 uppercase tracking-[0.14em] text-[#128C7E]">Phone-first catalog sync</p>
            <h2 className="mt-1 text-lg font-800 text-foreground">WhatsApp → FabricTrad dashboard</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">
              Send a product description, photos or a short reel from the mobile number linked to your seller account. Keep “SELLER CATALOG UPLOAD” at the start so a dual-role account is routed to seller mode, then FabricTrad receives it privately and organises the details here.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-800 text-white shadow-sm hover:brightness-95"
            >
              <Icon name="PaperAirplaneIcon" size={16} /> Send product on WhatsApp
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-xl border border-warning/20 bg-warning/10 px-4 py-2 text-xs font-800 text-warning">
              Meta business number not connected yet
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="ft-icon-button"
            aria-label="Refresh WhatsApp catalog inbox"
          >
            <Icon name="ArrowPathIcon" size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {!status?.channelReady && (
        <div className="border-b border-warning/20 bg-warning/5 px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">
          <strong className="text-foreground">Connection status:</strong> FabricTrad's webhook and dashboard path are installed, but the official Meta WhatsApp Business credentials/number still need to be configured before real messages can arrive.
        </div>
      )}

      {error && (
        <div role="alert" className="border-b border-error/20 bg-error/5 px-4 py-3 text-xs text-error sm:px-5">
          {error}
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Synced seller submissions</p>
            <p className="mt-1 text-sm text-muted-foreground">Newest WhatsApp catalogue messages appear automatically.</p>
          </div>
          <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-800 text-foreground">{items.length}</span>
        </div>

        {!items.length ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
            <Icon name="DevicePhoneMobileIcon" size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-800 text-foreground">No WhatsApp product submissions yet</p>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
              Once the official number is connected, a seller message from the same mobile number as their FabricTrad profile will be matched to that seller automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 12).map((item) => {
              const draft = item.parsed_draft;
              return (
                <article key={item.id} className="rounded-2xl border border-border bg-muted/15 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#25D366]/10 px-2.5 py-1 text-[11px] font-800 text-[#128C7E]">WhatsApp</span>
                        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-700 text-muted-foreground">{item.status.replace(/_/g, ' ')}</span>
                        <span className="text-[11px] text-muted-foreground">{new Date(item.received_at).toLocaleString('en-IN')}</span>
                      </div>
                      <h3 className="mt-3 text-base font-800 text-foreground">{draft?.name || 'Product details need review'}</h3>
                      {item.message_text && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{item.message_text}</p>}

                      {draft && (
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            ['Category', draft.category || 'Pending'],
                            ['Rate', `${money(draft.pricePerUnit)}${draft.unit ? `/${draft.unit}` : ''}`],
                            ['Stock', draft.availableQuantity ? `${draft.availableQuantity} ${draft.unit || ''}` : 'Pending'],
                            ['Variants', String(draft.variants?.length || 0)],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-border bg-card p-2.5">
                              <p className="text-[10px] font-800 uppercase tracking-wide text-muted-foreground">{label}</p>
                              <p className="mt-1 truncate text-xs font-800 text-foreground">{value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {item.mediaUrl && (
                      <div className="h-24 w-full shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:w-24">
                        {item.media_mime_type?.startsWith('video/') ? (
                          <video src={item.mediaUrl} controls playsInline className="h-full w-full object-cover" />
                        ) : item.media_mime_type?.startsWith('image/') ? (
                          // Signed private WhatsApp media URLs are short-lived and cannot use the Next image optimizer reliably.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.mediaUrl} alt="Seller WhatsApp product upload" className="h-full w-full object-cover" />
                        ) : (
                          <a href={item.mediaUrl} target="_blank" rel="noreferrer" className="grid h-full place-items-center text-xs font-800 text-primary">Open file</a>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
