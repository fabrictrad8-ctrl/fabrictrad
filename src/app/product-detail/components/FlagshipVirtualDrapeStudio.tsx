'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
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
type Fit = (typeof fits)[number];

type ServiceStatus = {
  configured: boolean;
  provider?: string | null;
  model?: string | null;
};

type GenerationResult = {
  image?: string;
  analysis?: string;
  provider?: string;
  model?: string;
  providerRequestId?: string | null;
  fabricReference?: { name?: string; variantName?: string | null; imageCount?: number };
  error?: string;
  code?: string;
};

const MAX_UPLOAD = 8 * 1024 * 1024;

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
}

function PersonImage({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="h-full w-full object-cover" />;
  }
  return <AppImage src={src} alt={alt} fill className="object-cover" />;
}

export default function FlagshipVirtualDrapeStudio() {
  const { product, loading: productLoading } = useProduct();
  const { user } = useAuth();
  const uploadRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

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
  const [requestId, setRequestId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [error, setError] = useState('');
  const [showExperimental3d, setShowExperimental3d] = useState(false);
  const [avatarGender, setAvatarGender] = useState<'woman' | 'man'>('woman');

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

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => () => stopCamera(), []);

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
          });
        }
      })
      .catch(() => !cancelled && setServiceStatus({ configured: false }));
    return () => {
      cancelled = true;
    };
  }, []);

  const clearResult = () => {
    setResult(null);
    setAnalysis('');
    setProvider('');
    setModelUsed('');
    setRequestId('');
    setError('');
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    stopCamera();
    clearResult();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Upload a JPG, PNG or WebP photo.');
      return;
    }
    if (file.size > MAX_UPLOAD) {
      setError('The photo must be smaller than 8 MB.');
      return;
    }
    try {
      setPersonImage(await readImage(file));
      setPhotoConsent(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to use this photo.');
    }
  };

  const startCamera = async () => {
    setCameraError('');
    clearResult();
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1280 } },
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
    clearResult();
    stopCamera();
  };

  const generate = async () => {
    setError('');
    if (!user) return setError('Sign in as a buyer to generate your AI try-on.');
    if (!product.rawProductId || product.rawProductId === 'unavailable') {
      return setError('Open a live FabricTrad product first.');
    }
    if (!fabricImage) return setError('This listing needs a usable seller fabric photo.');
    if (!personImage) return setError('Upload or capture your photo first.');
    if (!photoConsent) return setError('Confirm that you own this photo or have permission to use it.');
    if (serviceStatus?.configured === false) return setError('The AI try-on service is temporarily unavailable.');

    setLoading(true);
    setGenerationStage('Preparing your photo and the exact seller textile…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 180_000);
    const stageOne = window.setTimeout(
      () => setGenerationStage('OpenAI GPT Image is constructing the garment and preserving the textile…'),
      6500
    );
    const stageTwo = window.setTimeout(
      () => setGenerationStage('Finishing folds, fit, lighting and textile details…'),
      18000
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
        throw new Error(payload.error || 'The AI service did not return a try-on image.');
      }
      setResult(payload.image);
      setAnalysis(payload.analysis || 'Generated from your photo and this approved seller textile.');
      setProvider(payload.provider || 'OpenAI');
      setModelUsed(payload.model || serviceStatus?.model || '');
      setRequestId(payload.providerRequestId || '');
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch (caught) {
      setError(
        caught instanceof DOMException && caught.name === 'AbortError'
          ? 'AI generation timed out. Retry with a clear, well-lit standing photo.'
          : caught instanceof Error
            ? caught.message
            : 'Unable to generate the AI try-on.'
      );
    } finally {
      window.clearTimeout(timeout);
      window.clearTimeout(stageOne);
      window.clearTimeout(stageTwo);
      setLoading(false);
      setGenerationStage('');
    }
  };

  const disabled =
    productLoading || loading || !user || !fabricImage || !personImage || !photoConsent || serviceStatus?.configured === false;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl">
      <header className="relative overflow-hidden bg-gradient-to-br from-[#121c31] via-[#1b2943] to-[#101725] px-5 py-6 text-white sm:px-7 sm:py-8">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-800 uppercase tracking-[0.16em] text-primary">
              <Icon name="SparklesIcon" size={14} /> Flagship AI Virtual Drape
            </div>
            <h2 className="mt-3 text-2xl font-900 tracking-tight sm:text-3xl lg:text-4xl">Try this exact seller textile on your own photo</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              Upload a clear photo. FabricTrad sends your photo together with the approved seller fabric references to OpenAI GPT Image and returns one generated try-on preview.
            </p>
          </div>
          <div className="min-w-[220px] rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${serviceStatus?.configured ? 'bg-success' : serviceStatus === null ? 'bg-warning' : 'bg-error'}`} />
              <p className="text-sm font-800">
                {serviceStatus === null ? 'Checking AI…' : serviceStatus.configured ? 'OpenAI try-on ready' : 'AI unavailable'}
              </p>
            </div>
            <p className="mt-1 text-xs text-white/55">{serviceStatus?.model ? `Model: ${serviceStatus.model}` : 'Server-side image editing'}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b border-border p-5 sm:p-6 xl:border-b-0 xl:border-r">
          <p className="text-[11px] font-800 uppercase tracking-[0.15em] text-muted-foreground">1 · Seller textile</p>
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
              {fabricImage ? <AppImage src={fabricImage} alt={product.name || 'Seller textile'} fill className="object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-900 text-foreground">{product.name || 'Seller textile'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{productStyleLabel}</p>
              <p className="mt-1 text-[11px] font-700 text-success">Live approved listing reference</p>
            </div>
          </div>

          <p className="mt-5 text-[11px] font-800 uppercase tracking-[0.15em] text-muted-foreground">2 · Fit</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {fits.map((item) => (
              <button key={item} type="button" onClick={() => setFit(item)} className={`min-h-11 rounded-xl border px-2 text-xs font-800 transition ${fit === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40'}`}>
                {item}
              </button>
            ))}
          </div>

          <p className="mt-5 text-[11px] font-800 uppercase tracking-[0.15em] text-muted-foreground">3 · Your photo</p>
          <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => uploadRef.current?.click()} className="btn-secondary min-h-12 rounded-xl text-xs"><span className="inline-flex items-center gap-2"><Icon name="ArrowUpTrayIcon" size={15} /> Upload</span></button>
            <button type="button" onClick={() => void startCamera()} className="btn-secondary min-h-12 rounded-xl text-xs"><span className="inline-flex items-center gap-2"><Icon name="CameraIcon" size={15} /> Camera</span></button>
          </div>

          {cameraActive && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-primary/30 bg-black">
              <video ref={videoRef} muted playsInline autoPlay className="max-h-[55vh] aspect-[3/4] w-full scale-x-[-1] object-cover" />
              <div className="grid grid-cols-2 gap-2 bg-card p-3">
                <button type="button" onClick={captureCamera} className="btn-primary min-h-11 rounded-xl text-xs">Capture</button>
                <button type="button" onClick={stopCamera} className="btn-secondary min-h-11 rounded-xl text-xs">Cancel</button>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          {cameraError && <p className="mt-3 rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs text-warning">{cameraError}</p>}

          {personImage && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/20">
              <div className="relative mx-auto aspect-[3/4] max-h-64 w-full"><PersonImage src={personImage} alt="Your selected try-on photo" /></div>
              <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                <span className="text-[11px] font-700 text-success">Photo ready</span>
                <button type="button" onClick={() => { setPersonImage(null); setPhotoConsent(false); clearResult(); }} className="text-[11px] font-800 text-muted-foreground hover:text-foreground">Remove</button>
              </div>
            </div>
          )}

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
            <input type="checkbox" checked={photoConsent} onChange={(event) => setPhotoConsent(event.target.checked)} className="mt-0.5 h-5 w-5 rounded border-border text-primary" />
            <span>I own this photo or have permission to use it for this AI try-on.</span>
          </label>

          {error && <p className="mt-3 rounded-xl border border-error/20 bg-error/10 p-3 text-xs leading-5 text-error">{error}</p>}

          <button type="button" disabled={disabled} onClick={() => void generate()} className="btn-primary mt-4 min-h-14 w-full rounded-xl text-sm font-900 disabled:cursor-not-allowed disabled:opacity-45">
            <span className="inline-flex items-center justify-center gap-2"><Icon name="SparklesIcon" size={18} /> {loading ? 'Generating AI try-on…' : 'Generate AI Virtual Drape'}</span>
          </button>
          {!user && <p className="mt-2 text-center text-[11px] text-muted-foreground">Sign in as a buyer to generate.</p>}
        </aside>

        <div ref={resultRef} className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="relative flex min-h-[440px] items-center justify-center overflow-hidden rounded-[1.75rem] border border-border bg-[#0c1320] sm:min-h-[560px]">
            {result ? (
              <div className="relative h-[72vh] max-h-[820px] min-h-[440px] w-full">
                <PersonImage src={result} alt="AI generated FabricTrad virtual drape result" />
                <div className="absolute left-3 top-3 rounded-full border border-success/25 bg-black/65 px-3 py-1.5 text-[11px] font-800 text-success backdrop-blur">AI GENERATED · {provider || 'OpenAI'}</div>
              </div>
            ) : personImage ? (
              <div className="relative h-[68vh] max-h-[760px] min-h-[420px] w-full max-w-xl">
                <PersonImage src={personImage} alt="Your photo before AI try-on" />
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-black/65 p-4 text-center text-xs leading-5 text-white/75 backdrop-blur">Press <strong className="text-white">Generate AI Virtual Drape</strong>. Your photo and the approved seller textile are sent to GPT Image together.</div>
              </div>
            ) : (
              <div className="max-w-md px-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Icon name="SparklesIcon" size={30} /></div>
                <h3 className="mt-5 text-xl font-900 text-white">Your AI result appears here</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">Upload a standing photo, select the fit and generate. The server uses the seller's real textile references rather than a generic colour overlay.</p>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0c1320]/88 p-6 backdrop-blur-sm">
                <div className="max-w-sm text-center">
                  <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-primary/25 border-t-primary" />
                  <p className="mt-5 text-base font-900 text-white">Building your AI drape</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">{generationStage || 'OpenAI is generating the try-on…'}</p>
                </div>
              </div>
            )}
          </div>

          {result && (
            <div className="mt-4 rounded-2xl border border-success/20 bg-success/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-900 uppercase tracking-wider text-success">Generated successfully</p>
                  <p className="mt-1 text-sm leading-6 text-foreground">{analysis}</p>
                </div>
                <button type="button" onClick={() => void generate()} disabled={loading} className="btn-secondary min-h-10 rounded-xl px-4 text-xs">Regenerate</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {provider && <span className="rounded-full bg-muted px-2.5 py-1">Provider: {provider}</span>}
                {modelUsed && <span className="rounded-full bg-muted px-2.5 py-1">Model: {modelUsed}</span>}
                {requestId && <span className="rounded-full bg-muted px-2.5 py-1">Verified request: {requestId.slice(0, 18)}…</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-muted/15 p-4 sm:p-5">
        <button type="button" onClick={() => setShowExperimental3d((current) => !current)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 text-left text-sm font-800 text-foreground">
          <span className="inline-flex items-center gap-2"><Icon name="CubeIcon" size={17} /> Experimental 3D fabric preview</span>
          <Icon name={showExperimental3d ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={17} className="text-muted-foreground" />
        </button>
        <p className="mt-2 px-1 text-[11px] leading-5 text-muted-foreground">This is a procedural WebGL preview, not the OpenAI-generated try-on. Use the AI workflow above for the flagship realistic result.</p>

        {showExperimental3d && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">3D avatar</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['woman', 'man'] as const).map((gender) => (
                  <button key={gender} type="button" onClick={() => setAvatarGender(gender)} className={`min-h-11 rounded-xl border text-xs font-800 capitalize ${avatarGender === gender ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{gender}</button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Rotate and zoom to inspect a rough fabric placement. It is intentionally labelled experimental because it is not cloth simulation.</p>
            </div>
            <div className="min-h-[480px] overflow-hidden rounded-2xl border border-border bg-[#0b1220]">
              {fabricImage ? <InteractiveFabricMannequin3D fabricImage={fabricImage} productName={product.name || 'Seller textile'} style={productStyle} fit={fit} avatarGender={avatarGender} /> : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
