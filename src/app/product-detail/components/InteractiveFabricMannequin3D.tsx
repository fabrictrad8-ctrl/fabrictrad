'use client';

import { useEffect, useRef, useState } from 'react';
import type { DrapeProductStyle } from '@/lib/drapeProductStyle';

type Props = {
  fabricImage: string;
  productName: string;
  style: DrapeProductStyle;
  fit: 'Relaxed' | 'Regular' | 'Tailored';
};

export default function InteractiveFabricMannequin3D({
  fabricImage,
  productName,
  style,
  fit,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [textureReady, setTextureReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let cleanupInteractions = () => undefined;

    const boot = async () => {
      try {
        const THREE = await import('three');
        if (disposed || !mountRef.current) return;
        mount.innerHTML = '';

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#0f172a');
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
        camera.position.set(0, 0.25, 7.8);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mount.appendChild(renderer.domElement);

        const ambient = new THREE.HemisphereLight(0xffffff, 0x172033, 2.2);
        scene.add(ambient);
        const key = new THREE.DirectionalLight(0xffffff, 3.6);
        key.position.set(4, 6, 5);
        key.castShadow = true;
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xf2b36f, 1.7);
        fill.position.set(-4, 2, 3);
        scene.add(fill);

        const platform = new THREE.Mesh(
          new THREE.CylinderGeometry(1.75, 1.9, 0.18, 64),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75, metalness: 0.2 })
        );
        platform.position.y = -3.05;
        platform.receiveShadow = true;
        scene.add(platform);

        const group = new THREE.Group();
        group.position.y = -0.05;
        scene.add(group);

        const mannequinMaterial = new THREE.MeshStandardMaterial({
          color: 0xc8b7aa,
          roughness: 0.88,
          metalness: 0,
        });
        const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
        const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z = 0) => {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x, y, z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
          return mesh;
        };

        addMesh(new THREE.SphereGeometry(0.48, 40, 32), mannequinMaterial, 0, 2.42, 0);
        addMesh(new THREE.CylinderGeometry(0.16, 0.18, 0.34, 28), mannequinMaterial, 0, 1.93, 0);
        addMesh(new THREE.CylinderGeometry(0.66, 0.82, 1.7, 48), mannequinMaterial, 0, 0.96, 0);
        const leftArm = addMesh(new THREE.CylinderGeometry(0.18, 0.15, 2.05, 24), mannequinMaterial, -0.92, 0.92, 0);
        leftArm.rotation.z = -0.12;
        const rightArm = addMesh(new THREE.CylinderGeometry(0.18, 0.15, 2.05, 24), mannequinMaterial, 0.92, 0.92, 0);
        rightArm.rotation.z = 0.12;
        addMesh(new THREE.SphereGeometry(0.19, 24, 20), mannequinMaterial, -1.04, -0.09, 0);
        addMesh(new THREE.SphereGeometry(0.19, 24, 20), mannequinMaterial, 1.04, -0.09, 0);
        addMesh(new THREE.CylinderGeometry(0.26, 0.22, 2.25, 28), mannequinMaterial, -0.38, -1.63, 0);
        addMesh(new THREE.CylinderGeometry(0.26, 0.22, 2.25, 28), mannequinMaterial, 0.38, -1.63, 0);
        addMesh(new THREE.BoxGeometry(0.45, 0.16, 0.85), darkMaterial, -0.38, -2.83, 0.2);
        addMesh(new THREE.BoxGeometry(0.45, 0.16, 0.85), darkMaterial, 0.38, -2.83, 0.2);

        let garmentMaterial: THREE.MeshStandardMaterial;
        const fallbackMaterial = () =>
          new THREE.MeshStandardMaterial({
            color: 0xc8600a,
            roughness: 0.72,
            side: THREE.DoubleSide,
          });

        try {
          const texture = await new Promise<THREE.Texture>((resolve, reject) => {
            const loader = new THREE.TextureLoader();
            loader.setCrossOrigin('anonymous');
            loader.load(fabricImage, resolve, undefined, reject);
          });
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(style === 'fabric' || style === 'dupatta' ? 1.2 : 1.8, 2.2);
          garmentMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.68,
            metalness: 0.02,
            side: THREE.DoubleSide,
          });
          setTextureReady(true);
        } catch {
          garmentMaterial = fallbackMaterial();
          setTextureReady(false);
        }

        const fitScale = fit === 'Relaxed' ? 1.08 : fit === 'Tailored' ? 0.94 : 1;
        const addGarment = (
          geometry: THREE.BufferGeometry,
          x: number,
          y: number,
          z = 0,
          rotation: [number, number, number] = [0, 0, 0]
        ) => {
          const mesh = new THREE.Mesh(geometry, garmentMaterial);
          mesh.position.set(x, y, z);
          mesh.rotation.set(...rotation);
          mesh.scale.x *= fitScale;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
          return mesh;
        };

        if (style === 'saree') {
          addGarment(new THREE.CylinderGeometry(0.75, 1.18, 2.55, 64, 8, true), 0, -0.9, 0);
          const pallu = addGarment(new THREE.PlaneGeometry(1.25, 3.6, 18, 32), 0.38, 0.45, 0.55, [0.08, -0.28, -0.34]);
          pallu.geometry.rotateZ(0.08);
          addGarment(new THREE.CylinderGeometry(0.7, 0.78, 0.72, 48, 4, true), 0, 1.08, 0);
        } else if (style === 'lehenga') {
          addGarment(new THREE.CylinderGeometry(0.7, 1.45, 2.35, 64, 10, true), 0, -1.0, 0);
          addGarment(new THREE.CylinderGeometry(0.7, 0.79, 0.72, 48, 4, true), 0, 1.08, 0);
          addGarment(new THREE.PlaneGeometry(1.2, 3.0, 12, 24), 0.55, 0.0, 0.5, [0.05, -0.2, -0.3]);
        } else if (style === 'dress' || style === 'set') {
          addGarment(new THREE.CylinderGeometry(0.7, 0.88, 1.45, 48, 6, true), 0, 0.78, 0);
          addGarment(new THREE.CylinderGeometry(0.82, 1.3, 2.15, 64, 8, true), 0, -1.02, 0);
        } else if (style === 'kurta' || style === 'shirt' || style === 'top') {
          const length = style === 'kurta' ? 2.35 : 1.55;
          addGarment(new THREE.CylinderGeometry(0.7, style === 'kurta' ? 0.94 : 0.82, length, 48, 6, true), 0, style === 'kurta' ? 0.35 : 0.78, 0);
          const sleeveLength = style === 'top' ? 1.0 : 1.62;
          const l = addGarment(new THREE.CylinderGeometry(0.22, 0.18, sleeveLength, 24, 2, true), -0.92, 0.9, 0);
          l.rotation.z = -0.12;
          const r = addGarment(new THREE.CylinderGeometry(0.22, 0.18, sleeveLength, 24, 2, true), 0.92, 0.9, 0);
          r.rotation.z = 0.12;
        } else if (style === 'bottom') {
          addGarment(new THREE.CylinderGeometry(0.7, 1.05, 2.45, 64, 8, true), 0, -1.15, 0);
        } else if (style === 'dupatta') {
          addGarment(new THREE.PlaneGeometry(2.3, 3.6, 20, 32), 0, 0.3, 0.58, [0.02, 0, 0]);
        } else {
          const wrap = addGarment(new THREE.PlaneGeometry(2.65, 3.5, 24, 36), 0.1, 0.1, 0.6, [0.05, -0.08, -0.08]);
          wrap.geometry.rotateZ(-0.08);
        }

        const target = new THREE.Vector3(0, 0, 0);
        let yaw = 0;
        let pitch = 0.03;
        let distance = 7.8;
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        let idleTicks = 0;

        const updateCamera = () => {
          camera.position.set(
            Math.sin(yaw) * Math.cos(pitch) * distance,
            Math.sin(pitch) * distance + 0.2,
            Math.cos(yaw) * Math.cos(pitch) * distance
          );
          camera.lookAt(target);
        };
        updateCamera();

        const pointerDown = (event: PointerEvent) => {
          dragging = true;
          idleTicks = 0;
          lastX = event.clientX;
          lastY = event.clientY;
          renderer.domElement.setPointerCapture(event.pointerId);
        };
        const pointerMove = (event: PointerEvent) => {
          if (!dragging) return;
          yaw -= (event.clientX - lastX) * 0.009;
          pitch = Math.max(-0.32, Math.min(0.42, pitch + (event.clientY - lastY) * 0.004));
          lastX = event.clientX;
          lastY = event.clientY;
          updateCamera();
        };
        const pointerUp = (event: PointerEvent) => {
          dragging = false;
          if (renderer.domElement.hasPointerCapture(event.pointerId)) {
            renderer.domElement.releasePointerCapture(event.pointerId);
          }
        };
        const wheel = (event: WheelEvent) => {
          event.preventDefault();
          distance = Math.max(5.1, Math.min(10.2, distance + event.deltaY * 0.006));
          updateCamera();
        };
        renderer.domElement.addEventListener('pointerdown', pointerDown);
        renderer.domElement.addEventListener('pointermove', pointerMove);
        renderer.domElement.addEventListener('pointerup', pointerUp);
        renderer.domElement.addEventListener('pointercancel', pointerUp);
        renderer.domElement.addEventListener('wheel', wheel, { passive: false });
        cleanupInteractions = () => {
          renderer.domElement.removeEventListener('pointerdown', pointerDown);
          renderer.domElement.removeEventListener('pointermove', pointerMove);
          renderer.domElement.removeEventListener('pointerup', pointerUp);
          renderer.domElement.removeEventListener('pointercancel', pointerUp);
          renderer.domElement.removeEventListener('wheel', wheel);
        };

        const resize = () => {
          if (!mountRef.current) return;
          const width = Math.max(280, mountRef.current.clientWidth);
          const height = Math.max(440, Math.min(760, Math.round(width * 1.28)));
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize();

        const animate = () => {
          if (disposed) return;
          idleTicks += 1;
          if (!dragging && idleTicks > 240) {
            yaw += 0.0015;
            updateCamera();
          }
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(animate);
        };
        animate();
        setReady(true);

        cleanupInteractions = ((previous) => () => {
          previous();
          resizeObserver?.disconnect();
          cancelAnimationFrame(animationFrame);
          scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              const material = object.material;
              const materials = Array.isArray(material) ? material : [material];
              materials.forEach((item) => {
                if (item instanceof THREE.MeshStandardMaterial && item.map) item.map.dispose();
                item.dispose();
              });
            }
          });
          renderer.dispose();
          renderer.domElement.remove();
        })(cleanupInteractions);
      } catch (bootError) {
        console.error('3D drape viewer failed to start', bootError);
        setError('This browser could not start the interactive 3D viewer.');
      }
    };

    void boot();
    return () => {
      disposed = true;
      cleanupInteractions();
      resizeObserver?.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [fabricImage, fit, style]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-slate-950">
      <div ref={mountRef} className="min-h-[520px] w-full touch-none" aria-label={`Interactive 3D drape of ${productName}`} />
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white">
          <div className="text-center">
            <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white" />
            <p className="mt-3 text-sm font-800">Building 3D drape…</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6 text-center text-sm text-red-300">{error}</div>
      )}
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[10px] font-800 uppercase tracking-wider text-white backdrop-blur">
        Interactive WebGL 3D · drag 360° · wheel to zoom
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-black/60 p-3 text-xs leading-5 text-white/80 backdrop-blur">
        <strong className="text-white">{textureReady ? 'Live listing textile applied' : '3D geometry ready'}</strong>
        <span> · The shape follows the product type detected from the seller listing. This is a sourcing preview, not a body-measurement or tailoring simulation.</span>
      </div>
    </div>
  );
}
