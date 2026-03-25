import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface PermissionToast {
  id: string;
  title: string;
  body: string;
}

interface PermissionToastStackProps {
  toasts: PermissionToast[];
  onDismiss: (id: string) => void;
  onSelect?: (id: string) => void;
  autoDismissMs?: number;
}

export default function PermissionToastStack({
  toasts,
  onDismiss,
  onSelect,
  autoDismissMs = 5000,
}: PermissionToastStackProps) {
  const { t } = useTranslation();
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const startDismiss = useCallback((id: string) => {
    setExitingIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => onDismiss(id), 180);
  }, [onDismiss]);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map(toast => window.setTimeout(() => startDismiss(toast.id), autoDismissMs));
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [toasts, startDismiss, autoDismissMs]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        right: '16px',
        bottom: '44px',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '320px',
      }}
    >
      {toasts.slice(0, 3).map(toast => {
        const isExiting = exitingIds.has(toast.id);
        const isHovered = hoveredId === toast.id;
        const isFocused = focusedId === toast.id;
        return (
        <div
          key={toast.id}
          data-testid={`permission-toast-${toast.id}`}
          onClick={() => onSelect?.(toast.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect?.(toast.id);
            }
          }}
          onMouseEnter={() => setHoveredId(toast.id)}
          onMouseLeave={() => setHoveredId(current => current === toast.id ? null : current)}
          onMouseOver={() => setHoveredId(toast.id)}
          onMouseOut={() => setHoveredId(current => current === toast.id ? null : current)}
          onFocus={() => setFocusedId(toast.id)}
          onBlur={() => setFocusedId(current => current === toast.id ? null : current)}
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : undefined}
          style={{
            background: isHovered ? 'var(--surface-2)' : 'var(--surface-1)',
            border: `1px solid ${isFocused ? 'var(--active-border-hi)' : 'var(--active-border)'}`,
            boxShadow: isFocused ? '0 0 0 1px var(--active-border-hi), var(--shadow-lg)' : 'var(--shadow-lg)',
            borderRadius: '4px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            cursor: onSelect ? 'pointer' : 'default',
            animation: isExiting ? undefined : 'fade-up 0.18s ease-out',
            transition: 'opacity 0.18s ease, transform 0.18s ease',
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? 'translateY(6px)' : 'translateY(0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'var(--active-text)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {toast.title}
            </span>
            <button
              onClick={(event) => {
                event.stopPropagation();
                startDismiss(toast.id);
              }}
              aria-label={t('approval.dismiss_notification')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '11px',
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {toast.body}
          </div>
        </div>
      );})}
    </div>
  );
}
