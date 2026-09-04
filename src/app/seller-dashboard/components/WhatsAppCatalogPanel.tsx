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
  sku?: string;
  category?: string;
  price?: number;
  pricePerUnit?: number;
  available?: number;
  availableQuantity?: number;
  unit?: string;
  moq?: number;
  status?: string;
  variants?: ParsedVariant[];
};

type SellerIdentityPayload = {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsappNo?: string;
  ready?: boolean;
  error?: string;
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

const SELLER_FORMAT = `REQUIRED
name =
sku =
category =
price =
unit = mtr
available =
moq =
sale_channel = b2b | retail | both

OPTIONAL
description =
min_stock = 0
gsm =
width =
work_type = Plain
image_url =
dispatch_days = 3
origin_city =
origin_state =
status = draft
retail_store_min_quantity =
retail_store_max_quantity =
end_user_min_quantity =
end_user_max_quantity =`;

export default function WhatsAppCatalogPanel() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [identity, setIdentity] = useState<SellerIdentityPayload | null>(null);
  const [identityForm, setIdentityForm] = useState({ contactName: '', contactEmail: '', contactPhone: '', whatsappNo: '' });
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityMessage, setIdentityMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statusResponse, inboxResponse, identityResponse] = await Promise.all([
        fetch('/api/whatsapp/status', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/whatsapp/catalog-inbox', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/seller/contact-identity', { cache: 'no-store', credentials: 'same-origin' }),
      ]);
      const statusPayload = (await statusResponse.json().catch(() => ({}))) as StatusPayload;
      const inboxPayload = (await inboxResponse.json().catch(() => ({}))) as {
        items?: InboxItem[];
        error?: string;
      };
      const identityPayload = (await identityResponse.json().catch(() => ({}))) as SellerIdentityPayload;
      setStatus(statusPayload);
      if (identityResponse.ok) {
        setIdentity(identityPayload);
        setIdentityForm({
          contactName: identityPayload.contactName || '',
          contactEmail: identityPayload.contactEmail || '',
          contactPhone: identityPayload.contactPhone || '',
          whatsappNo: identityPayload.whatsappNo || '',
        });
      }
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
    if (!number || !identity?.ready) return null;
    return `https://wa.me/${number}?text=${encodeURIComponent('FORMAT')}`;
  }, [status?.businessNumber, identity?.ready]);

  const saveIdentity = async () => {
    setIdentitySaving(true);
    setIdentityMessage('');
    try {
      const response = await fetch('/api/seller/contact-identity', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(identityForm),
      });
      const payload = (await response.json().catch(() => ({}))) as SellerIdentityPayload;
      if (!response.ok) {
        setIdentityMessage(payload.error || 'Seller WhatsApp identity could not be saved.');
        return;
      }
      setIdentity(payload);
      setIdentityMessage('Saved. Only this seller WhatsApp number can add products to this store.');
    } catch {
      setIdentityMessage('Seller WhatsApp identity could not be saved.');
    } finally {
      setIdentitySaving(false);
    }
  };

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
              Register a dedicated seller WhatsApp below. That exact number gets seller-catalog priority, even on a dual-workspace login. Send FORMAT first, then one product's strict field template plus its photos/videos. Valid products are added directly to your store and remain editable in Products.
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
              <Icon name="PaperAirplaneIcon" size={16} /> Open WhatsApp with FORMAT
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-xl border border-warning/20 bg-warning/10 px-4 py-2 text-xs font-800 text-warning">
              {status?.businessNumber ? 'Save seller WhatsApp identity first' : 'Gupshup business number not connected yet'}
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

      <div className="border-b border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-800 uppercase tracking-[0.14em] text-[#128C7E]">Seller identity for WhatsApp catalogue</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Seller name, email, phone and WhatsApp must be different from buyer/account identity. FabricTrad rejects duplicates at the API and database levels.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-800 text-foreground">Seller name<input value={identityForm.contactName} onChange={(e) => setIdentityForm((v) => ({ ...v, contactName: e.target.value }))} className="input-base mt-1.5 w-full px-3 py-2.5 font-400" placeholder="Seller contact/display name" /></label>
          <label className="text-xs font-800 text-foreground">Seller email<input type="email" value={identityForm.contactEmail} onChange={(e) => setIdentityForm((v) => ({ ...v, contactEmail: e.target.value }))} className="input-base mt-1.5 w-full px-3 py-2.5 font-400" placeholder="seller@business.com" /></label>
          <label className="text-xs font-800 text-foreground">Seller phone<input inputMode="numeric" value={identityForm.contactPhone} onChange={(e) => setIdentityForm((v) => ({ ...v, contactPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="input-base mt-1.5 w-full px-3 py-2.5 font-mono font-400" placeholder="10 digit seller phone" /></label>
          <label className="text-xs font-800 text-foreground">Seller WhatsApp<input inputMode="numeric" value={identityForm.whatsappNo} onChange={(e) => setIdentityForm((v) => ({ ...v, whatsappNo: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="input-base mt-1.5 w-full px-3 py-2.5 font-mono font-400" placeholder="WhatsApp used to upload products" /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void saveIdentity()} disabled={identitySaving} className="inline-flex min-h-10 items-center rounded-xl bg-foreground px-4 text-xs font-800 text-background disabled:opacity-60">
            {identitySaving ? 'Saving…' : identity?.ready ? 'Update seller WhatsApp identity' : 'Save seller WhatsApp identity'}
          </button>
          {identityMessage && <p className={`text-xs font-700 ${identityMessage.startsWith('Saved') ? 'text-emerald-700' : 'text-error'}`}>{identityMessage}</p>}
        </div>

        <details className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
          <summary className="cursor-pointer text-xs font-800 text-foreground">Predefined product format — required & optional fields</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-[11px] leading-5 text-slate-100">{SELLER_FORMAT}</pre>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Photos/videos sent for the product are attached automatically, so image_url is optional. Use NEW PRODUCT before the next item. Duplicate SKU values are never auto-created.</p>
        </details>
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
              Save a dedicated seller WhatsApp identity above, open WhatsApp with FORMAT, then send one product's required fields and its photos. FabricTrad will validate and add the product to this store automatically.
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
                            ['Rate', `${money(draft.price ?? draft.pricePerUnit)}${draft.unit ? `/${draft.unit}` : ''}`],
                            ['Stock', (draft.available ?? draft.availableQuantity) !== undefined ? `${draft.available ?? draft.availableQuantity} ${draft.unit || ''}` : 'Pending'],
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
