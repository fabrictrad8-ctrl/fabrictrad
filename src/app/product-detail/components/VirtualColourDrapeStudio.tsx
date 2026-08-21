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
import InteractiveFabricMannequin3D from './InteractiveFabricMannequin3D';
import {
  drapeProductStyleApiId,
  drapeProductStyleLabel,
  drapeProductStylePrompt,
  inferDrapeProductStyle,
} from '@/lib/drapeProductStyle';

const fits = ['Relaxed', 'Regular', 'Tailored'] as const;
const MAX_UPLOAD = 8 * 1024 * 1024;
const DB_NAME = 'fabrictrad-buyer-tryon';
const STORE_NAME = 'sessions';

type TryOnMode = 'mannequin' | 'photo';

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

type StoredTryOnState = {
  mode: TryOnMode;
  fit: (typeof fits)[number];
  personImage: string | null;
  photoConsent: boolean;
  result: string | null;
  analysis: string;
  provider: string;
  modelUsed: string;
  usedFabric: FabricReference | null;
  show3d: boolean;
};

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
}

function openTryOnDb() {
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

async function readStoredState(key: string): Promise<StoredTryOnState | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openTryOnDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as StoredTryOnState | undefined) || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function writeStoredState(key: string, value: StoredTryOnState) {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openTryOnDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Browser persistence is best-effort; the live page must keep working without it.
  }
}

