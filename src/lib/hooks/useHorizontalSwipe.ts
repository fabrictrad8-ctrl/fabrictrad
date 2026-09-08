import { useRef, type TouchEvent } from 'react';

type SwipeHandlers = {
  onTouchStart: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
};

/**
 * Detects a horizontal swipe on the element these handlers are attached to,
 * ignoring anything that's mostly a vertical scroll. Shared by every list
 * that lets a phone swipe between tabs/slides instead of only tapping them
 * (product gallery images, order-status tabs, tracking-filter tabs).
 */
export function useHorizontalSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  options?: { threshold?: number; verticalTolerance?: number }
): SwipeHandlers {
  const threshold = options?.threshold ?? 40;
  const verticalTolerance = options?.verticalTolerance ?? 1.5;
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (event) => {
      start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    },
    onTouchEnd: (event) => {
      if (!start.current) return;
      const deltaX = event.changedTouches[0].clientX - start.current.x;
      const deltaY = event.changedTouches[0].clientY - start.current.y;
      start.current = null;
      if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY) * verticalTolerance) {
        if (deltaX < 0) onSwipeLeft(); else onSwipeRight();
      }
    },
  };
}
