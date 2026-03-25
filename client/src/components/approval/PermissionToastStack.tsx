import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface PermissionToast {
  id: string;
  title: string;
  body: string;
}

interface PermissionToastStackProps {
  toasts: PermissionToast[];
  onDismiss: (id: string) => void;
  autoDismissMs?: number;
}

export default function PermissionToastStack({
  toasts,
  onDismiss,
  autoDismissMs = 5000,
}: PermissionToastStackProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map(toast => setTimeout(() => onDismiss(toast.id), autoDismissMs));
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [toasts, onDismiss, autoDismissMs]);

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
      {toasts.slice(0, 3).map(toast => (
        <div
          key={toast.id}
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--active-border)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: '4px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'var(--active-text)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {toast.title}
            </span>
            <button
              onClick={() => onDismiss(toast.id)}
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
      ))}
    </div>
  );
}
