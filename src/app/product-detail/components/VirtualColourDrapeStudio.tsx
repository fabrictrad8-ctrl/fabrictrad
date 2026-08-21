'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useProduct } from '@/lib/hooks/useProduct';

const models = [
  {
    id: 'occasionwear',
    label: 'Occasionwear',
    image:
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=88',
  },
  {
    id: 'studio',
    label: 'Studio model',
    image:
      'https://images.unsplash.com/photo-1618375531912-867984bdfd87?auto=format&fit=crop&w=1200&q=88',
  },
  {
    id: 'menswear',
    label: 'Menswear',
    image:
      'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1200&q=88',
  },
] as const;

const garments = [
  { id: 'saree', label: 'Saree' },
  { id: 'lehenga', label: 'Lehenga' },
  { id: 'kurta', label: 'Kurta' },
  { id: 'shirt', label: 'Shirt' },
  { id: 'dress', label: 'Dress' },
  { id: 'dupatta', label: 'Dupatta' },
] as const;

const fits = ['Relaxed', 'Regular', 'Tailored'] as const;
const MAX_UPLOAD = 8 * 1024 * 1024;

type ServiceStatus = {
  configured: boolean;
  provider?: string | null;
  model?: string | null;
  mode?: string;
  usesListingMedia?: boolean;
};

type FabricReference = {
  name?: string;
  variantName?: string | null;
  imageCount?: number;
};

type GenerationResult = {
  image?: string;
  analysis?: string;
  provider?: string;
  model?: string;
  fabricReference?: FabricReference;
  error?: string;
};

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
}

function PortraitImage({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    // Local user-selected images cannot use next/image.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="h-full w-full object-cover" />;
  }
  return <AppImage src={src} alt={alt} fill className="object-cover" />;
}

