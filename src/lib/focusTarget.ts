'use client';

/**
 * Guided navigation: take someone to the exact control, not just the right page.
 *
 * A call to action like "Connect payout bank" used to switch to the Earnings tab
 * and stop there, leaving the reader to find "Connect bank with Razorpay"
 * somewhere further down a long screen -- and then, having pressed it, to find
 * the form that opened below the fold. Two invisible steps between the button
 * and the thing it promised.
 *
 * The convention:
 *   1. Tag the destination control with data-focus-id="something".
 *   2. Navigate with ?focus=something in the URL.
 *   3. focusTarget() brings it into view and flashes it so the eye lands on it.
 *
 * Deliberately forgiving about timing. The destination usually renders after the
 * navigation -- a tab swap, a fetch, a lazy panel -- so this retries on a frame
 * loop for a short window rather than assuming the element is already there.
 */

const FLASH_CLASS = 'ft-focus-flash';
const FLASH_MS = 2600;
const HUNT_MS = 4000;

export const focusTargetSelector = (id: string) => `[data-focus-id="${CSS.escape(id)}"]`;

/**
 * Scroll `id` into view and flash it. Resolves true once found, false if it never
 * appeared within the hunt window.
 */
export function focusTarget(id: string): Promise<boolean> {
  if (typeof document === 'undefined' || !id) return Promise.resolve(false);

  return new Promise((resolve) => {
    const started = performance.now();

    const attempt = () => {
      const element = document.querySelector<HTMLElement>(focusTargetSelector(id));
      if (element) {
        // 'center' rather than 'start': a control pinned to the top edge of a
        // scroll container reads as cut off, and on a phone the sticky header
        // would cover it outright.
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

        element.classList.remove(FLASH_CLASS);
        // Force a reflow so re-adding the class restarts the animation when the
        // same target is focused twice in a row.
        void element.offsetWidth;
        element.classList.add(FLASH_CLASS);
        window.setTimeout(() => element.classList.remove(FLASH_CLASS), FLASH_MS);

        // Move the keyboard caret too, so this works for anyone not using a
        // mouse and so screen readers announce where they have been taken.
        if (typeof element.focus === 'function') {
          const focusable = element.matches('a,button,input,select,textarea,[tabindex]');
          if (!focusable) element.setAttribute('tabindex', '-1');
          element.focus({ preventScroll: true });
        }

        resolve(true);
        return;
      }

      if (performance.now() - started > HUNT_MS) {
        resolve(false);
        return;
      }
      window.requestAnimationFrame(attempt);
    };

    window.requestAnimationFrame(attempt);
  });
}

/**
 * Build a workspace URL that lands on a tab and then on a specific control.
 */
export const withFocus = (href: string, focus?: string) =>
  focus ? `${href}${href.includes('?') ? '&' : '?'}focus=${encodeURIComponent(focus)}` : href;
