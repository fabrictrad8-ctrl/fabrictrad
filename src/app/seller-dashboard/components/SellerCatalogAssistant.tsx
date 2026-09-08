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
import { type ParsedCatalogDraft, type SaleChannel } from '@/lib/catalogAssistant';

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

type CustomAttribute = {
  id: string;
  name: string;
  value: string;
};

type ProductForm = {
  draftKey: string;
  name: string;
  description: string;
  fabricName: string;
  category: string;
  quality: string;
  productType: string;
  pricePerUnit: string;
  unitLabel: string;
  availableQuantity: string;
  moq: string;
  widthInches: string;
  gsm: string;
  workType: string;
  saleChannel: SaleChannel;
  productUrl: string;
  showProductUrl: boolean;
  customAttributes: CustomAttribute[];
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

const FABRIC_SUGGESTIONS = [
  'Cotton', 'Silk', 'Banarasi Silk', 'Raw Silk', 'Chanderi', 'Georgette', 'Chiffon',
  'Organza', 'Velvet', 'Linen', 'Denim', 'Wool', 'Satin', 'Crepe', 'Rayon', 'Viscose',
  'Polyester', 'Nylon', 'Net', 'Lace', 'Khadi', 'Handloom', 'Muslin', 'Twill', 'Jacquard',
  'Brocade', 'Modal', 'Lyocell', 'Jersey', 'Fleece', 'Canvas', 'Corduroy', 'Poplin',
];

const PRODUCT_TYPE_SUGGESTIONS = [
  'Fabric Only', 'Saree', 'Sherwani', 'Jodhpuri', 'Indo-Western', 'Lehenga', 'Kurta',
  'Kurta Set', 'Shirt', 'Dress', 'Dupatta', 'Blouse', 'Top', 'Bottom', 'Top & Bottom',
  'Suiting', 'Shirting', 'Menswear', 'Womenswear', 'Kidswear', 'Full Set', 'Accessory',
];

const QUALITY_SUGGESTIONS = [
  'Premium', 'Standard', 'Export Quality', 'Mill Made', 'Handloom', 'Pure', 'Blend',
  'Soft Finish', 'Heavy Quality', 'Lightweight', 'Dyeable', 'Pre-washed',
];

const UNIT_SUGGESTIONS = [
  'metre', 'meter', 'mtr', 'yard', 'kg', 'kilogram', 'farma', 'piece', 'pieces', 'roll',
];

function makeDraftKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function blankForm(draftKey = makeDraftKey()): ProductForm {
  return {
    draftKey,
    name: '',
    description: '',
    fabricName: '',
    category: '',
    quality: '',
    productType: 'Fabric Only',
    pricePerUnit: '',
    unitLabel: 'metre',
    availableQuantity: '',
    moq: '1',
    widthInches: '',
    gsm: '',
    workType: '',
    saleChannel: 'both',
    productUrl: '',
    showProductUrl: false,
    customAttributes: [],
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

function unitCode(value: string) {
  const normalized = value.trim().toLowerCase();
  if (/^(m|mtr|metre|meter|metres|meters)$/.test(normalized)) return 'mtr';
  if (/^(kg|kgs|kilogram|kilograms|kilo|kilos)$/.test(normalized)) return 'kg';
  if (/^(yd|yard|yards)$/.test(normalized)) return 'yard';
  if (/^farma$/.test(normalized)) return 'farma';
  if (/^(piece|pieces|pc|pcs)$/.test(normalized)) return 'piece';
  if (/^(roll|rolls)$/.test(normalized)) return 'roll';
  return 'custom';
}

function unitDisplay(value: string) {
  if (value === 'mtr') return 'metre';
  if (value === 'kg') return 'kg';
  if (value === 'piece') return 'piece';
  if (value === 'roll') return 'roll';
  if (value === 'yard') return 'yard';
  if (value === 'farma') return 'farma';
  return value || 'metre';
}

function customAttributesObject(rows: CustomAttribute[]) {
  return rows.reduce<Record<string, string>>((result, row) => {
    const name = row.name.trim().slice(0, 100);
    const value = row.value.trim().slice(0, 500);
    if (name && value) result[name] = value;
    return result;
  }, {});
}

function isOptionalUrlValid(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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
        const restored = { ...blankForm(draftKey), ...saved.form, draftKey };
        restored.showProductUrl = Boolean(restored.productUrl) || Boolean(restored.showProductUrl);
        restored.customAttributes = Array.isArray(restored.customAttributes)
          ? restored.customAttributes
          : [];
        setForm(restored);
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
        const { data: seller } = await supabase
          .from('seller_profiles')
          .select('id,verification_status')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!seller?.id || cancelled) return;
        setSellerState({
          id: String(seller.id),
          verificationStatus: String(seller.verification_status || ''),
        });
        const { data: rows, error } = await supabase
          .from('seller_product_drafts')
          .select('draft_key,payload,media,updated_at')
          .eq('seller_id', seller.id)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        const latest = rows?.[0];
        if (!latest || cancelled) return;
        const serverTime = Date.parse(String(latest.updated_at || '')) || 0;
        const localTime = Date.parse(localSavedAt || '') || 0;
        setServerSavedAt(String(latest.updated_at || ''));
        if (serverTime < localTime) return;
        const payload = (latest.payload || {}) as Partial<ComposerSnapshot>;
        if (payload.form) {
          const draftKey = payload.form.draftKey || String(latest.draft_key) || makeDraftKey();
          const restored = { ...blankForm(draftKey), ...payload.form, draftKey };
          restored.showProductUrl = Boolean(restored.productUrl) || Boolean(restored.showProductUrl);
          setForm(restored);
        }
        setAiText(payload.aiText || '');
        setRemoteMedia(Array.isArray(latest.media) ? (latest.media as PersistedMedia[]) : []);
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
        fabricName: parsed.fabric || current.fabricName,
        category: parsed.category || current.category,
        pricePerUnit: parsed.pricePerUnit > 0 ? String(parsed.pricePerUnit) : current.pricePerUnit,
        unitLabel: unitDisplay(parsed.unit),
        availableQuantity:
          parsed.availableQuantity >= 0 ? String(parsed.availableQuantity) : current.availableQuantity,
        moq: parsed.moq > 0 ? String(parsed.moq) : current.moq,
        widthInches: parsed.widthInches ? String(parsed.widthInches) : current.widthInches,
        gsm: parsed.gsm ? String(parsed.gsm) : current.gsm,
        workType: parsed.workType || current.workType,
        saleChannel: parsed.saleChannel || current.saleChannel,
        productType: parsed.packageFormat || current.productType,
      }));
      toast.success('Product fields filled. Every field remains editable.');
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
        } catch {
          toast.error(`${file.name}: this video could not be read.`);
          continue;
        }
        if (durationSeconds < 1 || durationSeconds > MAX_VIDEO_SECONDS) {
          toast.error(`${file.name}: videos must be between 1 and 20 seconds.`);
          continue;
        }
      }
      const existingImages =
        remoteMedia.filter((item) => item.mediaType === 'image').length +
        localMedia.filter((item) => item.mediaType === 'image').length +
        accepted.filter((item) => item.mediaType === 'image').length;
      accepted.push({
        id: makeDraftKey(),
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

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
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

  const uploadPendingMedia = useCallback(
    async (sellerId: string) => {
      if (!user?.id || !localMedia.length) return remoteMedia;
      const supabase = createClient();
      const uploaded = [...remoteMedia];
      for (const item of localMedia) {
        const storagePath = `${user.id}/${sellerId}/drafts/${form.draftKey}/${item.id}-${safeFilename(item.file.name)}`;
        const { error } = await supabase.storage
          .from('seller-product-media')
          .upload(storagePath, item.file, {
            cacheControl: '31536000',
            contentType: item.file.type,
            upsert: true,
          });
        if (error) throw error;
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
      toast.success('Draft saved on this device.');
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
      toast.success('Draft saved. You can return and continue later.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Draft could not be saved.');
    } finally {
      setSavingDraft(false);
    }
  };

  const imageCount = useMemo(
    () => remoteMedia.filter((item) => item.mediaType === 'image').length + localMedia.filter((item) => item.mediaType === 'image').length,
    [localMedia, remoteMedia]
  );
  const videoCount = useMemo(
    () => remoteMedia.filter((item) => item.mediaType === 'video').length + localMedia.filter((item) => item.mediaType === 'video').length,
    [localMedia, remoteMedia]
  );

  const publishMissing = useMemo(() => {
    const missing: string[] = [];
    if (form.name.trim().length < 2) missing.push('product name');
    if (form.description.trim().length < 5) missing.push('description');
    if (positiveNumber(form.pricePerUnit) <= 0) missing.push('price');
    if (positiveNumber(form.availableQuantity) <= 0) missing.push('stock quantity');
    if (!form.unitLabel.trim()) missing.push('measurement unit');
    if (imageCount < 1) missing.push('at least 1 photo');
    return missing;
  }, [form.availableQuantity, form.description, form.name, form.pricePerUnit, form.unitLabel, imageCount]);

  const publish = async () => {
    if (publishing || savingDraft) return;
    if (isDemoAccount) return toast.error('Use a real verified seller account to publish products.');
    if (!user?.id) return toast.error('Sign in again to publish this product.');
    if (publishMissing.length) return toast.error(`Before publishing, add: ${publishMissing.join(', ')}.`);
    if (!isOptionalUrlValid(form.productUrl)) return toast.error('Product URL must begin with http:// or https://, or be left blank.');
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
      const attributes = customAttributesObject(form.customAttributes);
      const packageFormat = form.productType.trim() || 'Fabric Only';
      const customUnitLabel = form.unitLabel.trim();
      const parentPayload = {
        seller_id: seller.id,
        name: form.name.trim(),
        sku: generatedSku || `FT-${Date.now()}`,
        category: form.category.trim() || form.fabricName.trim() || form.productType.trim() || 'Other',
        fabric_name: form.fabricName.trim() || null,
        quality: form.quality.trim() || null,
        product_type: form.productType.trim() || null,
        description: form.description.trim(),
        price_per_unit: positiveNumber(form.pricePerUnit),
        unit: unitCode(customUnitLabel),
        unit_label: customUnitLabel,
        available_quantity: positiveNumber(form.availableQuantity),
        reserved_quantity: 0,
        min_stock: 0,
        moq: Math.max(1, Math.floor(positiveNumber(form.moq) || 1)),
        gsm: optionalPositiveNumber(form.gsm),
        width_inches: optionalPositiveNumber(form.widthInches),
        work_type: form.workType.trim() || 'Plain',
        custom_attributes: attributes,
        product_url: form.productUrl.trim() || null,
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
        package_format: packageFormat,
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
        const { data, error } = await supabase.from('seller_products').insert(parentPayload).select('id').single();
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
      await supabase.from('seller_product_drafts').delete().eq('seller_id', seller.id).eq('draft_key', form.draftKey);
      clearComposerDraft();
      await clearMediaDraft();
      setForm(blankForm());
      setAiText('');
      setRemoteMedia([]);
      setLocalMedia([]);
      setServerSavedAt(null);
      toast.success('Product published. Your custom names, unit and attributes are saved exactly as entered.');
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
      id: item.id, source: 'remote' as const, mediaType: item.mediaType, viewType: item.viewType,
      previewUrl: item.publicUrl, filename: item.originalFilename, fileSize: item.fileSize,
      durationSeconds: item.durationSeconds,
    })),
    ...localMedia.map((item) => ({
      id: item.id, source: 'local' as const, mediaType: item.mediaType, viewType: item.viewType,
      previewUrl: item.previewUrl, filename: item.file.name, fileSize: item.file.size,
      durationSeconds: item.durationSeconds,
    })),
  ];

  const textInput = 'input-base mt-2 w-full rounded-xl px-4 py-3 text-sm';

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-800 uppercase tracking-[0.15em] text-primary">Add product</p>
          <h1 className="mt-1 text-2xl font-800 text-foreground">Create your product your way</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Fabric names, categories, quality, product type and stock units are fully editable. Suggestions are optional — you can type any value used by your business.
          </p>
        </div>
        <button type="button" onClick={newProduct} className="btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs">
          <Icon name="PlusIcon" size={15} /> New product
        </button>
      </div>

      {(localSavedAt || mediaSavedAt || serverSavedAt) && (
        <div className="mb-4 flex flex-wrap gap-2 text-[11px] font-800">
          {(localSavedAt || mediaSavedAt) && <span className="rounded-full border border-success/20 bg-success/5 px-3 py-1.5 text-success">Auto-recovery on this device</span>}
          {serverSavedAt && <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-primary">Draft saved to FabricTrad</span>}
        </div>
      )}
      {mediaDraftWarning && <div className="mb-4 rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs text-warning">{mediaDraftWarning}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Product details</p>
          <h2 className="mt-1 text-lg font-800 text-foreground">Everything here is vendor-editable</h2>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-800">Product name <span className="text-error">*</span></label>
              <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} className={textInput} placeholder="e.g. Royal Blue Banarasi Silk" maxLength={160} />
            </div>
            <div>
              <label className="text-xs font-800">Description <span className="text-error">*</span></label>
              <textarea value={form.description} onChange={(e) => updateForm('description', e.target.value)} rows={5} className={`${textInput} resize-y leading-6`} placeholder="Describe the product in your own words." />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-800">Fabric name</label>
                <input list="fabrictrad-fabrics" value={form.fabricName} onChange={(e) => updateForm('fabricName', e.target.value)} className={textInput} placeholder="Type any fabric name" />
              </div>
              <div>
                <label className="text-xs font-800">Category</label>
                <input list="fabrictrad-categories" value={form.category} onChange={(e) => updateForm('category', e.target.value)} className={textInput} placeholder="Cotton, Sherwani, Saree, Jodhpuri…" />
              </div>
              <div>
                <label className="text-xs font-800">Quality</label>
                <input list="fabrictrad-quality" value={form.quality} onChange={(e) => updateForm('quality', e.target.value)} className={textInput} placeholder="Type your quality name" />
              </div>
              <div>
                <label className="text-xs font-800">Product type / format</label>
                <input list="fabrictrad-product-types" value={form.productType} onChange={(e) => updateForm('productType', e.target.value)} className={textInput} placeholder="Fabric Only, Saree, Indo-Western…" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-800">Work / finish <span className="text-muted-foreground">optional</span></label>
                <input value={form.workType} onChange={(e) => updateForm('workType', e.target.value)} className={textInput} placeholder="Plain, embroidery, print, zari, your own term…" />
              </div>
            </div>

            <datalist id="fabrictrad-fabrics">{FABRIC_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
            <datalist id="fabrictrad-categories">{[...FABRIC_SUGGESTIONS, ...PRODUCT_TYPE_SUGGESTIONS].map((item) => <option key={item} value={item} />)}</datalist>
            <datalist id="fabrictrad-quality">{QUALITY_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
            <datalist id="fabrictrad-product-types">{PRODUCT_TYPE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
            <datalist id="fabrictrad-units">{UNIT_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <p className="text-xs font-800 uppercase tracking-wide text-primary">Price & availability</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-800">Price <span className="text-error">*</span></label>
                  <div className="mt-2 flex rounded-xl border border-border bg-card focus-within:border-primary">
                    <span className="flex items-center px-3 font-800 text-muted-foreground">₹</span>
                    <input type="number" min="0" step="0.01" value={form.pricePerUnit} onChange={(e) => updateForm('pricePerUnit', e.target.value)} className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none" placeholder="250" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-800">Measurement unit <span className="text-error">*</span></label>
                  <input list="fabrictrad-units" value={form.unitLabel} onChange={(e) => updateForm('unitLabel', e.target.value)} className={textInput} placeholder="metre, yard, kg, farma…" />
                </div>
                <div>
                  <label className="text-xs font-800">Available {form.unitLabel.trim() || 'stock'} <span className="text-error">*</span></label>
                  <input type="number" min="0" step="0.01" value={form.availableQuantity} onChange={(e) => updateForm('availableQuantity', e.target.value)} className={textInput} placeholder="100" />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">The unit label is yours: metre, yard, kilo, farma, pieces, rolls, or another business-specific term.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-800">Minimum order</label>
                  <input type="number" min="1" step="1" value={form.moq} onChange={(e) => updateForm('moq', e.target.value)} className={textInput} />
                </div>
                <div>
                  <label className="text-xs font-800">Width (inches) <span className="text-muted-foreground">optional</span></label>
                  <input type="number" min="0" step="0.1" value={form.widthInches} onChange={(e) => updateForm('widthInches', e.target.value)} className={textInput} placeholder="44" />
                </div>
                <div>
                  <label className="text-xs font-800">GSM <span className="text-muted-foreground">optional</span></label>
                  <input type="number" min="0" step="1" value={form.gsm} onChange={(e) => updateForm('gsm', e.target.value)} className={textInput} placeholder="120" />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-800">Sell to</label>
                <select value={form.saleChannel} onChange={(e) => updateForm('saleChannel', e.target.value as SaleChannel)} className={textInput}>
                  <option value="both">Business + retail buyers</option>
                  <option value="b2b">Business buyers only</option>
                  <option value="retail">Retail buyers only</option>
                </select>
              </div>
              <div className="flex items-end">
                {!form.showProductUrl ? (
                  <button type="button" onClick={() => updateForm('showProductUrl', true)} className="btn-secondary w-full rounded-xl px-4 py-3 text-sm">+ Add product URL (optional)</button>
                ) : (
                  <div className="w-full">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-800">Product URL <span className="text-muted-foreground">optional</span></label>
                      <button type="button" onClick={() => setForm((current) => ({ ...current, showProductUrl: false, productUrl: '' }))} className="text-[11px] font-800 text-muted-foreground hover:text-foreground">Remove</button>
                    </div>
                    <input type="url" value={form.productUrl} onChange={(e) => updateForm('productUrl', e.target.value)} className={textInput} placeholder="https://…" />
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-800">Custom attributes</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add any specification your catalogue uses. There is no fixed list.</p>
                </div>
                <button type="button" onClick={() => updateForm('customAttributes', [...form.customAttributes, { id: makeDraftKey(), name: '', value: '' }])} className="btn-secondary rounded-xl px-3 py-2 text-xs">+ Add attribute</button>
              </div>
              {form.customAttributes.length > 0 && (
                <div className="mt-3 space-y-2">
                  {form.customAttributes.map((attribute) => (
                    <div key={attribute.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input value={attribute.name} onChange={(e) => updateForm('customAttributes', form.customAttributes.map((item) => item.id === attribute.id ? { ...item, name: e.target.value } : item))} className="input-base rounded-xl px-3 py-2.5 text-sm" placeholder="Attribute name" />
                      <input value={attribute.value} onChange={(e) => updateForm('customAttributes', form.customAttributes.map((item) => item.id === attribute.id ? { ...item, value: e.target.value } : item))} className="input-base rounded-xl px-3 py-2.5 text-sm" placeholder="Value" />
                      <button type="button" onClick={() => updateForm('customAttributes', form.customAttributes.filter((item) => item.id !== attribute.id))} className="rounded-xl px-3 py-2 text-error hover:bg-error/5" aria-label="Remove attribute"><Icon name="TrashIcon" size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" onDragOver={(e) => e.preventDefault()} onDrop={(e) => void handleDrop(e)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Photos & video</p>
                <h2 className="mt-1 text-lg font-800">Show the product clearly</h2>
                <p className="mt-1 text-xs text-muted-foreground">At least one photo is required. Video is optional.</p>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-border px-3 py-2 text-xs font-800">Add media</button>
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/25 bg-primary/5 px-4 py-6 text-center">
              <Icon name="ArrowUpTrayIcon" size={24} className="text-primary" />
              <span className="mt-2 text-sm font-800">Add product photos</span>
              <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP · video optional up to 20 sec</span>
            </button>
            <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" onChange={(e) => void addFiles(e)} className="hidden" />
            {allMedia.length > 0 && (
              <div className="mt-4 space-y-3">
                {allMedia.map((item) => (
                  <article key={`${item.source}-${item.id}`} className="grid grid-cols-[76px_1fr_auto] gap-3 rounded-xl border border-border p-3">
                    <div className="h-20 overflow-hidden rounded-lg bg-muted">
                      {item.mediaType === 'video' ? <video src={item.previewUrl} className="h-full w-full object-cover" muted playsInline /> : <img src={item.previewUrl} alt={item.filename} className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-800">{item.filename}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{formatBytes(item.fileSize)}{item.durationSeconds ? ` · ${item.durationSeconds.toFixed(1)} sec` : ''}{item.source === 'remote' ? ' · saved' : ' · pending save'}</p>
                    </div>
                    <button type="button" onClick={() => item.source === 'local' ? removeLocalMedia(item.id) : setRemoteMedia((current) => current.filter((remote) => remote.id !== item.id))} className="h-9 rounded-lg px-2 text-error" aria-label={`Remove ${item.filename}`}><Icon name="TrashIcon" size={16} /></button>
                  </article>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2 text-[11px] font-800">
              <span className={`rounded-full px-2.5 py-1 ${imageCount ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{imageCount} photo{imageCount === 1 ? '' : 's'}</span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{videoCount} optional video{videoCount === 1 ? '' : 's'}</span>
            </div>
          </section>

          <details className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-800"><span className="inline-flex items-center gap-2"><Icon name="SparklesIcon" size={17} className="text-primary" /> AI helper <span className="text-xs font-600 text-muted-foreground">optional</span></span></summary>
            <p className="mt-3 text-xs text-muted-foreground">Paste a catalogue message. AI may suggest values, but every value stays editable.</p>
            <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={4} className={`${textInput} resize-y`} placeholder="e.g. blue silk, ₹250 per yard, 80 yards, premium zari work…" />
            <button type="button" onClick={() => void analyze()} disabled={analyzing || !aiText.trim()} className="btn-secondary mt-3 rounded-xl px-4 py-2.5 text-xs disabled:opacity-50">{analyzing ? 'Filling fields…' : 'Fill fields with AI'}</button>
          </details>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Ready to publish</p>
            <h2 className="mt-1 text-base font-800">{publishMissing.length ? `${publishMissing.length} required item${publishMissing.length === 1 ? '' : 's'} left` : 'Everything required is ready'}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {['product name', 'description', 'price', 'stock quantity', 'measurement unit', 'at least 1 photo'].map((requirement) => {
                const missing = publishMissing.includes(requirement);
                return <span key={requirement} className={`rounded-full px-2.5 py-1 text-[11px] font-800 ${missing ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>{missing ? '○' : '✓'} {requirement}</span>;
              })}
            </div>
          </section>
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-800">Save whenever you want</p>
            <p className="mt-1 text-xs text-muted-foreground">Drafts can be saved incomplete. URL, video, GSM, width, quality and custom attributes are optional.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void saveDraft()} disabled={savingDraft || publishing} className="btn-secondary inline-flex min-w-36 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm disabled:opacity-50"><Icon name="DocumentCheckIcon" size={17} /> {savingDraft ? 'Saving…' : 'Save draft'}</button>
            <button type="button" onClick={() => void publish()} disabled={publishing || savingDraft} className="btn-primary inline-flex min-w-44 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm disabled:opacity-50"><Icon name="RocketLaunchIcon" size={17} /> {publishing ? 'Publishing…' : 'Publish product'}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
