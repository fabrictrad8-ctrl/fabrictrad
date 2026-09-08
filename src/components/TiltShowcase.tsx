'use client';

import { useEffect, useRef } from 'react';

/**
 * A real photo with a genuine 3D-feeling pointer-tilt: the image and its
 * overlaid children (e.g. a caption card) rotate in perspective and drift
 * at different depths as the cursor moves, like an Apple/Stripe product
 * card. Springs back to neutral on pointer leave. No-ops under
 * prefers-reduced-motion.
 */
export default function TiltShowcase({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imageLayerRef = useRef<HTMLDivElement>(null);
  const captionLayerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const targetRef = useRef({ rx: 0, ry: 0 });
  const currentRef = useRef({ rx: 0, ry: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    const imageLayer = imageLayerRef.current;
    const captionLayer = captionLayerRef.current;
    if (!wrap || !imageLayer || !captionLayer) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const MAX_TILT = 9;

    function handleMove(event: PointerEvent) {
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      targetRef.current = { rx: -py * MAX_TILT * 2, ry: px * MAX_TILT * 2 };
    }

    function handleLeave() {
      targetRef.current = { rx: 0, ry: 0 };
    }

    function tick() {
      const current = currentRef.current;
      const target = targetRef.current;
      current.rx += (target.rx - current.rx) * 0.08;
      current.ry += (target.ry - current.ry) * 0.08;
      if (imageLayer) {
        imageLayer.style.transform = `rotateX(${current.rx}deg) rotateY(${current.ry}deg) scale3d(1.04, 1.04, 1.04)`;
      }
      if (captionLayer) {
        captionLayer.style.transform = `translate3d(${current.ry * 1.4}px, ${-current.rx * 1.4}px, 40px)`;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    wrap.addEventListener('pointermove', handleMove);
    wrap.addEventListener('pointerleave', handleLeave);
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      wrap.removeEventListener('pointermove', handleMove);
      wrap.removeEventListener('pointerleave', handleLeave);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div ref={wrapRef} className="ft-tilt-wrap">
      <div ref={imageLayerRef} className="ft-tilt-image-layer">
        {Array.isArray(children) ? children[0] : children}
      </div>
      <div ref={captionLayerRef} className="ft-tilt-caption-layer">
        {Array.isArray(children) ? children[1] : null}
      </div>
    </div>
  );
}
