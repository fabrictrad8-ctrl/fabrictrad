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
import InteractiveFabricMannequin3D, {
  type DrapeAvatarGender,
} from './InteractiveFabricMannequin3D';
import {
  drapeProductStyleApiId,
  drapeProductStyleLabel,
  drapeProductStylePrompt,
  inferDrapeProductStyle,
} from '@/lib/drapeProductStyle';

const fits = ['Relaxed', 'Regular', 'Tailored'] as const;
const MAX_UPLOAD = 8 * 1024 * 1024;
const DB_NAME = 'fabrictrad-hybrid-drape';
const STORE_NAME = 'sessions';

type StudioView = '3d' | 'ai';
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
  requestId?: string | null;
  code?: string;
  fabricReference?: FabricReference;
  error?: string;
};

type StoredState = {
  view: StudioView;
  avatarGender: DrapeAvatarGender;
  fit: Fit;
  personImage: string | null;
  photoConsent: boolean;
  result: string | null;
  analysis: string;
  provider: string;
  modelUsed: string;
  providerRequestId: string;
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
    // Persistence is best effort and must never interrupt shopping.
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
  const [avatarGender, setAvatarGender] = useState<DrapeAvatarGender>('woman');
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
  const [providerRequestId, setProviderRequestId] = useState('');
  const [usedFabric, setUsedFabric] = useState<FabricReference | null>(null);
  const [loading, setLoading] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');

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

  const snapshot = useMemo<StoredState>(
    () => ({
      view,
      avatarGender,
      fit,
      personImage,
      photoConsent,
      result,
      analysis,
      provider,
      modelUsed,
      providerRequestId,
      usedFabric,
    }),
    [analysis, avatarGender, fit, modelUsed, personImage, photoConsent, provider, providerRequestId, result, usedFabric, view]
  );
  const latestSnapshotRef = useRef(snapshot);
  useEffect(() => {
    latestSnapshotRef.current = snapshot;
  }, [snapshot]);

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
      setView(saved.view === 'ai' ? 'ai' : '3d');
      setAvatarGender(saved.avatarGender === 'man' ? 'man' : 'woman');
      setFit(fits.includes(saved.fit) ? saved.fit : 'Regular');
      setPersonImage(saved.personImage || null);
      setPhotoConsent(Boolean(saved.photoConsent));
      setResult(saved.result || null);
      setAnalysis(saved.analysis || '');
      setProvider(saved.provider || '');
      setModelUsed(saved.modelUsed || '');
      setProviderRequestId(saved.providerRequestId || '');
      setUsedFabric(saved.usedFabric || null);
    });
    return () => {
      cancelled = true;
    };
  }, [product.rawProductId, sessionKey]);

  useEffect(() => {
    if (!product.rawProductId || restoredKeyRef.current !== sessionKey) return;
    const timer = window.setTimeout(() => {
      void persistState(sessionKey, snapshot);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [product.rawProductId, sessionKey, snapshot]);

  useEffect(() => {
    if (!product.rawProductId) return;
    const saveImmediately = () => {
      if (restoredKeyRef.current === sessionKey) {
        void persistState(sessionKey, latestSnapshotRef.current);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveImmediately();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', saveImmediately);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', saveImmediately);
    };
  }, [product.rawProductId, sessionKey]);

  const clearResult = () => {
    setResult(null);
    setAnalysis('');
    setProvider('');
    setModelUsed('');
    setProviderRequestId('');
    setUsedFabric(null);
    setError('');
    setErrorCode('');
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    stopCamera();
    clearResult();
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
      setView('ai');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to use this image.');
    }
  };

  const startCamera = async () => {
    setCameraError('');
    clearResult();
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
    clearResult();
    stopCamera();
  };

  const generatePhotoTryOn = async () => {
    setError('');
    setErrorCode('');
    if (!user) return setError('Sign in as a buyer to generate the AI try-on.');
    if (!product.rawProductId || product.rawProductId === 'unavailable') {
      return setError('Open a live FabricTrad product first.');
    }
    if (!fabricImage) return setError('This listing needs a usable product photo for draping.');
    if (serviceStatus?.configured === false) {
      return setError('The live AI image service is unavailable right now.');
    }
    if (!personImage) return setError('Upload or capture your own photo first.');
    if (!photoConsent) {
      return setError('Confirm that you own this photo or have permission to use it.');
    }

    setLoading(true);
    setGenerationStage('Preparing your photo and the exact seller textile for GPT Image…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 180_000);
    const stageTimer = window.setTimeout(
      () => setGenerationStage('GPT Image is constructing the product-driven drape, folds and fabric texture…'),
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
          modelImage: personImage,
          garmentId: drapeProductStyleApiId(productStyle),
          styleName: drapeProductStylePrompt(productStyle),
          fit,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as GenerationResult;
      if (!response.ok || !payload.image) {
        setErrorCode(payload.code || `HTTP_${response.status}`);
        if (payload.requestId) setProviderRequestId(payload.requestId);
        throw new Error(payload.error || 'The AI image service did not return a drape image.');
      }
      setResult(payload.image);
      setAnalysis(
        payload.analysis ||
          'Generated from your photo and the exact approved seller listing textile.'
      );
      setProvider(payload.provider || serviceStatus?.provider || 'AI image provider');
      setModelUsed(payload.model || serviceStatus?.model || '');
      setProviderRequestId(payload.requestId || '');
      setUsedFabric(payload.fabricReference || null);
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      );
    } catch (generationError) {
      setError(
        generationError instanceof DOMException && generationError.name === 'AbortError' ?'AI generation timed out. Please retry with a clear, well-lit full-body photo.'
          : generationError instanceof Error
            ? generationError.message
            : 'Unable to generate the AI try-on.'
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
    setAvatarGender('woman');
    setFit('Regular');
    setPersonImage(null);
    setPhotoConsent(false);
    clearResult();
  };

  const aiDisabled =
    productLoading ||
    loading ||
    !user ||
    !fabricImage ||
    !personImage ||
    !photoConsent ||
    serviceStatus?.configured === false;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border bg-card card-shadow-lg">
      <header className="bg-gradient-to-r from-secondary via-navy-light to-secondary px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-800 uppercase tracking-[0.18em] text-gold">
              <Icon name="SparklesIcon" size={16} /> FabricTrad Virtual Drape Studio
            </p>
            <h2 className="mt-2 text-2xl font-800 sm:text-3xl">
              Human 3D preview + AI try-on with your photo
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
              Choose a 3D woman or man for an interactive 360° textile preview, or upload/capture your own photo for a GPT Image try-on. The garment/drape type always comes from this seller listing.
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
              <Icon name="SparklesIcon" size={18} /> Try on my photo
            </span>
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[370px_minmax(0,1fr)]">
        <aside className="border-b border-border p-5 sm:p-6 xl:border-b-0 xl:border-r">
          <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">
            Product-driven drape
          </p>
          <div className="mt-3 rounded-2xl border border-success/20 bg-success/5 p-4">
            <p className="text-[10px] font-800 uppercase tracking-wider text-success">
              Detected from this seller listing
            </p>
            <p className="mt-1 text-base font-800 text-foreground">{productStyleLabel}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Product type, category, description and seller-defined format determine the drape. Buyers cannot turn the listing into an unrelated garment.
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
            <>
              <p className="mt-5 text-xs font-800 uppercase tracking-wider text-muted-foreground">3D person</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAvatarGender('woman')}
                  className={`rounded-xl border p-3 text-left ${avatarGender === 'woman' ? 'border-primary bg-primary/10' : 'border-border'}`}
                >
                  <Icon name="UserIcon" size={18} className="text-primary" />
                  <p className="mt-2 text-xs font-800 text-foreground">Woman</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarGender('man')}
                  className={`rounded-xl border p-3 text-left ${avatarGender === 'man' ? 'border-primary bg-primary/10' : 'border-border'}`}
                >
                  <Icon name="UserIcon" size={18} className="text-primary" />
                  <p className="mt-2 text-xs font-800 text-foreground">Man</p>
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-800 text-foreground">360° controls</p>
                <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                  <p className="flex items-center gap-2"><Icon name="CursorArrowRaysIcon" size={15} /> Drag to rotate around the person.</p>
                  <p className="flex items-center gap-2"><Icon name="MagnifyingGlassIcon" size={15} /> Scroll or pinch to zoom.</p>
                  <p className="flex items-center gap-2"><Icon name="ArrowsPointingOutIcon" size={15} /> View the product-driven textile from front, side and back.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setView('ai');
                  setError('');
                  requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                }}
                className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5"
              >
                <Icon name="CameraIcon" size={17} /> Try it on my photo
              </button>
            </>
          ) : (
            <>
              <p className="mt-5 text-xs font-800 uppercase tracking-wider text-muted-foreground">Your photo</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Upload a clear standing photo or take one with your camera. FabricTrad sends it only when you press Generate.
              </p>
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
                  <Icon name="ArrowUpTrayIcon" size={15} /> Upload photo
                </button>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="btn-secondary flex items-center justify-center gap-2 rounded-xl py-3 text-xs"
                >
                  <Icon name="CameraIcon" size={15} /> Use camera
                </button>
              </div>

              {cameraActive && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-primary/25 bg-black">
                  <video ref={videoRef} muted playsInline autoPlay className="aspect-[3/4] w-full scale-x-[-1] object-cover" />
                  <div className="grid grid-cols-2 gap-2 bg-card p-3">
                    <button type="button" onClick={captureCamera} className="btn-primary rounded-xl py-2.5 text-xs">Capture photo</button>
                    <button type="button" onClick={stopCamera} className="btn-secondary rounded-xl py-2.5 text-xs">Cancel</button>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
              {cameraError && <p className="mt-3 rounded-xl bg-warning/10 p-3 text-xs text-warning">{cameraError}</p>}

              {personImage ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/30">
                  <div className="relative aspect-[3/4] max-h-72">
                    <PortraitImage src={personImage} alt="Your selected try-on photo" />
                  </div>
                  <div className="flex gap-2 border-t border-border p-3">
                    <button type="button" onClick={() => uploadRef.current?.click()} className="btn-secondary flex-1 rounded-xl py-2 text-xs">Replace</button>
                    <button type="button" onClick={() => { setPersonImage(null); setPhotoConsent(false); clearResult(); }} className="rounded-xl border border-error/20 px-3 py-2 text-xs font-800 text-error">Remove</button>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 border-t border-border p-3 text-xs leading-5 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={photoConsent}
                      onChange={(event) => setPhotoConsent(event.target.checked)}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <span>I own this photo or have permission to use it for this AI try-on.</span>
                  </label>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No photo selected yet.
                </div>
              )}

              <button
                type="button"
                onClick={() => void generatePhotoTryOn()}
                disabled={aiDisabled}
                className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Generating with AI…</>
                ) : (
                  <><Icon name="SparklesIcon" size={17} /> Generate AI try-on</>
                )}
              </button>
              {generationStage && <p className="mt-3 text-center text-xs text-primary">{generationStage}</p>}
              {!user && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  <Link href="/login" className="font-800 text-primary">Sign in</Link> to generate your AI try-on.
                </p>
              )}
            </>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-xs font-700 leading-5 text-error">
              <p>{error}</p>
              {(errorCode || providerRequestId) && (
                <p className="mt-1 break-all text-[10px] font-600 opacity-80">
                  {errorCode ? `Code: ${errorCode}` : ''}{errorCode && providerRequestId ? ' · ' : ''}{providerRequestId ? `Provider request: ${providerRequestId}` : ''}
                </p>
              )}
            </div>
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
                    <p className="text-xs font-800 uppercase tracking-wider text-primary">Interactive 3D human drape</p>
                    <h3 className="mt-1 text-xl font-800 text-foreground">{avatarGender === 'woman' ? 'Woman' : 'Man'} · {productStyleLabel} · {fit} fit</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Drag 360° · wheel/pinch to zoom</p>
                </div>

                {fabricImage ? (
                  <InteractiveFabricMannequin3D
                    fabricImage={fabricImage}
                    productName={product.name || 'FabricTrad product'}
                    style={productStyle}
                    fit={fit}
                    avatarGender={avatarGender}
                  />
                ) : (
                  <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">This listing needs a product photo before a 3D textile preview can be built.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-800 uppercase tracking-wider text-primary">AI photo try-on</p>
                    <h3 className="mt-1 text-xl font-800 text-foreground">See {productStyleLabel.toLowerCase()} on your own photo</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Your photo + exact live listing textile → server-side GPT Image</p>
                </div>

                {result ? (
                  <div className="space-y-4">
                    <div className="relative mx-auto aspect-[2/3] max-h-[900px] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={result} alt={`AI try-on of ${product.name}`} className="h-full w-full object-cover" />
                      <span className="absolute left-4 top-4 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-800 uppercase tracking-wider text-white">
                        AI generated try-on
                      </span>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <p className="text-xs font-800 text-foreground">Generated by {provider || 'AI image service'}{modelUsed ? ` · ${modelUsed}` : ''}</p>
                      {providerRequestId && <p className="mt-1 break-all text-[10px] text-muted-foreground">Provider request: {providerRequestId}</p>}
                      {usedFabric?.name && <p className="mt-1 text-xs font-800 text-success">Product: {usedFabric.name}{usedFabric.variantName ? ` · ${usedFabric.variantName}` : ''}</p>}
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{analysis}</p>
                      <button type="button" onClick={() => void generatePhotoTryOn()} disabled={loading} className="btn-secondary mt-3 rounded-xl px-4 py-2.5 text-xs">Generate again</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[560px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-7 text-center">
                    {personImage ? (
                      <div className="relative mb-5 aspect-[3/4] w-40 overflow-hidden rounded-2xl border border-border bg-muted">
                        <PortraitImage src={personImage} alt="Your photo awaiting AI try-on" />
                      </div>
                    ) : (
                      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon name="CameraIcon" size={34} />
                      </div>
                    )}
                    <h4 className="text-lg font-800 text-foreground">{personImage ? 'Ready for your AI try-on' : 'Upload or capture your photo'}</h4>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                      {personImage
                        ? 'Confirm permission on the left, then Generate. FabricTrad will send your photo together with the exact approved seller textile to the configured image model.' :'Use a clear standing or 3/4 body photo with visible arms and clothing. There is no stock studio model in this mode — the result is made for your selected photo.'}
                    </p>
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
