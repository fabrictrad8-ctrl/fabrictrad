'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useCatalogComposerDraft } from '@/lib/hooks/useCatalogComposerDraft';
import {
  useCatalogMediaDraft,
  type CatalogMediaDraftItem,
} from '@/lib/hooks/useCatalogMediaDraft';
import {
  type CatalogUnit,
  type PackageFormat,
  type ParsedCatalogDraft,
  type SaleChannel,
} from '@/lib/catalogAssistant';

type ViewType = CatalogMediaDraftItem['viewType'];
type LocalAttachment = CatalogMediaDraftItem & { previewUrl: string };

type PersistedMedia = {
  id: string;
  mediaType: 'image' | 'video';
  durationSeconds: number | null;
  viewType: ViewType;
  publicUrl: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
};

type ProductForm = {
  draftKey: string;
  name: string;
  description: string;
  category: string;
  pricePerUnit: string;
  unit: CatalogUnit;
  availableQuantity: string;
  moq: string;
  widthInches: string;
  gsm: string;
  workType: string;
  saleChannel: SaleChannel;
  packageFormat: PackageFormat;
};

type ComposerSnapshot = {
  form: ProductForm;
  aiText: string;
  remoteMedia: PersistedMedia[];
};

type SellerState = {
  id: string;
  verificationStatus: string;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 20.5;
const MAX_MEDIA_ITEMS = 24;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

const CATEGORIES = [
  'Silk',
  'Cotton',
  'Net & Netting',
  'Georgette',
  'Polyester',
  'Handloom',
  'Velvet',
  'Organza',
  'Linen',
  'Denim',
  'Wool',
  'Satin',
  'Lace',
  'Other',
];

const PACKAGE_FORMATS: PackageFormat[] = [
  'Fabric Only',
  'Full Set',
  'Top',
  'Bottom',
  'Top & Bottom',
  'Additional Accessory',
  'Other',
];

function makeDraftKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}`;
}

function blankForm(draftKey = makeDraftKey()): ProductForm {
  return {
    draftKey,
    name: '',
    description: '',
    category: 'Other',
    pricePerUnit: '',
    unit: 'mtr',
    availableQuantity: '',
    moq: '1',
    widthInches: '',
    gsm: '',
    workType: '',
    saleChannel: 'both',
    packageFormat: 'Fabric Only',
  };
}

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-100) || 'media';
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function optionalPositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function SellerCatalogAssistant() {
  const { user, profile, isDemoAccount } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localUrlsRef = useRef<string[]>([]);
  const serverHydratedRef = useRef(false);

  const [form, setForm] = useState<ProductForm>(() => blankForm());
  const [aiText, setAiText] = useState('');
  const [localMedia, setLocalMedia] = useState<LocalAttachment[]>([]);
  const [remoteMedia, setRemoteMedia] = useState<PersistedMedia[]>([]);
  const [sellerState, setSellerState] = useState<SellerState | null>(null);
  const [serverSavedAt, setServerSavedAt] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const snapshot = useMemo<ComposerSnapshot>(
    () => ({ form, aiText, remoteMedia }),
    [aiText, form, remoteMedia]
  );

  const {
    loaded: composerLoaded,
    savedAt: localSavedAt,
    saveNow: saveComposerNow,
    clear: clearComposerDraft,
  } = useCatalogComposerDraft<ComposerSnapshot>({
    ownerKey: user?.id,
    payload: snapshot,
    onRestore: (saved) => {
      if (saved?.form) {
        const draftKey = saved.form.draftKey || makeDraftKey();
        setForm({ ...blankForm(draftKey), ...saved.form, draftKey });
      }
      setAiText(saved?.aiText || '');
      setRemoteMedia(Array.isArray(saved?.remoteMedia) ? saved.remoteMedia : []);
    },
  });

  const {
    savedAt: mediaSavedAt,
    warning: mediaDraftWarning,
    persist: persistLocalMedia,
    clear: clearMediaDraft,
  } = useCatalogMediaDraft({
    ownerKey: user?.id,
    items: localMedia,
    onRestore: (items) => {
      setLocalMedia((current) => {
        current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return items.map((item) => ({ ...item, previewUrl: URL.createObjectURL(item.file) }));
      });
    },
  });

  useEffect(() => {
    localUrlsRef.current = localMedia.map((item) => item.previewUrl);
  }, [localMedia]);

  useEffect(
    () => () => {
      localUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

  const resolveSeller = useCallback(async () => {
    if (sellerState) return sellerState;
    if (!user?.id || isDemoAccount) return null;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('seller_profiles')
      .select('id,verification_status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error('Complete your seller profile before publishing products.');
    const resolved = {
      id: String(data.id),
      verificationStatus: String(data.verification_status || ''),
    };
    setSellerState(resolved);
    return resolved;
  }, [isDemoAccount, sellerState, user?.id]);

  useEffect(() => {
    if (!composerLoaded || !user?.id || isDemoAccount || serverHydratedRef.current) return;
    serverHydratedRef.current = true;
    let cancelled = false;

    const hydrate = async () => {
      try {
        const supabase = createClient();
        const { data: seller, error: sellerError } = await supabase
          .from('seller_profiles')
          .select('id,verification_status')
          .eq('user_id', user.id)
          .maybeSingle();
        if (sellerError || !seller?.id) return;
        if (!cancelled) {
          setSellerState({
            id: String(seller.id),
            verificationStatus: String(seller.verification_status || ''),
          });
        }

        const { data: rows, error: draftError } = await supabase
          .from('seller_product_drafts')
          .select('draft_key,payload,media,updated_at')
          .eq('seller_id', seller.id)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (draftError) throw draftError;
        const latest = rows?.[0];
        if (!latest || cancelled) return;

        const serverTime = Date.parse(String(latest.updated_at || '')) || 0;
        const localTime = Date.parse(localSavedAt || '') || 0;
        setServerSavedAt(String(latest.updated_at || ''));
        if (serverTime < localTime) return;

        const payload = (latest.payload || {}) as Partial<ComposerSnapshot>;
        const serverForm = payload.form;
        const draftKey = serverForm?.draftKey || String(latest.draft_key) || makeDraftKey();
        if (serverForm) setForm({ ...blankForm(draftKey), ...serverForm, draftKey });
        setAiText(payload.aiText || '');
        setRemoteMedia(Array.isArray(latest.media) ? (latest.media as PersistedMedia[]) : []);
        toast.success('Your latest saved product draft was restored.');
      } catch (error) {
        console.warn('Unable to restore server product draft', error);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [composerLoaded, isDemoAccount, localSavedAt, user?.id]);

  const updateForm = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const analyze = async () => {
    if (!aiText.trim()) return toast.error('Paste or describe the product first.');
    setAnalyzing(true);
    try {
      const response = await fetch('/api/catalog-assistant/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ text: aiText }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        draft?: ParsedCatalogDraft;
        error?: string;
      };
      if (!response.ok || !payload.draft) {
        throw new Error(payload.error || 'The product details could not be organised.');
      }
      const parsed = payload.draft;
      setForm((current) => ({
        ...current,
        name: parsed.name || current.name,
        description: parsed.description || current.description,
        category: parsed.category || current.category,
        pricePerUnit: parsed.pricePerUnit > 0 ? String(parsed.pricePerUnit) : current.pricePerUnit,
        unit: parsed.unit || current.unit,
        availableQuantity:
          parsed.availableQuantity >= 0 ? String(parsed.availableQuantity) : current.availableQuantity,
        moq: parsed.moq > 0 ? String(parsed.moq) : current.moq,
        widthInches: parsed.widthInches ? String(parsed.widthInches) : current.widthInches,
        gsm: parsed.gsm ? String(parsed.gsm) : current.gsm,
        workType: parsed.workType || current.workType,
        saleChannel: parsed.saleChannel || current.saleChannel,
        packageFormat: parsed.packageFormat || current.packageFormat,
      }));
      toast.success('Product fields filled. Review them and publish when ready.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to organise the product.');
    } finally {
      setAnalyzing(false);
    }
  };

  const ingestFiles = async (files: File[]) => {
    if (!files.length) return;
    const remainingSlots = Math.max(0, MAX_MEDIA_ITEMS - remoteMedia.length - localMedia.length);
    if (!remainingSlots) return toast.error(`A product can contain up to ${MAX_MEDIA_ITEMS} media files.`);

    const accepted: LocalAttachment[] = [];
    for (const file of files.slice(0, remainingSlots)) {
      const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
      const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);
      if (!isImage && !isVideo) {
        toast.error(`${file.name}: use JPG, PNG, WebP, MP4, MOV or WebM.`);
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
          toast.error(`${file.name}: videos must be between 1 and 20 seconds.`);
          continue;
        }
      }

      const existingImages = remoteMedia.filter((item) => item.mediaType === 'image').length +
        localMedia.filter((item) => item.mediaType === 'image').length +
        accepted.filter((item) => item.mediaType === 'image').length;

      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        mediaType: isVideo ? 'video' : 'image',
        durationSeconds,
        viewType: isVideo ? 'reel' : existingImages === 0 ? 'front' : 'detail',
        targetKey: '',
      });
    }
    setLocalMedia((current) => [...current, ...accepted]);
  };

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await ingestFiles(files);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    await ingestFiles(Array.from(event.dataTransfer.files || []));
  };

  const removeLocalMedia = (id: string) => {
    setLocalMedia((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const updateLocalMedia = (id: string, viewType: ViewType) => {
    setLocalMedia((current) =>
      current.map((item) => (item.id === id ? { ...item, viewType } : item))
    );
  };

  const updateRemoteMedia = (id: string, viewType: ViewType) => {
    setRemoteMedia((current) =>
      current.map((item) => (item.id === id ? { ...item, viewType } : item))
    );
  };

  const removeRemoteMedia = (id: string) => {
    setRemoteMedia((current) => current.filter((item) => item.id !== id));
  };

  const uploadPendingMedia = useCallback(
    async (sellerId: string) => {
      if (!user?.id || !localMedia.length) return remoteMedia;
      const supabase = createClient();
      const uploaded = remoteMedia.filter(
        (remote) => !localMedia.some((local) => local.id === remote.id)
      );

      for (const item of localMedia) {
        const storagePath = `${user.id}/${sellerId}/drafts/${form.draftKey}/${item.id}-${safeFilename(item.file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from('seller-product-media')
          .upload(storagePath, item.file, {
            cacheControl: '31536000',
            contentType: item.file.type,
            upsert: true,
          });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage
          .from('seller-product-media')
          .getPublicUrl(storagePath);
        uploaded.push({
          id: item.id,
          mediaType: item.mediaType,
          durationSeconds: item.durationSeconds,
          viewType: item.viewType,
          publicUrl: publicData.publicUrl,
          storagePath,
          originalFilename: item.file.name,
          mimeType: item.file.type,
          fileSize: item.file.size,
        });
      }

      localMedia.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setRemoteMedia(uploaded);
      setLocalMedia([]);
      await clearMediaDraft();
      return uploaded;
    },
    [clearMediaDraft, form.draftKey, localMedia, remoteMedia, user?.id]
  );

  const saveDraft = async () => {
    if (savingDraft || publishing) return;
    saveComposerNow();
    await persistLocalMedia().catch(() => undefined);

    if (isDemoAccount) {
      toast.success('Draft saved in this browser. Use a real seller account to save it to FabricTrad.');
      return;
    }
    if (!user?.id) return toast.error('Sign in again to save this draft.');

    setSavingDraft(true);
    try {
      const seller = await resolveSeller();
      if (!seller) throw new Error('Seller profile not found.');
      const media = await uploadPendingMedia(seller.id);
      const supabase = createClient();
      const now = new Date().toISOString();
      const { error } = await supabase.from('seller_product_drafts').upsert(
        {
          seller_id: seller.id,
          draft_key: form.draftKey,
          payload: { form, aiText },
          media,
          updated_at: now,
        },
        { onConflict: 'seller_id,draft_key' }
      );
      if (error) throw error;
      setServerSavedAt(now);
      toast.success('Draft saved. You can come back and finish it later.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Draft could not be saved.');
    } finally {
      setSavingDraft(false);
    }
  };

  const imageCount = useMemo(
    () =>
      remoteMedia.filter((item) => item.mediaType === 'image').length +
      localMedia.filter((item) => item.mediaType === 'image').length,
    [localMedia, remoteMedia]
  );

  const videoCount = useMemo(
    () =>
      remoteMedia.filter((item) => item.mediaType === 'video').length +
      localMedia.filter((item) => item.mediaType === 'video').length,
    [localMedia, remoteMedia]
  );

  const publishMissing = useMemo(() => {
    const missing: string[] = [];
    if (form.name.trim().length < 2) missing.push('product name');
    if (form.description.trim().length < 5) missing.push('description');
    if (positiveNumber(form.pricePerUnit) <= 0) missing.push('price');
    if (positiveNumber(form.availableQuantity) <= 0) missing.push('stock quantity');
    if (imageCount < 1) missing.push('at least 1 photo');
    return missing;
  }, [form.availableQuantity, form.description, form.name, form.pricePerUnit, imageCount]);

  const publish = async () => {
    if (publishing || savingDraft) return;
    if (isDemoAccount) return toast.error('Use a real verified seller account to publish products.');
    if (!user?.id) return toast.error('Sign in again to publish this product.');
    if (publishMissing.length) {
      return toast.error(`Before publishing, add: ${publishMissing.join(', ')}.`);
    }

    setPublishing(true);
    try {
      const seller = await resolveSeller();
      if (!seller) throw new Error('Seller profile not found.');
      if (seller.verificationStatus !== 'verified') {
        throw new Error('Your seller account must be approved before products can go live.');
      }

      const media = await uploadPendingMedia(seller.id);
      const images = media.filter((item) => item.mediaType === 'image').map((item) => item.publicUrl);
      if (!images.length) throw new Error('Add at least one product photo before publishing.');

      const supabase = createClient();
      const sourceReference = `composer:${seller.id}:${form.draftKey}`;
      const generatedSku = `FT-${form.draftKey.replace(/[^a-z0-9]/gi, '').slice(0, 18).toUpperCase()}`;
      const parentPayload = {
        seller_id: seller.id,
        name: form.name.trim(),
        sku: generatedSku || `FT-${Date.now()}`,
        category: form.category || 'Other',
        description: form.description.trim(),
        price_per_unit: positiveNumber(form.pricePerUnit),
        unit: form.unit,
        available_quantity: positiveNumber(form.availableQuantity),
        reserved_quantity: 0,
        min_stock: 0,
        moq: Math.max(1, Math.floor(positiveNumber(form.moq) || 1)),
        gsm: optionalPositiveNumber(form.gsm),
        width_inches: optionalPositiveNumber(form.widthInches),
        work_type: form.workType.trim() || 'Plain',
        image_url: images[0],
        image_urls: images,
        dispatch_days: 3,
        origin_city: profile?.city || null,
        origin_state: profile?.state || null,
        status: 'active',
        source: 'manual',
        source_reference: sourceReference,
        approval_status: 'approved',
        sale_channel: form.saleChannel,
        package_format: form.packageFormat,
      };

      const { data: existing, error: existingError } = await supabase
        .from('seller_products')
        .select('id,sku')
        .eq('seller_id', seller.id)
        .eq('source_reference', sourceReference)
        .maybeSingle();
      if (existingError) throw existingError;

      let productId: string;
      if (existing?.id) {
        const { data, error } = await supabase
          .from('seller_products')
          .update({ ...parentPayload, sku: existing.sku })
          .eq('id', existing.id)
          .eq('seller_id', seller.id)
          .select('id')
          .single();
        if (error) throw error;
        productId = String(data.id);
      } else {
        const { data, error } = await supabase
          .from('seller_products')
          .insert(parentPayload)
          .select('id')
          .single();
        if (error) throw error;
        productId = String(data.id);
      }

      const { error: deleteMediaError } = await supabase
        .from('seller_product_media')
        .delete()
        .eq('product_id', productId)
        .eq('seller_id', seller.id);
      if (deleteMediaError) throw deleteMediaError;

      if (media.length) {
        const { error: mediaError } = await supabase.from('seller_product_media').insert(
          media.map((item, index) => ({
            product_id: productId,
            variant_id: null,
            seller_id: seller.id,
            media_type: item.mediaType,
            view_type: item.viewType,
            public_url: item.publicUrl,
            storage_path: item.storagePath,
            original_filename: item.originalFilename,
            mime_type: item.mimeType,
            file_size: item.fileSize,
            duration_seconds: item.durationSeconds,
            alt_text: `${form.name.trim()} ${item.viewType} view`,
            sort_order: index,
          }))
        );
        if (mediaError) throw mediaError;
      }

      await supabase
        .from('seller_product_drafts')
        .delete()
        .eq('seller_id', seller.id)
        .eq('draft_key', form.draftKey);

      clearComposerDraft();
      await clearMediaDraft();
      setForm(blankForm());
      setAiText('');
      setRemoteMedia([]);
      setLocalMedia([]);
      setServerSavedAt(null);
      toast.success('Product published. It is now available to matching buyers.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Product could not be published.');
    } finally {
      setPublishing(false);
    }
  };

  const newProduct = () => {
    clearComposerDraft();
    void clearMediaDraft();
    localUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    localUrlsRef.current = [];
    setForm(blankForm());
    setAiText('');
    setLocalMedia([]);
    setRemoteMedia([]);
    setServerSavedAt(null);
  };

  const allMedia = [
    ...remoteMedia.map((item) => ({
      id: item.id,
      source: 'remote' as const,
      mediaType: item.mediaType,
      viewType: item.viewType,
      previewUrl: item.publicUrl,
      filename: item.originalFilename,
      fileSize: item.fileSize,
      durationSeconds: item.durationSeconds,
    })),
    ...localMedia.map((item) => ({
      id: item.id,
      source: 'local' as const,
      mediaType: item.mediaType,
      viewType: item.viewType,
      previewUrl: item.previewUrl,
      filename: item.file.name,
      fileSize: item.file.size,
      durationSeconds: item.durationSeconds,
    })),
  ];

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-800 uppercase tracking-[0.15em] text-primary">Add product</p>
          <h1 className="mt-1 text-2xl font-800 text-foreground">Create a product listing</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Add the basic product details, photos, price and available stock. Video is optional. Save a draft at any time or publish when the essentials are ready.
          </p>
        </div>
        <button
          type="button"
          onClick={newProduct}
          className="btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs"
        >
          <Icon name="PlusIcon" size={15} /> New product
        </button>
      </div>

      {(localSavedAt || mediaSavedAt || serverSavedAt) && (
        <div className="mb-4 flex flex-wrap gap-2 text-[11px] font-800">
          {(localSavedAt || mediaSavedAt) && (
            <span className="rounded-full border border-success/20 bg-success/5 px-3 py-1.5 text-success">
              Auto-recovery on this device
            </span>
          )}
          {serverSavedAt && (
            <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-primary">
              Draft saved to your FabricTrad account
            </span>
          )}
        </div>
      )}

      {mediaDraftWarning && (
        <div className="mb-4 rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs text-warning">
          {mediaDraftWarning}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Product details</p>
              <h2 className="mt-1 text-lg font-800 text-foreground">What are you selling?</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-800 text-primary">
              Simple listing
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-800 text-foreground">Product name <span className="text-error">*</span></label>
              <input
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                className="input-base mt-2 w-full rounded-xl px-4 py-3 text-sm"
                placeholder="e.g. Royal Blue Banarasi Silk"
                maxLength={160}
              />
            </div>

            <div>
              <label className="text-xs font-800 text-foreground">Description <span className="text-error">*</span></label>
              <textarea
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                rows={5}
                className="input-base mt-2 w-full resize-y rounded-xl px-4 py-3 text-sm leading-6"
                placeholder="Describe the fabric, finish, pattern, use, feel, work or any important buyer information."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-800 text-foreground">Category</label>
                <select
                  value={form.category}
                  onChange={(event) => updateForm('category', event.target.value)}
                  className="input-base mt-2 w-full rounded-xl px-3 py-3 text-sm"
                >
                  {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-800 text-foreground">Work / finish <span className="text-muted-foreground">optional</span></label>
                <input
                  value={form.workType}
                  onChange={(event) => updateForm('workType', event.target.value)}
                  className="input-base mt-2 w-full rounded-xl px-4 py-3 text-sm"
                  placeholder="Plain, embroidery, print, zari…"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <p className="text-xs font-800 uppercase tracking-wide text-primary">Price & stock</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-800 text-foreground">Price <span className="text-error">*</span></label>
                  <div className="mt-2 flex rounded-xl border border-border bg-card focus-within:border-primary">
                    <span className="flex items-center px-3 text-sm font-800 text-muted-foreground">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.pricePerUnit}
                      onChange={(event) => updateForm('pricePerUnit', event.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"
                      placeholder="250"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-800 text-foreground">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(event) => updateForm('unit', event.target.value as CatalogUnit)}
                    className="input-base mt-2 w-full rounded-xl px-3 py-3 text-sm"
                  >
                    <option value="mtr">metre</option>
                    <option value="kg">kg</option>
                    <option value="piece">piece</option>
                    <option value="roll">roll</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-800 text-foreground">Available {form.unit === 'mtr' ? 'metres' : 'stock'} <span className="text-error">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.availableQuantity}
                    onChange={(event) => updateForm('availableQuantity', event.target.value)}
                    className="input-base mt-2 w-full rounded-xl px-4 py-3 text-sm"
                    placeholder={form.unit === 'mtr' ? '100' : '25'}
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-800 text-foreground">Minimum order</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.moq}
                    onChange={(event) => updateForm('moq', event.target.value)}
                    className="input-base mt-2 w-full rounded-xl px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-800 text-foreground">Width (inches) <span className="text-muted-foreground">optional</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.widthInches}
                    onChange={(event) => updateForm('widthInches', event.target.value)}
                    className="input-base mt-2 w-full rounded-xl px-4 py-3 text-sm"
                    placeholder="44"
                  />
                </div>
                <div>
                  <label className="text-xs font-800 text-foreground">GSM <span className="text-muted-foreground">optional</span></label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.gsm}
                    onChange={(event) => updateForm('gsm', event.target.value)}
                    className="input-base mt-2 w-full rounded-xl px-4 py-3 text-sm"
                    placeholder="120"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-800 text-foreground">Sell to</label>
                <select
                  value={form.saleChannel}
                  onChange={(event) => updateForm('saleChannel', event.target.value as SaleChannel)}
                  className="input-base mt-2 w-full rounded-xl px-3 py-3 text-sm"
                >
                  <option value="both">Business + retail buyers</option>
                  <option value="b2b">Business buyers only</option>
                  <option value="retail">Retail buyers only</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-800 text-foreground">Product format</label>
                <select
                  value={form.packageFormat}
                  onChange={(event) => updateForm('packageFormat', event.target.value as PackageFormat)}
                  className="input-base mt-2 w-full rounded-xl px-3 py-3 text-sm"
                >
                  {PACKAGE_FORMATS.map((format) => <option key={format}>{format}</option>)}
                </select>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void handleDrop(event)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Photos & video</p>
                <h2 className="mt-1 text-lg font-800 text-foreground">Show the product clearly</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  At least one photo is required to publish. Short videos are optional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-border px-3 py-2 text-xs font-800 hover:border-primary hover:text-primary"
              >
                Add media
              </button>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/25 bg-primary/5 px-4 py-6 text-center transition hover:border-primary/60"
            >
              <Icon name="ArrowUpTrayIcon" size={24} className="text-primary" />
              <span className="mt-2 text-sm font-800 text-foreground">Add product photos</span>
              <span className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP · video optional up to 20 sec</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              onChange={(event) => void addFiles(event)}
              className="hidden"
            />

            {allMedia.length > 0 && (
              <div className="mt-4 space-y-3">
                {allMedia.map((item) => (
                  <article key={`${item.source}-${item.id}`} className="grid grid-cols-[76px_1fr_auto] gap-3 rounded-xl border border-border p-3">
                    <div className="h-20 overflow-hidden rounded-lg bg-muted">
                      {item.mediaType === 'video' ? (
                        <video src={item.previewUrl} className="h-full w-full object-cover" muted playsInline />
                      ) : (
                        // Object and public URLs are intentionally rendered directly.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.previewUrl} alt={item.filename} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-800 text-foreground">{item.filename}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatBytes(item.fileSize)}
                        {item.durationSeconds ? ` · ${item.durationSeconds.toFixed(1)} sec` : ''}
                        {item.source === 'remote' ? ' · saved' : ' · pending save'}
                      </p>
                      <select
                        value={item.viewType}
                        onChange={(event) => {
                          const viewType = event.target.value as ViewType;
                          if (item.source === 'remote') updateRemoteMedia(item.id, viewType);
                          else updateLocalMedia(item.id, viewType);
                        }}
                        className="input-base mt-2 w-full rounded-lg px-2 py-1.5 text-xs"
                      >
                        <option value="front">Front view</option>
                        <option value="back">Back view</option>
                        <option value="detail">Detail / close-up</option>
                        <option value="reel">Video / reel</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => item.source === 'remote' ? removeRemoteMedia(item.id) : removeLocalMedia(item.id)}
                      className="h-9 rounded-lg px-2 text-error hover:bg-error/5"
                      aria-label={`Remove ${item.filename}`}
                    >
                      <Icon name="TrashIcon" size={16} />
                    </button>
                  </article>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2 text-[11px] font-800">
              <span className={`rounded-full px-2.5 py-1 ${imageCount ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                {imageCount} photo{imageCount === 1 ? '' : 's'}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                {videoCount} optional video{videoCount === 1 ? '' : 's'}
              </span>
            </div>
          </section>

          <details className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-800 text-foreground">
              <span className="inline-flex items-center gap-2">
                <Icon name="SparklesIcon" size={17} className="text-primary" /> AI helper <span className="text-xs font-600 text-muted-foreground">optional</span>
              </span>
            </summary>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Paste a catalogue message or describe the item. AI can fill the form, but it is never required to save or publish.
            </p>
            <textarea
              value={aiText}
              onChange={(event) => setAiText(event.target.value)}
              rows={4}
              className="input-base mt-3 w-full resize-y rounded-xl px-4 py-3 text-sm leading-6"
              placeholder="e.g. blue silk, ₹250/mtr, 80 metres, 44 inch width, zari work…"
            />
            <button
              type="button"
              onClick={() => void analyze()}
              disabled={analyzing || !aiText.trim()}
              className="btn-secondary mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs disabled:opacity-50"
            >
              <Icon name="CpuChipIcon" size={15} /> {analyzing ? 'Filling fields…' : 'Fill fields with AI'}
            </button>
          </details>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Ready to publish</p>
                <h2 className="mt-1 text-base font-800 text-foreground">
                  {publishMissing.length ? `${publishMissing.length} item${publishMissing.length === 1 ? '' : 's'} left` : 'Everything required is ready'}
                </h2>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${publishMissing.length ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                <Icon name={publishMissing.length ? 'ClockIcon' : 'CheckCircleIcon'} size={20} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {['product name', 'description', 'price', 'stock quantity', 'at least 1 photo'].map((requirement) => {
                const missing = publishMissing.includes(requirement);
                return (
                  <span key={requirement} className={`rounded-full px-2.5 py-1 text-[11px] font-800 ${missing ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                    {missing ? '○' : '✓'} {requirement}
                  </span>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-800 text-foreground">Save whenever you want</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Drafts stay private. Publishing only checks the five essentials above; videos, width, GSM and work details are optional.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={savingDraft || publishing}
              className="btn-secondary inline-flex min-w-36 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm disabled:opacity-50"
            >
              <Icon name="DocumentCheckIcon" size={17} /> {savingDraft ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={publishing || savingDraft}
              className="btn-primary inline-flex min-w-44 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm disabled:opacity-50"
            >
              <Icon name="RocketLaunchIcon" size={17} /> {publishing ? 'Publishing…' : 'Publish product'}
            </button>
          </div>
        </div>
        {isDemoAccount && (
          <p className="mt-3 text-xs text-warning">Demo sellers can test the form and local drafts, but only verified real sellers can publish.</p>
        )}
      </section>
    </div>
  );
}
