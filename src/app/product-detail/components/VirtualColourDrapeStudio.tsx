'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useProduct } from '@/lib/hooks/useProduct';

type DrapeOption = {
  id: string;
  label: string;
  colour: string;
  family: string;
  texture?: string | null;
};

type ViewMode = 'single' | 'compare';

const models = [
  {
    id: 'natural-light',
    label: 'Natural light',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=88',
  },
  {
    id: 'neutral-background',
    label: 'Neutral background',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=88',
  },
  {
    id: 'menswear',
    label: 'Menswear',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=88',
  },
] as const;

const colours: DrapeOption[] = [
  { id: 'ivory', label: 'Soft Ivory', colour: '#F3E8D0', family: 'Neutral' },
  { id: 'camel', label: 'Warm Camel', colour: '#B9865B', family: 'Neutral' },
  { id: 'chocolate', label: 'Chocolate', colour: '#503329', family: 'Neutral' },
  { id: 'charcoal', label: 'Charcoal', colour: '#424650', family: 'Neutral' },
  { id: 'navy', label: 'Deep Navy', colour: '#1F365C', family: 'Blue' },
  { id: 'cobalt', label: 'Clear Cobalt', colour: '#2856A6', family: 'Blue' },
  { id: 'teal', label: 'Rich Teal', colour: '#0D6B69', family: 'Green' },
  { id: 'olive', label: 'Soft Olive', colour: '#6B7042', family: 'Green' },
  { id: 'emerald', label: 'Emerald', colour: '#13765B', family: 'Green' },
  { id: 'coral', label: 'Warm Coral', colour: '#D96A5B', family: 'Red' },
  { id: 'berry', label: 'Berry', colour: '#8C3155', family: 'Red' },
  { id: 'burgundy', label: 'Burgundy', colour: '#641F32', family: 'Red' },
  { id: 'rose', label: 'Dusty Rose', colour: '#B97882', family: 'Pink' },
  { id: 'plum', label: 'Deep Plum', colour: '#603F63', family: 'Purple' },
  { id: 'mustard', label: 'Mustard', colour: '#C79A2B', family: 'Yellow' },
];

const MAX_UPLOAD = 8 * 1024 * 1024;
const FAVOURITES_KEY = 'fabrictrad-colour-drape-favourites-v1';

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
}

function photoFilter(brightness: number, warmth: number) {
  if (warmth >= 0) {
    return `brightness(${brightness}%) sepia(${warmth * 0.45}%) saturate(${100 + warmth * 0.7}%) hue-rotate(-${warmth * 0.12}deg)`;
  }
  const coolness = Math.abs(warmth);
  return `brightness(${brightness}%) saturate(${100 + coolness * 0.25}%) hue-rotate(${coolness * 0.25}deg)`;
}

