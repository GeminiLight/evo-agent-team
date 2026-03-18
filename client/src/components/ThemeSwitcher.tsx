import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette } from 'lucide-react';
import { THEMES, useTheme, type ThemeId } from '../context/ThemeContext';

export default function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen(o => !o);
  }

  const current = THEMES.find(th => th.id === theme)!;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        title={t('theme.change')}
        aria-expanded={open}
        aria-controls="theme-menu"
        aria-haspopup="true"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '4px 10px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '3px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.1em',
          transition: 'border-color 0.15s, color 0.15s',
          textTransform: 'uppercase',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--border-bright)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
      >
        {/* Live accent dot */}
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: current.accent,
          boxShadow: `0 0 5px ${current.accent}`,
          flexShrink: 0,
          display: 'inline-block',
        }} />
        <Palette size={10} />
        {t('theme.button')}
      </button>

      {open && (
        <div
          id="theme-menu"
          role="menu"
          aria-label="Theme selection"
          style={{
            position: 'fixed',
            top: dropPos.top,
            right: dropPos.right,
            zIndex: 9999,
            background: 'var(--surface-1)',
            border: '1px solid var(--border-bright)',
            borderRadius: '4px',
            overflow: 'hidden',
            width: 'min(320px, 95vw)',
            animation: 'fade-up 0.15s ease-out',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
          {/* Header */}
          <div style={{
            padding: '8px 12px 6px',
            borderBottom: '1px solid var(--border)',
            fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.18em',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
          }}>
            {t('theme.select')}
          </div>

          {/* 2-column grid of theme options */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1px',
            background: 'var(--border)',
          }}>
            {THEMES.map((themeItem) => {
              const isActive = theme === themeItem.id;
              return (
                <button
                  key={themeItem.id}
                  role="menuitem"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => { setTheme(themeItem.id as ThemeId); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 10px',
                    background: isActive ? `${themeItem.accent}14` : 'var(--surface-1)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = 'var(--surface-2)';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = 'var(--surface-1)';
                  }}
                >
                  {/* Active left bar */}
                  {isActive && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px',
                      background: themeItem.accent,
                      boxShadow: `0 0 6px ${themeItem.accent}`,
                    }} />
                  )}

                  {/* Mini preview card */}
                  <div style={{
                    width: '32px', height: '22px', borderRadius: '2px', flexShrink: 0,
                    background: themeItem.bg,
                    border: `1px solid ${isActive ? themeItem.accent : 'var(--border)'}`,
                    display: 'flex', flexDirection: 'column',
                    justifyContent: 'center', alignItems: 'flex-start',
                    gap: '2px', padding: '3px',
                    overflow: 'hidden',
                  }}>
                    <div style={{ width: '80%', height: '2px', background: themeItem.accent, borderRadius: '1px', opacity: 0.9 }} />
                    <div style={{ width: '55%', height: '1px', background: themeItem.accent, borderRadius: '1px', opacity: 0.45 }} />
                    <div style={{ width: '35%', height: '1px', background: themeItem.accent, borderRadius: '1px', opacity: 0.22 }} />
                  </div>

                  {/* Label + description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                      color: isActive ? themeItem.accent : 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      marginBottom: '1px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textTransform: 'uppercase',
                    }}>
                      {t(`theme.${themeItem.id}.label`)}
                    </div>
                    <div style={{
                      fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.03em',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                    }}>
                      {t(`theme.${themeItem.id}.desc`)}
                    </div>
                  </div>

                  {/* Accent dot */}
                  {isActive && (
                    <div style={{
                      width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
                      background: themeItem.accent,
                      boxShadow: `0 0 5px ${themeItem.accent}`,
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
