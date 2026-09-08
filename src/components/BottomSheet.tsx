'use client';

import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import Icon from '@/components/ui/AppIcon';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
};

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.5;
const CLOSE_ANIMATION_MS = 200;

export default function BottomSheet({ open, onClose, title, children, footer, ariaLabel }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const [closing, setClosing] = useState(false);
  const drag = useRef<{ startY: number; startTime: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setClosing(false);
      setDragY(0);
    }
  }, [open]);

  if (!open) return null;

  const requestClose = () => {
    setClosing(true);
    window.setTimeout(onClose, CLOSE_ANIMATION_MS);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    drag.current = { startY: event.touches[0].clientY, startTime: Date.now() };
  };
  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = event.touches[0].clientY - drag.current.startY;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    if (!drag.current) return;
    const elapsed = Date.now() - drag.current.startTime;
    const velocity = dragY / Math.max(elapsed, 1);
    drag.current = null;
    if (dragY > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      requestClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div className="ft-sheet-backdrop" onClick={requestClose}>
      <div
        className={`ft-bottom-sheet ${closing ? 'is-closing' : 'is-open'}`}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
      >
        <div
          className="ft-bottom-sheet-handle-area"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="ft-bottom-sheet-handle" aria-hidden="true" />
        </div>
        {title && (
          <div className="ft-bottom-sheet-header">
            <span className="ft-bottom-sheet-title">{title}</span>
            <button type="button" onClick={requestClose} className="ft-icon-button" aria-label="Close">
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
        )}
        <div className="ft-bottom-sheet-body">{children}</div>
        {footer && <div className="ft-bottom-sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}
