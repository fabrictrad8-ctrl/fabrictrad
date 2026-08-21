'use client';

import { useEffect, useRef, useState } from 'react';
import type { DrapeProductStyle } from '@/lib/drapeProductStyle';

type Props = {
  fabricImage: string;
  productName: string;
  style: DrapeProductStyle;
  fit: 'Relaxed' | 'Regular' | 'Tailored';
};

type ClothOptions = {
  topY: number;
  height: number;
  topRadius: number;
  bottomRadius: number;
  arc: number;
  startAngle?: number;
  folds?: number;
  foldDepth?: number;
  rows?: number;
  cols?: number;
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
    let cleanup = () => undefined;

    const boot = async () => {
      try {
        const THREE = await import('three');
        if (disposed || !mountRef.current) return;
        mount.innerHTML = '';
        setReady(false);
        setError('');

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#0b1220');
        scene.fog = new THREE.Fog('#0b1220', 10, 18);

        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
        camera.position.set(0, 0.1, 8.3);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.style.cursor = 'grab';
        renderer.domElement.style.touchAction = 'none';
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x172033, 2.8));
        const key = new THREE.DirectionalLight(0xffffff, 4.2);
        key.position.set(4.5, 6.5, 5.5);
        key.castShadow = true;
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x9db5ff, 2.1);
        rim.position.set(-4, 3.5, -4.5);
        scene.add(rim);
        const warm = new THREE.DirectionalLight(0xffbf78, 1.45);
        warm.position.set(-3, 1.5, 4);
        scene.add(warm);

        const platform = new THREE.Mesh(
          new THREE.CylinderGeometry(1.65, 1.9, 0.16, 72),
          new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.72, metalness: 0.18 })
        );
        platform.position.y = -3.02;
        platform.receiveShadow = true;
        scene.add(platform);

        const group = new THREE.Group();
        group.position.y = -0.03;
        scene.add(group);

        const mannequinMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xd3b7a2,
          roughness: 0.78,
          metalness: 0,
          clearcoat: 0.05,
        });
        const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x171a21, roughness: 0.62 });

        const addBody = (
          geometry: THREE.BufferGeometry,
          x: number,
          y: number,
          z = 0,
          scale: [number, number, number] = [1, 1, 1],
          rotation: [number, number, number] = [0, 0, 0],
          material: THREE.Material = mannequinMaterial
        ) => {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x, y, z);
          mesh.scale.set(...scale);
          mesh.rotation.set(...rotation);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
          return mesh;
        };

        addBody(new THREE.SphereGeometry(0.43, 48, 40), 0, 2.46, 0, [0.88, 1.08, 0.9]);
        addBody(new THREE.CylinderGeometry(0.14, 0.16, 0.3, 30), 0, 1.98, 0);
        addBody(new THREE.SphereGeometry(0.72, 48, 40), 0, 1.08, 0, [0.98, 1.24, 0.68]);
        addBody(new THREE.SphereGeometry(0.67, 48, 40), 0, -0.1, 0, [1.05, 0.82, 0.78]);

        const leftArm = addBody(new THREE.CapsuleGeometry(0.15, 1.45, 12, 24), -0.86, 0.92, 0);
        leftArm.rotation.z = -0.16;
        const rightArm = addBody(new THREE.CapsuleGeometry(0.15, 1.45, 12, 24), 0.86, 0.92, 0);
        rightArm.rotation.z = 0.16;
        addBody(new THREE.SphereGeometry(0.17, 24, 20), -0.99, -0.02, 0);
        addBody(new THREE.SphereGeometry(0.17, 24, 20), 0.99, -0.02, 0);
        addBody(new THREE.CapsuleGeometry(0.2, 1.62, 12, 24), -0.33, -1.72, 0);
        addBody(new THREE.CapsuleGeometry(0.2, 1.62, 12, 24), 0.33, -1.72, 0);
        addBody(new THREE.BoxGeometry(0.42, 0.18, 0.78), -0.33, -2.82, 0.2, [1, 1, 1], [0, 0, 0], shoeMaterial);
        addBody(new THREE.BoxGeometry(0.42, 0.18, 0.78), 0.33, -2.82, 0.2, [1, 1, 1], [0, 0, 0], shoeMaterial);

        let garmentMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xc96c21,
          roughness: 0.78,
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
          texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          texture.repeat.set(style === 'saree' || style === 'dupatta' ? 1.0 : 1.35, 2.25);
          garmentMaterial.dispose();
          garmentMaterial = new THREE.MeshPhysicalMaterial({
            map: texture,
            roughness: 0.72,
            metalness: 0,
            sheen: 0.22,
            sheenRoughness: 0.75,
            clearcoat: 0.03,
            side: THREE.DoubleSide,
          });
          setTextureReady(true);
        } catch {
          setTextureReady(false);
        }

        const fitScale = fit === 'Relaxed' ? 1.08 : fit === 'Tailored' ? 0.95 : 1;

        const createClothShell = (options: ClothOptions) => {
          const rows = options.rows ?? 72;
          const cols = options.cols ?? 80;
          const positions: number[] = [];
          const uvs: number[] = [];
          const indices: number[] = [];
          const start = options.startAngle ?? 0;
          const folds = options.folds ?? 8;
          const foldDepth = options.foldDepth ?? 0.035;

          for (let row = 0; row <= rows; row += 1) {
            const v = row / rows;
            const y = options.topY - v * options.height;
            const baseRadius =
              (options.topRadius + (options.bottomRadius - options.topRadius) * Math.pow(v, 1.05)) * fitScale;
            const verticalSway = Math.sin(v * Math.PI) * 0.035;

            for (let col = 0; col <= cols; col += 1) {
              const u = col / cols;
              const theta = start + (u - 0.5) * options.arc;
              const fold = Math.sin(u * Math.PI * 2 * folds + v * 2.4) * foldDepth * (0.3 + 0.7 * v);
              const radius = baseRadius + fold;
              positions.push(Math.sin(theta) * radius, y, Math.cos(theta) * radius + verticalSway);
              uvs.push(u, 1 - v);
            }
          }

          for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
              const a = row * (cols + 1) + col;
              const b = a + cols + 1;
              indices.push(a, b, a + 1, b, b + 1, a + 1);
            }
          }

          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          return geometry;
        };

        const createFlowingPanel = (width: number, height: number, wave = 0.16, cols = 44, rows = 66) => {
          const geometry = new THREE.PlaneGeometry(width, height, cols, rows);
          const position = geometry.getAttribute('position');
          for (let i = 0; i < position.count; i += 1) {
            const x = position.getX(i);
            const y = position.getY(i);
            const normalizedY = (y + height / 2) / height;
            const z =
              Math.sin((x / width) * Math.PI * 5 + normalizedY * 2.4) * wave * (0.35 + normalizedY * 0.65) +
              Math.sin(normalizedY * Math.PI) * 0.08;
            position.setZ(i, z);
          }
          geometry.computeVertexNormals();
          return geometry;
        };

        const addGarment = (
          geometry: THREE.BufferGeometry,
          x = 0,
          y = 0,
          z = 0,
          rotation: [number, number, number] = [0, 0, 0]
        ) => {
          const mesh = new THREE.Mesh(geometry, garmentMaterial);
          mesh.position.set(x, y, z);
          mesh.rotation.set(...rotation);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
          return mesh;
        };

        const torsoShell = (length = 1.65, bottomRadius = 0.82) =>
          createClothShell({
            topY: 1.7,
            height: length,
            topRadius: 0.72,
            bottomRadius,
            arc: Math.PI * 1.92,
            folds: 7,
            foldDepth: 0.018,
          });

        if (style === 'saree') {
          addGarment(createClothShell({ topY: 0.2, height: 2.65, topRadius: 0.69, bottomRadius: 1.03, arc: Math.PI * 1.95, folds: 12, foldDepth: 0.055 }));
          addGarment(createClothShell({ topY: 1.62, height: 0.72, topRadius: 0.7, bottomRadius: 0.72, arc: Math.PI * 1.9, folds: 6, foldDepth: 0.015 }));
          const pallu = addGarment(createFlowingPanel(1.35, 3.5, 0.13), 0.46, 0.34, 0.46, [0.08, -0.33, -0.28]);
          pallu.geometry.rotateZ(0.1);
        } else if (style === 'lehenga') {
          addGarment(createClothShell({ topY: 0.15, height: 2.55, topRadius: 0.7, bottomRadius: 1.38, arc: Math.PI * 1.96, folds: 14, foldDepth: 0.07 }));
          addGarment(createClothShell({ topY: 1.62, height: 0.72, topRadius: 0.7, bottomRadius: 0.72, arc: Math.PI * 1.9, folds: 5, foldDepth: 0.015 }));
          addGarment(createFlowingPanel(1.15, 3.0, 0.13), 0.55, 0.18, 0.5, [0.04, -0.22, -0.26]);
        } else if (style === 'dress' || style === 'set') {
          addGarment(torsoShell(1.25, 0.8));
          addGarment(createClothShell({ topY: 0.62, height: 2.15, topRadius: 0.75, bottomRadius: 1.18, arc: Math.PI * 1.96, folds: 10, foldDepth: 0.05 }));
        } else if (style === 'kurta' || style === 'shirt' || style === 'top') {
          const length = style === 'kurta' ? 2.25 : 1.5;
          addGarment(torsoShell(length, style === 'kurta' ? 0.9 : 0.8));
          const sleeveLength = style === 'top' ? 0.85 : 1.45;
          const sleeveTop = 0.22 * fitScale;
          const left = addGarment(new THREE.CylinderGeometry(sleeveTop, sleeveTop * 0.84, sleeveLength, 30, 6, true), -0.87, 0.9, 0);
          left.rotation.z = -0.16;
          const right = addGarment(new THREE.CylinderGeometry(sleeveTop, sleeveTop * 0.84, sleeveLength, 30, 6, true), 0.87, 0.9, 0);
          right.rotation.z = 0.16;
        } else if (style === 'bottom') {
          addGarment(createClothShell({ topY: 0.1, height: 2.55, topRadius: 0.68, bottomRadius: 0.98, arc: Math.PI * 1.96, folds: 10, foldDepth: 0.045 }));
        } else if (style === 'dupatta') {
          const panel = addGarment(createFlowingPanel(2.5, 3.65, 0.18), 0, 0.25, 0.47, [0.02, 0, 0.02]);
          panel.geometry.rotateZ(-0.08);
        } else {
          addGarment(createClothShell({
            topY: 1.7,
            height: 3.95,
            topRadius: 0.75,
            bottomRadius: 1.05,
            arc: Math.PI * 1.72,
            startAngle: -0.15,
            folds: 11,
            foldDepth: 0.055,
          }));
        }

        const target = new THREE.Vector3(0, -0.05, 0);
        let yaw = 0;
        let pitch = 0.03;
        let distance = 8.1;
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        let idleFrames = 0;

        const updateCamera = () => {
          camera.position.set(
            Math.sin(yaw) * Math.cos(pitch) * distance,
            Math.sin(pitch) * distance + 0.15,
            Math.cos(yaw) * Math.cos(pitch) * distance
          );
          camera.lookAt(target);
        };
        updateCamera();

        const pointerDown = (event: PointerEvent) => {
          dragging = true;
          idleFrames = 0;
          lastX = event.clientX;
          lastY = event.clientY;
          renderer.domElement.style.cursor = 'grabbing';
          renderer.domElement.setPointerCapture(event.pointerId);
        };
        const pointerMove = (event: PointerEvent) => {
          if (!dragging) return;
          yaw -= (event.clientX - lastX) * 0.009;
          pitch = Math.max(-0.3, Math.min(0.34, pitch + (event.clientY - lastY) * 0.0035));
          lastX = event.clientX;
          lastY = event.clientY;
          updateCamera();
        };
        const pointerUp = (event: PointerEvent) => {
          dragging = false;
          renderer.domElement.style.cursor = 'grab';
          if (renderer.domElement.hasPointerCapture(event.pointerId)) {
            renderer.domElement.releasePointerCapture(event.pointerId);
          }
        };
        const wheel = (event: WheelEvent) => {
          event.preventDefault();
          distance = Math.max(5.4, Math.min(11.2, distance + event.deltaY * 0.006));
          updateCamera();
        };

        renderer.domElement.addEventListener('pointerdown', pointerDown);
        renderer.domElement.addEventListener('pointermove', pointerMove);
        renderer.domElement.addEventListener('pointerup', pointerUp);
        renderer.domElement.addEventListener('pointercancel', pointerUp);
        renderer.domElement.addEventListener('wheel', wheel, { passive: false });

        const resize = () => {
          if (!mountRef.current) return;
          const width = Math.max(300, mountRef.current.clientWidth);
          const height = Math.max(540, Math.min(820, Math.round(width * 1.12)));
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize();

        const animate = () => {
          if (disposed) return;
          idleFrames += 1;
          if (!dragging && idleFrames > 260) {
            yaw += 0.0012;
            updateCamera();
          }
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(animate);
        };
        animate();
        setReady(true);

        cleanup = () => {
          renderer.domElement.removeEventListener('pointerdown', pointerDown);
          renderer.domElement.removeEventListener('pointermove', pointerMove);
          renderer.domElement.removeEventListener('pointerup', pointerUp);
          renderer.domElement.removeEventListener('pointercancel', pointerUp);
          renderer.domElement.removeEventListener('wheel', wheel);
          resizeObserver?.disconnect();
          cancelAnimationFrame(animationFrame);
          scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => {
              if (material instanceof THREE.MeshPhysicalMaterial && material.map) {
                material.map.dispose();
              }
              material.dispose();
            });
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (bootError) {
        console.error('3D drape viewer failed to start', bootError);
        setError('This browser could not start the interactive 3D viewer.');
      }
    };

    void boot();
    return () => {
      disposed = true;
      cleanup();
      resizeObserver?.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [fabricImage, fit, style]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-slate-950">
      <div
        ref={mountRef}
        className="min-h-[560px] w-full touch-none"
        aria-label={`Interactive 360 degree 3D drape of ${productName}`}
      />

      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white">
          <div className="text-center">
            <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white" />
            <p className="mt-3 text-sm font-800">Building garment-shaped 3D drape…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6 text-center text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[10px] font-800 uppercase tracking-wider text-white">
        Interactive 3D · drag 360° · wheel/pinch to zoom
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/65 p-3 text-xs leading-5 text-white/80 backdrop-blur-sm">
        <span className="font-800 text-white">{textureReady ? 'Live seller textile mapped to curved garment geometry' : 'Garment preview'}</span>
        {' · '}This preview follows the product type detected from the seller listing and wraps the textile around the mannequin instead of placing a flat image in front of it.
      </div>
    </div>
  );
}
