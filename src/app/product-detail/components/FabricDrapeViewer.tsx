'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';

// These are the ACTUAL product images from ProductGallery — same product being viewed
const PRODUCT_IMAGES = [
{
  id: 'product-1',
  name: 'Full View',
  src: "https://images.unsplash.com/photo-1514830482894-94795a87f997",
  alt: 'Cream soft nett fabric with intricate gold embroidery floral pattern'
},
{
  id: 'product-2',
  name: 'Close-up',
  src: "https://img.rocket.new/generatedImages/rocket_gen_img_1acbbfc48-1773129576236.png",
  alt: 'Close-up macro detail of gold embroidery thread work on white nett fabric'
},
{
  id: 'product-3',
  name: 'Draped',
  src: "https://img.rocket.new/generatedImages/rocket_gen_img_13cdc9d4f-1772216883669.png",
  alt: 'Draped soft nett fabric showing flow and texture in studio setting'
},
{
  id: 'product-4',
  name: 'Texture',
  src: "https://img.rocket.new/generatedImages/rocket_gen_img_1b23ddc65-1772723055087.png",
  alt: 'Fabric texture close-up showing weave pattern and embroidery density'
}];


const MODEL_POSES = [
{
  id: 'front',
  label: 'Front View',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_13f7b8f3e-1766474744341.png",
  alt: 'Fashion model front view for fabric draping'
},
{
  id: 'full',
  label: 'Full Length',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f38d0ce7-1772722216837.png",
  alt: 'Fashion model full length view for fabric draping'
},
{
  id: 'side',
  label: 'Side View',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_13f7b8f3e-1766474744341.png",
  alt: 'Fashion model side view for fabric draping'
}];


const FREE_QUOTA = 2;
const STORAGE_KEY = 'ft_drape_usage';

type DrapingStep = 'select-fabric' | 'select-model' | 'adjust' | 'result';

function getDrapeUsage(): {count: number;date: string;} {
  if (typeof window === 'undefined') return { count: 0, date: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, date: new Date().toDateString() };
    return JSON.parse(raw);
  } catch {
    return { count: 0, date: new Date().toDateString() };
  }
}

function incrementDrapeUsage(): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toDateString();
  const usage = getDrapeUsage();
  // Reset daily count if new day
  const newCount = usage.date === today ? usage.count + 1 : 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: newCount, date: today }));
  return newCount;
}