export default function VirtualColourDrapeStudio() {
  const { product, loading: productLoading } = useProduct();
  const { user } = useAuth();
  const uploadRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [modelId, setModelId] = useState<(typeof models)[number]['id']>('occasionwear');
  const [garmentId, setGarmentId] = useState<(typeof garments)[number]['id']>('saree');
  const [fit, setFit] = useState<(typeof fits)[number]>('Regular');
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [provider, setProvider] = useState('');
  const [modelUsed, setModelUsed] = useState('');
  const [usedFabric, setUsedFabric] = useState<FabricReference | null>(null);
  const [compare, setCompare] = useState(58);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedModel = useMemo(
    () => models.find((item) => item.id === modelId) || models[0],
    [modelId]
  );
  const garment = useMemo(
    () => garments.find((item) => item.id === garmentId) || garments[0],
    [garmentId]
  );
  const variants = product.variants || [];
  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === product.selectedVariantId) || null,
    [product.selectedVariantId, variants]
  );
  const baseImage = personImage || selectedModel.image;
  const fabricImage =
    selectedVariant?.images?.[0] ||
    selectedVariant?.image ||
    product.images?.[0] ||
    product.image ||
    '';
  const fabricLabel = selectedVariant
    ? `${selectedVariant.colorName}${selectedVariant.designName ? ` · ${selectedVariant.designName}` : ''}`
    : null;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const clearGeneratedResult = useCallback(() => {
    setResult(null);
    setAnalysis('');
    setProvider('');
    setModelUsed('');
    setUsedFabric(null);
    setCompare(58);
    setError('');
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      try {
        const response = await fetch('/api/ai/drape-on', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const payload = (await response.json().catch(() => ({}))) as ServiceStatus;
        if (!cancelled) {
          setServiceStatus({
            configured: response.ok && payload.configured === true,
            provider: payload.provider || null,
            model: payload.model || null,
            mode: payload.mode,
            usesListingMedia: payload.usesListingMedia,
          });
        }
      } catch {
        if (!cancelled) setServiceStatus({ configured: false });
      }
    };
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    clearGeneratedResult();
  }, [clearGeneratedResult, product.rawProductId, product.selectedVariantId]);

  const selectModel = (next: (typeof models)[number]['id']) => {
    stopCamera();
    setModelId(next);
    setPersonImage(null);
    setPhotoConsent(false);
    setCameraError('');
    clearGeneratedResult();
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    stopCamera();
    setCameraError('');
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Upload a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_UPLOAD) {
      setError('The photo must be smaller than 8 MB.');
      return;
    }
    try {
      setPersonImage(await readImage(file));
      setPhotoConsent(false);
      clearGeneratedResult();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to use this image.');
    }
  };

  const startCamera = async () => {
    setCameraError('');
    setError('');
    clearGeneratedResult();
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setCameraError('Camera access was blocked. Allow camera permission or upload a photo instead.');
    }
  };

  const captureCamera = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera is still starting. Try again in a moment.');
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPersonImage(canvas.toDataURL('image/jpeg', 0.9));
    setPhotoConsent(false);
    stopCamera();
    clearGeneratedResult();
  };

  const generate = async () => {
    setError('');
    if (!user) {
      setError('Sign in as a buyer to generate a private AI try-on.');
      return;
    }
    if (!product.rawProductId || product.rawProductId === 'unavailable') {
      setError('Open a live FabricTrad product before generating a try-on.');
      return;
    }
    if (!fabricImage) {
      setError('This listing does not have a usable fabric photo.');
      return;
    }
    if (serviceStatus?.configured === false) {
      setError('The AI image service is not configured on the live website yet.');
      return;
    }
    if (personImage && !photoConsent) {
      setError('Confirm that you own the uploaded/captured photo or have permission to use it.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/drape-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          productId: product.rawProductId,
          variantId: product.selectedVariantId,
          modelImage: baseImage,
          garmentId,
          fit,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as GenerationResult;
      if (!response.ok || !payload.image) {
        throw new Error(payload.error || 'Unable to generate the AI try-on.');
      }
      setResult(payload.image);
      setAnalysis(
        payload.analysis ||
          'AI try-on generated from the selected live listing. Confirm the physical fabric before production.'
      );
      setProvider(payload.provider || serviceStatus?.provider || 'AI image provider');
      setModelUsed(payload.model || serviceStatus?.model || '');
      setUsedFabric(payload.fabricReference || null);
      setCompare(58);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Unable to generate the AI try-on.'
      );
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    stopCamera();
    setModelId('occasionwear');
    setGarmentId('saree');
    setFit('Regular');
    setPersonImage(null);
    setPhotoConsent(false);
    setCameraError('');
    clearGeneratedResult();
  };

  const download = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result;
    link.download = `${(product.name || 'fabrictrad-ai-try-on')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-ai-try-on.jpg`;
    link.click();
  };

  const generationDisabled =
    loading ||
    productLoading ||
    serviceStatus?.configured === false ||
    !product.rawProductId ||
    Boolean(personImage && !photoConsent);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border bg-card card-shadow-lg">
      <header className="bg-gradient-to-r from-secondary via-navy-light to-secondary px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-800 uppercase tracking-[0.18em] text-gold">
              <Icon name="SparklesIcon" size={16} /> FabricTrad AI Try-On
            </p>
            <h2 className="mt-2 text-2xl font-800 sm:text-3xl">
              See this exact fabric as a wearable garment
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Choose a person, garment and fit. FabricTrad uses the live seller&apos;s product photos
              and selected colour as the textile reference for a new AI-generated image.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white/80">
            <p className="flex items-center gap-2 font-800 text-white">
              <Icon name="CpuChipIcon" size={15} /> Real image generation
            </p>
            <p className="mt-1 max-w-[250px] leading-5">
              No browser texture trick. The server loads the approved listing fabric and sends it to
              the configured image model together with the person reference.
            </p>
          </div>
        </div>
      </header>

      <div className="grid xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="border-b border-border p-5 sm:p-6 xl:border-b-0 xl:border-r">
          <div
            className={`rounded-2xl border p-4 ${
              serviceStatus === null
                ? 'border-border bg-muted/40'
                : serviceStatus.configured
                  ? 'border-success/20 bg-success/5'
                  : 'border-error/20 bg-error/10'
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon
                name={
                  serviceStatus === null
                    ? 'ArrowPathIcon'
                    : serviceStatus.configured
                      ? 'CheckCircleIcon'
                      : 'ExclamationTriangleIcon'
                }
                size={18}
                className={`mt-0.5 shrink-0 ${
                  serviceStatus?.configured
                    ? 'text-success'
                    : serviceStatus === null
                      ? 'animate-spin text-muted-foreground'
                      : 'text-error'
                }`}
              />
              <div>
                <p className="text-xs font-800 text-foreground">
                  {serviceStatus === null
                    ? 'Checking AI service'
                    : serviceStatus.configured
                      ? `${serviceStatus.provider || 'AI image service'} ready`
                      : 'AI image service unavailable'}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {serviceStatus?.configured
                    ? `Real AI image editing${serviceStatus.model ? ` · ${serviceStatus.model}` : ''}.`
                    : serviceStatus === null
                      ? 'Checking the live image-generation endpoint.'
                      : 'Generation is disabled until an AI image provider is configured.'}
                </p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">
            1 · Choose a person
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            A clear standing 3/4 or full-body photo with visible arms usually gives the best result.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {models.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectModel(item.id)}
                className={`overflow-hidden rounded-xl border-2 text-left transition ${
                  modelId === item.id && !personImage
                    ? 'border-primary shadow-md ring-2 ring-primary/10'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="relative aspect-[3/4]">
                  <AppImage src={item.image} alt={item.label} fill className="object-cover" />
                </div>
                <p className="truncate px-2 py-2 text-[10px] font-800 text-foreground">
                  {item.label}
                </p>
              </button>
            ))}
          </div>

          <input
            ref={uploadRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleUpload}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              className="btn-secondary flex items-center justify-center gap-2 rounded-xl py-3 text-xs"
            >
              <Icon name="ArrowUpTrayIcon" size={16} /> Upload photo
            </button>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="btn-secondary flex items-center justify-center gap-2 rounded-xl py-3 text-xs"
            >
              <Icon name="CameraIcon" size={16} /> Use camera
            </button>
          </div>

          {cameraActive && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-primary/25 bg-black">
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="aspect-[3/4] w-full scale-x-[-1] object-cover"
              />
              <div className="grid grid-cols-2 gap-2 bg-card p-3">
                <button type="button" onClick={captureCamera} className="btn-primary rounded-xl py-2.5 text-xs">
                  Capture photo
                </button>
                <button type="button" onClick={stopCamera} className="btn-secondary rounded-xl py-2.5 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          {cameraError && (
            <p className="mt-3 rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs leading-5 text-warning">
              {cameraError}
            </p>
          )}

          {personImage && (
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={photoConsent}
                  onChange={(event) => {
                    setPhotoConsent(event.target.checked);
                    setError('');
                  }}
                  className="mt-1 h-4 w-4 rounded border-border accent-primary"
                />
                <span>I own this photo or have permission to use it for AI generation.</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setPersonImage(null);
                  setPhotoConsent(false);
                  clearGeneratedResult();
                }}
                className="w-full rounded-xl py-2 text-xs font-800 text-muted-foreground hover:bg-muted"
              >
                Use a FabricTrad model instead
              </button>
            </div>
          )}

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">
            2 · Choose the garment
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {garments.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setGarmentId(item.id);
                  clearGeneratedResult();
                }}
                className={`rounded-xl border px-2 py-2.5 text-xs font-800 transition ${
                  garmentId === item.id
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border text-foreground hover:border-primary/40'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">
            3 · Choose the fit
          </p>
          <div className="mt-3 flex gap-2">
            {fits.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setFit(item);
                  clearGeneratedResult();
                }}
                className={`flex-1 rounded-xl border py-2 text-xs font-800 transition ${
                  fit === item
                    ? 'border-secondary bg-secondary text-white'
                    : 'border-border text-foreground hover:border-secondary/40'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
              {fabricImage ? (
                <AppImage src={fabricImage} alt={product.name || 'Selected live fabric'} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Icon name="PhotoIcon" size={20} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-800 uppercase tracking-wider text-primary">Live listing fabric</p>
              <p className="mt-1 truncate text-sm font-800 text-foreground">{product.name || 'Selected fabric'}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {fabricLabel || (product.gsm ? `${product.gsm} GSM` : product.work || 'Product reference')}
              </p>
              {product.selectedVariantId && (
                <p className="mt-1 text-[10px] font-700 text-success">Selected colour variant is used by the server</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={generationDisabled}
            className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating virtual garment…
              </>
            ) : (
              <>
                <Icon name="SparklesIcon" size={18} /> Generate AI try-on
              </>
            )}
          </button>

          {!user && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <Link href="/login" className="font-800 text-primary hover:underline">Sign in as a buyer</Link>{' '}
              to generate securely.
            </p>
          )}
          <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">
            Generation can take around a minute or two. Your personal photo is sent only when you press Generate.
          </p>
          <button
            type="button"
            onClick={reset}
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-800 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <Icon name="ArrowPathIcon" size={15} /> Reset try-on
          </button>
          {error && (
            <p className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-xs font-700 leading-5 text-error">{error}</p>
          )}
        </aside>

        <section className="min-w-0 bg-muted/35 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-800 uppercase tracking-wider text-primary">AI virtual try-on</p>
                <h3 className="mt-1 text-xl font-800 text-foreground">
                  {result ? 'Compare the generated garment with the original' : 'Ready for generation'}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">{garment.label} · {fit} fit</p>
            </div>

            <div className="relative mx-auto aspect-[2/3] max-h-[900px] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
              <div className="absolute inset-0">
                <PortraitImage src={baseImage} alt="Person selected for AI virtual try-on" />
              </div>
              {result && (
                <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${compare}%` }}>
                  {/* AI outputs are data URLs and cannot use next/image. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result}
                    alt="AI-generated garment made from the selected FabricTrad textile"
                    className="h-full max-w-none object-cover"
                    style={{ width: `${10000 / compare}%` }}
                  />
                </div>
              )}
              {result && (
                <div
                  className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_16px_rgba(0,0,0,0.45)]"
                  style={{ left: `${compare}%` }}
                >
                  <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-secondary shadow-xl">
                    <Icon name="ArrowsRightLeftIcon" size={19} />
                  </div>
                </div>
              )}
              <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-800 uppercase tracking-wider text-white backdrop-blur-sm">
                {result ? 'AI garment' : personImage ? 'Your photo' : 'Selected model'}
              </span>
              {result && (
                <span className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-800 uppercase tracking-wider text-white backdrop-blur-sm">Original</span>
              )}
              {!result && !loading && (
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-black/65 p-4 text-white backdrop-blur-md sm:inset-x-6 sm:bottom-6">
                  <p className="flex items-center gap-2 text-sm font-800">
                    <Icon name="SparklesIcon" size={17} className="text-gold" /> No fake overlay
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/75">
                    The server uses this product&apos;s real listing photos as textile references and asks the image model to construct a new garment with seams, folds, shadows and fabric texture.
                  </p>
                </div>
              )}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-secondary/75 p-6 text-center text-white backdrop-blur-sm">
                  <div className="max-w-sm">
                    <span className="mx-auto block h-11 w-11 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                    <p className="mt-5 text-lg font-800">Constructing the virtual garment</p>
                    <p className="mt-2 text-sm leading-6 text-white/75">
                      AI is matching the person, garment structure and selected live fabric reference. Keep this page open until it finishes.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {result ? (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <label className="flex items-center justify-between gap-4 text-xs font-800 text-foreground">
                  <span>Compare AI result with the original person</span>
                  <span className="text-primary">{compare}% AI</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="95"
                  value={compare}
                  onChange={(event) => setCompare(Number(event.target.value))}
                  className="mt-3 w-full accent-primary"
                />
                <div className="mt-5 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-800 text-foreground">
                      Generated by {provider || 'AI image service'}{modelUsed ? ` · ${modelUsed}` : ''}
                    </p>
                    {usedFabric?.name && (
                      <p className="mt-1 text-xs font-800 text-success">
                        Fabric: {usedFabric.name}{usedFabric.variantName ? ` · ${usedFabric.variantName}` : ''}{usedFabric.imageCount && usedFabric.imageCount > 1 ? ` · ${usedFabric.imageCount} listing references used` : ''}
                      </p>
                    )}
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{analysis}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => void generate()}
                      disabled={loading}
                      className="btn-secondary flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs"
                    >
                      <Icon name="ArrowPathIcon" size={15} /> Generate again
                    </button>
                    <button
                      type="button"
                      onClick={download}
                      className="btn-secondary flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs"
                    >
                      <Icon name="ArrowDownTrayIcon" size={16} /> Download
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-800 uppercase tracking-wider text-primary">Person</p>
                  <p className="mt-1 text-xs font-800 text-foreground">{personImage ? 'Your uploaded/captured photo' : selectedModel.label}</p>
                </div>
                <div>
                  <p className="text-[10px] font-800 uppercase tracking-wider text-primary">Garment</p>
                  <p className="mt-1 text-xs font-800 text-foreground">{garment.label} · {fit}</p>
                </div>
                <div>
                  <p className="text-[10px] font-800 uppercase tracking-wider text-primary">Fabric</p>
                  <p className="mt-1 truncate text-xs font-800 text-foreground">{product.name || 'Selected fabric'}</p>
                  {fabricLabel && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{fabricLabel}</p>}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-xs leading-5 text-muted-foreground">
              <Icon name="InformationCircleIcon" size={17} className="mt-0.5 shrink-0 text-primary" />
              <p>
                AI try-on is a sourcing preview, not a physical fit guarantee. Exact shade, pattern placement, drape, thickness and tailoring can vary. Confirm important production details against the seller&apos;s physical fabric sample.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
