'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';

// Product fabric images — actual images of the fabric being viewed
const PRODUCT_FABRIC_IMAGES = [
{
  id: 'fabric-1',
  name: 'Full View',
  src: 'https://images.unsplash.com/photo-1514830482894-94795a87f997',
  alt: 'Cream soft nett fabric with intricate gold embroidery floral pattern',
  thumbnail: "https://images.unsplash.com/photo-1514830482894-94795a87f997"
},
{
  id: 'fabric-2',
  name: 'Close-up',
  src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1acbbfc48-1773129576236.png',
  alt: 'Close-up macro detail of gold embroidery thread work on white nett fabric',
  thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1acbbfc48-1773129576236.png'
},
{
  id: 'fabric-3',
  name: 'Draped',
  src: 'https://img.rocket.new/generatedImages/rocket_gen_img_13cdc9d4f-1772216883669.png',
  alt: 'Draped soft nett fabric showing flow and texture in studio setting',
  thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_13cdc9d4f-1772216883669.png'
},
{
  id: 'fabric-4',
  name: 'Texture',
  src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1b23ddc65-1772723055087.png',
  alt: 'Fabric texture close-up showing weave pattern and embroidery density',
  thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1b23ddc65-1772723055087.png'
}];


// Model poses for draping
const MODEL_POSES = [
{
  id: 'saree',
  label: 'Saree Drape',
  icon: '👘',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1405f67fe-1778499810520.png",
  alt: 'Fashion model in saree pose for fabric draping visualization',
  description: 'Traditional saree draping style'
},
{
  id: 'lehenga',
  label: 'Lehenga',
  icon: '👗',
  image: "https://images.unsplash.com/photo-1611505254094-4b0ae99e6500",
  alt: 'Fashion model in lehenga pose for fabric draping visualization',
  description: 'Lehenga & dupatta style'
},
{
  id: 'suit',
  label: 'Suit / Kurti',
  icon: '🥻',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1c0bc95c6-1773141263634.png",
  alt: 'Fashion model in suit pose for fabric draping visualization',
  description: 'Salwar suit / kurti style'
}];


const FREE_QUOTA = 3;
const STORAGE_KEY = 'ft_drape_usage_v2';

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
  const newCount = usage.date === today ? usage.count + 1 : 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: newCount, date: today }));
  return newCount;
}

type Step = 'select' | 'preview' | 'result';
type PhotoSource = 'model' | 'upload' | 'camera';

interface DrapeSettings {
  opacity: number;
  blend: 'multiply' | 'overlay' | 'screen' | 'normal';
  scale: number;
  posX: number;
  posY: number;
  rotation: number;
}

