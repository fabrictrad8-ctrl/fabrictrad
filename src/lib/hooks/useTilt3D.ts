import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

const MAX_TILT_DEG = 32;
const DRAG_SENSITIVITY = 0.35;

type Angle = { rx: number; ry: number };

/**
 * A toggleable, drag-driven 3D tilt for a single flat photo — button-activated,
 * unlike the always-on hover tilt in TiltShowcase.tsx. This is explicitly
 * decorative: tilting a flat image in perspective space never reveals the
 * product's actual back or sides (past roughly the tilt's own edge-on angle
 * there's nothing there to show), so it's presented as a "3D view" flourish,
 * not a real multi-angle rotation. Works from both mouse drag and touch drag
 * via Pointer Events, and springs back to flat when released or turned off.
 */
export function useTilt3D(enabled: boolean) {
  const [angle, setAngle] = useState<Angle>({ rx: 0, ry: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ pointerId: number; x: number; y: number; angle: Angle } | null>(null);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      dragStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, angle };
      setDragging(true);
    },
    [enabled, angle]
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const nextRy = Math.min(MAX_TILT_DEG, Math.max(-MAX_TILT_DEG, start.angle.ry + dx * DRAG_SENSITIVITY));
    const nextRx = Math.min(MAX_TILT_DEG, Math.max(-MAX_TILT_DEG, start.angle.rx - dy * DRAG_SENSITIVITY));
    setAngle({ rx: nextRx, ry: nextRy });
  }, []);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStart.current?.pointerId !== event.pointerId) return;
    dragStart.current = null;
    setDragging(false);
    // Settle back to flat rather than leaving the photo resting at an
    // arbitrary tilt — a spin toy returns to rest, it doesn't freeze mid-turn.
    setAngle({ rx: 0, ry: 0 });
  }, []);

  const bind = useMemo(
    () =>
      enabled
        ? {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onDragStart: (event: React.DragEvent) => event.preventDefault(),
            style: { touchAction: 'none' as const, cursor: dragging ? 'grabbing' : 'grab' },
          }
        : {},
    [enabled, handlePointerDown, handlePointerMove, endDrag, dragging]
  );

  const style = useMemo(
    () =>
      enabled
        ? {
            transform: `perspective(1000px) rotateX(${angle.rx}deg) rotateY(${angle.ry}deg)`,
            transition: dragging ? 'none' : 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1)',
            transformStyle: 'preserve-3d' as const,
            willChange: 'transform',
          }
        : undefined,
    [enabled, angle, dragging]
  );

  return { bind, style, dragging };
}
