'use client';

import {
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
import InteractiveFabricMannequin3D from './InteractiveFabricMannequin3D';
import {
  drapeProductStyleApiId,
  drapeProductStyleLabel,
  drapeProductStylePrompt,
  inferDrapeProductStyle,
} from '@/lib/drapeProductStyle';

const fits = ['Relaxed', 'Regular', 'Tailored'] as const;
const MAX_UPLOAD = 8 * 1024 * 1024;
const DEFAULT_MODEL_IMAGE =
  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=88';
const DB_NAME = 'fabrictrad-hybrid-drape';
const STORE_NAME = 'sessions';

type StudioView = '3d' | 'ai';
type PersonMode = 'model' | 'photo';
type Fit = (typeof fits)[number];

type ServiceStatus = {
  configured: boolean;
  provider?: string | null;
  model?: string | null;
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

type StoredState = {
  view: StudioView;
  personMode: PersonMode;
  fit: Fit;
  personImage: string | null;
  photoConsent: boolean;
  result: string | null;
  analysis: string;
  provider: string;
  modelUsed: string;
  usedFabric: FabricReference | null;
};

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
}

function openStateDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function restoreState(key: string): Promise<StoredState | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openStateDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as StoredState | undefined) || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function persistState(key: string, state: StoredState) {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openStateDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(state, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Persistence is best effort. Never interrupt the shopping experience.
  }
}

function PortraitImage({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="h-full w-full object-cover" />;
  }
  return <AppImage src={src} alt={alt} fill className="object-cover" />;
}

