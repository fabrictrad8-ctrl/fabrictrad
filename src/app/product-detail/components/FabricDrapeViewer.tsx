'use client';
import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';

const FABRIC_TEXTURES = [
{
  id: 'nett',
  name: 'Soft Nett',
  thumbnail: "https://images.unsplash.com/photo-1606603049788-24284ce70986",
  alt: 'Cream nett fabric texture',
  opacity: 0.75,
  blendMode: 'multiply' as const
},
{
  id: 'georgette',
  name: 'Georgette',
  thumbnail: "https://images.unsplash.com/photo-1605069569728-ce7e50336b00",
  alt: 'Pink georgette fabric texture',
  opacity: 0.7,
  blendMode: 'multiply' as const
},
{
  id: 'silk',
  name: 'Banarasi Silk',
  thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1aeaa3700-1772089421033.png",
  alt: 'Red Banarasi silk brocade texture',
  opacity: 0.8,
  blendMode: 'multiply' as const
},
{
  id: 'cotton',
  name: 'Cotton',
  thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_174daee7c-1779170788598.png",
  alt: 'White cotton fabric texture',
  opacity: 0.65,
  blendMode: 'multiply' as const
}];


const MODEL_POSES = [
{
  id: 'front',
  label: 'Front View',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_13f7b8f3e-1766474744341.png",
  alt: 'Fashion model front view for fabric draping'
},
{
  id: 'side',
  label: 'Side View',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_13f7b8f3e-1766474744341.png",
  alt: 'Fashion model side view for fabric draping'
},
{
  id: 'full',
  label: 'Full Length',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f38d0ce7-1772722216837.png",
  alt: 'Fashion model full length view for fabric draping'
}];


type DrapingStep = 'select-fabric' | 'select-model' | 'adjust' | 'result';

export default function FabricDrapeViewer() {
  const [step, setStep] = useState<DrapingStep>('select-fabric');
  const [selectedFabric, setSelectedFabric] = useState(FABRIC_TEXTURES[0]);
  const [selectedModel, setSelectedModel] = useState(MODEL_POSES[0]);
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const fabricInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

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
    setIsProcessing(true);
    setTimeout(() => {
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
  };

  const activeFabricSrc = uploadedFabric || selectedFabric.thumbnail;
  const activeModelSrc = uploadedModel || selectedModel.image;

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
              <p className="text-xs text-muted-foreground">Drag fabric onto model · Adjust opacity & scale</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-600">
              ₹10/image
            </span>
            {showResult &&
            <button onClick={resetDrape} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors">
                Reset
              </button>
            }
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 mt-3">
          {(['select-fabric', 'select-model', 'adjust', 'result'] as DrapingStep[]).map((s, i) =>
          <React.Fragment key={s}>
              <div className={`flex items-center gap-1 text-xs font-600 px-2 py-0.5 rounded-full transition-all ${
            step === s ? 'bg-primary text-white' :
            ['select-fabric', 'select-model', 'adjust', 'result'].indexOf(step) > i ?
            'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`
            }>
                <span>{i + 1}</span>
                <span className="hidden sm:inline capitalize">{s.replace('-', ' ')}</span>
              </div>
              {i < 3 && <div className="flex-1 h-px bg-border max-w-6" />}
            </React.Fragment>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Step 1: Select Fabric */}
        {step === 'select-fabric' &&
        <div>
            <p className="text-sm font-700 text-foreground mb-3">Choose fabric texture or upload your own</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {FABRIC_TEXTURES.map((fabric) =>
            <button
              key={fabric.id}
              onClick={() => setSelectedFabric(fabric)}
              className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square ${
              selectedFabric.id === fabric.id ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'}`
              }>
              
                  <AppImage src={fabric.thumbnail} alt={fabric.alt} fill className="object-cover" sizes="120px" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-1 left-0 right-0 text-center text-white text-xs font-600 px-1">{fabric.name}</span>
                  {selectedFabric.id === fabric.id &&
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
            
              <input ref={fabricInputRef} type="file" accept="image/*" className="hidden" onChange={handleFabricUpload} />
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
                  <p className="text-xs font-600 text-foreground">Upload your fabric image</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG up to 10MB</p>
                </>
            }
            </div>

            <button
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
              onClick={() => setSelectedModel(pose)}
              className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-[3/4] ${
              selectedModel.id === pose.id ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'}`
              }>
              
                  <AppImage src={pose.image} alt={pose.alt} fill className="object-cover" sizes="120px" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-1 left-0 right-0 text-center text-white text-xs font-600">{pose.label}</span>
                  {selectedModel.id === pose.id &&
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
            
              <input ref={modelInputRef} type="file" accept="image/*" className="hidden" onChange={handleModelUpload} />
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
              <button onClick={() => setStep('select-fabric')} className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">
                ← Back
              </button>
              <button onClick={() => setStep('adjust')} className="btn-primary flex-1 py-2.5 text-sm rounded-xl">
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
              className={`absolute cursor-grab active:cursor-grabbing transition-none ${isDragging ? 'cursor-grabbing' : ''}`}
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(calc(-50% + ${drapePosition.x}px), calc(-50% + ${drapePosition.y}px)) scale(${scale / 100}) rotate(${rotation}deg)`,
                width: '60%',
                height: '60%',
                opacity: opacity / 100,
                mixBlendMode: selectedFabric.blendMode,
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
              <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                <Icon name="ArrowsPointingOutIcon" size={11} />
                Drag fabric to position
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
                type="range" min={20} max={100} value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full accent-primary" />
              
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-600 text-foreground">Scale</span>
                  <span className="text-muted-foreground">{scale}%</span>
                </div>
                <input
                type="range" min={40} max={180} value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full accent-primary" />
              
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-600 text-foreground">Rotation</span>
                  <span className="text-muted-foreground">{rotation}°</span>
                </div>
                <input
                type="range" min={-45} max={45} value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full accent-primary" />
              
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('select-model')} className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">
                ← Back
              </button>
              <button
              onClick={handleGenerateDrape}
              disabled={isProcessing}
              className="btn-primary flex-1 py-2.5 text-sm rounded-xl flex items-center justify-center gap-2">
              
                {isProcessing ?
              <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </> :

              <>
                    <Icon name="SparklesIcon" size={14} />
                    Generate Drape (₹10)
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
            <div className="relative rounded-xl overflow-hidden bg-muted border border-border mb-4" style={{ height: 320 }}>
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
                mixBlendMode: selectedFabric.blendMode
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
              <p>This is a browser-based drape overlay. For AI-powered photorealistic draping with full 3D simulation, our AI processing engine generates a high-resolution result (₹10/image, credited to your account).</p>
            </div>

            <div className="flex gap-2">
              <button onClick={resetDrape} className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">
                Try Another
              </button>
              <button className="btn-primary flex-1 py-2.5 text-sm rounded-xl flex items-center justify-center gap-2">
                <Icon name="ArrowDownTrayIcon" size={14} />
                Save Preview
              </button>
            </div>
          </div>
        }
      </div>
    </div>);

}