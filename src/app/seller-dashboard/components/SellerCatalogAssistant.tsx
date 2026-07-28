'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  catalogVariantKey,
  type ParsedCatalogDraft,
  type PackageFormat,
  type SaleChannel,
} from '@/lib/catalogAssistant';

type ViewType = 'front' | 'back' | 'detail' | 'reel' | 'other';
type Attachment = {
  id: string;
  file: File;
  previewUrl: string;
  mediaType: 'image' | 'video';
  durationSeconds: number | null;
  viewType: ViewType;
  targetKey: string;
};

type ChatMessage = {
  id: string;
  role: 'assistant' | 'seller';
  text: string;
};

const STARTER_TEXT = `Catalog = Navratri Vichitra Silk
Fabric = vichitra silk
Category = Silk
Width = 44
Work = mirror work
Rate = 240 per mtr
MOQ = 3
Channel = both
Format = Fabric Only

Color = Royal Blue
Stock = 9 mtr
Rate = 240 per mtr
Design = mirror dots
Details = deep blue shade with all-over mirror motifs

Color = Pink
Stock = 14 mtr
Rate = 250 per mtr
Design = mirror border
Details = bright pink with a detailed border`;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 20.5;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-100);
}

function getVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const duration = Number(video.duration);
      if (!Number.isFinite(duration)) reject(new Error('Unable to read the video duration.'));
      else resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This video could not be read.'));
    };
    video.src = objectUrl;
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function labelForChannel(channel: SaleChannel) {
  if (channel === 'both') return 'B2B + Retail';
  return channel === 'retail' ? 'Retail / B2C' : 'B2B / Wholesale';
}