export default function FabricDrapeViewer() {
  const [step, setStep] = useState<DrapingStep>('select-fabric');
  const [selectedFabricId, setSelectedFabricId] = useState<string>(PRODUCT_IMAGES[0].id);
  const [selectedModelId, setSelectedModelId] = useState<string>(MODEL_POSES[0].id);
  const [opacity, setOpacity] = useState(75);
  const [scale, setScale] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [drapePosition, setDrapePosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [uploadedFabric, setUploadedFabric] = useState<string | null>(null);
  const [uploadedModel, setUploadedModel] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fabricInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const usage = getDrapeUsage();
    const today = new Date().toDateString();
    setUsageCount(usage.date === today ? usage.count : 0);
  }, []);

  const selectedFabric = PRODUCT_IMAGES.find((f) => f.id === selectedFabricId) || PRODUCT_IMAGES[0];
  const selectedModel = MODEL_POSES.find((m) => m.id === selectedModelId) || MODEL_POSES[0];
  const activeFabricSrc = uploadedFabric || selectedFabric.src;
  const activeModelSrc = uploadedModel || selectedModel.image;
  const freeRemaining = Math.max(0, FREE_QUOTA - usageCount);
  const isFree = freeRemaining > 0;

  const handleFabricSelect = (id: string) => {
    setSelectedFabricId(id);
    setUploadedFabric(null);
  };

  const handleFabricUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedFabric(url);
    }
  };

  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedModel(url);
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - drapePosition.x, y: e.clientY - drapePosition.y });
  }, [drapePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setDrapePosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - drapePosition.x, y: touch.clientY - drapePosition.y });
  }, [drapePosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setDrapePosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => setIsDragging(false), []);

  const handleGenerateDrape = () => {
    if (!isFree && !showPaywall) {
      setShowPaywall(true);
      return;
    }
    setShowPaywall(false);
    setIsProcessing(true);
    setTimeout(() => {
      const newCount = incrementDrapeUsage();
      setUsageCount(newCount);
      setIsProcessing(false);
      setShowResult(true);
      setStep('result');
    }, 2200);
  };

  const handlePayAndGenerate = () => {
    // In production, trigger Razorpay for ₹10/day charge
    setShowPaywall(false);
    setIsProcessing(true);
    setTimeout(() => {
      const newCount = incrementDrapeUsage();
      setUsageCount(newCount);
      setIsProcessing(false);
      setShowResult(true);
      setStep('result');
    }, 2200);
  };

  const resetDrape = () => {
    setStep('select-fabric');
    setShowResult(false);
    setDrapePosition({ x: 0, y: 0 });
    setOpacity(75);
    setScale(100);
    setRotation(0);
    setUploadedFabric(null);
    setUploadedModel(null);
    setShowPaywall(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="SparklesIcon" size={16} className="text-primary" />
            </div>
            <div>
              <h3 className="font-700 text-sm text-foreground">3D Fabric Drape-on-Model</h3>
              <p className="text-xs text-muted-foreground">Drag fabric onto model · Adjust opacity &amp; scale</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isFree ?
            <span className="text-xs bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full font-600">
                {freeRemaining} free left
              </span> :

            <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-600">
                ₹10/day
              </span>
            }
            {showResult &&
            <button
              onClick={resetDrape}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors">
              
                Reset
              </button>
            }
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 mt-3">
          {(['select-fabric', 'select-model', 'adjust', 'result'] as DrapingStep[]).map((s, i) =>
          <React.Fragment key={s}>
              <button
              onClick={() => {
                if (s !== 'result' || showResult) setStep(s);
              }}
              className={`flex items-center gap-1 text-xs font-600 px-2 py-0.5 rounded-full transition-all ${
              step === s ?
              'bg-primary text-white' :
              (['select-fabric', 'select-model', 'adjust', 'result'] as DrapingStep[]).indexOf(step) > i ?
              'bg-success/20 text-success cursor-pointer hover:bg-success/30' : 'bg-muted text-muted-foreground'}`
              }>
              
                <span>{i + 1}</span>
                <span className="hidden sm:inline capitalize">{s.replace('-', ' ')}</span>
              </button>
              {i < 3 && <div className="flex-1 h-px bg-border max-w-6" />}
            </React.Fragment>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Step 1: Select Fabric — uses actual product images */}
        {step === 'select-fabric' &&
        <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm font-700 text-foreground">Select fabric view from this product</p>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-600">Actual Product</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {PRODUCT_IMAGES.map((fabric) =>
            <button
              key={fabric.id}
              type="button"
              onClick={() => handleFabricSelect(fabric.id)}
              className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square focus:outline-none ${
              selectedFabricId === fabric.id && !uploadedFabric ?
              'border-primary shadow-md ring-2 ring-primary/30' :
              'border-border hover:border-primary/50'}`
              }>
              
                  <AppImage src={fabric.src} alt={fabric.alt} fill className="object-cover" sizes="120px" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-1 left-0 right-0 text-center text-white text-xs font-600 px-1">
                    {fabric.name}
                  </span>
                  {selectedFabricId === fabric.id && !uploadedFabric &&
              <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Icon name="CheckIcon" size={10} className="text-white" />
                    </div>
              }
                </button>
            )}
            </div>

            {/* Upload own fabric */}
            <div
            onClick={() => fabricInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all mb-4">
            
              <input
              ref={fabricInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFabricUpload} />
            
              {uploadedFabric ?
            <div className="flex items-center justify-center gap-2">
                  <img src={uploadedFabric} alt="Uploaded fabric" className="w-12 h-12 object-cover rounded-lg" />
                  <div className="text-left">
                    <p className="text-xs font-700 text-success">Custom fabric uploaded ✓</p>
                    <p className="text-xs text-muted-foreground">Click to change</p>
                  </div>
                </div> :

            <>
                  <Icon name="PhotoIcon" size={20} className="text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs font-600 text-foreground">Upload a different fabric image</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG up to 10MB</p>
                </>
            }
            </div>

            {/* Free quota notice */}
            {isFree ?
          <div className="flex items-center gap-2 mb-3 p-2.5 bg-success/5 border border-success/20 rounded-xl">
                <Icon name="GiftIcon" size={14} className="text-success shrink-0" />
                <p className="text-xs text-success font-600">
                  {freeRemaining} free drape{freeRemaining !== 1 ? 's' : ''} remaining · First 2 are free!
                </p>
              </div> :

          <div className="flex items-center gap-2 mb-3 p-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                <Icon name="CurrencyRupeeIcon" size={14} className="text-primary shrink-0" />
                <p className="text-xs text-primary font-600">
                  Free quota used · ₹10/day charge applies for additional drapes
                </p>
              </div>
          }

            <button
            type="button"
            onClick={() => setStep('select-model')}
            className="btn-primary w-full py-2.5 text-sm rounded-xl">
            
              Next: Choose Model →
            </button>
          </div>
        }

        {/* Step 2: Select Model */}
        {step === 'select-model' &&
        <div>
            <p className="text-sm font-700 text-foreground mb-3">Choose a model pose or upload a photo</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {MODEL_POSES.map((pose) =>
            <button
              key={pose.id}
              type="button"
              onClick={() => {
                setSelectedModelId(pose.id);
                setUploadedModel(null);
              }}
              className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-[3/4] focus:outline-none ${
              selectedModelId === pose.id && !uploadedModel ?
              'border-primary shadow-md ring-2 ring-primary/30' :
              'border-border hover:border-primary/50'}`
              }>
              
                  <AppImage src={pose.image} alt={pose.alt} fill className="object-cover" sizes="120px" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-1 left-0 right-0 text-center text-white text-xs font-600">
                    {pose.label}
                  </span>
                  {selectedModelId === pose.id && !uploadedModel &&
              <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Icon name="CheckIcon" size={10} className="text-white" />
                    </div>
              }
                </button>
            )}
            </div>

            {/* Upload own photo */}
            <div
            onClick={() => modelInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all mb-4">
            
              <input
              ref={modelInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleModelUpload} />
            
              {uploadedModel ?
            <div className="flex items-center justify-center gap-2">
                  <img src={uploadedModel} alt="Uploaded model" className="w-12 h-12 object-cover rounded-lg" />
                  <div className="text-left">
                    <p className="text-xs font-700 text-success">Custom photo uploaded ✓</p>
                    <p className="text-xs text-muted-foreground">Click to change</p>
                  </div>
                </div> :

            <>
                  <Icon name="UserCircleIcon" size={20} className="text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs font-600 text-foreground">Upload your selfie or statue photo</p>
                  <p className="text-xs text-muted-foreground">For best results, use a full-body photo</p>
                </>
            }
            </div>

            <div className="flex gap-2">
              <button
              type="button"
              onClick={() => setStep('select-fabric')}
              className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">
              
                ← Back
              </button>
              <button
              type="button"
              onClick={() => setStep('adjust')}
              className="btn-primary flex-1 py-2.5 text-sm rounded-xl">
              
                Next: Adjust →
              </button>
            </div>
          </div>
        }

        {/* Step 3: Drag & Adjust */}
        {step === 'adjust' &&
        <div>
            <p className="text-sm font-700 text-foreground mb-3">Drag fabric onto model · Adjust settings</p>

            {/* Canvas */}
            <div
            ref={canvasRef}
            className="relative rounded-xl overflow-hidden bg-muted border border-border mb-4 select-none"
            style={{ height: 320 }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}>
            
              {/* Model base */}
              <img
              src={activeModelSrc}
              alt={selectedModel.alt}
              className="w-full h-full object-cover"
              draggable={false} />
            

              {/* Draggable fabric overlay */}
              <div
              className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(calc(-50% + ${drapePosition.x}px), calc(-50% + ${drapePosition.y}px)) scale(${scale / 100}) rotate(${rotation}deg)`,
                width: '60%',
                height: '60%',
                opacity: opacity / 100,
                mixBlendMode: 'multiply',
                touchAction: 'none'
              }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}>
              
                <img
                src={activeFabricSrc}
                alt={selectedFabric.alt}
                className="w-full h-full object-cover rounded-lg"
                draggable={false} />
              
              </div>

              {/* Drag hint */}
              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1 pointer-events-none">
                <Icon name="ArrowsPointingOutIcon" size={11} />
                Drag fabric to position
              </div>

              {/* Selected fabric label */}
              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg pointer-events-none">
                {uploadedFabric ? 'Custom' : selectedFabric.name}
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-600 text-foreground">Opacity</span>
                  <span className="text-muted-foreground">{opacity}%</span>
                </div>
                <input
                type="range"
                min={20}
                max={100}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full accent-primary" />
              
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-600 text-foreground">Scale</span>
                  <span className="text-muted-foreground">{scale}%</span>
                </div>
                <input
                type="range"
                min={40}
                max={180}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full accent-primary" />
              
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-600 text-foreground">Rotation</span>
                  <span className="text-muted-foreground">{rotation}°</span>
                </div>
                <input
                type="range"
                min={-45}
                max={45}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full accent-primary" />
              
              </div>
            </div>

            {/* Paywall notice */}
            {showPaywall &&
          <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="CurrencyRupeeIcon" size={16} className="text-primary" />
                  <p className="text-sm font-700 text-foreground">Free quota used</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  You&apos;ve used your 2 free drapes. Additional drapes are charged at ₹10/day (unlimited drapes for the day).
                </p>
                <button
              type="button"
              onClick={handlePayAndGenerate}
              className="btn-primary w-full py-2.5 text-sm rounded-xl flex items-center justify-center gap-2">
              
                  <Icon name="LockClosedIcon" size={14} />
                  Pay ₹10 &amp; Generate (Unlimited Today)
                </button>
              </div>
          }

            <div className="flex gap-2">
              <button
              type="button"
              onClick={() => setStep('select-model')}
              className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">
              
                ← Back
              </button>
              <button
              type="button"
              onClick={handleGenerateDrape}
              disabled={isProcessing}
              className="btn-primary flex-1 py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
              
                {isProcessing ?
              <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </> :

              <>
                    <Icon name="SparklesIcon" size={14} />
                    {isFree ? `Generate Drape (Free · ${freeRemaining} left)` : 'Generate Drape (₹10/day)'}
                  </>
              }
              </button>
            </div>
          </div>
        }

        {/* Step 4: Result */}
        {step === 'result' && showResult &&
        <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center">
                <Icon name="CheckIcon" size={12} className="text-white" />
              </div>
              <p className="text-sm font-700 text-success">Drape preview generated!</p>
            </div>

            {/* Result preview */}
            <div
            className="relative rounded-xl overflow-hidden bg-muted border border-border mb-4"
            style={{ height: 320 }}>
            
              <img
              src={activeModelSrc}
              alt={selectedModel.alt}
              className="w-full h-full object-cover" />
            
              <div
              className="absolute"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(calc(-50% + ${drapePosition.x}px), calc(-50% + ${drapePosition.y}px)) scale(${scale / 100}) rotate(${rotation}deg)`,
                width: '60%',
                height: '60%',
                opacity: opacity / 100,
                mixBlendMode: 'multiply'
              }}>
              
                <img
                src={activeFabricSrc}
                alt={selectedFabric.alt}
                className="w-full h-full object-cover rounded-lg" />
              
              </div>

              {/* Watermark */}
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-lg font-600">
                FabricTrad Preview
              </div>
            </div>

            <div className="bg-muted rounded-xl p-3 mb-4 text-xs text-muted-foreground">
              <p className="font-600 text-foreground mb-1">About this preview</p>
              <p>
                This is a browser-based drape overlay using the actual product fabric image. For AI-powered
                photorealistic draping with full 3D simulation, our AI processing engine generates a high-resolution
                result (₹10/day, unlimited drapes credited to your account).
              </p>
            </div>

            <div className="flex gap-2">
              <button
              type="button"
              onClick={resetDrape}
              className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">
              
                Try Another
              </button>
              <button
              type="button"
              onClick={() => {
                const link = document.createElement('a');
                link.href = activeModelSrc;
                link.download = 'fabrictrad-drape-preview.jpg';
                link.click();
              }}
              className="btn-primary flex-1 py-2.5 text-sm rounded-xl flex items-center justify-center gap-2">
              
                <Icon name="ArrowDownTrayIcon" size={14} />
                Save Preview
              </button>
            </div>
          </div>
        }
      </div>
    </div>);

}