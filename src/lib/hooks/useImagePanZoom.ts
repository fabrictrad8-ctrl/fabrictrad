import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.2;
const DOUBLE_TAP_WINDOW_MS = 300;
const SWIPE_THRESHOLD = 40;
const SWIPE_VERTICAL_TOLERANCE = 1.5;
// Per wheel-tick zoom growth. A typical mouse wheel tick reports
// deltaY ~100-120; at this coefficient that is roughly a 6-7% scale step,
// so reaching MAX_SCALE takes a deliberate, controllable series of ticks
// instead of maxing out in a handful (an earlier, higher coefficient did
// exactly that — smooth zoom needs to feel gradual, not like a jump cut).
const WHEEL_ZOOM_COEFFICIENT = 0.0006;
const MAX_WHEEL_DELTA = 400;

type Point = { x: number; y: number };

type PanZoomOptions = {
  /** Fires on a plain single-finger/mouse swipe while not zoomed in — lets the gallery still move between images when the user isn't inspecting detail. */
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

/**
 * Pan-and-zoom for a single image, driven entirely by Pointer Events so mouse
 * and touch share one code path: pinch (two pointers) or the scroll wheel
 * zooms continuously between 1x and MAX_SCALE, a single pointer drag pans
 * once zoomed in, and a double-click/double-tap zooms to a fixed level
 * centered on the tapped point (tapping again resets). Panning is clamped so
 * the image can never be dragged past its own edge into empty space — the
 * failure mode a fixed, non-pannable zoom has no way to avoid.
 */
export function useImagePanZoom(options: PanZoomOptions = {}) {
  const [scale, setScale] = useState(MIN_SCALE);
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const dragStart = useRef<{ pointerId: number; origin: Point; translate: Point } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const isZoomed = scale > MIN_SCALE + 0.01;

  const clampTranslate = useCallback((next: Point, atScale: number) => {
    const el = containerRef.current;
    if (!el) return next;
    const rect = el.getBoundingClientRect();
    // Object-contain centers the image; once scaled, the extra room to pan
    // in each direction is half the growth the scale added to that axis.
    const maxX = (rect.width * (atScale - 1)) / 2;
    const maxY = (rect.height * (atScale - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, []);

  const reset = useCallback(() => {
    setScale(MIN_SCALE);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const zoomAtPoint = useCallback(
    (clientPoint: Point, nextScale: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      // Keep the tapped/scrolled-over point visually fixed while the scale
      // changes, instead of always zooming toward the image's own center.
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      const ratio = clamped / scale;
      const nextTranslate = {
        x: (translate.x - (clientPoint.x - centerX)) * ratio + (clientPoint.x - centerX),
        y: (translate.y - (clientPoint.y - centerY)) * ratio + (clientPoint.y - centerY),
      };
      setScale(clamped);
      setTranslate(clamped <= MIN_SCALE + 0.01 ? { x: 0, y: 0 } : clampTranslate(nextTranslate, clamped));
    },
    [scale, translate, clampTranslate]
  );

  // React's onWheel prop is registered as a passive listener, so
  // event.preventDefault() inside it silently no-ops (and logs a console
  // warning) — the page would scroll underneath the image while it also
  // zoomed. A native listener with { passive: false } is the only way to
  // actually stop that default scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const clampedDelta = Math.max(-MAX_WHEEL_DELTA, Math.min(MAX_WHEEL_DELTA, event.deltaY));
      const delta = -clampedDelta * WHEEL_ZOOM_COEFFICIENT;
      zoomAtPoint({ x: event.clientX, y: event.clientY }, scale + delta * scale);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scale, zoomAtPoint]);

  const handleDoubleClick = useCallback(
    (clientPoint: Point) => {
      if (isZoomed) {
        reset();
      } else {
        zoomAtPoint(clientPoint, DOUBLE_TAP_SCALE);
      }
    },
    [isZoomed, reset, zoomAtPoint]
  );

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale };
      dragStart.current = null;
    } else if (pointers.current.size === 1) {
      dragStart.current = { pointerId: event.pointerId, origin: { x: event.clientX, y: event.clientY }, translate };
    }
  }, [scale, translate]);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.current.size === 2 && pinchStart.current) {
        const [a, b] = [...pointers.current.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const nextScale = pinchStart.current.scale * (distance / pinchStart.current.distance);
        zoomAtPoint(midpoint, nextScale);
        return;
      }

      const drag = dragStart.current;
      if (drag && drag.pointerId === event.pointerId && isZoomed) {
        const next = {
          x: drag.translate.x + (event.clientX - drag.origin.x),
          y: drag.translate.y + (event.clientY - drag.origin.y),
        };
        setTranslate(clampTranslate(next, scale));
      }
    },
    [isZoomed, scale, zoomAtPoint, clampTranslate]
  );

  const endPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = dragStart.current;
      const wasSingleDrag = pointers.current.size === 1 && start?.pointerId === event.pointerId;
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) pinchStart.current = null;

      // A tap (not a drag) that lands within the double-tap window and close
      // to the previous one toggles zoom, centered on that point.
      if (wasSingleDrag) {
        const dx = event.clientX - start.origin.x;
        const dy = event.clientY - start.origin.y;
        const dragDistance = Math.hypot(dx, dy);

        if (dragDistance < 8) {
          const now = Date.now();
          const last = lastTapRef.current;
          lastTapRef.current = { time: now, x: event.clientX, y: event.clientY };
          if (last && now - last.time < DOUBLE_TAP_WINDOW_MS && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 40) {
            lastTapRef.current = null;
            handleDoubleClick({ x: event.clientX, y: event.clientY });
          }
        } else if (!isZoomed && Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * SWIPE_VERTICAL_TOLERANCE) {
          if (dx < 0) options.onSwipeLeft?.(); else options.onSwipeRight?.();
        }
      }
      dragStart.current = null;
    },
    [handleDoubleClick, isZoomed, options]
  );

  const bind = useMemo(
    () => ({
      ref: containerRef,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onDragStart: (event: React.DragEvent) => event.preventDefault(),
      style: { touchAction: isZoomed ? ('none' as const) : ('pan-y' as const) },
    }),
    [handlePointerDown, handlePointerMove, endPointer, isZoomed]
  );

  const imageStyle = useMemo(
    () => ({
      transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`,
      transition: dragStart.current || pinchStart.current ? 'none' : 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)',
      cursor: isZoomed ? 'grab' : 'zoom-in',
    }),
    [translate, scale, isZoomed]
  );

  const zoomIn = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAtPoint({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, DOUBLE_TAP_SCALE);
  }, [zoomAtPoint]);

  return { bind, imageStyle, scale, isZoomed, reset, zoomIn };
}