function Preview({
  photo,
  option,
  brightness,
  warmth,
}: {
  photo: string;
  option: DrapeOption;
  brightness: number;
  warmth: number;
}) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      <div className="absolute inset-0" style={{ filter: photoFilter(brightness, warmth) }}>
        {photo.startsWith('data:') ? (
          <img src={photo} alt="Uploaded portrait for virtual colour draping" className="h-full w-full object-cover" />
        ) : (
          <AppImage src={photo} alt="Portrait selected for virtual colour draping" fill className="object-cover" />
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[51%] overflow-hidden shadow-[0_-18px_35px_rgba(0,0,0,0.18)]"
        style={{
          clipPath: 'polygon(0 22%,20% 12%,37% 4%,50% 12%,63% 4%,80% 12%,100% 22%,100% 100%,0 100%)',
          backgroundColor: option.colour,
          backgroundImage: option.texture
            ? `linear-gradient(rgba(255,255,255,0.06),rgba(0,0,0,0.10)),url("${option.texture}")`
            : 'radial-gradient(circle at 50% 12%,rgba(255,255,255,0.22),transparent 34%),linear-gradient(115deg,rgba(255,255,255,0.12),transparent 35%,rgba(0,0,0,0.08))',
          backgroundPosition: 'center',
          backgroundSize: option.texture ? 'cover' : '100% 100%',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/10" />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-4 pb-4 pt-16 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-800">{option.label}</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/70">{option.family}</p>
        </div>
        <span className="h-8 w-8 shrink-0 rounded-full border-2 border-white/80 shadow-lg" style={{ backgroundColor: option.colour }} />
      </div>
    </div>
  );
}

export default function VirtualColourDrapeStudio() {
  const { product } = useProduct();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [modelId, setModelId] = useState<(typeof models)[number]['id']>(models[0].id);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [primaryId, setPrimaryId] = useState('product-fabric');
  const [secondaryId, setSecondaryId] = useState('navy');
  const [mode, setMode] = useState<ViewMode>('single');
  const [brightness, setBrightness] = useState(100);
  const [warmth, setWarmth] = useState(0);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [error, setError] = useState('');

  const fabricImage = product.images?.[0] || product.image;
  const options = useMemo<DrapeOption[]>(
    () => [
      {
        id: 'product-fabric',
        label: product.name || 'Current fabric',
        colour: '#8D6049',
        family: 'Selected fabric',
        texture: fabricImage || null,
      },
      ...colours,
    ],
    [fabricImage, product.name]
  );

  const selectedModel = models.find((model) => model.id === modelId) || models[0];
  const photo = uploadedPhoto || selectedModel.image;
  const primary = options.find((option) => option.id === primaryId) || options[0];
  const secondary = options.find((option) => option.id === secondaryId) || options[1];

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(FAVOURITES_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        setFavourites(parsed.filter((item): item is string => typeof item === 'string'));
      }
    } catch {
      setFavourites([]);
    }
  }, []);

  const saveFavourites = (next: string[]) => {
    setFavourites(next);
    try {
      window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
    } catch {
      // Browser storage is optional; the draping controls still work without it.
    }
  };

  const toggleFavourite = (id: string) => {
    saveFavourites(
      favourites.includes(id) ? favourites.filter((item) => item !== id) : [...favourites, id]
    );
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
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
      setUploadedPhoto(await readImage(file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to use this image.');
    }
  };

  const reset = () => {
    setModelId(models[0].id);
    setUploadedPhoto(null);
    setPrimaryId('product-fabric');
    setSecondaryId('navy');
    setMode('single');
    setBrightness(100);
    setWarmth(0);
    setError('');
  };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border bg-card card-shadow-lg">
      <header className="bg-gradient-to-r from-secondary via-navy-light to-secondary px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-800 uppercase tracking-[0.18em] text-gold">
              <Icon name="SwatchIcon" size={16} /> FabricTrad Virtual Colour Draping
            </p>
            <h2 className="mt-2 text-2xl font-800 sm:text-3xl">See fabric colours beside your face</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Upload a portrait, compare the selected fabric with other shades, adjust the photo and save your favourites.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white/80">
            <p className="font-800 text-white">Private in your browser</p>
            <p className="mt-1">Your photo is not sent for AI generation.</p>
          </div>
        </div>
      </header>

      <div className="grid xl:grid-cols-[370px_minmax(0,1fr)]">
        <aside className="border-b border-border p-5 sm:p-6 xl:border-b-0 xl:border-r">
          <div className="rounded-2xl border border-success/20 bg-success/5 p-4">
            <div className="flex items-start gap-3">
              <Icon name="CameraIcon" size={18} className="mt-0.5 shrink-0 text-success" />
              <div>
                <p className="text-xs font-800 text-foreground">Use a clear, accurate photo</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Face the camera in natural light, avoid beauty filters and use a simple background.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">1 · Portrait</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {models.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  setModelId(model.id);
                  setUploadedPhoto(null);
                }}
                className={`overflow-hidden rounded-xl border-2 text-left transition ${
                  modelId === model.id && !uploadedPhoto ? 'border-primary' : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="relative aspect-[3/4]">
                  <AppImage src={model.image} alt={model.label} fill className="object-cover" />
                </div>
                <p className="truncate px-2 py-2 text-[10px] font-800 text-foreground">{model.label}</p>
              </button>
            ))}
          </div>

          <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadPhoto} />
          <button type="button" onClick={() => uploadRef.current?.click()} className="btn-secondary mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs">
            <Icon name="ArrowUpTrayIcon" size={16} /> {uploadedPhoto ? 'Replace your photo' : 'Upload your own photo'}
          </button>

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">2 · Photo balance</p>
          <div className="mt-3 space-y-4 rounded-2xl border border-border bg-muted/40 p-4">
            <label className="block text-xs font-800 text-foreground">
              Brightness <span className="float-right text-primary">{brightness}%</span>
              <input type="range" min="75" max="125" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} className="mt-3 w-full accent-primary" />
            </label>
            <label className="block text-xs font-800 text-foreground">
              Temperature
              <span className="float-right text-primary">{warmth === 0 ? 'Neutral' : warmth > 0 ? `Warm +${warmth}` : `Cool ${warmth}`}</span>
              <input type="range" min="-40" max="40" value={warmth} onChange={(event) => setWarmth(Number(event.target.value))} className="mt-3 w-full accent-primary" />
            </label>
          </div>

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">3 · View</p>
          <div className="mt-3 grid grid-cols-2 rounded-xl border border-border bg-muted p-1">
            {(['single', 'compare'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-lg px-3 py-2.5 text-xs font-800 transition ${mode === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                {value === 'single' ? 'One colour' : 'Side by side'}
              </button>
            ))}
          </div>

          <button type="button" onClick={reset} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-800 text-muted-foreground hover:bg-muted">
            <Icon name="ArrowPathIcon" size={15} /> Reset studio
          </button>
          {error && <p className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-xs font-700 text-error">{error}</p>}
        </aside>

        <section className="min-w-0 bg-muted/35 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            {mode === 'single' ? (
              <div className="mx-auto max-w-[580px]">
                <Preview photo={photo} option={primary} brightness={brightness} warmth={warmth} />
                <button
                  type="button"
                  onClick={() => toggleFavourite(primary.id)}
                  className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-800 transition ${
                    favourites.includes(primary.id)
                      ? 'border-rose-300/40 bg-rose-500/10 text-rose-600'
                      : 'border-border bg-card text-foreground hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  <Icon name="HeartIcon" size={17} /> {favourites.includes(primary.id) ? 'Saved to favourites' : 'Save this colour'}
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Preview photo={photo} option={primary} brightness={brightness} warmth={warmth} />
                <Preview photo={photo} option={secondary} brightness={brightness} warmth={warmth} />
              </div>
            )}

            <div className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-800 uppercase tracking-wider text-primary">Colour palette</p>
                  <h3 className="mt-1 text-xl font-800 text-foreground">Click a fabric or shade to drape it</h3>
                </div>
                <p className="text-xs text-muted-foreground">{favourites.length} saved {favourites.length === 1 ? 'colour' : 'colours'}</p>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {options.map((option) => {
                  const selected = primary.id === option.id;
                  const saved = favourites.includes(option.id);
                  return (
                    <div key={option.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setPrimaryId(option.id)}
                        className={`w-full rounded-2xl border p-2 text-left transition ${selected ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/15' : 'border-border bg-background hover:border-primary/40'}`}
                      >
                        <span
                          className="relative block aspect-square overflow-hidden rounded-xl border border-black/5"
                          style={{
                            backgroundColor: option.colour,
                            backgroundImage: option.texture ? `linear-gradient(rgba(255,255,255,0.04),rgba(0,0,0,0.08)),url("${option.texture}")` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        >
                          {selected && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary shadow"><Icon name="CheckIcon" size={16} /></span>
                            </span>
                          )}
                        </span>
                        <span className="mt-2 block truncate text-[11px] font-800 text-foreground">{option.label}</span>
                        <span className="block truncate text-[9px] uppercase tracking-wider text-muted-foreground">{option.family}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavourite(option.id)}
                        aria-label={`${saved ? 'Remove' : 'Add'} ${option.label} ${saved ? 'from' : 'to'} favourites`}
                        className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm ${saved ? 'border-rose-200 bg-rose-500 text-white' : 'border-white/60 bg-white/85 text-slate-500 hover:text-rose-500'}`}
                      >
                        <Icon name="HeartIcon" size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {mode === 'compare' && (
                <div className="mt-6 border-t border-border pt-5">
                  <label htmlFor="comparison-colour" className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Compare against</label>
                  <select
                    id="comparison-colour"
                    value={secondaryId}
                    onChange={(event) => setSecondaryId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-700 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  >
                    {options.filter((option) => option.id !== primary.id).map((option) => (
                      <option key={option.id} value={option.id}>{option.label} · {option.family}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-xs leading-5 text-muted-foreground">
              <Icon name="InformationCircleIcon" size={17} className="mt-0.5 shrink-0 text-primary" />
              <p>
                This is a visual comparison tool, not a professional colour analysis. Screen calibration, lighting and the original photo can change how shades appear. Confirm the final colour with a physical fabric sample before a bulk order.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
