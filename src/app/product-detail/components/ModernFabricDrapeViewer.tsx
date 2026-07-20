'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useProduct } from '@/lib/hooks/useProduct';
import { useAuth } from '@/contexts/AuthContext';

const models = [
  { id: 'occasion', label: 'Occasionwear model', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=88' },
  { id: 'studio', label: 'Studio model', image: 'https://images.unsplash.com/photo-1618375531912-867984bdfd87?auto=format&fit=crop&w=1200&q=88' },
  { id: 'menswear', label: 'Menswear model', image: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1200&q=88' },
] as const;

const garments = [
  { id: 'saree', label: 'Saree', description: 'six-yard saree with natural pleats and pallu' },
  { id: 'lehenga', label: 'Lehenga', description: 'full lehenga skirt, blouse and coordinated dupatta' },
  { id: 'kurta', label: 'Kurta', description: 'straight tailored kurta with realistic textile fall' },
  { id: 'shirt', label: 'Shirt', description: 'premium long-sleeve shirt with collar and natural seams' },
  { id: 'dress', label: 'Dress', description: 'modern midi dress with clean tailoring' },
  { id: 'dupatta', label: 'Dupatta', description: 'draped dupatta layered naturally over the outfit' },
] as const;

const fits = ['Relaxed', 'Regular', 'Tailored'] as const;
const MAX_UPLOAD = 8 * 1024 * 1024;

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
}

export default function ModernFabricDrapeViewer() {
  const { product } = useProduct();
  const { user } = useAuth();
  const [modelId, setModelId] = useState(models[0].id);
  const [garmentId, setGarmentId] = useState(garments[0].id);
  const [fit, setFit] = useState<(typeof fits)[number]>('Regular');
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [compare, setCompare] = useState(55);
  const [opacity, setOpacity] = useState(70);
  const [scale, setScale] = useState(112);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);

  const model = useMemo(() => models.find((item) => item.id === modelId) || models[0], [modelId]);
  const garment = useMemo(() => garments.find((item) => item.id === garmentId) || garments[0], [garmentId]);
  const baseImage = personImage || model.image;
  const fabricImage = product.images?.[0] || product.image;

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
      setPersonImage(await readImage(file));
      setResult(null);
      setAnalysis('');
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
    setLoading(true);
    try {
      const response = await fetch('/api/ai/drape-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fabricImage,
          modelImage: baseImage,
          fabricName: `${product.name}; ${product.gsm || 'unknown'} GSM; ${product.work || 'textile fabric'}`,
          styleName: `${fit.toLowerCase()} fit ${garment.description}`,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { image?: string; analysis?: string; error?: string };
      if (!response.ok || !payload.image) throw new Error(payload.error || 'Unable to generate the drape preview.');
      setResult(payload.image);
      setAnalysis(payload.analysis || 'Preview generated. Confirm shade, scale and hand-feel with a physical sample before bulk production.');
      setCompare(55);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Unable to generate the drape preview.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPersonImage(null);
    setResult(null);
    setAnalysis('');
    setError('');
    setModelId(models[0].id);
    setGarmentId(garments[0].id);
    setFit('Regular');
    setOpacity(70);
    setScale(112);
  };

  const download = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result;
    link.download = `${product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-drape.png`;
    link.click();
  };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border bg-card card-shadow-lg">
      <header className="bg-gradient-to-r from-secondary via-navy-light to-secondary px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-800 uppercase tracking-[0.18em] text-gold"><Icon name="SparklesIcon" size={16} /> FabricTrad AI Drape Studio</p>
            <h2 className="mt-2 text-2xl font-800 sm:text-3xl">Preview this fabric on a garment</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Use a studio model or your own photo, choose the garment and fit, then generate a sourcing preview before ordering a sample.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white/80"><p className="font-800 text-white">Private preview</p><p className="mt-1">Authenticated and quota-protected.</p></div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-b border-border p-5 lg:border-b-0 lg:border-r sm:p-6">
          <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">1 · Choose a person</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {models.map((item) => (
              <button key={item.id} type="button" onClick={() => { setModelId(item.id); setPersonImage(null); setResult(null); }} className={`overflow-hidden rounded-xl border-2 text-left ${modelId === item.id && !personImage ? 'border-primary' : 'border-border'}`}>
                <div className="relative aspect-[3/4]"><AppImage src={item.image} alt={item.label} fill className="object-cover" /></div>
                <p className="truncate px-2 py-2 text-[10px] font-800 text-foreground">{item.label}</p>
              </button>
            ))}
          </div>
          <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
          <button type="button" onClick={() => uploadRef.current?.click()} className="btn-secondary mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs"><Icon name="ArrowUpTrayIcon" size={16} />Upload your own photo</button>

          <p className="mt-6 text-xs font-800 uppercase tracking-wider text-muted-foreground">2 · Garment style</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {garments.map((item) => <button key={item.id} type="button" onClick={() => { setGarmentId(item.id); setResult(null); }} className={`rounded-xl border px-2 py-2.5 text-xs font-800 ${garmentId === item.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground'}`}>{item.label}</button>)}
          </div>

          <p className="mt-5 text-xs font-800 uppercase tracking-wider text-muted-foreground">3 · Fit</p>
          <div className="mt-3 flex gap-2">{fits.map((item) => <button key={item} type="button" onClick={() => { setFit(item); setResult(null); }} className={`flex-1 rounded-xl border py-2 text-xs font-800 ${fit === item ? 'border-secondary bg-secondary text-white' : 'border-border text-foreground'}`}>{item}</button>)}</div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-muted p-3"><div className="relative h-14 w-14 overflow-hidden rounded-xl"><AppImage src={fabricImage} alt={product.name} fill className="object-cover" /></div><div className="min-w-0"><p className="truncate text-sm font-800 text-foreground">{product.name}</p><p className="text-xs text-muted-foreground">{product.gsm ? `${product.gsm} GSM · ` : ''}{product.work}</p></div></div>

          <button type="button" onClick={generate} disabled={loading} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 disabled:opacity-60">{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Generating…</> : <><Icon name="SparklesIcon" size={18} />Generate AI drape</>}</button>
          {!user && <p className="mt-3 text-center text-xs text-muted-foreground"><Link href="/login" className="font-800 text-primary hover:underline">Sign in</Link> to generate securely.</p>}
          <button type="button" onClick={reset} className="mt-2 w-full rounded-xl py-2.5 text-xs font-800 text-muted-foreground hover:bg-muted">Reset studio</button>
          {error && <p className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-xs font-700 text-error">{error}</p>}
        </aside>

        <section className="min-w-0 bg-muted/40 p-4 sm:p-6">
          <div className="mx-auto max-w-3xl">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
              {baseImage.startsWith('data:') ? <img src={baseImage} alt="Uploaded person for fabric preview" className="h-full w-full object-cover" /> : <AppImage src={baseImage} alt="Person selected for fabric preview" fill className="object-cover" />}
              {!result && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="relative h-[72%] w-[58%] overflow-hidden rounded-[45%_45%_18%_18%]" style={{ opacity: opacity / 100, transform: `scale(${scale / 100})`, mixBlendMode: 'multiply' }}>{fabricImage.startsWith('data:') ? <img src={fabricImage} alt="Selected fabric" className="h-full w-full object-cover" /> : <AppImage src={fabricImage} alt="Selected fabric" fill className="object-cover" />}</div><div className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/55 p-3 text-xs text-white backdrop-blur"><span className="font-800">Composition preview:</span> generate the AI result for realistic folds, seams and anatomy.</div></div>}
              {result && <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${compare}%` }}><img src={result} alt="AI generated fabric drape" className="h-full object-cover" style={{ width: `${10000 / compare}%`, maxWidth: 'none' }} /></div>}
              {result && <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-xl" style={{ left: `${compare}%` }}><div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-secondary shadow-xl"><Icon name="ArrowsRightLeftIcon" size={18} /></div></div>}
              <span className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-800 uppercase tracking-wider text-white">{result ? 'AI result' : 'Live preview'}</span>
            </div>

            {result ? <div className="mt-4 rounded-2xl border border-border bg-card p-4"><label className="flex items-center justify-between text-xs font-800 text-foreground"><span>Compare AI result with original</span><span>{compare}%</span></label><input type="range" min="5" max="95" value={compare} onChange={(event) => setCompare(Number(event.target.value))} className="mt-3 w-full accent-primary" /><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xl text-xs leading-5 text-muted-foreground">{analysis}</p><button type="button" onClick={download} className="btn-secondary flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs"><Icon name="ArrowDownTrayIcon" size={16} />Download</button></div></div> : <div className="mt-4 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2"><label className="text-xs font-800 text-foreground">Fabric opacity <span className="float-right text-primary">{opacity}%</span><input type="range" min="25" max="95" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} className="mt-3 w-full accent-primary" /></label><label className="text-xs font-800 text-foreground">Fabric scale <span className="float-right text-primary">{scale}%</span><input type="range" min="80" max="150" value={scale} onChange={(event) => setScale(Number(event.target.value))} className="mt-3 w-full accent-primary" /></label></div>}
          </div>
        </section>
      </div>
    </div>
  );
}
