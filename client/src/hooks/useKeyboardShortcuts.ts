import { useEffect } from 'react';
import type { ViewType } from '../components/Layout';

const VIEW_MAP: ViewType[] = ['dashboard', 'graph', 'activity', 'history', 'cost', 'settings'];

interface ShortcutConfig {
  onViewChange: (view: ViewType) => void;
  onClosePanel?: () => void;
  onNextNotification?: () => void;
  onRefresh?: () => void;
}

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((document.activeElement as HTMLElement)?.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(config: ShortcutConfig): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape always works — close panels
      if (e.key === 'Escape') {
        config.onClosePanel?.();
        return;
      }

      // All other shortcuts only fire outside input/textarea
      if (isInputFocused()) return;

      // Number keys 1-6 → switch views
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 6) {
        e.preventDefault();
        config.onViewChange(VIEW_MAP[num - 1]);
        return;
      }

      // / → focus search (dispatch custom event)
      if (e.key === '/') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('focus-search'));
        return;
      }

      // n → next notification (jump to activity)
      if (e.key === 'n') {
        config.onNextNotification?.();
        return;
      }

      // r → refresh current view
      if (e.key === 'r') {
        config.onRefresh?.();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config]);
}
