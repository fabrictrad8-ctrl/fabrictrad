'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
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
  {
    id: 'saree',
    label: 'Saree',
    description:
      'a complete six-yard saree with a fitted blouse, realistic waist pleats and a naturally falling pallu',
  },
  {
    id: 'lehenga',
    label: 'Lehenga',
    description:
      'a complete lehenga with a fitted blouse, full skirt and coordinated dupatta, with realistic tailoring and textile fall',
  },
  {
    id: 'kurta',
    label: 'Kurta',
    description:
      'a properly tailored long-sleeve kurta with a finished neckline, side seams and natural fabric folds',
  },
  {
    id: 'shirt',
    label: 'Shirt',
    description:
      'a premium long-sleeve shirt with a structured collar, buttons, cuffs and anatomically correct seams',
  },
  {
    id: 'dress',
    label: 'Dress',
    description:
      'a modern midi dress with a finished neckline, sleeves and clean tailoring that follows the body naturally',
  },
  {
    id: 'dupatta',
    label: 'Dupatta',
    description:
      'a full-length dupatta draped naturally over both shoulders and the existing outfit with realistic folds and gravity',
  },
] as const;

const fits = ['Relaxed', 'Regular', 'Tailored'] as const;
const MAX_UPLOAD = 8 * 1024 * 1024;

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

function PortraitImage({
  src,
  alt,
  className = 'h-full w-full object-cover',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return <img src={src} alt={alt} className={className} />;
  }

  return <AppImage src={src} alt={alt} fill className={className} />;
}

function StepHeading({ number, children }: { number: number; children: ReactNode }) {
  return (
    <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">
      {number} · {children}
    </p>
  );
}

