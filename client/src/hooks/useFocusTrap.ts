import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within a container while it's mounted.
 * Returns a ref to attach to the dialog/panel root element.
 * Restores focus to the previously focused element on unmount.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;

    const el = ref.current;
    if (!el) return;

    // Focus the first focusable element inside the trap
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !el) return;

      const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus
      previousFocus.current?.focus();
    };
  }, []);

  return ref;
}
