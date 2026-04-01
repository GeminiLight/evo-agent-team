import { useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

const MemoryView = lazy(() => import('../memory/MemoryView'));
const ContextSummaryView = lazy(() => import('../context/ContextSummaryView'));
const ExpertProfilePanel = lazy(() => import('../ExpertProfilePanel'));

type KnowledgeTab = 'memory' | 'context' | 'expert';

const STORAGE_KEY = 'knowledge-tab';

interface KnowledgeViewProps {
  teamId: string;
  teamName?: string;
  isDemoMode?: boolean;
  initialTab?: KnowledgeTab;
}

const TABS: { key: KnowledgeTab; labelKey: string }[] = [
  { key: 'memory',  labelKey: 'sidebar.memory' },
  { key: 'context', labelKey: 'sidebar.context' },
  { key: 'expert',  labelKey: 'sidebar.expert_profile' },
];

export default function KnowledgeView({ teamId, teamName, isDemoMode, initialTab }: KnowledgeViewProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<KnowledgeTab>(() => {
    if (initialTab) return initialTab;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY) as KnowledgeTab | null;
      if (stored && ['memory', 'context', 'expert'].includes(stored)) return stored;
    } catch { /* noop */ }
    return 'memory';
  });

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, tab); } catch { /* noop */ }
  }, [tab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%' }} data-tour="knowledge">
      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex',
        gap: '2px',
        padding: '0 0 12px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '12px',
      }}>
        {TABS.map(({ key, labelKey }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '6px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: active ? 'var(--active-bg-med)' : 'transparent',
                color: active ? 'var(--active-text)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: active ? '2px solid var(--phosphor)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textShadow: active ? '0 0 8px var(--phosphor-glow-strong)' : 'none',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--surface-1)'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; } }}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            LOADING...
          </div>
        }>
          {tab === 'memory' && (
            <MemoryView teamId={teamId} isDemoMode={isDemoMode} />
          )}
          {tab === 'context' && (
            <ContextSummaryView teamId={teamId} isDemoMode={isDemoMode} />
          )}
          {tab === 'expert' && (
            <ExpertProfilePanel teamId={teamId} teamName={teamName} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