export default function SellerCatalogAssistant() {
  const { user, profile, isDemoAccount } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(STARTER_TEXT);
  const [draft, setDraft] = useState<ParsedCatalogDraft | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        'Describe one fabric or product in your own words. Add colours, metres, rates and designs. Then attach front, back, detail photos or a 10–20 second reel. I will organise it into a customer-ready catalogue.',
    },
  ]);
  const [analyzing, setAnalyzing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [listingStatus, setListingStatus] = useState<'draft' | 'active'>('draft');
  const [provider, setProvider] = useState<'openai' | 'rules' | null>(null);

  const variantTargets = useMemo(
    () =>
      (draft?.variants || []).map((variant) => ({
        key: catalogVariantKey(variant.colorName, variant.designName),
        label: `${variant.colorName} · ${variant.designName}`,
      })),
    [draft]
  );

  useEffect(
    () => () => {
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    },
    [attachments]
  );

  const analyze = async () => {
    if (!text.trim()) return toast.error('Describe the product first.');
    setAnalyzing(true);
    setMessages((current) => [
      ...current,
      { id: `seller-${Date.now()}`, role: 'seller', text: text.trim() },
    ]);

    try {
      const response = await fetch('/api/catalog-assistant/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ text }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        draft?: ParsedCatalogDraft;
        provider?: 'openai' | 'rules';
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.draft) throw new Error(payload.error || 'Unable to organise the catalogue.');

      setDraft(payload.draft);
      setProvider(payload.provider || 'rules');
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: `${payload.message || 'Catalogue organised.'} I found ${payload.draft.variants.length || 1} variation${payload.draft.variants.length === 1 ? '' : 's'}. Attach media, choose its colour/view, and review before saving.`,
        },
      ]);
      setAttachments((current) =>
        current.map((attachment) => ({
          ...attachment,
          targetKey:
            attachment.targetKey &&
            payload.draft?.variants.some(
              (variant) => catalogVariantKey(variant.colorName, variant.designName) === attachment.targetKey
            )
              ? attachment.targetKey
              : '',
        }))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to organise the catalogue.';
      toast.error(message);
      setMessages((current) => [
        ...current,
        { id: `assistant-error-${Date.now()}`, role: 'assistant', text: message },
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  const addFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const accepted: Attachment[] = [];
    for (const file of files) {
      const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
      const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);
      if (!isImage && !isVideo) {
        toast.error(`${file.name}: choose JPG, PNG, WebP, MP4, MOV or WebM.`);
        continue;
      }
      if (isImage && file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name}: images must be 10 MB or smaller.`);
        continue;
      }
      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        toast.error(`${file.name}: videos must be 50 MB or smaller.`);
        continue;
      }

      let durationSeconds: number | null = null;
      if (isVideo) {
        try {
          durationSeconds = await getVideoDuration(file);
        } catch (error) {
          toast.error(error instanceof Error ? `${file.name}: ${error.message}` : `${file.name}: invalid video.`);
          continue;
        }
        if (durationSeconds < 1 || durationSeconds > MAX_VIDEO_SECONDS) {
          toast.error(`${file.name}: reels must be between 1 and 20 seconds.`);
          continue;
        }
      }

      accepted.push({
        id: `${Date.now()}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        mediaType: isVideo ? 'video' : 'image',
        durationSeconds,
        viewType: isVideo ? 'reel' : accepted.length === 0 ? 'front' : 'detail',
        targetKey: '',
      });
    }

    setAttachments((current) => [...current, ...accepted].slice(0, 24));
  };

  const updateAttachment = (id: string, patch: Partial<Attachment>) => {
    setAttachments((current) =>
      current.map((attachment) => (attachment.id === id ? { ...attachment, ...patch } : attachment))
    );
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
  };

  const publish = async () => {
    if (!draft) return toast.error('Ask the assistant to organise the product first.');
    if (isDemoAccount) return toast.error('Use a real seller account to publish catalogue products.');
    if (!user?.id) return toast.error('Sign in as a seller again.');
    if (listingStatus === 'active' && !attachments.some((item) => item.mediaType === 'image')) {
      return toast.error('Add at least one product image before publishing a live listing.');
    }

    setPublishing(true);
    const supabase = createClient();
    try {
      const { data: seller, error: sellerError } = await supabase
        .from('seller_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (sellerError || !seller?.id) {
        throw new Error(sellerError?.message || 'Complete your seller profile before publishing.');
      }

      const sourceReference = `assistant:${seller.id}:${draft.catalogKey}`;
      const parentPayload = {
        seller_id: seller.id,
        name: draft.name,
        sku: `AI-${draft.catalogKey.replace(/[^a-z0-9]/gi, '').slice(0, 18).toUpperCase() || Date.now()}`,
        category: draft.category || 'Other',
        description: draft.description,
        price_per_unit: draft.pricePerUnit,
        unit: draft.unit,
        available_quantity: draft.availableQuantity,
        reserved_quantity: 0,
        min_stock: 0,
        moq: Math.max(1, Math.ceil(draft.moq)),
        gsm: draft.gsm,
        width_inches: draft.widthInches,
        work_type: draft.workType,
        image_url: null,
        image_urls: [],
        dispatch_days: 3,
        origin_city: profile?.city || null,
        origin_state: profile?.state || null,
        status: listingStatus,
        source: 'assistant',
        source_reference: sourceReference,
        approval_status: 'approved',
        sale_channel: draft.saleChannel,
        package_format: draft.packageFormat,
      };

      const { data: existingParent, error: existingError } = await supabase
        .from('seller_products')
        .select('id,sku')
        .eq('seller_id', seller.id)
        .eq('source', 'assistant')
        .eq('source_reference', sourceReference)
        .maybeSingle();
      if (existingError) throw existingError;

      let productId: string;
      if (existingParent?.id) {
        const { data, error } = await supabase
          .from('seller_products')
          .update({ ...parentPayload, sku: existingParent.sku })
          .eq('id', existingParent.id)
          .eq('seller_id', seller.id)
          .select('id')
          .single();
        if (error) throw error;
        productId = data.id;
      } else {
        const { data, error } = await supabase
          .from('seller_products')
          .insert(parentPayload)
          .select('id')
          .single();
        if (error) throw error;
        productId = data.id;
      }

      const variantIdByKey = new Map<string, string>();
      for (let index = 0; index < draft.variants.length; index += 1) {
        const variant = draft.variants[index];
        const key = catalogVariantKey(variant.colorName, variant.designName);
        const payload = {
          product_id: productId,
          seller_id: seller.id,
          variant_key: key,
          variant_code: `${parentPayload.sku}-${String(index + 1).padStart(2, '0')}`,
          color_name: variant.colorName,
          color_hex: variant.colorHex,
          design_name: variant.designName,
          description: variant.description || null,
          price_per_unit: variant.pricePerUnit,
          unit: variant.unit,
          available_quantity: variant.availableQuantity,
          reserved_quantity: 0,
          moq: variant.moq,
          source: 'assistant',
          source_reference: `${sourceReference}:${key}`,
          approval_status: 'approved',
          status: listingStatus,
        };
        const { data, error } = await supabase
          .from('seller_product_variants')
          .upsert(payload, { onConflict: 'product_id,variant_key' })
          .select('id,variant_key')
          .single();
        if (error) throw error;
        variantIdByKey.set(String(data.variant_key), String(data.id));
      }

      const parentImages: string[] = [];
      const variantImages = new Map<string, string[]>();
      const now = Date.now();

      for (let index = 0; index < attachments.length; index += 1) {
        const attachment = attachments[index];
        const extension = safeFilename(attachment.file.name).split('.').pop() ||
          (attachment.mediaType === 'video' ? 'mp4' : 'jpg');
        const storagePath = `${user.id}/${seller.id}/${productId}/${now}-${index + 1}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('seller-product-media')
          .upload(storagePath, attachment.file, {
            cacheControl: '31536000',
            contentType: attachment.file.type,
            upsert: true,
          });
        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('seller-product-media')
          .getPublicUrl(storagePath);
        const publicUrl = publicData.publicUrl;
        const variantId = attachment.targetKey
          ? variantIdByKey.get(attachment.targetKey) || null
          : null;

        const { error: mediaError } = await supabase.from('seller_product_media').insert({
          product_id: productId,
          variant_id: variantId,
          seller_id: seller.id,
          media_type: attachment.mediaType,
          view_type: attachment.viewType,
          public_url: publicUrl,
          storage_path: storagePath,
          original_filename: attachment.file.name,
          mime_type: attachment.file.type,
          file_size: attachment.file.size,
          duration_seconds: attachment.durationSeconds,
          alt_text: `${draft.name} ${attachment.viewType} ${attachment.targetKey || 'product'} view`,
          sort_order: index,
        });
        if (mediaError) throw mediaError;

        if (attachment.mediaType === 'image') {
          if (attachment.targetKey) {
            variantImages.set(attachment.targetKey, [
              ...(variantImages.get(attachment.targetKey) || []),
              publicUrl,
            ]);
          } else {
            parentImages.push(publicUrl);
          }
        }
      }

      if (parentImages.length) {
        const { error } = await supabase
          .from('seller_products')
          .update({ image_url: parentImages[0], image_urls: parentImages })
          .eq('id', productId)
          .eq('seller_id', seller.id);
        if (error) throw error;
      }

      for (const [key, images] of variantImages.entries()) {
        const variantId = variantIdByKey.get(key);
        if (!variantId || !images.length) continue;
        const { error } = await supabase
          .from('seller_product_variants')
          .update({ image_url: images[0], image_urls: images })
          .eq('id', variantId)
          .eq('seller_id', seller.id);
        if (error) throw error;
      }

      toast.success(
        listingStatus === 'active'
          ? 'Catalogue published and visible to matching buyers.'
          : 'Catalogue saved privately as a draft.'
      );
      setMessages((current) => [
        ...current,
        {
          id: `published-${Date.now()}`,
          role: 'assistant',
          text:
            listingStatus === 'active'
              ? 'Done. The parent product, variations, stock, photos and reels are now in your live catalogue.'
              : 'Saved. You can review the draft in Parent Fabrics and publish it later.',
        },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The catalogue could not be saved.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">In-app catalogue automation</p>
          <h1 className="mt-1 text-2xl font-800 text-foreground">AI Catalog Studio</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Chat with the assistant, attach product media, review the extracted details and publish without leaving FabricTrad.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-border bg-card px-3 py-1.5">Images up to 10 MB</span>
          <span className="rounded-full border border-border bg-card px-3 py-1.5">Reels up to 20 seconds</span>
          <span className="rounded-full border border-border bg-card px-3 py-1.5">24 media files per draft</span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-gradient-to-r from-primary/8 to-secondary/8 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                <Icon name="SparklesIcon" size={20} />
              </div>
              <div>
                <p className="text-sm font-800 text-foreground">FabricTrad Catalogue Assistant</p>
                <p className="text-xs text-muted-foreground">
                  {provider === 'openai' ? 'AI extraction active' : 'Built-in textile parser ready'}
                </p>
              </div>
            </div>
          </div>

          <div className="max-h-80 space-y-3 overflow-y-auto bg-muted/20 p-4 sm:p-5">
            {messages.slice(-6).map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'seller' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'seller'
                      ? 'rounded-br-md bg-primary text-white'
                      : 'rounded-bl-md border border-border bg-card text-foreground'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            <label className="text-xs font-800 uppercase tracking-wide text-muted-foreground">
              Product message
            </label>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={16}
              className="input-base mt-2 w-full resize-y rounded-xl px-4 py-3 font-mono text-sm leading-6"
              placeholder="Tell me the fabric, rate, stock, colours, design, channel and format…"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void analyze()}
                disabled={analyzing || !text.trim()}
                className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm disabled:opacity-50"
              >
                <Icon name="CpuChipIcon" size={17} />
                {analyzing ? 'Organising catalogue…' : draft ? 'Analyse again' : 'Ask AI to organise'}
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm"
              >
                <Icon name="PaperClipIcon" size={17} /> Add photos or reel
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                onChange={(event) => void addFiles(event)}
                className="hidden"
              />
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Structured preview</p>
                <h2 className="mt-1 text-lg font-800 text-foreground">
                  {draft?.name || 'Waiting for product details'}
                </h2>
              </div>
              {draft && (
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-800 text-success">
                  Ready to review
                </span>
              )}
            </div>

            {draft ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  {[
                    ['Category', draft.category],
                    ['Channel', labelForChannel(draft.saleChannel)],
                    ['Format', draft.packageFormat],
                    ['Base rate', `₹${draft.pricePerUnit.toLocaleString('en-IN')}/${draft.unit}`],
                    ['Total stock', `${draft.availableQuantity.toLocaleString('en-IN')} ${draft.unit}`],
                    ['Variations', String(draft.variants.length || 1)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-muted p-3">
                      <p className="text-[10px] font-800 uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className="mt-1 font-800 text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                {!!draft.variants.length && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Colours & designs</p>
                    {draft.variants.map((variant) => (
                      <div
                        key={catalogVariantKey(variant.colorName, variant.designName)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-800 text-foreground">{variant.colorName} · {variant.designName}</p>
                          <p className="text-muted-foreground">
                            {variant.availableQuantity.toLocaleString('en-IN')} {variant.unit} · MOQ {variant.moq}
                          </p>
                        </div>
                        <p className="shrink-0 font-800 text-primary">
                          ₹{variant.pricePerUnit.toLocaleString('en-IN')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-border py-12 text-center">
                <Icon name="ChatBubbleBottomCenterTextIcon" size={30} className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm font-800 text-foreground">Send the product message to begin</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  The assistant will separate the parent product, colours, designs, rates and stock.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Product media</p>
                <p className="mt-1 text-sm font-800 text-foreground">Front, back, details and reels</p>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-xl border border-border px-3 py-2 text-xs font-800 hover:border-primary hover:text-primary"
              >
                Add media
              </button>
            </div>

            {attachments.length ? (
              <div className="mt-4 space-y-3">
                {attachments.map((attachment) => (
                  <article key={attachment.id} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[88px_1fr_auto]">
                    <div className="h-20 overflow-hidden rounded-lg bg-muted">
                      {attachment.mediaType === 'video' ? (
                        <video src={attachment.previewUrl} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        // Browser object URLs are intentionally rendered without the image optimiser.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={attachment.previewUrl} alt={attachment.file.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div>
                        <p className="truncate text-xs font-800 text-foreground">{attachment.file.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatBytes(attachment.file.size)}
                          {attachment.durationSeconds ? ` · ${attachment.durationSeconds.toFixed(1)} sec` : ''}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          value={attachment.targetKey}
                          onChange={(event) => updateAttachment(attachment.id, { targetKey: event.target.value })}
                          className="input-base rounded-lg px-2 py-1.5 text-xs"
                        >
                          <option value="">Parent product</option>
                          {variantTargets.map((target) => (
                            <option key={target.key} value={target.key}>{target.label}</option>
                          ))}
                        </select>
                        <select
                          value={attachment.viewType}
                          onChange={(event) => updateAttachment(attachment.id, { viewType: event.target.value as ViewType })}
                          className="input-base rounded-lg px-2 py-1.5 text-xs"
                        >
                          <option value="front">Front view</option>
                          <option value="back">Back view</option>
                          <option value="detail">Zoom / detail</option>
                          <option value="reel">Video / reel</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="h-9 rounded-lg px-2 text-error hover:bg-error/5"
                      aria-label={`Remove ${attachment.file.name}`}
                    >
                      <Icon name="TrashIcon" size={16} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-4 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border px-4 py-10 text-center hover:border-primary/50 hover:bg-primary/5"
              >
                <Icon name="PhotoIcon" size={28} className="text-muted-foreground" />
                <span className="mt-2 text-sm font-800 text-foreground">Upload product media</span>
                <span className="mt-1 text-xs text-muted-foreground">Add front/back photos, close-ups and one or more short reels.</span>
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Save & visibility</p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setListingStatus('draft')}
                className={`rounded-lg px-3 py-2.5 text-xs font-800 ${listingStatus === 'draft' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                Draft · private
              </button>
              <button
                type="button"
                onClick={() => setListingStatus('active')}
                className={`rounded-lg px-3 py-2.5 text-xs font-800 ${listingStatus === 'active' ? 'bg-success text-white shadow-sm' : 'text-muted-foreground'}`}
              >
                Active · visible
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Archived products remain hidden. Drafts are visible only to you. Active products appear in buyer search according to the selected B2B/Retail channel.
            </p>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={!draft || publishing || isDemoAccount}
              className="btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name={listingStatus === 'active' ? 'RocketLaunchIcon' : 'DocumentCheckIcon'} size={17} />
              {publishing ? 'Uploading and saving…' : listingStatus === 'active' ? 'Publish catalogue' : 'Save catalogue draft'}
            </button>
            {isDemoAccount && (
              <p className="mt-2 text-center text-xs text-warning">The demo account can test parsing and media preview but cannot publish.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
