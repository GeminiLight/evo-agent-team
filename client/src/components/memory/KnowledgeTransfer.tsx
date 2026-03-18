import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Check, X, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { sectionStyle, sectionHeaderStyle, sectionTitleStyle, btnStyle } from '../../utils/sharedStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamSummary {
  id: string;
  name: string;
  memberCount: number;
}

interface KnowledgeItem {
  content: string;
  category: 'universal' | 'transferable' | 'project-specific' | 'ephemeral';
  destination: 'memory' | 'guide';
  reason: string;
  source: string;
}

interface AnalyzeResult {
  items: KnowledgeItem[];
  stats: {
    total: number;
    universal: number;
    transferable: number;
    projectSpecific: number;
    ephemeral: number;
    deduplicated: number;
  };
}

interface KnowledgeTransferProps {
  targetTeamId: string;
  onComplete: () => void;
  onCancel: () => void;
  isDemoMode?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

type Step = 'selectSource' | 'analyzing' | 'reviewing' | 'applying';

const CATEGORY_ORDER: KnowledgeItem['category'][] = ['universal', 'transferable', 'project-specific', 'ephemeral'];

export default function KnowledgeTransfer({ targetTeamId, onComplete, onCancel, isDemoMode }: KnowledgeTransferProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('selectSource');
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [sourceTeamId, setSourceTeamId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showExcluded, setShowExcluded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch team list
  useEffect(() => {
    setTeamsLoading(true);
    fetch('/api/teams')
      .then(r => r.json())
      .then(data => {
        const list = (data.teams ?? []).filter(
          (t: TeamSummary) => t.id !== targetTeamId && t.id !== 'demo-team'
        );
        setTeams(list);
      })
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
  }, [targetTeamId]);

  // Analyze
  const handleAnalyze = useCallback(async (srcId: string) => {
    setSourceTeamId(srcId);
    setStep('analyzing');
    setError(null);
    try {
      const res = await fetch(`/api/teams/${targetTeamId}/knowledge/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceTeamId: srcId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || 'Analysis failed');
      }
      const json: AnalyzeResult = await res.json();
      setResult(json);

      // Default selection: universal + transferable
      const sel = new Set<number>();
      json.items.forEach((item, i) => {
        if (item.category === 'universal' || item.category === 'transferable') {
          sel.add(i);
        }
      });
      setSelected(sel);
      setStep('reviewing');
    } catch (err) {
      setError((err as Error).message);
      setStep('selectSource');
    }
  }, [targetTeamId]);

  // Apply
  const handleApply = useCallback(async () => {
    if (!result) return;
    setStep('applying');
    setError(null);

    const selectedItems = result.items
      .filter((_, i) => selected.has(i))
      .map(item => ({ content: item.content, destination: item.destination }));

    try {
      const res = await fetch(`/api/teams/${targetTeamId}/knowledge/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems }),
      });
      if (!res.ok) throw new Error('Apply failed');
      onComplete();
    } catch (err) {
      setError((err as Error).message);
      setStep('reviewing');
    }
  }, [targetTeamId, result, selected, onComplete]);

  // Toggle selection
  const toggleItem = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const CATEGORY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
    universal:          { color: 'var(--phosphor)', bg: 'var(--phosphor-glow)', label: t('knowledge.category_universal') },
    transferable:       { color: 'var(--amber)',    bg: 'var(--amber-glow)',    label: t('knowledge.category_transferable') },
    'project-specific': { color: 'var(--text-muted)', bg: 'var(--surface-1)',  label: t('knowledge.category_project_specific') },
    ephemeral:          { color: 'var(--crimson, #ff4466)', bg: 'var(--surface-1)', label: t('knowledge.category_ephemeral') },
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  // Step 1: Select source
  if (step === 'selectSource') {
    return (
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>{t('knowledge.select_source')}</span>
          <button style={btnStyle('ghost')} onClick={onCancel}>
            <X size={11} /> {t('memory.cancel')}
          </button>
        </div>
        <div style={{ padding: '14px' }}>
          {error && (
            <div style={{ fontSize: '10px', color: 'var(--crimson, #ff4466)', marginBottom: '10px', padding: '6px 10px', background: 'var(--surface-1)', border: '1px solid var(--crimson, #ff4466)', borderRadius: '3px' }}>
              {error}
            </div>
          )}
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: '1.5' }}>
            {t('knowledge.select_source_desc')}
          </p>
          {teamsLoading ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '20px 0', textAlign: 'center' }}>
              {t('common.loading')}
            </div>
          ) : teams.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', padding: '20px 0', textAlign: 'center' }}>
              {t('knowledge.import_disabled_single')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {teams.map(team => (
                <div
                  key={team.id}
                  onClick={() => handleAnalyze(team.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--phosphor)'; e.currentTarget.style.background = 'var(--phosphor-glow)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                      {team.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {t('knowledge.members_count', { count: team.memberCount })}
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Analyzing
  if (step === 'analyzing') {
    return (
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>{t('knowledge.select_source')}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 0' }}>
          <div style={{
            width: '24px', height: '24px',
            border: '1px solid var(--border)',
            borderTop: '1px solid var(--phosphor)',
            borderRadius: '50%',
            animation: 'spin-slow 1s linear infinite',
            boxShadow: '0 0 8px var(--phosphor-glow)',
          }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            {t('knowledge.analyzing', { source: sourceTeamId })}
          </span>
        </div>
      </div>
    );
  }

  // Step 3: Reviewing
  if (step === 'reviewing' && result) {
    const activeCategories = CATEGORY_ORDER.filter(cat =>
      result.items.some(i => i.category === cat)
    );
    const excludedCategories = ['project-specific', 'ephemeral'] as const;
    const mainCategories = activeCategories.filter(c => !excludedCategories.includes(c as 'project-specific' | 'ephemeral'));
    const hiddenCategories = activeCategories.filter(c => excludedCategories.includes(c as 'project-specific' | 'ephemeral'));
    const hiddenCount = result.items.filter(i => excludedCategories.includes(i.category as 'project-specific' | 'ephemeral')).length;

    if (result.items.length === 0) {
      return (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>{t('knowledge.select_source')}</span>
            <button style={btnStyle('ghost')} onClick={onCancel}>
              <X size={11} /> {t('memory.cancel')}
            </button>
          </div>
          <div style={{ padding: '40px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              {t('knowledge.no_knowledge')}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>
            <ArrowLeftRight size={11} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
            {sourceTeamId} → {targetTeamId}
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              {t('knowledge.items_selected', { count: selected.size })}
            </span>
            <button style={btnStyle('ghost')} onClick={onCancel}>
              <X size={11} /> {t('memory.cancel')}
            </button>
            <button
              style={{ ...btnStyle('primary'), opacity: selected.size === 0 ? 0.5 : 1 }}
              onClick={handleApply}
              disabled={selected.size === 0}
            >
              <Check size={11} /> {t('knowledge.apply_selected')}
            </button>
          </div>
        </div>

        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div style={{ fontSize: '10px', color: 'var(--crimson, #ff4466)', padding: '6px 10px', background: 'var(--surface-1)', border: '1px solid var(--crimson, #ff4466)', borderRadius: '3px' }}>
              {error}
            </div>
          )}

          {/* Main categories: universal + transferable */}
          {mainCategories.map(cat => {
            const catItems = result.items.map((item, i) => ({ item, i })).filter(({ item }) => item.category === cat);
            const style = CATEGORY_STYLES[cat];
            return (
              <div key={cat}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: style.color, textTransform: 'uppercase', marginBottom: '6px' }}>
                  {style.label} ({catItems.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {catItems.map(({ item, i }) => (
                    <ItemRow key={i} item={item} index={i} isSelected={selected.has(i)} onToggle={toggleItem} catStyle={style} t={t} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Excluded categories (collapsible) */}
          {hiddenCount > 0 && (
            <div>
              <button
                onClick={() => setShowExcluded(s => !s)}
                style={{ ...btnStyle('ghost'), fontSize: '9px', padding: '3px 8px' }}
              >
                {showExcluded ? <EyeOff size={10} /> : <Eye size={10} />}
                {showExcluded ? t('knowledge.hide_excluded') : t('knowledge.show_excluded')} ({hiddenCount})
              </button>
              {showExcluded && hiddenCategories.map(cat => {
                const catItems = result.items.map((item, i) => ({ item, i })).filter(({ item }) => item.category === cat);
                if (catItems.length === 0) return null;
                const style = CATEGORY_STYLES[cat];
                return (
                  <div key={cat} style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: style.color, textTransform: 'uppercase', marginBottom: '6px' }}>
                      {style.label} ({catItems.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {catItems.map(({ item, i }) => (
                        <ItemRow key={i} item={item} index={i} isSelected={selected.has(i)} onToggle={toggleItem} catStyle={style} t={t} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 4: Applying
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <span style={sectionTitleStyle}>{t('knowledge.select_source')}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 0' }}>
        <div style={{
          width: '24px', height: '24px',
          border: '1px solid var(--border)',
          borderTop: '1px solid var(--phosphor)',
          borderRadius: '50%',
          animation: 'spin-slow 1s linear infinite',
          boxShadow: '0 0 8px var(--phosphor-glow)',
        }} />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          {t('knowledge.applying')}
        </span>
      </div>
    </div>
  );
}

// ── Item row sub-component ────────────────────────────────────────────────────

function ItemRow({ item, index, isSelected, onToggle, catStyle, t }: {
  item: KnowledgeItem;
  index: number;
  isSelected: boolean;
  onToggle: (i: number) => void;
  catStyle: { color: string; bg: string };
  t: (key: string) => string;
}) {
  const destLabel = item.destination === 'memory' ? t('knowledge.dest_memory') : t('knowledge.dest_guide');

  return (
    <div
      onClick={() => onToggle(index)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '8px 10px',
        background: isSelected ? catStyle.bg : 'transparent',
        border: `1px solid ${isSelected ? catStyle.color + '40' : 'var(--border)'}`,
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {/* Checkbox */}
      <span style={{
        flexShrink: 0,
        width: '14px',
        height: '14px',
        border: `1px solid ${isSelected ? catStyle.color : 'var(--border)'}`,
        borderRadius: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        color: catStyle.color,
        marginTop: '1px',
      }}>
        {isSelected ? '✓' : ''}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
          {item.content}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '3px', alignItems: 'center' }}>
          <span style={{
            fontSize: '9px',
            color: item.destination === 'memory' ? 'var(--phosphor)' : 'var(--amber)',
            background: item.destination === 'memory' ? 'var(--phosphor-glow)' : 'var(--amber-glow)',
            padding: '1px 5px',
            borderRadius: '2px',
            letterSpacing: '0.06em',
          }}>
            → {destLabel}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            {item.reason}
          </span>
        </div>
      </div>
    </div>
  );
}