function PortraitImage({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
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
  const resultRef = useRef<HTMLDivElement>(null);
  const restoredKeyRef = useRef('');

  const [mode, setMode] = useState<TryOnMode>('mannequin');
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
  const [show3d, setShow3d] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [error, setError] = useState('');

  const variants = product.variants || [];
  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === product.selectedVariantId) || null,
    [product.selectedVariantId, variants]
  );
  const fabricImage =
    selectedVariant?.images?.[0] || selectedVariant?.image || product.images?.[0] || product.image || '';
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

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/ai/drape-on', { method: 'GET', cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
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
    void readStoredState(sessionKey).then((saved) => {
      if (!saved || cancelled) return;
      setMode(saved.mode || 'mannequin');
      setFit(saved.fit || 'Regular');
      setPersonImage(saved.personImage || null);
      setPhotoConsent(Boolean(saved.photoConsent));
      setResult(saved.result || null);
      setAnalysis(saved.analysis || '');
      setProvider(saved.provider || '');
      setModelUsed(saved.modelUsed || '');
      setUsedFabric(saved.usedFabric || null);
      setShow3d(Boolean(saved.show3d));
    });
    return () => {
      cancelled = true;
    };
  }, [product.rawProductId, sessionKey]);

  useEffect(() => {
    if (!product.rawProductId || restoredKeyRef.current !== sessionKey) return;
    const timer = window.setTimeout(() => {
      void writeStoredState(sessionKey, {
        mode,
        fit,
        personImage,
        photoConsent,
        result,
        analysis,
        provider,
        modelUsed,
        usedFabric,
        show3d,
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [analysis, fit, mode, modelUsed, personImage, photoConsent, product.rawProductId, provider, result, sessionKey, show3d, usedFabric]);

  const switchMode = (next: TryOnMode) => {
    stopCamera();
    setMode(next);
    setError('');
    if (next === 'mannequin') setShow3d(false);
  };

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
      setResult(null);
      setMode('photo');
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
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setMode('photo');
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
    setResult(null);
    stopCamera();
  };

  const generate = async () => {
    setError('');
    if (!fabricImage) return setError('This product needs at least one product photo for draping.');
    if (mode === 'mannequin') {
      setShow3d(true);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }
    if (!user) return setError('Sign in as a buyer to generate a private AI try-on.');
    if (!personImage) return setError('Upload your photo or use the camera first.');
    if (!photoConsent) return setError('Confirm that you own this photo or have permission to use it.');
    if (serviceStatus?.configured === false) return setError('The AI image service is unavailable right now.');
    if (!product.rawProductId || product.rawProductId === 'unavailable') return setError('Open a live FabricTrad product first.');

    setLoading(true);
    setGenerationStage('Preparing your photo and the seller’s live textile…');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 150_000);
    const stageTimer = window.setTimeout(() => setGenerationStage('AI is constructing the product drape. This can take a minute…'), 7000);
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
      if (!response.ok || !payload.image) throw new Error(payload.error || 'AI try-on did not return an image.');
      setResult(payload.image);
      setAnalysis(payload.analysis || 'Generated from your photo and the selected live FabricTrad textile.');
      setProvider(payload.provider || serviceStatus?.provider || 'AI image provider');
      setModelUsed(payload.model || serviceStatus?.model || '');
      setUsedFabric(payload.fabricReference || null);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (generationError) {
      setError(
        generationError instanceof DOMException && generationError.name === 'AbortError'
          ? 'AI generation timed out. Please retry with a clear full-body photo.'
          : generationError instanceof Error
            ? generationError.message
            : 'Unable to generate the AI try-on.'
      );
    } finally {
      window.clearTimeout(timer);
      window.clearTimeout(stageTimer);
      setLoading(false);
      setGenerationStage('');
    }
  };

  const reset = () => {
    stopCamera();
    setMode('mannequin');
    setFit('Regular');
    setPersonImage(null);
    setPhotoConsent(false);
    setResult(null);
    setAnalysis('');
    setProvider('');
    setModelUsed('');
    setUsedFabric(null);
    setShow3d(false);
    setError('');
  };

  const generationDisabled = productLoading || !fabricImage || loading || (mode === 'photo' && (!personImage || !photoConsent));

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border bg-card card-shadow-lg">
      <header className="bg-gradient-to-r from-secondary via-navy-light to-secondary px-5 py-6 text-white sm:px-8">
        <p className="flex items-center gap-2 text-xs font-800 uppercase tracking-[0.18em] text-gold">
          <Icon name="SparklesIcon" size={16} /> FabricTrad AI + 3D Trial Room
        </p>
        <h2 className="mt-2 text-2xl font-800 sm:text-3xl">See this exact listing on a mannequin or on your photo</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
          FabricTrad detects the product type from the seller listing. There is no unrelated garment picker: the selected product and colour drive the drape.
        </p>
      </header>

      <div className="grid xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="border-b border-border p-5 sm:p-6 xl:border-b-0 xl:border-r">
          <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">1 · Choose how to preview</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => switchMode('mannequin')} className={`rounded-xl border p-3 text-left ${mode === 'mannequin' ? 'border-primary bg-primary/10' : 'border-border'}`}>
              <Icon name="CubeIcon" size={20} className="text-primary" />
              <p className="mt-2 text-xs font-800 text-foreground">3D mannequin</p>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Drag through 360° and zoom.</p>
            </button>
            <button type="button" onClick={() => switchMode('photo')} className={`rounded-xl border p-3 text-left ${mode === 'photo' ? 'border-primary bg-primary/10' : 'border-border'}`}>
              <Icon name="UserIcon" size={20} className="text-primary" />
              <p className="mt-2 text-xs font-800 text-foreground">My photo</p>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">AI try-on on your actual image.</p>
            </button>
          </div>

          {mode === 'photo' && (
            <>
              <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => uploadRef.current?.click()} className="btn-secondary flex items-center justify-center gap-2 rounded-xl py-3 text-xs">
                  <Icon name="ArrowUpTrayIcon" size={16} /> Upload photo
                </button>
                <button type="button" onClick={() => void startCamera()} className="btn-secondary flex items-center justify-center gap-2 rounded-xl py-3 text-xs">
                  <Icon name="CameraIcon" size={16} /> Use camera
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
                  <div className="relative aspect-[3/4] max-h-72"><PortraitImage src={personImage} alt="Your selected try-on photo" /></div>
                  <label className="flex cursor-pointer items-start gap-3 p-3 text-xs leading-5 text-muted-foreground">
                    <input type="checkbox" checked={photoConsent} onChange={(event) => setPhotoConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
                    <span>I own this photo or have permission to use it for AI generation.</span>
                  </label>
                </div>
              )}
            </>
          )}

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">2 · Product garment</p>
          <div className="mt-3 rounded-2xl border border-success/20 bg-success/5 p-4">
            <p className="text-[10px] font-800 uppercase tracking-wider text-success">Detected from this listing</p>
            <p className="mt-1 text-base font-800 text-foreground">{productStyleLabel}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Based on product name, listing description and product format. Buyers cannot switch it to an unrelated garment.</p>
          </div>

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">3 · Fit preview</p>
          <div className="mt-3 flex gap-2">
            {fits.map((item) => (
              <button key={item} type="button" onClick={() => setFit(item)} className={`flex-1 rounded-xl border py-2 text-xs font-800 ${fit === item ? 'border-secondary bg-secondary text-white' : 'border-border'}`}>{item}</button>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
              {fabricImage ? <AppImage src={fabricImage} alt={product.name || 'Selected product'} fill className="object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-800 uppercase tracking-wider text-primary">Exact selected listing</p>
              <p className="truncate text-sm font-800 text-foreground">{product.name || 'Selected product'}</p>
              <p className="truncate text-xs text-muted-foreground">{selectedVariant ? `${selectedVariant.colorName} · ${selectedVariant.designName}` : product.packageFormat}</p>
            </div>
          </div>

          <button type="button" onClick={() => void generate()} disabled={generationDisabled} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 disabled:cursor-not-allowed disabled:opacity-55">
            {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Generating…</> : <><Icon name={mode === 'mannequin' ? 'CubeIcon' : 'SparklesIcon'} size={18} /> {mode === 'mannequin' ? 'Open 3D drape' : 'Generate AI try-on'}</>}
          </button>
          {generationStage && <p className="mt-3 text-center text-xs text-primary">{generationStage}</p>}
          {!user && mode === 'photo' && <p className="mt-3 text-center text-xs text-muted-foreground"><Link href="/login" className="font-800 text-primary">Sign in</Link> to use your own photo.</p>}
          {error && <p className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-xs font-700 leading-5 text-error">{error}</p>}
          <button type="button" onClick={reset} disabled={loading} className="mt-2 w-full rounded-xl py-2.5 text-xs font-800 text-muted-foreground hover:bg-muted">Reset trial room</button>
        </aside>

        <section ref={resultRef} className="min-w-0 bg-muted/35 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-800 uppercase tracking-wider text-primary">{mode === 'mannequin' ? 'Interactive 3D drape' : 'Personal AI try-on'}</p>
                <h3 className="mt-1 text-xl font-800 text-foreground">{productStyleLabel} · {fit} fit</h3>
              </div>
              <p className="text-xs text-muted-foreground">State is preserved when you switch browser tabs.</p>
            </div>

            {mode === 'mannequin' ? (
              show3d && fabricImage ? (
                <InteractiveFabricMannequin3D fabricImage={fabricImage} productName={product.name || 'FabricTrad product'} style={productStyle} fit={fit} />
              ) : (
                <div className="flex min-h-[560px] items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center">
                  <div className="max-w-md">
                    <Icon name="CubeIcon" size={42} className="mx-auto text-primary" />
                    <h4 className="mt-4 text-lg font-800 text-foreground">Ready for a real 3D mannequin preview</h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Click <strong>Open 3D drape</strong>. The live product textile is mapped onto WebGL garment geometry detected from this listing, then you can drag around it through 360° and zoom.</p>
                  </div>
                </div>
              )
            ) : result ? (
              <div className="space-y-4">
                <div className="relative mx-auto aspect-[2/3] max-h-[900px] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
                  {/* AI result is returned as a data URL. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result} alt={`AI try-on of ${product.name}`} className="h-full w-full object-cover" />
                  <span className="absolute left-4 top-4 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-800 uppercase tracking-wider text-white">Generated from your photo</span>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-800 text-foreground">Generated by {provider || 'AI image service'}{modelUsed ? ` · ${modelUsed}` : ''}</p>
                  {usedFabric?.name && <p className="mt-1 text-xs font-800 text-success">Product: {usedFabric.name}{usedFabric.variantName ? ` · ${usedFabric.variantName}` : ''}</p>}
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{analysis}</p>
                  <button type="button" onClick={() => void generate()} disabled={loading} className="btn-secondary mt-3 rounded-xl px-4 py-2.5 text-xs">Generate again</button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[560px] items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center">
                <div className="max-w-md">
                  {personImage ? <div className="relative mx-auto mb-4 aspect-[3/4] w-40 overflow-hidden rounded-2xl"><PortraitImage src={personImage} alt="Your try-on photo" /></div> : <Icon name="UserIcon" size={42} className="mx-auto text-primary" />}
                  <h4 className="text-lg font-800 text-foreground">Upload your own photo</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">AI keeps your identity and pose while applying the actual selected listing textile in the product-derived garment style. A personal-photo result is a 2D AI image; 360° interaction is available in mannequin mode.</p>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase text-primary">Product</p><p className="mt-1 text-xs font-800">{product.name}</p></div>
              <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase text-primary">Detected garment</p><p className="mt-1 text-xs font-800">{productStyleLabel}</p></div>
              <div className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] uppercase text-primary">Preview mode</p><p className="mt-1 text-xs font-800">{mode === 'mannequin' ? 'Interactive 3D mannequin' : 'Your photo · AI image'}</p></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
