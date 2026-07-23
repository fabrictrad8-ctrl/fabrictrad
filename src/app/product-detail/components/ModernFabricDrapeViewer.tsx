'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useProduct } from '@/lib/hooks/useProduct';

const DEFAULT_PORTRAIT =
  'https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?auto=format&fit=crop&w=1200&q=88';
const MAX_UPLOAD = 8 * 1024 * 1024;

type Swatch = {
  id: string;
  label: string;
  hex: string;
  note: string;
  texture?: string;
};

const BASE_SWATCHES: Swatch[] = [
  { id: 'warm-coral', label: 'Warm coral', hex: '#C75C48', note: 'Warm · clear' },
  { id: 'cool-cobalt', label: 'Cool cobalt', hex: '#3157A4', note: 'Cool · clear' },
  { id: 'light-ivory', label: 'Light ivory', hex: '#EFE2C7', note: 'Light · warm neutral' },
  { id: 'deep-navy', label: 'Deep navy', hex: '#17243D', note: 'Deep · cool neutral' },
  { id: 'bright-teal', label: 'Bright teal', hex: '#087F83', note: 'Bright · balanced' },
  { id: 'muted-sage', label: 'Muted sage', hex: '#7F927B', note: 'Muted · soft' },
  { id: 'warm-camel', label: 'Warm camel', hex: '#B88757', note: 'Warm · earthy' },
  { id: 'cool-rose', label: 'Cool rose', hex: '#A85F79', note: 'Cool · softened' },
];

const PAIRS = [
  { label: 'Warm vs cool', left: 'warm-coral', right: 'cool-cobalt' },
  { label: 'Light vs deep', left: 'light-ivory', right: 'deep-navy' },
  { label: 'Bright vs muted', left: 'bright-teal', right: 'muted-sage' },
  { label: 'Earthy vs rosy', left: 'warm-camel', right: 'cool-rose' },
] as const;

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (!src.startsWith('data:')) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to prepare the image for download.'));
    image.src = src;
  });
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  zoom: number,
  positionX: number,
  positionY: number
) {
  const scale = Math.max(width / image.width, height / image.height) * (zoom / 100);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const overflowX = Math.max(0, drawWidth - width);
  const overflowY = Math.max(0, drawHeight - height);
  const x = -(overflowX * positionX) / 100;
  const y = -(overflowY * positionY) / 100;
  context.drawImage(image, x, y, drawWidth, drawHeight);
}

function drapePath(
  context: CanvasRenderingContext2D,
  side: 'left' | 'right' | 'full',
  width: number,
  height: number,
  top: number
) {
  const middle = width / 2;
  context.beginPath();
  if (side === 'left') {
    context.moveTo(0, height);
    context.lineTo(0, top + 85);
    context.quadraticCurveTo(width * 0.18, top - 15, middle, top + 20);
    context.lineTo(middle, height);
  } else if (side === 'right') {
    context.moveTo(middle, height);
    context.lineTo(middle, top + 20);
    context.quadraticCurveTo(width * 0.82, top - 15, width, top + 85);
    context.lineTo(width, height);
  } else {
    context.moveTo(0, height);
    context.lineTo(0, top + 85);
    context.quadraticCurveTo(width * 0.23, top - 25, middle, top + 18);
    context.quadraticCurveTo(width * 0.77, top - 25, width, top + 85);
    context.lineTo(width, height);
  }
  context.closePath();
}