export default function VirtualColourDrapeStudio() {
  const { product } = useProduct();
  const { user } = useAuth();
  const uploadRef = useRef<HTMLInputElement>(null);

  const [modelId, setModelId] = useState<(typeof models)[number]['id']>(models[0].id);
  const [garmentId, setGarmentId] = useState<(typeof garments)[number]['id']>(
    garments[0].id
  );
  const [fit, setFit] = useState<(typeof fits)[number]>('Regular');
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [provider, setProvider] = useState('');
  const [modelUsed, setModelUsed] = useState('');
  const [compare, setCompare] = useState(58);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);

  const selectedModel = useMemo(
    () => models.find((item) => item.id === modelId) || models[0],
    [modelId]
  );
  const garment = useMemo(
    () => garments.find((item) => item.id === garmentId) || garments[0],
    [garmentId]
  );
  const baseImage = personImage || selectedModel.image;
  const fabricImage = product.images?.[0] || product.image || '';

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

  const clearGeneratedResult = () => {
    setResult(null);
    setAnalysis('');
    setProvider('');
    setModelUsed('');
    setCompare(58);
    setError('');
  };

  const selectModel = (nextModel: (typeof models)[number]['id']) => {
    setModelId(nextModel);
    setPersonImage(null);
    setPhotoConsent(false);
    clearGeneratedResult();
  };

  const selectGarment = (nextGarment: (typeof garments)[number]['id']) => {
    setGarmentId(nextGarment);
    clearGeneratedResult();
  };

  const selectFit = (nextFit: (typeof fits)[number]) => {
    setFit(nextFit);
    clearGeneratedResult();
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

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
      const image = await readImage(file);
      setPersonImage(image);
      setPhotoConsent(false);
      clearGeneratedResult();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to use this image.');
    }
  };

  const generate = async () => {
    setError('');
    setAnalysis('');

    if (!user) {
      setError('Sign in as a buyer to generate a private AI drape preview.');
      return;
    }
    if (!fabricImage) {
      setError('This listing does not have a usable fabric image.');
      return;
    }
    if (serviceStatus?.configured === false) {
      setError('The AI image service is not configured on the live website yet.');
      return;
    }
    if (personImage && !photoConsent) {
      setError('Confirm that you have permission to use the uploaded photo.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/drape-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          fabricImage,
          modelImage: baseImage,
          fabricName: `${product.name || 'Selected fabric'}; ${product.gsm || 'unknown'} GSM; ${product.work || 'textile fabric'}`,
          styleName: `${fit.toLowerCase()} fit ${garment.description}`,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as GenerationResult;
      if (!response.ok || !payload.image) {
        throw new Error(payload.error || 'Unable to generate the AI drape preview.');
      }

      setResult(payload.image);
      setAnalysis(
        payload.analysis ||
          'AI drape generated. Confirm the exact shade, scale and hand-feel with a physical sample before production.'
      );
      setProvider(payload.provider || serviceStatus?.provider || 'AI image provider');
      setModelUsed(payload.model || serviceStatus?.model || '');
      setCompare(58);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Unable to generate the AI drape preview.'
      );
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setModelId(models[0].id);
    setGarmentId(garments[0].id);
    setFit('Regular');
    setPersonImage(null);
    setPhotoConsent(false);
    clearGeneratedResult();
  };

  const download = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result;
    link.download = `${(product.name || 'fabrictrad-ai-drape')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-ai-drape.jpg`;
    link.click();
  };

  const generationDisabled =
    loading || serviceStatus?.configured === false || Boolean(personImage && !photoConsent);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border bg-card card-shadow-lg">
      <header className="bg-gradient-to-r from-secondary via-navy-light to-secondary px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-800 uppercase tracking-[0.18em] text-gold">
              <Icon name="SparklesIcon" size={16} /> FabricTrad AI Drape-On
            </p>
            <h2 className="mt-2 text-2xl font-800 sm:text-3xl">
              Generate the fabric as a real garment on a person
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Choose a model or upload your own full, clear photo. Select the garment and fit,
              then AI creates a new virtual try-on image using this product&apos;s actual fabric.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white/80">
            <p className="flex items-center gap-2 font-800 text-white">
              <Icon name="CpuChipIcon" size={15} /> Real image generation
            </p>
            <p className="mt-1 max-w-[240px] leading-5">
              Your selected portrait and fabric are sent securely to the configured AI image
              provider only when you press Generate.
            </p>
          </div>
        </div>
      </header>

      <div className="grid xl:grid-cols-[370px_minmax(0,1fr)]">
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
                    ? 'Checking AI image service'
                    : serviceStatus.configured
                      ? `${serviceStatus.provider || 'AI image service'} ready`
                      : 'AI image service unavailable'}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {serviceStatus?.configured
                    ? `This generates a new virtual try-on image${serviceStatus.model ? ` with ${serviceStatus.model}` : ''}.`
                    : serviceStatus === null
                      ? 'This takes only a moment.'
                      : 'Generation is disabled until the server API key is configured.'}
                </p>
              </div>
            </div>
          </div>

          <StepHeading number={1}>Choose a person</StepHeading>
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
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="btn-secondary mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs"
          >
            <Icon name="ArrowUpTrayIcon" size={16} />
            {personImage ? 'Replace your photo' : 'Upload your own photo'}
          </button>

          {personImage && (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
              <input
                type="checkbox"
                checked={photoConsent}
                onChange={(event) => {
                  setPhotoConsent(event.target.checked);
                  setError('');
                }}
                className="mt-1 h-4 w-4 rounded border-border accent-primary"
              />
              <span>I confirm that I own this photo or have permission to use it for AI generation.</span>
            </label>
          )}

          <StepHeading number={2}>Choose the garment</StepHeading>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {garments.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectGarment(item.id)}
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

          <StepHeading number={3}>Choose the fit</StepHeading>
          <div className="mt-3 flex gap-2">
            {fits.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => selectFit(item)}
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

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-muted/50 p-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
              {fabricImage ? (
                <AppImage src={fabricImage} alt={product.name || 'Selected fabric'} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Icon name="PhotoIcon" size={20} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-800 uppercase tracking-wider text-primary">
                Fabric reference
              </p>
              <p className="mt-1 truncate text-sm font-800 text-foreground">
                {product.name || 'Selected fabric'}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {product.gsm ? `${product.gsm} GSM · ` : ''}
                {product.work || 'Texture and colour reference'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={generationDisabled}
            className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Generating real AI drape…
              </>
            ) : (
              <>
                <Icon name="SparklesIcon" size={18} /> Generate AI drape
              </>
            )}
          </button>

          {!user && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <Link href="/login" className="font-800 text-primary hover:underline">
                Sign in as a buyer
              </Link>{' '}
              to generate securely.
            </p>
          )}
          <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">
            A detailed image can take up to about two minutes. Keep this page open while it is
            being generated.
          </p>

          <button
            type="button"
            onClick={reset}
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-800 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <Icon name="ArrowPathIcon" size={15} /> Reset studio
          </button>

          {error && (
            <p className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-xs font-700 leading-5 text-error">
              {error}
            </p>
          )}
        </aside>

        <section className="min-w-0 bg-muted/35 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-800 uppercase tracking-wider text-primary">
                  Virtual try-on preview
                </p>
                <h3 className="mt-1 text-xl font-800 text-foreground">
                  {result ? 'AI-generated drape compared with the original' : 'Ready for AI generation'}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {garment.label} · {fit} fit
              </p>
            </div>

            <div className="relative mx-auto aspect-[2/3] max-h-[900px] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
              <div className="absolute inset-0">
                <PortraitImage
                  src={baseImage}
                  alt="Original person selected for the AI fabric try-on"
                />
              </div>

              {result && (
                <div
                  className="absolute inset-y-0 left-0 overflow-hidden"
                  style={{ width: `${compare}%` }}
                >
                  <img
                    src={result}
                    alt="AI-generated garment using the selected fabric"
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
                {result ? 'AI garment' : personImage ? 'Your uploaded photo' : 'Selected model'}
              </span>
              {result && (
                <span className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-800 uppercase tracking-wider text-white backdrop-blur-sm">
                  Original
                </span>
              )}

              {!result && !loading && (
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-black/65 p-4 text-white backdrop-blur-md sm:inset-x-6 sm:bottom-6">
                  <p className="flex items-center gap-2 text-sm font-800">
                    <Icon name="SparklesIcon" size={17} className="text-gold" /> No fake overlay
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/75">
                    Press Generate AI drape to create a new image with real garment construction,
                    folds, seams, shadows and fabric texture on this person.
                  </p>
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-secondary/75 p-6 text-center text-white backdrop-blur-sm">
                  <div className="max-w-sm">
                    <span className="mx-auto block h-11 w-11 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                    <p className="mt-5 text-lg font-800">Generating the virtual garment</p>
                    <p className="mt-2 text-sm leading-6 text-white/75">
                      AI is combining the person, garment structure and this fabric&apos;s texture.
                      Please keep the page open.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {result ? (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <label className="flex items-center justify-between gap-4 text-xs font-800 text-foreground">
                  <span>Drag to compare AI result with the original</span>
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
                      Generated by {provider || 'AI image service'}
                      {modelUsed ? ` · ${modelUsed}` : ''}
                    </p>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                      {analysis}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={download}
                    className="btn-secondary flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs"
                  >
                    <Icon name="ArrowDownTrayIcon" size={16} /> Download result
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-800 uppercase tracking-wider text-primary">Person</p>
                  <p className="mt-1 text-xs font-800 text-foreground">
                    {personImage ? 'Your uploaded photo' : selectedModel.label}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-800 uppercase tracking-wider text-primary">Garment</p>
                  <p className="mt-1 text-xs font-800 text-foreground">{garment.label}</p>
                </div>
                <div>
                  <p className="text-[10px] font-800 uppercase tracking-wider text-primary">Fabric</p>
                  <p className="mt-1 truncate text-xs font-800 text-foreground">
                    {product.name || 'Selected fabric'}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-xs leading-5 text-muted-foreground">
              <Icon
                name="InformationCircleIcon"
                size={17}
                className="mt-0.5 shrink-0 text-primary"
              />
              <p>
                AI try-on images are visual sourcing previews. The generated garment may vary in
                exact construction, shade and pattern placement. Confirm the final colour, weave,
                hand-feel and production details with a physical fabric sample.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
