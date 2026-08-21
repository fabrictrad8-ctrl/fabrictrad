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

type PreviewMode = 'model' | 'photo';

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
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="h-full w-full object-cover" />;
  }
  return <AppImage src={src} alt={alt} fill className="object-cover" />;
}

export default function RealAIDrapeStudio() {
  const { product, loading: productLoading } = useProduct();
  const { user } = useAuth();
  const uploadRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<PreviewMode>('model');
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
  const baseImage = mode === 'photo' ? personImage : DEFAULT_MODEL_IMAGE;

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
    setResult(null);
    setAnalysis('');
    setProvider('');
    setModelUsed('');
    setUsedFabric(null);
    setError('');
  }, [fit, mode, product.rawProductId, product.selectedVariantId]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
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
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 1280 },
        },
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
    stopCamera();
  };

  const generate = async () => {
    setError('');
    if (!user) return setError('Sign in as a buyer to generate the AI drape.');
    if (!product.rawProductId || product.rawProductId === 'unavailable') {
      return setError('Open a live FabricTrad product first.');
    }
    if (!fabricImage) return setError('This listing needs a usable product image for AI draping.');
    if (serviceStatus?.configured === false) {
      return setError('The live AI image service is unavailable right now.');
    }
    if (!baseImage) return setError('Choose a model image or upload your photo first.');
    if (mode === 'photo' && !photoConsent) {
      return setError('Confirm that you own this photo or have permission to use it.');
    }

    setLoading(true);
    setGenerationStage('Sending the model and exact seller textile to the live AI image service…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 150_000);
    const stageTimer = window.setTimeout(
      () => setGenerationStage('AI is constructing realistic folds, seams, shadows and textile texture…'),
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
          modelImage: baseImage,
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
          'Generated by the live AI image service using the selected seller textile and model reference.'
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
          ? 'AI generation timed out. Please retry.'
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

  const download = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result;
    link.download = `${(product.name || 'fabrictrad-drape')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-ai-drape.jpg`;
    link.click();
  };

  const generationDisabled =
    productLoading ||
    loading ||
    !user ||
    !fabricImage ||
    serviceStatus?.configured === false ||
    (mode === 'photo' && (!personImage || !photoConsent));

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border bg-card card-shadow-lg">
      <header className="bg-gradient-to-r from-secondary via-navy-light to-secondary px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-800 uppercase tracking-[0.18em] text-gold">
              <Icon name="SparklesIcon" size={16} /> FabricTrad AI Drape-On
            </p>
            <h2 className="mt-2 text-2xl font-800 sm:text-3xl">
              Generate the actual textile drape with AI
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              This uses the live server-side image model with the exact approved seller listing and selected colour. No WebGL mannequin, no pasted browser texture and no fake rectangle overlay.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white/80">
            <p className="font-800 text-white">
              {serviceStatus === null
                ? 'Checking AI service…'
                : serviceStatus.configured
                  ? `${serviceStatus.provider || 'AI image service'} ready`
                  : 'AI service unavailable'}
            </p>
            {serviceStatus?.model && <p className="mt-1">Model: {serviceStatus.model}</p>}
          </div>
        </div>
      </header>

      <div className="grid xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="border-b border-border p-5 sm:p-6 xl:border-b-0 xl:border-r">
          <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">
            1 · Person reference
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setMode('model');
                setError('');
              }}
              className={`rounded-xl border p-3 text-left transition ${
                mode === 'model' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
              }`}
            >
              <Icon name="UserIcon" size={20} className="text-primary" />
              <p className="mt-2 text-xs font-800 text-foreground">FabricTrad model</p>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                Generate a real AI drape on the studio model.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setMode('photo');
                setError('');
              }}
              className={`rounded-xl border p-3 text-left transition ${
                mode === 'photo' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
              }`}
            >
              <Icon name="CameraIcon" size={20} className="text-primary" />
              <p className="mt-2 text-xs font-800 text-foreground">My photo</p>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                Use your own image as the person reference.
              </p>
            </button>
          </div>

          {mode === 'model' ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/30">
              <div className="relative aspect-[3/4] max-h-72">
                <PortraitImage src={DEFAULT_MODEL_IMAGE} alt="FabricTrad AI drape model" />
              </div>
              <p className="p-3 text-xs leading-5 text-muted-foreground">
                The generated result will use this person only as the body/pose reference and the seller listing as the textile reference.
              </p>
            </div>
          ) : (
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
                    <button
                      type="button"
                      onClick={captureCamera}
                      className="btn-primary rounded-xl py-2.5 text-xs"
                    >
                      Capture
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="btn-secondary rounded-xl py-2.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
              {cameraError && (
                <p className="mt-3 rounded-xl bg-warning/10 p-3 text-xs text-warning">{cameraError}</p>
              )}

              {personImage && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/30">
                  <div className="relative aspect-[3/4] max-h-72">
                    <PortraitImage src={personImage} alt="Your AI drape photo" />
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

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">
            2 · Listing-driven drape
          </p>
          <div className="mt-3 rounded-2xl border border-success/20 bg-success/5 p-4">
            <p className="text-[10px] font-800 uppercase tracking-wider text-success">
              Detected from this seller listing
            </p>
            <p className="mt-1 text-base font-800 text-foreground">{productStyleLabel}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The seller product type determines the drape. FabricTrad does not let the buyer turn one listing into an unrelated garment.
            </p>
          </div>

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">
            3 · Fit
          </p>
          <div className="mt-3 flex gap-2">
            {fits.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFit(item)}
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
              {fabricImage && (
                <AppImage
                  src={fabricImage}
                  alt={product.name || 'Selected textile'}
                  fill
                  className="object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-800 uppercase tracking-wider text-primary">
                Exact textile reference
              </p>
              <p className="truncate text-sm font-800 text-foreground">
                {product.name || 'Selected product'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {selectedVariant
                  ? `${selectedVariant.colorName} · ${selectedVariant.designName}`
                  : product.packageFormat}
              </p>
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
                Generating AI drape…
              </>
            ) : (
              <>
                <Icon name="SparklesIcon" size={18} />
                {mode === 'model' ? 'Generate real AI drape' : 'Generate AI try-on'}
              </>
            )}
          </button>

          {generationStage && (
            <p className="mt-3 text-center text-xs leading-5 text-primary">{generationStage}</p>
          )}
          {!user && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <Link href="/login" className="font-800 text-primary hover:underline">
                Sign in as a buyer
              </Link>{' '}
              to generate with the live AI image service.
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-xs font-700 leading-5 text-error">
              {error}
            </p>
          )}
        </aside>

        <section ref={resultRef} className="min-w-0 bg-muted/35 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-800 uppercase tracking-wider text-primary">
                  Real AI image result
                </p>
                <h3 className="mt-1 text-xl font-800 text-foreground">
                  {productStyleLabel} · {fit} fit
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {serviceStatus?.configured
                  ? `Powered by ${serviceStatus.provider || 'the configured image provider'}`
                  : 'Waiting for AI service'}
              </p>
            </div>

            <div className="relative mx-auto aspect-[2/3] max-h-[900px] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
              {result ? (
                <>
                  {/* AI output is returned as a data URL. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result}
                    alt={`AI-generated drape for ${product.name}`}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-800 uppercase tracking-wider text-white">
                    AI-generated drape
                  </span>
                </>
              ) : baseImage ? (
                <>
                  <PortraitImage src={baseImage} alt="Person reference for AI drape" />
                  <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-black/70 p-4 text-white backdrop-blur-md sm:inset-x-6 sm:bottom-6">
                    <p className="flex items-center gap-2 text-sm font-800">
                      <Icon name="SparklesIcon" size={17} className="text-gold" />
                      This is only the person reference
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/75">
                      Press Generate. The server will send this person plus the exact live seller textile to the configured AI image API and replace this preview with the generated drape.
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  Upload or capture a photo to continue.
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 p-6 text-center text-white backdrop-blur-sm">
                  <div className="max-w-sm">
                    <span className="mx-auto block h-11 w-11 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                    <p className="mt-5 text-lg font-800">Generating the textile drape</p>
                    <p className="mt-2 text-sm leading-6 text-white/75">
                      The live image model is reconstructing folds, garment structure, shadows and the selected textile texture. This can take around a minute.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {result && (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-800 text-foreground">
                      Generated by {provider || 'AI image service'}
                      {modelUsed ? ` · ${modelUsed}` : ''}
                    </p>
                    {usedFabric?.name && (
                      <p className="mt-1 text-xs font-800 text-success">
                        Textile: {usedFabric.name}
                        {usedFabric.variantName ? ` · ${usedFabric.variantName}` : ''}
                        {usedFabric.imageCount && usedFabric.imageCount > 1
                          ? ` · ${usedFabric.imageCount} listing references used`
                          : ''}
                      </p>
                    )}
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
                      {analysis}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
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
                      <Icon name="ArrowDownTrayIcon" size={15} /> Download
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