export default function ModernFabricDrapeViewer() {
  const { product } = useProduct();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [portrait, setPortrait] = useState(DEFAULT_PORTRAIT);
  const [portraitName, setPortraitName] = useState('Studio portrait');
  const [leftId, setLeftId] = useState('warm-coral');
  const [rightId, setRightId] = useState('cool-cobalt');
  const [mode, setMode] = useState<'split' | 'left' | 'right'>('split');
  const [opacity, setOpacity] = useState(92);
  const [height, setHeight] = useState(43);
  const [zoom, setZoom] = useState(100);
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(42);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const fabricImage = product.images?.[0] || product.image;
  const swatches = useMemo<Swatch[]>(
    () => [
      {
        id: 'product-fabric',
        label: product.name,
        hex: '#A76546',
        note: 'Selected product fabric',
        texture: fabricImage,
      },
      ...BASE_SWATCHES,
    ],
    [fabricImage, product.name]
  );
  const left = swatches.find((item) => item.id === leftId) || swatches[1];
  const right = swatches.find((item) => item.id === rightId) || swatches[2];

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Upload a JPG, PNG or WebP portrait.');
      return;
    }
    if (file.size > MAX_UPLOAD) {
      setError('The portrait must be smaller than 8 MB.');
      return;
    }
    try {
      setPortrait(await readImage(file));
      setPortraitName(file.name);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to use this portrait.');
    }
  };

  const applyPair = (leftSwatch: string, rightSwatch: string) => {
    setLeftId(leftSwatch);
    setRightId(rightSwatch);
    setMode('split');
  };

  const downloadComparison = async () => {
    setDownloading(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1250;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not create the comparison image.');

      const portraitImage = await loadImage(portrait);
      drawCover(context, portraitImage, canvas.width, canvas.height, zoom, positionX, positionY);
      const top = canvas.height * (1 - height / 100);

      const paint = async (swatch: Swatch, side: 'left' | 'right' | 'full') => {
        context.save();
        drapePath(context, side, canvas.width, canvas.height, top);
        context.clip();
        context.globalAlpha = opacity / 100;
        context.fillStyle = swatch.hex;
        context.fillRect(0, top - 40, canvas.width, canvas.height - top + 40);
        if (swatch.texture) {
          try {
            const texture = await loadImage(swatch.texture);
            const pattern = context.createPattern(texture, 'repeat');
            if (pattern) {
              context.globalAlpha = Math.min(0.62, opacity / 100);
              context.globalCompositeOperation = 'multiply';
              context.fillStyle = pattern;
              context.fillRect(0, top - 40, canvas.width, canvas.height - top + 40);
            }
          } catch {
            // The colour drape remains usable if a remote texture blocks canvas export.
          }
        }
        context.restore();
      };

      if (mode === 'split') {
        await paint(left, 'left');
        await paint(right, 'right');
        context.fillStyle = 'rgba(255,255,255,0.9)';
        context.fillRect(canvas.width / 2 - 2, top + 18, 4, canvas.height - top - 18);
      } else {
        await paint(mode === 'left' ? left : right, 'full');
      }

      const label = (text: string, x: number, align: CanvasTextAlign) => {
        context.save();
        context.font = '700 28px sans-serif';
        context.textAlign = align;
        context.fillStyle = 'rgba(8,15,26,0.78)';
        const width = context.measureText(text).width + 32;
        const boxX = align === 'right' ? x - width : x;
        context.fillRect(boxX, canvas.height - 66, width, 44);
        context.fillStyle = '#ffffff';
        context.fillText(text, x + (align === 'left' ? 16 : -16), canvas.height - 35);
        context.restore();
      };

      if (mode === 'split') {
        label(left.label, 28, 'left');
        label(right.label, canvas.width - 28, 'right');
      } else {
        label((mode === 'left' ? left : right).label, 28, 'left');
      }

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `fabrictrad-colour-drape-${Date.now()}.png`;
      link.click();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to download the comparison.');
    } finally {
      setDownloading(false);
    }
  };

  const drapeLayer = (swatch: Swatch, side: 'left' | 'right' | 'full') => {
    const sideClass =
      side === 'left'
        ? 'left-0 w-1/2 rounded-tr-[45%]'
        : side === 'right'
          ? 'right-0 w-1/2 rounded-tl-[45%]'
          : 'inset-x-0 rounded-t-[42%]';
    return (
      <div
        className={`absolute bottom-0 overflow-hidden ${sideClass}`}
        style={{ height: `${height}%`, backgroundColor: swatch.hex, opacity: opacity / 100 }}
      >
        {swatch.texture && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-55 mix-blend-multiply"
            style={{ backgroundImage: `url("${swatch.texture}")` }}
          />
        )}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/10 to-transparent" />
      </div>
    );
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl">
      <header className="border-b border-white/10 bg-[#0b1728] px-5 py-7 text-white sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-800 uppercase tracking-[0.18em] text-orange-300"><Icon name="SwatchIcon" size={16} /> FabricTrad Virtual Drape Studio</p>
            <h2 className="mt-3 text-3xl font-800 tracking-tight sm:text-4xl">Compare colour and fabric beside the face</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Virtual colour draping places digital swatches close to the face so you can compare how warm, cool, light, deep, bright or muted colours interact with a person&apos;s natural colouring. It is a sourcing aid, not a substitute for a physical fabric sample.</p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100"><p className="font-800">Works in the browser</p><p className="mt-1 text-emerald-100/70">No AI key or shared demo account required.</p></div>
        </div>
      </header>

      <div className="grid xl:grid-cols-[370px_minmax(0,1fr)]">
        <aside className="border-b border-border p-5 sm:p-6 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">1 · Portrait</p><p className="mt-1 truncate text-sm font-800 text-foreground">{portraitName}</p></div>
            <button type="button" onClick={() => uploadRef.current?.click()} className="btn-secondary flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"><Icon name="ArrowUpTrayIcon" size={15} /> Upload</button>
          </div>
          <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
          <div className="mt-3 rounded-xl border border-border bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">Use an evenly lit, front-facing portrait with no colour filters. Keep the face and upper shoulders visible.</div>

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">2 · Quick comparisons</p>
          <div className="mt-3 grid grid-cols-2 gap-2">{PAIRS.map((pair) => <button key={pair.label} type="button" onClick={() => applyPair(pair.left, pair.right)} className="rounded-xl border border-border px-3 py-2.5 text-left text-xs font-800 text-foreground transition hover:border-primary hover:bg-primary/5">{pair.label}</button>)}</div>

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">3 · Left drape</p>
          <div className="mt-3 grid grid-cols-3 gap-2">{swatches.map((swatch) => <button key={`left-${swatch.id}`} type="button" onClick={() => setLeftId(swatch.id)} className={`rounded-xl border p-2 text-left transition ${leftId === swatch.id ? 'border-primary ring-2 ring-primary/15' : 'border-border'}`}><span className="block h-8 rounded-lg border border-black/5" style={{ backgroundColor: swatch.hex, backgroundImage: swatch.texture ? `url("${swatch.texture}")` : undefined, backgroundSize: 'cover' }} /><span className="mt-1.5 block truncate text-[10px] font-800 text-foreground">{swatch.label}</span></button>)}</div>

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">4 · Right drape</p>
          <div className="mt-3 grid grid-cols-3 gap-2">{swatches.map((swatch) => <button key={`right-${swatch.id}`} type="button" onClick={() => setRightId(swatch.id)} className={`rounded-xl border p-2 text-left transition ${rightId === swatch.id ? 'border-secondary ring-2 ring-secondary/15' : 'border-border'}`}><span className="block h-8 rounded-lg border border-black/5" style={{ backgroundColor: swatch.hex, backgroundImage: swatch.texture ? `url("${swatch.texture}")` : undefined, backgroundSize: 'cover' }} /><span className="mt-1.5 block truncate text-[10px] font-800 text-foreground">{swatch.label}</span></button>)}</div>
        </aside>

        <div className="bg-muted/40 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-xl border border-border bg-card p-1">
                {(['split', 'left', 'right'] as const).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-lg px-3 py-2 text-xs font-800 capitalize ${mode === item ? 'bg-secondary text-white' : 'text-muted-foreground hover:text-foreground'}`}>{item === 'split' ? 'Compare' : item}</button>)}
              </div>
              <button type="button" onClick={() => void downloadComparison()} disabled={downloading} className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs disabled:opacity-60">{downloading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Exporting…</> : <><Icon name="ArrowDownTrayIcon" size={15} /> Download comparison</>}</button>
            </div>

            <div className="relative mx-auto aspect-[4/5] max-h-[760px] overflow-hidden rounded-[2rem] border border-border bg-[#dfe3e8] shadow-2xl">
              {portrait.startsWith('data:') ? <img src={portrait} alt="Uploaded portrait for virtual colour draping" className="h-full w-full object-cover" style={{ objectPosition: `${positionX}% ${positionY}%`, transform: `scale(${zoom / 100})` }} /> : <AppImage src={portrait} alt="Portrait for virtual colour draping" fill className="object-cover" style={{ objectPosition: `${positionX}% ${positionY}%`, transform: `scale(${zoom / 100})` }} />}
              {mode === 'split' ? <>{drapeLayer(left, 'left')}{drapeLayer(right, 'right')}<div className="pointer-events-none absolute bottom-0 left-1/2 w-px -translate-x-1/2 bg-white/80 shadow" style={{ height: `${height}%` }} /></> : drapeLayer(mode === 'left' ? left : right, 'full')}
              <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-between px-4 text-[10px] font-800 uppercase tracking-wider text-white"><span className="rounded-full bg-black/55 px-3 py-1.5 backdrop-blur">{mode === 'right' ? right.label : left.label}</span>{mode === 'split' && <span className="rounded-full bg-black/55 px-3 py-1.5 backdrop-blur">{right.label}</span>}</div>
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-xs font-800 text-foreground">Drape height <span className="float-right text-primary">{height}%</span><input type="range" min="30" max="60" value={height} onChange={(event) => setHeight(Number(event.target.value))} className="mt-3 w-full accent-primary" /></label>
              <label className="text-xs font-800 text-foreground">Opacity <span className="float-right text-primary">{opacity}%</span><input type="range" min="55" max="100" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} className="mt-3 w-full accent-primary" /></label>
              <label className="text-xs font-800 text-foreground">Portrait zoom <span className="float-right text-primary">{zoom}%</span><input type="range" min="100" max="145" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="mt-3 w-full accent-primary" /></label>
              <label className="text-xs font-800 text-foreground">Horizontal <span className="float-right text-primary">{positionX}%</span><input type="range" min="0" max="100" value={positionX} onChange={(event) => setPositionX(Number(event.target.value))} className="mt-3 w-full accent-primary" /></label>
              <label className="text-xs font-800 text-foreground">Vertical <span className="float-right text-primary">{positionY}%</span><input type="range" min="0" max="100" value={positionY} onChange={(event) => setPositionY(Number(event.target.value))} className="mt-3 w-full accent-primary" /></label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-800 uppercase tracking-wider text-primary">Left observation</p><p className="mt-2 text-sm font-800 text-foreground">{left.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{left.note}. Look for clearer skin, stronger eye definition and fewer visible shadows around the face.</p></div><div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-800 uppercase tracking-wider text-secondary">Right observation</p><p className="mt-2 text-sm font-800 text-foreground">{right.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{right.note}. Compare the face rather than choosing the colour you personally like more.</p></div></div>
            {error && <p className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-xs font-700 text-error">{error}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