export default function FabricDrapeViewer() {
  const [step, setStep] = useState<Step>('select');
  const [selectedFabricId, setSelectedFabricId] = useState(PRODUCT_FABRIC_IMAGES[0].id);
  const [selectedPoseId, setSelectedPoseId] = useState(MODEL_POSES[0].id);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<PhotoSource>('model');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [settings, setSettings] = useState<DrapeSettings>({
    opacity: 72,
    blend: 'multiply',
    scale: 110,
    posX: 0,
    posY: 0,
    rotation: 0
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const usage = getDrapeUsage();
    const today = new Date().toDateString();
    setUsageCount(usage.date === today ? usage.count : 0);
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const selectedFabric = PRODUCT_FABRIC_IMAGES.find((f) => f.id === selectedFabricId) || PRODUCT_FABRIC_IMAGES[0];
  const selectedPose = MODEL_POSES.find((p) => p.id === selectedPoseId) || MODEL_POSES[0];
  const modelSrc = uploadedPhoto || selectedPose.image;
  const freeRemaining = Math.max(0, FREE_QUOTA - usageCount);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedPhoto(url);
      setPhotoSource('upload');
      setCameraActive(false);
    }
  };

  const handleStartCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      setPhotoSource('camera');
    } catch {
      setCameraError('Camera access denied. Please allow camera permission and try again.');
    }
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror the image (selfie mode)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setUploadedPhoto(dataUrl);
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleStopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - settings.posX, y: e.clientY - settings.posY });
    },
    [settings.posX, settings.posY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setSettings((s) => ({ ...s, posX: e.clientX - dragStart.x, posY: e.clientY - dragStart.y }));
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - settings.posX, y: touch.clientY - settings.posY });
    },
    [settings.posX, settings.posY]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      setSettings((s) => ({ ...s, posX: touch.clientX - dragStart.x, posY: touch.clientY - dragStart.y }));
    },
    [isDragging, dragStart]
  );

  const handleTouchEnd = useCallback(() => setIsDragging(false), []);

  const handleGenerate = () => {
    if (freeRemaining <= 0) {
      setShowPaywall(true);
      return;
    }
    setIsGenerating(true);
    setTimeout(() => {
      incrementDrapeUsage();
      setUsageCount((c) => c + 1);
      setIsGenerating(false);
      setShowResult(true);
      setStep('result');
    }, 2000);
  };

  const handleReset = () => {
    setStep('select');
    setShowResult(false);
    setShowPaywall(false);
    setUploadedPhoto(null);
    setPhotoSource('model');
    setCameraActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setSettings({ opacity: 72, blend: 'multiply', scale: 110, posX: 0, posY: 0, rotation: 0 });
  };

  const blendModes: {value: DrapeSettings['blend'];label: string;}[] = [
    { value: 'multiply', label: 'Multiply' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'screen', label: 'Screen' },
    { value: 'normal', label: 'Normal' }
  ];

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
              <h3 className="font-700 text-sm text-foreground">AI Drape-on Visualizer</h3>
              <p className="text-xs text-muted-foreground">On model · Upload photo · Use camera selfie</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {freeRemaining > 0 ?
              <span className="text-xs bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full font-600">
                {freeRemaining} free today
              </span> :
              <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-600">
                ₹10/day unlimited
              </span>
            }
            {showResult &&
              <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors">
                Reset
              </button>
            }
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mt-3">
          {(['select', 'preview', 'result'] as Step[]).map((s, i) =>
            <React.Fragment key={s}>
              <button
                onClick={() => {if (s !== 'result' || showResult) setStep(s);}}
                className={`flex items-center gap-1.5 text-xs font-600 transition-colors ${step === s ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-800 ${step === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <span className="hidden sm:inline capitalize">{s === 'select' ? 'Select' : s === 'preview' ? 'Adjust' : 'Result'}</span>
              </button>
              {i < 2 && <div className={`flex-1 h-px ${i < ['select', 'preview', 'result'].indexOf(step) ? 'bg-primary' : 'bg-border'}`} />}
            </React.Fragment>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* STEP 1: Select Fabric + Model */}
        {step === 'select' &&
          <div className="space-y-5">
            {/* Fabric Selection */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-primary text-white text-xs font-800 flex items-center justify-center">1</div>
                <p className="text-sm font-700 text-foreground">Choose Fabric View</p>
                <span className="text-xs text-muted-foreground">(This product's actual fabric)</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {PRODUCT_FABRIC_IMAGES.map((fabric) =>
                  <button
                    key={fabric.id}
                    onClick={() => setSelectedFabricId(fabric.id)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square ${selectedFabricId === fabric.id ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'}`}
                  >
                    <AppImage src={fabric.src} alt={fabric.alt} width={80} height={80} className="object-cover w-full h-full" />
                    {selectedFabricId === fabric.id &&
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Icon name="CheckCircleIcon" size={20} className="text-white" variant="solid" />
                      </div>
                    }
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-0.5 px-1">
                      <p className="text-white text-xs font-600 truncate">{fabric.name}</p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Photo Source Selection */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-primary text-white text-xs font-800 flex items-center justify-center">2</div>
                <p className="text-sm font-700 text-foreground">Choose Photo Source</p>
              </div>

              {/* Source Tabs */}
              <div className="flex gap-2 mb-3">
                {[
                  { key: 'model' as PhotoSource, label: 'On Model', icon: 'UserIcon' },
                  { key: 'upload' as PhotoSource, label: 'Upload Photo', icon: 'ArrowUpTrayIcon' },
                  { key: 'camera' as PhotoSource, label: 'Use Camera', icon: 'CameraIcon' },
                ].map((src) => (
                  <button
                    key={src.key}
                    onClick={() => {
                      setPhotoSource(src.key);
                      if (src.key !== 'camera') handleStopCamera();
                      if (src.key !== 'upload' && src.key !== 'camera') setUploadedPhoto(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-600 border transition-all ${
                      photoSource === src.key
                        ? 'bg-primary text-white border-primary' :'bg-muted border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Icon name={src.icon as 'UserIcon'} size={13} />
                    {src.label}
                  </button>
                ))}
              </div>

              {/* Model Poses */}
              {photoSource === 'model' && (
                <div className="grid grid-cols-3 gap-2">
                  {MODEL_POSES.map((pose) =>
                    <button
                      key={pose.id}
                      onClick={() => { setSelectedPoseId(pose.id); setUploadedPhoto(null); }}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all ${selectedPoseId === pose.id ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'}`}
                    >
                      <div className="aspect-[3/4] relative">
                        <AppImage src={pose.image} alt={pose.alt} width={120} height={160} className="object-cover w-full h-full" />
                        {selectedPoseId === pose.id &&
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <Icon name="CheckCircleIcon" size={20} className="text-white" variant="solid" />
                          </div>
                        }
                      </div>
                      <div className="p-1.5 bg-card">
                        <p className="text-xs font-700 text-foreground text-center">{pose.label}</p>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Upload Photo */}
              {photoSource === 'upload' && (
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${uploadedPhoto ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}
                >
                  {uploadedPhoto ? (
                    <>
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                        <img src={uploadedPhoto} alt="Uploaded photo for fabric draping" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-700 text-primary">Photo uploaded ✓</p>
                        <p className="text-xs text-muted-foreground">Fabric will drape on your photo</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setUploadedPhoto(null); }}
                        className="text-xs text-error hover:underline"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon name="ArrowUpTrayIcon" size={20} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-700 text-foreground">Upload your photo</p>
                        <p className="text-xs text-muted-foreground">Drape this fabric on your model or yourself</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Camera Selfie */}
              {photoSource === 'camera' && (
                <div className="space-y-3">
                  {cameraError && (
                    <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-xs text-error">
                      {cameraError}
                    </div>
                  )}

                  {!cameraActive && !uploadedPhoto && (
                    <button
                      onClick={handleStartCamera}
                      className="w-full p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all flex flex-col items-center gap-2"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon name="CameraIcon" size={24} className="text-primary" />
                      </div>
                      <p className="text-sm font-700 text-foreground">Open Camera</p>
                      <p className="text-xs text-muted-foreground">Take a selfie to drape fabric on yourself</p>
                    </button>
                  )}

                  {cameraActive && (
                    <div className="relative rounded-xl overflow-hidden bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full rounded-xl"
                        style={{ transform: 'scaleX(-1)', maxHeight: 300 }}
                      />
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                        <button
                          onClick={handleCapturePhoto}
                          className="w-14 h-14 rounded-full bg-white border-4 border-primary flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                        >
                          <Icon name="CameraIcon" size={22} className="text-primary" />
                        </button>
                        <button
                          onClick={handleStopCamera}
                          className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center self-center"
                        >
                          <Icon name="XMarkIcon" size={16} className="text-white" />
                        </button>
                      </div>
                    </div>
                  )}

                  {uploadedPhoto && photoSource === 'camera' && (
                    <div className="relative rounded-xl overflow-hidden">
                      <img src={uploadedPhoto} alt="Captured selfie for fabric draping" className="w-full rounded-xl" style={{ maxHeight: 300, objectFit: 'cover' }} />
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={() => { setUploadedPhoto(null); }}
                          className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
                        >
                          <Icon name="XMarkIcon" size={14} className="text-white" />
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-success text-white text-xs font-700 px-2 py-1 rounded-full flex items-center gap-1">
                        <Icon name="CheckCircleIcon" size={12} />
                        Selfie captured
                      </div>
                    </div>
                  )}

                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}

              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </div>

            <button
              onClick={() => setStep('preview')}
              className="btn-primary w-full py-3 text-sm rounded-xl flex items-center justify-center gap-2"
            >
              <Icon name="EyeIcon" size={16} />
              Preview Drape
            </button>
          </div>
        }

        {/* STEP 2: Adjust & Preview */}
        {step === 'preview' &&
          <div className="space-y-4">
            {/* Live Drape Canvas */}
            <div
              className="relative rounded-2xl overflow-hidden bg-muted select-none"
              style={{ minHeight: 320 }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Model base */}
              <AppImage
                src={modelSrc}
                alt={uploadedPhoto ? 'Your photo for fabric draping' : selectedPose.alt}
                width={400}
                height={500}
                className="w-full object-cover"
                style={{ maxHeight: 400 }}
              />

              {/* Fabric overlay — draggable */}
              <div
                className={`absolute inset-0 flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
              >
                <div
                  style={{
                    transform: `translate(${settings.posX}px, ${settings.posY}px) scale(${settings.scale / 100}) rotate(${settings.rotation}deg)`,
                    opacity: settings.opacity / 100,
                    mixBlendMode: settings.blend,
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}
                >
                  <AppImage
                    src={selectedFabric.src}
                    alt={`${selectedFabric.alt} draped on model`}
                    width={400}
                    height={500}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Drag hint */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                <Icon name="ArrowsPointingOutIcon" size={12} />
                Drag to reposition fabric
              </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-700 text-foreground">Opacity</p>
                  <span className="text-xs font-800 text-primary">{settings.opacity}%</span>
                </div>
                <input type="range" min={20} max={100} value={settings.opacity}
                  onChange={(e) => setSettings((s) => ({ ...s, opacity: Number(e.target.value) }))}
                  className="w-full accent-primary" />
              </div>

              <div className="bg-muted rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-700 text-foreground">Scale</p>
                  <span className="text-xs font-800 text-primary">{settings.scale}%</span>
                </div>
                <input type="range" min={60} max={180} value={settings.scale}
                  onChange={(e) => setSettings((s) => ({ ...s, scale: Number(e.target.value) }))}
                  className="w-full accent-primary" />
              </div>

              <div className="bg-muted rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-700 text-foreground">Rotation</p>
                  <span className="text-xs font-800 text-primary">{settings.rotation}°</span>
                </div>
                <input type="range" min={-45} max={45} value={settings.rotation}
                  onChange={(e) => setSettings((s) => ({ ...s, rotation: Number(e.target.value) }))}
                  className="w-full accent-primary" />
              </div>

              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs font-700 text-foreground mb-2">Blend Mode</p>
                <div className="grid grid-cols-2 gap-1">
                  {blendModes.map((bm) =>
                    <button
                      key={bm.value}
                      onClick={() => setSettings((s) => ({ ...s, blend: bm.value }))}
                      className={`text-xs py-1 rounded-lg font-600 transition-all ${settings.blend === bm.value ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:border-primary'}`}
                    >
                      {bm.label}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('select')} className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">
                ← Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="btn-primary flex-1 py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isGenerating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    AI Processing...
                  </>
                ) : (
                  <>
                    <Icon name="SparklesIcon" size={15} />
                    Generate AI Drape
                  </>
                )}
              </button>
            </div>
          </div>
        }

        {/* STEP 3: Result */}
        {step === 'result' && showResult &&
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-muted">
              <AppImage
                src={modelSrc}
                alt={uploadedPhoto ? 'Your photo with fabric draped on it' : selectedPose.alt}
                width={400}
                height={500}
                className="w-full object-cover"
                style={{ maxHeight: 420 }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: `translate(${settings.posX}px, ${settings.posY}px) scale(${settings.scale / 100}) rotate(${settings.rotation}deg)`,
                  opacity: settings.opacity / 100,
                  mixBlendMode: settings.blend
                }}
              >
                <AppImage
                  src={selectedFabric.src}
                  alt={`${selectedFabric.alt} final drape result`}
                  width={400}
                  height={500}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="absolute top-3 left-3 bg-success text-white text-xs font-700 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Icon name="SparklesIcon" size={12} />
                AI Drape Generated
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <AppImage src={selectedFabric.src} alt={selectedFabric.alt} width={48} height={48} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-700 text-foreground">Pure Dyeable Soft Nett Fabric</p>
                <p className="text-xs text-muted-foreground">Surat Textile Mills · {selectedFabric.name} view</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-800 text-primary">₹840/mtr</p>
                <p className="text-xs text-muted-foreground">Min 3 mtrs</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('preview')} className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">
                Adjust
              </button>
              <button onClick={handleReset} className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">
                Try Another
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {freeRemaining > 0 ?
                `${freeRemaining} free drape${freeRemaining !== 1 ? 's' : ''} remaining today` :
                'Upgrade to ₹10/day for unlimited drapes'}
            </p>
          </div>
        }

        {/* Paywall */}
        {showPaywall &&
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full shadow-xl">
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Icon name="SparklesIcon" size={24} className="text-primary" />
                </div>
                <h3 className="font-800 text-foreground text-base mb-1">Daily Free Limit Reached</h3>
                <p className="text-sm text-muted-foreground">You've used your {FREE_QUOTA} free drapes today. Upgrade for unlimited access.</p>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-700 text-foreground">Unlimited Drapes</span>
                  <span className="text-lg font-800 text-primary">₹10/day</span>
                </div>
                <ul className="space-y-1.5">
                  {['Unlimited drapes per day', 'All blend modes', 'Upload photos or use camera', 'High-res output'].map((f) =>
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon name="CheckCircleIcon" size={13} className="text-success" />
                      {f}
                    </li>
                  )}
                </ul>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowPaywall(false)} className="btn-secondary flex-1 py-2.5 text-sm rounded-xl">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowPaywall(false);
                    setIsGenerating(true);
                    setTimeout(() => {
                      incrementDrapeUsage();
                      setUsageCount((c) => c + 1);
                      setIsGenerating(false);
                      setShowResult(true);
                      setStep('result');
                    }, 2000);
                  }}
                  className="btn-primary flex-1 py-2.5 text-sm rounded-xl"
                >
                  Pay ₹10 & Generate
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  );
}