interface CRTEmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: string;
}

export default function CRTEmptyState({ title, subtitle, icon }: CRTEmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
      minHeight: '180px',
    }}>
      {/* Scanline overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(var(--accent-rgb, 57,255,106), 0.03) 2px, rgba(var(--accent-rgb, 57,255,106), 0.03) 4px)',
        animation: 'data-stream 8s linear infinite',
        pointerEvents: 'none',
        opacity: 0.6,
      }} />

      {/* Optional ASCII icon */}
      {icon && (
        <pre style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '11px',
          lineHeight: 1.3,
          color: 'var(--text-muted)',
          marginBottom: '16px',
          opacity: 0.5,
          letterSpacing: '0.06em',
          userSelect: 'none',
        }}>
          {icon}
        </pre>
      )}

      {/* Title */}
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.18em',
        fontFamily: 'var(--font-mono, monospace)',
        marginBottom: subtitle ? '8px' : '0',
      }}>
        — {title} —
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          letterSpacing: '0.06em',
          opacity: 0.6,
          maxWidth: '320px',
          lineHeight: 1.5,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
