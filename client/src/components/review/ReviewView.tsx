import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Sparkles, ChevronDown, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeedbackEntry {
  id: string;
  agentName: string;
  type: 'praise' | 'correction' | 'bookmark';
  content: string | null;
  sessionId: string | null;
  messageUuid: string | null;
  createdAt: string;
  processedAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTypeMeta(t: (key: string) => string) {
  return {
    praise:     { emoji: '👍', label: t('review.type_praise'),      color: 'var(--phosphor)' },
    correction: { emoji: '👎', label: t('review.type_correction'),  color: 'var(--amber)' },
    bookmark:   { emoji: '📌', label: t('review.type_note'),        color: 'var(--ice)' },
  };
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ── Main component ────────────────────────────────────────────────────────────

interface ReviewViewProps {
  teamId: string;
  agentNames: string[];
  isDemoMode?: boolean;
}

export default function ReviewView({ teamId, agentNames, isDemoMode }: ReviewViewProps) {
  const { t } = useTranslation();
  const TYPE_META = buildTypeMeta(t);
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [preferences, setPreferences] = useState<Record<string, string[]>>({});
  const [guideRules, setGuideRules] = useState<string[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [generatingPrefs, setGeneratingPrefs] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'praise' | 'correction' | 'bookmark'>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'applied'>('all');
  const [showNewEntry, setShowNewEntry] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchFeedback = useCallback(async () => {
    setLoadingFeedback(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/feedback`);
      const json = await res.json();
      setEntries(json.entries ?? []);
    } catch { /* ignore */ } finally {
      setLoadingFeedback(false);
    }
  }, [teamId]);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/preferences`);
      const json = await res.json();
      setPreferences(json.preferences ?? {});
    } catch { /* ignore */ }
  }, [teamId]);

  const fetchGuideRules = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/guide`);
      const { content } = await res.json();
      if (!content) { setGuideRules([]); return; }
      const match = content.match(/##\s*Preferences\n([\s\S]*?)(?=\n##|\n$|$)/i);
      if (!match) { setGuideRules([]); return; }
      const rules = match[1]
        .split('\n')
        .map((l: string) => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
      setGuideRules(rules);
    } catch { setGuideRules([]); }
  }, [teamId]);

  useEffect(() => {
    fetchFeedback();
    fetchPreferences();
    fetchGuideRules();
  }, [fetchFeedback, fetchPreferences, fetchGuideRules]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const deleteEntry = useCallback(async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    try {
      await fetch(`/api/teams/${teamId}/feedback/${id}`, { method: 'DELETE' });
    } catch { /* optimistic delete already done */ }
  }, [teamId]);

  const generatePreferences = useCallback(async () => {
    setGeneratingPrefs(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/preferences/generate`, { method: 'POST' });
      const json = await res.json();
      if (json.preferences) setPreferences(json.preferences);
      // Re-fetch feedback to reflect processedAt changes
      await fetchFeedback();
    } catch { /* ignore */ } finally {
      setGeneratingPrefs(false);
    }
  }, [teamId, fetchFeedback]);

  const deletePreference = useCallback(async (agentName: string, idx: number) => {
    const updated = { ...preferences };
    updated[agentName] = updated[agentName].filter((_, i) => i !== idx);
    if (updated[agentName].length === 0) delete updated[agentName];
    setPreferences(updated);
    try {
      await fetch(`/api/teams/${teamId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: updated }),
      });
    } catch { /* ignore */ }
  }, [preferences, teamId]);

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = entries.filter(e => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterAgent !== 'all' && e.agentName !== filterAgent) return false;
    if (filterStatus === 'pending' && e.processedAt) return false;
    if (filterStatus === 'applied' && !e.processedAt) return false;
    return true;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────

  const allAgentNames = [...new Set(entries.map(e => e.agentName))].sort();
  const statsByAgent = allAgentNames.map(name => {
    const ag = entries.filter(e => e.agentName === name);
    return {
      name,
      praise:     ag.filter(e => e.type === 'praise').length,
      correction: ag.filter(e => e.type === 'correction').length,
      bookmark:   ag.filter(e => e.type === 'bookmark').length,
      total:      ag.length,
    };
  });

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '4px', textTransform: 'uppercase' }}>
            {t('review.title', { id: teamId.toUpperCase() })}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {t('review.feedback_prefs')}
          </div>
        </div>
        {!isDemoMode && (
          <button
            onClick={() => setShowNewEntry(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px', letterSpacing: '0.1em',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--phosphor)'; e.currentTarget.style.color = 'var(--phosphor)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <Plus size={11} /> <span style={{ textTransform: 'uppercase' }}>{t('review.new_entry')}</span>
          </button>
        )}
      </div>

      {/* New Entry Modal */}
      {showNewEntry && (
        <NewEntryModal
          teamId={teamId}
          agentNames={agentNames.length > 0 ? agentNames : allAgentNames}
          onClose={() => setShowNewEntry(false)}
          onSubmitted={() => { setShowNewEntry(false); fetchFeedback(); fetchPreferences(); fetchGuideRules(); }}
        />
      )}

      {/* FEEDBACK LOG */}
      <Section label={t('review.feedback_log')} count={filtered.length}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <FilterSelect
            value={filterType}
            onChange={v => setFilterType(v as any)}
            options={[
              { value: 'all', label: t('review.filter_all_types') },
              { value: 'praise', label: t('review.filter_praise') },
              { value: 'correction', label: t('review.filter_correction') },
              { value: 'bookmark', label: t('review.filter_bookmark') },
            ]}
          />
          <FilterSelect
            value={filterAgent}
            onChange={setFilterAgent}
            options={[
              { value: 'all', label: t('review.filter_all_agents') },
              ...allAgentNames.map(n => ({ value: n, label: n.toUpperCase() })),
            ]}
          />
          <FilterSelect
            value={filterStatus}
            onChange={v => setFilterStatus(v as any)}
            options={[
              { value: 'all', label: t('review.filter_all_status') },
              { value: 'pending', label: t('review.filter_pending') },
              { value: 'applied', label: t('review.filter_applied') },
            ]}
          />
        </div>

        {loadingFeedback ? (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '20px 0', textTransform: 'uppercase' }}>{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', padding: '24px 0', textAlign: 'center', lineHeight: 1.8 }}>
            <div style={{ fontSize: '24px', opacity: 0.3, marginBottom: '8px' }}>📭</div>
            <span style={{ textTransform: 'uppercase' }}>{t('review.no_feedback')}</span>
            <div style={{ marginTop: '6px', fontSize: '9px', opacity: 0.6 }}>
              {isDemoMode ? t('review.no_feedback_demo_sub') : t('review.no_feedback_real_sub')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {filtered.map(entry => (
              <FeedbackRow
                key={entry.id}
                entry={entry}
                onDelete={isDemoMode ? undefined : deleteEntry}
              />
            ))}
          </div>
        )}
      </Section>

      {/* PREFERENCES */}
      <Section label={t('review.preferences')} subtitle={t('review.preferences_subtitle')}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          {!isDemoMode && (
            <button
              onClick={generatePreferences}
              disabled={generatingPrefs}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px',
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                cursor: generatingPrefs ? 'default' : 'pointer',
                color: generatingPrefs ? 'var(--text-muted)' : 'var(--ice)',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px', letterSpacing: '0.1em',
                opacity: generatingPrefs ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (!generatingPrefs) e.currentTarget.style.borderColor = 'var(--ice)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <Sparkles size={10} style={{ animation: generatingPrefs ? 'spin 1s linear infinite' : 'none' }} />
              <span style={{ textTransform: 'uppercase' }}>{generatingPrefs ? t('review.generating') : t('review.generate_from_feedback')}</span>
            </button>
          )}
        </div>

        {/* TEAM_GUIDE rules */}
        {guideRules.length > 0 && (
          <div style={{ marginBottom: Object.keys(preferences).length > 0 ? '0' : '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span style={{
                fontSize: '9px', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)',
                color: 'var(--ice)',
              }}>
                TEAM GUIDE
              </span>
              <span style={{
                fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
              }}>
                {t('review.guide_source_file')}
              </span>
              <span style={{
                fontSize: '7px', color: 'var(--text-muted)', opacity: 0.5, letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)',
              }}>
                {t('review.guide_readonly')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px', borderLeft: '2px solid var(--ice-dim, var(--ice)33)' }}>
              {guideRules.map((rule, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ color: 'var(--ice)', fontSize: '9px', flexShrink: 0, marginTop: '2px' }}>▸</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Separator between guide rules and agent preferences */}
        {guideRules.length > 0 && Object.keys(preferences).length > 0 && (
          <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />
        )}

        {Object.keys(preferences).length === 0 && guideRules.length === 0 ? (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', padding: '20px 0', textAlign: 'center', lineHeight: 1.8 }}>
            <div style={{ fontSize: '24px', opacity: 0.3, marginBottom: '8px' }}>🧠</div>
            <span style={{ textTransform: 'uppercase' }}>{t('review.no_preferences')}</span>
            <div style={{ marginTop: '6px', fontSize: '9px', opacity: 0.6 }}>
              {t('review.no_preferences_sub_action')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(preferences).map(([agentName, rules]) => (
              <AgentPreferenceBlock
                key={agentName}
                agentName={agentName}
                rules={rules}
                readOnly={isDemoMode}
                onDelete={(idx) => deletePreference(agentName, idx)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* AGENT STATS */}
      {statsByAgent.length > 0 && (
        <Section label={t('review.agent_stats')} subtitle={t('review.stats_subtitle')}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[t('review.th_agent'), t('review.th_total'), t('review.th_praise'), t('review.th_correction'), t('review.th_bookmark')].map(h => (
                    <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.12em', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statsByAgent.map(s => (
                  <tr key={s.name} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>{s.name}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{s.total}</td>
                    <td style={{ padding: '8px 12px', color: s.praise > 0 ? 'var(--phosphor)' : 'var(--text-muted)' }}>{s.praise}</td>
                    <td style={{ padding: '8px 12px', color: s.correction > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>{s.correction}</td>
                    <td style={{ padding: '8px 12px', color: s.bookmark > 0 ? 'var(--ice)' : 'var(--text-muted)' }}>{s.bookmark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, subtitle, count, children }: { label: string; subtitle?: string; count?: number; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{label}</span>
        {subtitle && <span style={{ fontSize: '9px', color: 'var(--text-muted)', opacity: 0.6 }}>{subtitle}</span>}
        {count !== undefined && <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{t('review.entries_count', { count })}</span>}
        <div style={{ flex: 1, height: '1px', background: 'var(--border)', marginLeft: '8px' }} />
      </div>
      {children}
    </div>
  );
}

function FeedbackRow({ entry, onDelete }: { entry: FeedbackEntry; onDelete?: (id: string) => void }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const meta = buildTypeMeta(t)[entry.type];
  const isProcessed = !!entry.processedAt;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '10px 12px',
        background: hovered ? 'var(--surface-1)' : 'transparent',
        borderRadius: '3px',
        transition: 'background 0.1s',
        opacity: isProcessed ? 0.5 : 1,
      }}
    >
      {/* Type badge */}
      <div style={{
        flexShrink: 0, width: '80px',
        display: 'flex', alignItems: 'center', gap: '5px',
        marginTop: '1px',
      }}>
        <span>{meta.emoji}</span>
        <span style={{ fontSize: '8px', color: meta.color, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{meta.label}</span>
      </div>

      {/* Agent */}
      <div style={{ flexShrink: 0, width: '120px', fontSize: '10px', color: 'var(--text-secondary)', marginTop: '1px' }}>
        {entry.agentName}
      </div>

      {/* Content */}
      <div style={{ flex: 1, fontSize: '10px', color: entry.content ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.5, fontStyle: entry.content ? 'normal' : 'italic' }}>
        {entry.content ?? t('review.no_note')}
      </div>

      {/* Date */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px', whiteSpace: 'nowrap' }}>
        {isProcessed && (
          <span style={{
            fontSize: '7px', letterSpacing: '0.1em',
            color: 'var(--phosphor)', fontFamily: 'var(--font-mono)',
            padding: '1px 4px', border: '1px solid var(--phosphor)40',
            borderRadius: '2px',
          }}>
            {t('review.processed')}
          </span>
        )}
        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
          {fmtDate(entry.createdAt)}
        </span>
      </div>

      {/* Delete */}
      {onDelete && (
        <button
          onClick={() => onDelete(entry.id)}
          style={{
            flexShrink: 0, background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--text-muted)', padding: '2px',
            opacity: hovered ? 1 : 0, transition: 'opacity 0.1s',
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--crimson, #ff4466)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

function AgentPreferenceBlock({ agentName, rules, readOnly, onDelete }: {
  agentName: string;
  rules: string[];
  readOnly?: boolean;
  onDelete: (idx: number) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
        {agentName.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px', borderLeft: '2px solid var(--border)' }}>
        {rules.map((rule, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ color: 'var(--ice)', fontSize: '9px', flexShrink: 0, marginTop: '2px' }}>▸</span>
            <span style={{ fontSize: '10px', color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>{rule}</span>
            {!readOnly && (
              <button
                onClick={() => onDelete(i)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '1px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--crimson, #ff4466)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        appearance: 'none',
        background: 'var(--surface-1)',
        color: 'var(--text-secondary)',
        fontSize: '9px', fontFamily: 'var(--font-mono)',
        letterSpacing: '0.08em',
        border: '1px solid var(--border)',
        borderRadius: '3px',
        padding: '4px 10px',
        cursor: 'pointer', outline: 'none',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── New Entry Modal ───────────────────────────────────────────────────────────

interface Suggestion {
  id: string;
  target: string;
  action: 'add' | 'update' | 'remove';
  rule: string;
  reason: string;
}

type ModalPhase = 'form' | 'analyzing' | 'suggestions' | 'done';

function NewEntryModal({ teamId, agentNames, onClose, onSubmitted }: {
  teamId: string;
  agentNames: string[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const TYPE_META = buildTypeMeta(t);
  const [agentName, setAgentName] = useState(agentNames[0] ?? '');
  const [type, setType] = useState<'praise' | 'correction' | 'bookmark'>('praise');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [phase, setPhase] = useState<ModalPhase>('form');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [feedbackEntryId, setFeedbackEntryId] = useState<string | null>(null);

  const toggleSuggestion = (id: string) => {
    setAccepted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!agentName) { setError(t('review.select_agent_error')); return; }
    if ((type === 'correction' || type === 'bookmark') && !content.trim()) {
      setError(t('review.content_required_error'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/teams/${teamId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName, type, content: content.trim() || null }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Failed'); setSubmitting(false); return; }
      const { id: entryId } = await res.json();
      setFeedbackEntryId(entryId);

      // Start analysis phase
      setPhase('analyzing');
      setSubmitting(false);

      try {
        const analyzeRes = await fetch(`/api/teams/${teamId}/feedback/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latestEntry: { id: entryId, agentName, type, content: content.trim() } }),
        });
        const analyzeJson = await analyzeRes.json();

        if (analyzeJson.suggestions?.length > 0) {
          setSuggestions(analyzeJson.suggestions);
          setAccepted(new Set(analyzeJson.suggestions.map((s: Suggestion) => s.id)));
          setPhase('suggestions');
        } else {
          setPhase('done');
        }
      } catch {
        // Analysis failed — show done state
        setPhase('done');
      }
    } catch { setError('Network error'); setSubmitting(false); }
  };

  const applySelected = async () => {
    const toApply = suggestions.filter(s => accepted.has(s.id));
    if (toApply.length === 0) { onSubmitted(); return; }

    setApplying(true);
    try {
      await fetch(`/api/teams/${teamId}/feedback/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: toApply, sourceEntryId: feedbackEntryId }),
      });
    } catch { /* best-effort */ }
    onSubmitted();
  };

  const ACTION_COLORS: Record<string, string> = {
    add: 'var(--phosphor)',
    update: 'var(--ice)',
    remove: 'var(--amber)',
  };

  return (
    <>
      <div onClick={phase === 'form' ? onClose : undefined} style={{ position: 'fixed', inset: 0, background: 'rgba(4,6,8,0.7)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 201, width: phase === 'suggestions' ? '520px' : '420px',
        background: 'var(--surface-0)', border: '1px solid var(--border-bright)',
        borderRadius: '4px', padding: '24px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        fontFamily: 'var(--font-mono)',
        transition: 'width 0.2s ease',
      }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            {phase === 'suggestions' ? t('review.suggestions_title') : phase === 'analyzing' ? t('review.analyzing') : phase === 'done' ? t('review.done_title') : t('review.modal_title')}
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          ><X size={14} /></button>
        </div>

        {/* ── Form Phase ── */}
        {phase === 'form' && (
          <>
            <ModalField label={t('review.modal_agent')}>
              <select value={agentName} onChange={e => setAgentName(e.target.value)} style={selectStyle}>
                {agentNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </ModalField>

            <ModalField label={t('review.modal_type')}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['praise', 'correction', 'bookmark'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    style={{
                      flex: 1, padding: '6px', border: `1px solid ${type === t ? TYPE_META[t].color : 'var(--border)'}`,
                      borderRadius: '3px', background: type === t ? `${TYPE_META[t].color}18` : 'var(--surface-1)',
                      color: type === t ? TYPE_META[t].color : 'var(--text-muted)',
                      cursor: 'pointer', fontSize: '10px', fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {TYPE_META[t].emoji} {TYPE_META[t].label}
                  </button>
                ))}
              </div>
            </ModalField>

            <ModalField label={type === 'correction' ? t('review.modal_note_required') : t('review.modal_note_optional')}>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={type === 'praise' ? t('review.placeholder_praise') : type === 'correction' ? t('review.placeholder_correction') : t('review.placeholder_bookmark')}
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface-1)', border: '1px solid var(--border)',
                  borderRadius: '3px', padding: '8px 10px',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '10px',
                  resize: 'vertical', outline: 'none', lineHeight: 1.5,
                }}
              />
            </ModalField>

            {error && <div style={{ fontSize: '9px', color: 'var(--amber)', marginBottom: '12px' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button onClick={onClose} style={{ ...btnStyle, color: 'var(--text-muted)' }}><span style={{ textTransform: 'uppercase' }}>{t('review.cancel')}</span></button>
              <button
                onClick={submit}
                disabled={submitting}
                style={{ ...btnStyle, borderColor: 'var(--phosphor)', color: 'var(--phosphor)', opacity: submitting ? 0.5 : 1 }}
              >
                <span style={{ textTransform: 'uppercase' }}>{submitting ? t('review.saving') : t('review.submit')}</span>
              </button>
            </div>
          </>
        )}

        {/* ── Analyzing Phase ── */}
        {phase === 'analyzing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px 0' }}>
            <Sparkles size={24} style={{ color: 'var(--ice)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
              {t('review.analyzing')}
            </span>
          </div>
        )}

        {/* ── Suggestions Phase ── */}
        {phase === 'suggestions' && (
          <>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.06em' }}>
              {t('review.suggestions_desc')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', marginBottom: '16px' }}>
              {suggestions.map(sug => (
                <div
                  key={sug.id}
                  onClick={() => toggleSuggestion(sug.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    padding: '10px 12px',
                    background: accepted.has(sug.id) ? 'var(--surface-1)' : 'var(--surface-0)',
                    border: `1px solid ${accepted.has(sug.id) ? 'var(--border-bright)' : 'var(--border)'}`,
                    borderRadius: '3px', cursor: 'pointer',
                    opacity: accepted.has(sug.id) ? 1 : 0.5,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0, marginTop: '1px',
                    border: `1px solid ${accepted.has(sug.id) ? 'var(--phosphor)' : 'var(--border)'}`,
                    background: accepted.has(sug.id) ? 'var(--phosphor)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', color: 'var(--surface-0)',
                  }}>
                    {accepted.has(sug.id) && '\u2713'}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      {/* Target badge */}
                      <span style={{
                        fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase',
                        padding: '2px 6px', borderRadius: '2px',
                        background: sug.target === 'TEAM_GUIDE' ? 'var(--ice)18' : 'var(--phosphor)18',
                        color: sug.target === 'TEAM_GUIDE' ? 'var(--ice)' : 'var(--phosphor)',
                        border: `1px solid ${sug.target === 'TEAM_GUIDE' ? 'var(--ice)' : 'var(--phosphor)'}40`,
                      }}>
                        {sug.target === 'TEAM_GUIDE' ? t('review.suggestion_target_guide') : sug.target}
                      </span>
                      {/* Action badge */}
                      <span style={{
                        fontSize: '8px', letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: ACTION_COLORS[sug.action] ?? 'var(--text-muted)',
                      }}>
                        {t(`review.suggestion_action_${sug.action}`)}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '2px' }}>
                      {sug.rule}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      {sug.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={onSubmitted} style={{ ...btnStyle, color: 'var(--text-muted)' }}>
                <span style={{ textTransform: 'uppercase' }}>{t('review.skip_suggestions')}</span>
              </button>
              <button
                onClick={applySelected}
                disabled={applying}
                style={{ ...btnStyle, borderColor: 'var(--phosphor)', color: 'var(--phosphor)', opacity: applying ? 0.5 : 1 }}
              >
                <span style={{ textTransform: 'uppercase' }}>
                  {applying ? t('review.applying') : t('review.apply_selected', { count: accepted.size })}
                </span>
              </button>
            </div>
          </>
        )}

        {/* ── Done Phase ── */}
        {phase === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px 0' }}>
            <span style={{ fontSize: '11px', color: 'var(--phosphor)', letterSpacing: '0.1em' }}>
              {suggestions.length > 0 ? t('review.applied') : t('review.saved_no_suggestions')}
            </span>
            <button onClick={onSubmitted} style={{
              ...btnStyle, background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', marginTop: '8px',
            }}>
              {t('review.close')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: '6px' }}>{label}</div>
      {children}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%', appearance: 'none',
  background: 'var(--surface-1)', border: '1px solid var(--border)',
  borderRadius: '3px', padding: '6px 10px',
  color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '10px',
  cursor: 'pointer', outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '6px 16px', background: 'transparent',
  border: '1px solid var(--border)', borderRadius: '3px',
  cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '9px',
  letterSpacing: '0.1em',
};