export default function HybridVirtualDrapeStudio() {
  const { product, loading: productLoading } = useProduct();
  const { user } = useAuth();
  const uploadRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const restoredKeyRef = useRef('');
  const resultRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<StudioView>('3d');
  const [personMode, setPersonMode] = useState<PersonMode>('model');
  const [fit, setFit] = useState<Fit>('Regular');
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
  const [loading, setLoading] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [error, setError] = useState('');

  const variants = useMemo(() => product.variants || [], [product.variants]);
  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === product.selectedVariantId) || null,
    [product.selectedVariantId, variants]
  );
  const fabricImage =
    selectedVariant?.images?.[0] ||
    selectedVariant?.image ||
    product.images?.[0] ||
    product.image ||
    '';
  const productStyle = useMemo(
    () =>
      inferDrapeProductStyle({
        name: product.name,
        category: product.category,
        description: product.description,
        work: product.work,
        packageFormat: product.packageFormat,
      }),
    [product.category, product.description, product.name, product.packageFormat, product.work]
  );
  const productStyleLabel = drapeProductStyleLabel(productStyle);
  const sessionKey = `product:${product.rawProductId || product.id}:variant:${product.selectedVariantId || 'parent'}`;
  const modelImage = personMode === 'photo' ? personImage : DEFAULT_MODEL_IMAGE;

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/ai/drape-on', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as ServiceStatus;
        if (!cancelled) {
          setServiceStatus({
            configured: response.ok && payload.configured === true,
            provider: payload.provider || null,
            model: payload.model || null,
          });
        }
      })
      .catch(() => !cancelled && setServiceStatus({ configured: false }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!product.rawProductId || restoredKeyRef.current === sessionKey) return;
    restoredKeyRef.current = sessionKey;
    let cancelled = false;
    void restoreState(sessionKey).then((saved) => {
      if (!saved || cancelled) return;
      setView(saved.view || '3d');
      setPersonMode(saved.personMode || 'model');
      setFit(saved.fit || 'Regular');
      setPersonImage(saved.personImage || null);
      setPhotoConsent(Boolean(saved.photoConsent));
      setResult(saved.result || null);
      setAnalysis(saved.analysis || '');
      setProvider(saved.provider || '');
      setModelUsed(saved.modelUsed || '');
      setUsedFabric(saved.usedFabric || null);
    });
    return () => {
      cancelled = true;
    };
  }, [product.rawProductId, sessionKey]);

  useEffect(() => {
    if (!product.rawProductId || restoredKeyRef.current !== sessionKey) return;
    const timer = window.setTimeout(() => {
      void persistState(sessionKey, {
        view,
        personMode,
        fit,
        personImage,
        photoConsent,
        result,
        analysis,
        provider,
        modelUsed,
        usedFabric,
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [analysis, fit, modelUsed, personImage, personMode, photoConsent, product.rawProductId, provider, result, sessionKey, usedFabric, view]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    stopCamera();
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
      setPersonMode('photo');
      setView('ai');
      setResult(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to use this image.');
    }
  };

  const startCamera = async () => {
    setCameraError('');
    setError('');
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
      setPersonMode('photo');
      setView('ai');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setCameraError('Camera access was blocked. Allow permission or upload a photo instead.');
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
    setResult(null);
    stopCamera();
  };

  const generateAiReference = async () => {
    setError('');
    if (!user) return setError('Sign in as a buyer to generate the AI drape.');
    if (!product.rawProductId || product.rawProductId === 'unavailable') {
      return setError('Open a live FabricTrad product first.');
    }
    if (!fabricImage) return setError('This listing needs a usable product photo for draping.');
    if (serviceStatus?.configured === false) {
      return setError('The live AI image service is unavailable right now.');
    }
    if (!modelImage) return setError('Choose a model or upload your photo first.');
    if (personMode === 'photo' && !photoConsent) {
      return setError('Confirm that you own this photo or have permission to use it.');
    }

    setLoading(true);
    setGenerationStage('Sending the person reference and exact seller textile to the AI image model…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 150_000);
    const stageTimer = window.setTimeout(
      () => setGenerationStage('AI is building folds, seams, fall and fabric texture…'),
      7000
    );
    try {
      const response = await fetch('/api/ai/drape-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({
          productId: product.rawProductId,
          variantId: product.selectedVariantId,
          modelImage,
          garmentId: drapeProductStyleApiId(productStyle),
          styleName: drapeProductStylePrompt(productStyle),
          fit,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as GenerationResult;
      if (!response.ok || !payload.image) {
        throw new Error(payload.error || 'The AI image service did not return a drape image.');
      }
      setResult(payload.image);
      setAnalysis(
        payload.analysis ||
          'Generated using the exact seller listing textile and selected person reference.'
      );
      setProvider(payload.provider || serviceStatus?.provider || 'AI image provider');
      setModelUsed(payload.model || serviceStatus?.model || '');
      setUsedFabric(payload.fabricReference || null);
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      );
    } catch (generationError) {
      setError(
        generationError instanceof DOMException && generationError.name === 'AbortError'
          ? 'AI generation timed out. Please retry with a clear full-body photo.'
          : generationError instanceof Error
            ? generationError.message
            : 'Unable to generate the AI drape.'
      );
    } finally {
      window.clearTimeout(timeout);
      window.clearTimeout(stageTimer);
      setLoading(false);
      setGenerationStage('');
    }
  };

  const reset = () => {
    stopCamera();
    setView('3d');
    setPersonMode('model');
    setFit('Regular');
    setPersonImage(null);
    setPhotoConsent(false);
    setResult(null);
    setAnalysis('');
    setProvider('');
    setModelUsed('');
    setUsedFabric(null);
    setError('');
  };

  const aiDisabled =
    productLoading ||
    loading ||
    !user ||
    !fabricImage ||
    serviceStatus?.configured === false ||
    (personMode === 'photo' && (!personImage || !photoConsent));

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border bg-card card-shadow-lg">
      <header className="bg-gradient-to-r from-secondary via-navy-light to-secondary px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-800 uppercase tracking-[0.18em] text-gold">
              <Icon name="SparklesIcon" size={16} /> FabricTrad Virtual Drape Studio
            </p>
            <h2 className="mt-2 text-2xl font-800 sm:text-3xl">
              360° mannequin drape + photoreal AI try-on
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
              The 3D view uses the exact selected listing textile on garment-shaped geometry. The AI view uses the server-side image API for a photorealistic person reference. Both are driven by this product — there is no unrelated garment picker.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white/80">
            <p className="font-800 text-white">
              {serviceStatus === null
                ? 'Checking AI service…'
                : serviceStatus.configured
                  ? `${serviceStatus.provider || 'AI image service'} ready`
                  : 'AI image service unavailable'}
            </p>
            {serviceStatus?.model && <p className="mt-1">Model: {serviceStatus.model}</p>}
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-card px-5 py-4 sm:px-8">
        <div className="grid max-w-xl grid-cols-2 rounded-2xl border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setView('3d')}
            className={`rounded-xl px-4 py-3 text-sm font-800 transition ${
              view === '3d' ? 'bg-secondary text-white shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="CubeIcon" size={18} /> Interactive 3D
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView('ai')}
            className={`rounded-xl px-4 py-3 text-sm font-800 transition ${
              view === 'ai' ? 'bg-secondary text-white shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="SparklesIcon" size={18} /> AI photo try-on
            </span>
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b border-border p-5 sm:p-6 xl:border-b-0 xl:border-r">
          <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">
            Product-driven garment
          </p>
          <div className="mt-3 rounded-2xl border border-success/20 bg-success/5 p-4">
            <p className="text-[10px] font-800 uppercase tracking-wider text-success">
              Detected from this seller listing
            </p>
            <p className="mt-1 text-base font-800 text-foreground">{productStyleLabel}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The product name, description and package format determine the drape shape.
            </p>
          </div>

          <p className="mt-5 text-xs font-800 uppercase tracking-wider text-muted-foreground">Fit</p>
          <div className="mt-3 flex gap-2">
            {fits.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFit(item)}
                className={`flex-1 rounded-xl border py-2 text-xs font-800 ${
                  fit === item ? 'border-secondary bg-secondary text-white' : 'border-border'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
              {fabricImage ? (
                <AppImage src={fabricImage} alt={product.name || 'Selected product'} fill className="object-cover" />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-800 uppercase tracking-wider text-primary">Live listing textile</p>
              <p className="truncate text-sm font-800 text-foreground">{product.name || 'Selected product'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {selectedVariant
                  ? `${selectedVariant.colorName || ''}${selectedVariant.designName ? ` · ${selectedVariant.designName}` : ''}`
                  : product.packageFormat || 'Parent product'}
              </p>
            </div>
          </div>

          {view === '3d' ? (
            <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-800 text-foreground">360° controls</p>
              <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                <p className="flex items-center gap-2"><Icon name="CursorArrowRaysIcon" size={15} /> Drag left/right to rotate around the mannequin.</p>
                <p className="flex items-center gap-2"><Icon name="MagnifyingGlassIcon" size={15} /> Scroll or pinch to zoom.</p>
                <p className="flex items-center gap-2"><Icon name="ArrowsPointingOutIcon" size={15} /> The textile is curved around garment geometry, not displayed as a flat panel.</p>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-5 text-xs font-800 uppercase tracking-wider text-muted-foreground">Person reference</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setPersonMode('model');
                    setError('');
                  }}
                  className={`rounded-xl border p-3 text-left ${
                    personMode === 'model' ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <Icon name="UserIcon" size={18} className="text-primary" />
                  <p className="mt-2 text-xs font-800 text-foreground">Studio model</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setPersonMode('photo');
                    setError('');
                  }}
                  className={`rounded-xl border p-3 text-left ${
                    personMode === 'photo' ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <Icon name="CameraIcon" size={18} className="text-primary" />
                  <p className="mt-2 text-xs font-800 text-foreground">My photo</p>
                </button>
              </div>

              {personMode === 'photo' && (
                <>
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
                      <Icon name="ArrowUpTrayIcon" size={15} /> Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="btn-secondary flex items-center justify-center gap-2 rounded-xl py-3 text-xs"
                    >
                      <Icon name="CameraIcon" size={15} /> Camera
                    </button>
                  </div>
                  {cameraActive && (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-primary/25 bg-black">
                      <video ref={videoRef} muted playsInline autoPlay className="aspect-[3/4] w-full scale-x-[-1] object-cover" />
                      <div className="grid grid-cols-2 gap-2 bg-card p-3">
                        <button type="button" onClick={captureCamera} className="btn-primary rounded-xl py-2.5 text-xs">Capture</button>
                        <button type="button" onClick={stopCamera} className="btn-secondary rounded-xl py-2.5 text-xs">Cancel</button>
                      </div>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                  {cameraError && <p className="mt-3 rounded-xl bg-warning/10 p-3 text-xs text-warning">{cameraError}</p>}
                  {personImage && (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/30">
                      <div className="relative aspect-[3/4] max-h-72">
                        <PortraitImage src={personImage} alt="Your selected try-on photo" />
                      </div>
                      <label className="flex cursor-pointer items-start gap-3 p-3 text-xs leading-5 text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={photoConsent}
                          onChange={(event) => setPhotoConsent(event.target.checked)}
                          className="mt-1 h-4 w-4 accent-primary"
                        />
                        <span>I own this photo or have permission to use it for AI generation.</span>
                      </label>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => void generateAiReference()}
            disabled={aiDisabled}
            className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Generating…</>
            ) : (
              <><Icon name="SparklesIcon" size={17} /> {view === '3d' ? 'Generate AI drape reference' : 'Generate AI try-on'}</>
            )}
          </button>
          {generationStage && <p className="mt-3 text-center text-xs text-primary">{generationStage}</p>}
          {!user && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <Link href="/login" className="font-800 text-primary">Sign in</Link> to generate AI images. The 3D viewer remains available.
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-xs font-700 leading-5 text-error">{error}</p>
          )}
          <button type="button" onClick={reset} disabled={loading} className="mt-2 w-full rounded-xl py-2.5 text-xs font-800 text-muted-foreground hover:bg-muted">
            Reset studio
          </button>
        </aside>

        <section ref={resultRef} className="min-w-0 bg-muted/35 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            {view === '3d' ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-800 uppercase tracking-wider text-primary">Interactive 3D drape</p>
                    <h3 className="mt-1 text-xl font-800 text-foreground">{productStyleLabel} · {fit} fit</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Drag 360° · wheel/pinch to zoom</p>
                </div>

                {fabricImage ? (
                  <InteractiveFabricMannequin3D
                    fabricImage={fabricImage}
                    productName={product.name || 'FabricTrad product'}
                    style={productStyle}
                    fit={fit}
                  />
                ) : (
                  <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">This listing needs a product photo before a 3D textile preview can be built.</p>
                  </div>
                )}

                {result && (
                  <div className="grid gap-4 rounded-3xl border border-primary/20 bg-card p-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-muted">
                      {/* AI result is a data URL returned by the server-side provider. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={result} alt={`AI drape reference for ${product.name}`} className="h-full w-full object-cover" />
                    </div>
                    <div className="self-center">
                      <p className="text-xs font-800 uppercase tracking-wider text-primary">Photoreal AI reference</p>
                      <h4 className="mt-2 text-lg font-800 text-foreground">Same listing textile, generated on a person reference</h4>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{analysis}</p>
                      <p className="mt-3 text-xs font-800 text-foreground">
                        {provider || 'AI image service'}{modelUsed ? ` · ${modelUsed}` : ''}
                      </p>
                      {usedFabric?.name && (
                        <p className="mt-1 text-xs text-success">{usedFabric.name}{usedFabric.variantName ? ` · ${usedFabric.variantName}` : ''}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-800 uppercase tracking-wider text-primary">AI photo try-on</p>
                    <h3 className="mt-1 text-xl font-800 text-foreground">{productStyleLabel} · {fit} fit</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Uses the server-side image model and live listing media</p>
                </div>

                {result ? (
                  <div className="space-y-4">
                    <div className="relative mx-auto aspect-[2/3] max-h-[900px] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={result} alt={`AI try-on of ${product.name}`} className="h-full w-full object-cover" />
                      <span className="absolute left-4 top-4 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-800 uppercase tracking-wider text-white">
                        AI generated drape
                      </span>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <p className="text-xs font-800 text-foreground">Generated by {provider || 'AI image service'}{modelUsed ? ` · ${modelUsed}` : ''}</p>
                      {usedFabric?.name && <p className="mt-1 text-xs font-800 text-success">Product: {usedFabric.name}{usedFabric.variantName ? ` · ${usedFabric.variantName}` : ''}</p>}
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{analysis}</p>
                      <button type="button" onClick={() => void generateAiReference()} disabled={loading} className="btn-secondary mt-3 rounded-xl px-4 py-2.5 text-xs">Generate again</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[560px] items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center">
                    <div className="max-w-md">
                      <div className="relative mx-auto mb-4 aspect-[3/4] w-44 overflow-hidden rounded-2xl border border-border">
                        <PortraitImage src={modelImage || DEFAULT_MODEL_IMAGE} alt="Person reference for AI drape" />
                      </div>
                      <h4 className="text-lg font-800 text-foreground">Ready for photoreal AI draping</h4>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        The server sends this person reference together with the exact selected seller textile and product-derived garment type to the configured image API.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
