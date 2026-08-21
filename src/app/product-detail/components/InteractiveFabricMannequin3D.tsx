'use client';

import { useEffect, useRef, useState } from 'react';
import type { DrapeProductStyle } from '@/lib/drapeProductStyle';

export type DrapeAvatarGender = 'woman' | 'man';

type Props = {
  fabricImage: string;
  productName: string;
  style: DrapeProductStyle;
  fit: 'Relaxed' | 'Regular' | 'Tailored';
  avatarGender: DrapeAvatarGender;
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
  avatarGender,
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
        setTextureReady(false);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#0b1220');
        scene.fog = new THREE.Fog('#0b1220', 10, 18);

        const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
        camera.position.set(0, 0.15, 8.4);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.style.cursor = 'grab';
        renderer.domElement.style.touchAction = 'none';
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x172033, 2.7));
        const key = new THREE.DirectionalLight(0xffffff, 4.1);
        key.position.set(4.8, 6.7, 5.4);
        key.castShadow = true;
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xaac0ff, 2.0);
        rim.position.set(-4, 3.3, -4.4);
        scene.add(rim);
        const warm = new THREE.DirectionalLight(0xffba78, 1.2);
        warm.position.set(-2.8, 1.4, 4.2);
        scene.add(warm);

        const platform = new THREE.Mesh(
          new THREE.CylinderGeometry(1.55, 1.82, 0.14, 72),
          new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.72, metalness: 0.18 })
        );
        platform.position.y = -3.05;
        platform.receiveShadow = true;
        scene.add(platform);

        const group = new THREE.Group();
        group.position.y = -0.02;
        scene.add(group);

        const skinTone = avatarGender === 'woman' ? 0xc98f70 : 0xb9795b;
        const skinMaterial = new THREE.MeshPhysicalMaterial({
          color: skinTone,
          roughness: 0.62,
          metalness: 0,
          clearcoat: 0.03,
        });
        const hairMaterial = new THREE.MeshStandardMaterial({
          color: avatarGender === 'woman' ? 0x241712 : 0x251a15,
          roughness: 0.88,
        });
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x231a17, roughness: 0.5 });
        const mouthMaterial = new THREE.MeshStandardMaterial({
          color: avatarGender === 'woman' ? 0x8a3d45 : 0x6c4140,
          roughness: 0.7,
        });
        const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.65 });

        const addMesh = (
          geometry: THREE.BufferGeometry,
          material: THREE.Material,
          x: number,
          y: number,
          z = 0,
          scale: [number, number, number] = [1, 1, 1],
          rotation: [number, number, number] = [0, 0, 0]
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

        // Human head + visible facial cues. This keeps the viewer recognisably human instead of a faceless mannequin.
        addMesh(
          new THREE.SphereGeometry(0.43, 56, 48),
          skinMaterial,
          0,
          2.47,
          0,
          avatarGender === 'woman' ? [0.88, 1.08, 0.91] : [0.93, 1.1, 0.94]
        );
        addMesh(new THREE.SphereGeometry(0.055, 20, 16), eyeMaterial, -0.145, 2.52, 0.39, [1.15, 0.62, 0.55]);
        addMesh(new THREE.SphereGeometry(0.055, 20, 16), eyeMaterial, 0.145, 2.52, 0.39, [1.15, 0.62, 0.55]);
        addMesh(new THREE.ConeGeometry(0.055, 0.18, 18), skinMaterial, 0, 2.39, 0.43, [1, 1, 0.75], [Math.PI / 2, 0, 0]);
        addMesh(new THREE.SphereGeometry(0.09, 24, 16), mouthMaterial, 0, 2.27, 0.4, [1.05, 0.23, 0.42]);
        addMesh(new THREE.SphereGeometry(0.105, 22, 18), skinMaterial, -0.41, 2.44, 0, [0.4, 0.9, 0.55]);
        addMesh(new THREE.SphereGeometry(0.105, 22, 18), skinMaterial, 0.41, 2.44, 0, [0.4, 0.9, 0.55]);

        if (avatarGender === 'woman') {
          addMesh(new THREE.SphereGeometry(0.445, 48, 36), hairMaterial, 0, 2.62, -0.06, [0.98, 0.92, 1]);
          addMesh(new THREE.SphereGeometry(0.29, 36, 28), hairMaterial, -0.29, 2.22, -0.08, [0.7, 1.55, 0.75]);
          addMesh(new THREE.SphereGeometry(0.29, 36, 28), hairMaterial, 0.29, 2.22, -0.08, [0.7, 1.55, 0.75]);
        } else {
          addMesh(new THREE.SphereGeometry(0.44, 48, 28), hairMaterial, 0, 2.7, -0.03, [0.98, 0.48, 1]);
        }

        addMesh(new THREE.CylinderGeometry(0.14, 0.17, 0.31, 30), skinMaterial, 0, 1.99, 0);

        // Body proportions differ for the woman/man avatar, rather than sharing one mannequin shell.
        if (avatarGender === 'woman') {
          addMesh(new THREE.SphereGeometry(0.73, 52, 42), skinMaterial, 0, 1.18, 0, [0.9, 1.1, 0.67]);
          addMesh(new THREE.SphereGeometry(0.63, 48, 38), skinMaterial, 0, 0.33, 0, [0.8, 0.8, 0.68]);
          addMesh(new THREE.SphereGeometry(0.73, 48, 38), skinMaterial, 0, -0.22, 0, [1.02, 0.62, 0.78]);
        } else {
          addMesh(new THREE.SphereGeometry(0.77, 52, 42), skinMaterial, 0, 1.18, 0, [1.07, 1.05, 0.7]);
          addMesh(new THREE.SphereGeometry(0.66, 48, 38), skinMaterial, 0, 0.34, 0, [0.9, 0.78, 0.72]);
          addMesh(new THREE.SphereGeometry(0.68, 48, 38), skinMaterial, 0, -0.23, 0, [0.9, 0.57, 0.72]);
        }

        const shoulderX = avatarGender === 'woman' ? 0.84 : 0.94;
        const armRadius = avatarGender === 'woman' ? 0.135 : 0.16;
        const leftArm = addMesh(new THREE.CapsuleGeometry(armRadius, 1.45, 12, 28), skinMaterial, -shoulderX, 0.88, 0);
        leftArm.rotation.z = -0.12;
        const rightArm = addMesh(new THREE.CapsuleGeometry(armRadius, 1.45, 12, 28), skinMaterial, shoulderX, 0.88, 0);
        rightArm.rotation.z = 0.12;
        addMesh(new THREE.SphereGeometry(armRadius * 1.05, 24, 20), skinMaterial, -shoulderX - 0.09, -0.04, 0);
        addMesh(new THREE.SphereGeometry(armRadius * 1.05, 24, 20), skinMaterial, shoulderX + 0.09, -0.04, 0);

        const legX = avatarGender === 'woman' ? 0.29 : 0.32;
        const legRadius = avatarGender === 'woman' ? 0.19 : 0.21;
        addMesh(new THREE.CapsuleGeometry(legRadius, 1.64, 12, 28), skinMaterial, -legX, -1.72, 0);
        addMesh(new THREE.CapsuleGeometry(legRadius, 1.64, 12, 28), skinMaterial, legX, -1.72, 0);
        addMesh(new THREE.BoxGeometry(0.42, 0.17, 0.78), shoeMaterial, -legX, -2.83, 0.2);
        addMesh(new THREE.BoxGeometry(0.42, 0.17, 0.78), shoeMaterial, legX, -2.83, 0.2);

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
          texture.repeat.set(style === 'saree' || style === 'dupatta' ? 1.0 : 1.3, 2.15);
          garmentMaterial.dispose();
          garmentMaterial = new THREE.MeshPhysicalMaterial({
            map: texture,
            roughness: 0.73,
            metalness: 0,
            sheen: 0.2,
            sheenRoughness: 0.76,
            clearcoat: 0.02,
            side: THREE.DoubleSide,
          });
          setTextureReady(true);
        } catch {
          setTextureReady(false);
        }

        const fitScale = fit === 'Relaxed' ? 1.08 : fit === 'Tailored' ? 0.95 : 1;
        const chestRadius = avatarGender === 'woman' ? 0.7 : 0.76;
        const hipRadius = avatarGender === 'woman' ? 0.78 : 0.7;

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
            const verticalSway = Math.sin(v * Math.PI) * 0.03;
            for (let col = 0; col <= cols; col += 1) {
              const u = col / cols;
              const theta = start + (u - 0.5) * options.arc;
              const fold = Math.sin(u * Math.PI * 2 * folds + v * 2.35) * foldDepth * (0.3 + 0.7 * v);
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
              Math.sin(normalizedY * Math.PI) * 0.07;
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

        const torsoShell = (length = 1.6, bottomRadius = hipRadius) =>
          createClothShell({
            topY: 1.72,
            height: length,
            topRadius: chestRadius,
            bottomRadius,
            arc: Math.PI * 1.94,
            folds: 7,
            foldDepth: 0.018,
          });

        if (style === 'saree') {
          addGarment(createClothShell({ topY: 0.2, height: 2.62, topRadius: hipRadius, bottomRadius: 1.03, arc: Math.PI * 1.97, folds: 12, foldDepth: 0.055 }));
          addGarment(torsoShell(0.78, chestRadius));
          addGarment(createFlowingPanel(1.3, 3.45, 0.14), 0.46, 0.32, 0.48, [0.08, -0.32, -0.28]);
        } else if (style === 'lehenga') {
          addGarment(createClothShell({ topY: 0.15, height: 2.55, topRadius: hipRadius, bottomRadius: 1.36, arc: Math.PI * 1.97, folds: 14, foldDepth: 0.07 }));
          addGarment(torsoShell(0.78, chestRadius));
          addGarment(createFlowingPanel(1.12, 2.95, 0.13), 0.56, 0.18, 0.5, [0.04, -0.22, -0.26]);
        } else if (style === 'dress' || style === 'set') {
          addGarment(torsoShell(1.25, hipRadius));
          addGarment(createClothShell({ topY: 0.62, height: 2.15, topRadius: hipRadius, bottomRadius: avatarGender === 'woman' ? 1.15 : 0.98, arc: Math.PI * 1.97, folds: 10, foldDepth: 0.05 }));
        } else if (style === 'kurta' || style === 'shirt' || style === 'top') {
          const length = style === 'kurta' ? 2.2 : 1.48;
          addGarment(torsoShell(length, style === 'kurta' ? hipRadius + 0.1 : hipRadius));
          const sleeveLength = style === 'top' ? 0.82 : 1.42;
          const sleeveTop = (avatarGender === 'woman' ? 0.19 : 0.22) * fitScale;
          const left = addGarment(new THREE.CylinderGeometry(sleeveTop, sleeveTop * 0.84, sleeveLength, 30, 6, true), -shoulderX, 0.88, 0);
          left.rotation.z = -0.12;
          const right = addGarment(new THREE.CylinderGeometry(sleeveTop, sleeveTop * 0.84, sleeveLength, 30, 6, true), shoulderX, 0.88, 0);
          right.rotation.z = 0.12;
        } else if (style === 'bottom') {
          addGarment(createClothShell({ topY: 0.08, height: 2.55, topRadius: hipRadius, bottomRadius: 0.94, arc: Math.PI * 1.98, folds: 10, foldDepth: 0.045 }));
        } else if (style === 'dupatta') {
          addGarment(createFlowingPanel(2.45, 3.6, 0.18), 0, 0.26, 0.5, [0.02, 0, 0.02]);
        } else {
          // Fabric-only listing: neutral textile drape, not an invented garment or a flat apron panel.
          addGarment(createClothShell({ topY: 0.15, height: 2.6, topRadius: hipRadius, bottomRadius: 1.0, arc: Math.PI * 1.45, startAngle: -0.35, folds: 11, foldDepth: 0.055 }));
          addGarment(createFlowingPanel(1.12, 3.2, 0.15), 0.45, 0.32, 0.5, [0.08, -0.35, -0.29]);
        }

        const target = new THREE.Vector3(0, -0.05, 0);
        let distance = 8.2;
        let yaw = 0;
        let pitch = 0.04;
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
          const height = Math.max(560, Math.min(820, Math.round(width * 1.08)));
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
          if (!dragging && idleFrames > 280) {
            yaw += 0.001;
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
              if (material instanceof THREE.MeshPhysicalMaterial && material.map) material.map.dispose();
              material.dispose();
            });
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (bootError) {
        console.error('3D human drape viewer failed to start', bootError);
        setError('This browser could not start the interactive 3D human viewer.');
      }
    };

    void boot();
    return () => {
      disposed = true;
      cleanup();
      resizeObserver?.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [avatarGender, fabricImage, fit, style]);

  const avatarLabel = avatarGender === 'woman' ? 'woman' : 'man';

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-slate-950">
      <div
        ref={mountRef}
        className="min-h-[560px] w-full touch-none"
        aria-label={`Interactive 360 degree 3D ${avatarLabel} wearing a drape of ${productName}`}
      />

      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white">
          <div className="text-center">
            <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white" />
            <p className="mt-3 text-sm font-800">Building the 3D {avatarLabel} and textile drape…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6 text-center text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[10px] font-800 uppercase tracking-wider text-white">
        3D {avatarLabel} · drag 360° · wheel/pinch to zoom
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/65 p-3 text-xs leading-5 text-white/80 backdrop-blur-sm">
        <span className="font-800 text-white">
          {textureReady ? 'Live seller textile mapped onto the selected human avatar' : 'Human avatar drape preview'}
        </span>
        {' · '}Rotate around the {avatarLabel} to inspect the product-driven drape from the front, side and back.
      </div>
    </div>
  );
}
