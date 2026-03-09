import { useTranslation } from 'react-i18next';

export default function LangSwitcher() {
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      border: '1px solid var(--border)',
      borderRadius: '3px',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <button
        onClick={() => i18n.changeLanguage('en')}
        style={{
          padding: '3px 8px',
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.08em',
          background: !isZh ? 'var(--active-bg-med)' : 'transparent',
          color: !isZh ? 'var(--active-text)' : 'var(--text-muted)',
          border: 'none',
          borderRight: '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { if (isZh) e.currentTarget.style.color = 'var(--text-secondary)'; }}
        onMouseLeave={e => { if (isZh) e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        EN
      </button>
      <button
        onClick={() => i18n.changeLanguage('zh')}
        style={{
          padding: '3px 8px',
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          background: isZh ? 'var(--active-bg-med)' : 'transparent',
          color: isZh ? 'var(--active-text)' : 'var(--text-muted)',
          border: 'none',
          cursor: 'pointer',
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { if (!isZh) e.currentTarget.style.color = 'var(--text-secondary)'; }}
        onMouseLeave={e => { if (!isZh) e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        中
      </button>
    </div>
  );
}
