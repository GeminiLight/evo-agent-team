import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Sparkles, Shield } from 'lucide-react';
import type { SupervisionRule, SupervisionConfig } from '../../types';

interface SupervisionPanelProps {
  teamId: string;
  isDemoMode?: boolean;
}

export default function SupervisionPanel({ teamId, isDemoMode }: SupervisionPanelProps) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<SupervisionRule[]>([]);
  const [threshold, setThreshold] = useState(50);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newRuleText, setNewRuleText] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ text: string; reason: string; supportCount: number }>>([]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchSupervision = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/supervision`);
      const json: SupervisionConfig = await res.json();
      setRules(json.rules ?? []);
      setThreshold(json.threshold ?? 50);
    } catch { setError('Failed to load supervision rules'); }
    finally { setLoading(false); }
  }, [teamId]);

  useEffect(() => { fetchSupervision(); }, [fetchSupervision]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = async (newRules: SupervisionRule[], newThreshold: number) => {
    if (isDemoMode) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/supervision`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: newRules, threshold: newThreshold }),
      });
      if (!res.ok) { setError('Failed to save'); return; }
      setRules(newRules);
      setThreshold(newThreshold);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  // ── Add rule ───────────────────────────────────────────────────────────────

  const handleAddRule = () => {
    if (!newRuleText.trim()) return;
    const newRule: SupervisionRule = {
      id: `sr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: newRuleText.trim(),
      source: 'manual',
      createdAt: new Date().toISOString(),
    };
    const updated = [...rules, newRule];
    save(updated, threshold);
    setNewRuleText('');
    setShowAddInput(false);
  };

  // ── Remove rule ────────────────────────────────────────────────────────────

  const handleRemoveRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    save(updated, threshold);
  };

  // ── Threshold change (debounced save) ───────────────────────────────────────

  const thresholdTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    clearTimeout(thresholdTimerRef.current);
    thresholdTimerRef.current = setTimeout(() => save(rules, val), 500);
  };

  // ── Extract suggestions ────────────────────────────────────────────────────

  const handleExtract = async () => {
    if (isDemoMode) return;
    setExtracting(true);
    setSuggestions([]);
    try {
      const res = await fetch(`/api/teams/${teamId}/supervision/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        setSuggestions(json.suggestions ?? []);
      }
    } catch { /* ignore */ }
    finally { setExtracting(false); }
  };

  // ── Accept suggestion ──────────────────────────────────────────────────────

  const handleAcceptSuggestion = (idx: number) => {
    const sug = suggestions[idx];
    const newRule: SupervisionRule = {
      id: `sr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: sug.text,
      source: 'auto',
      createdAt: new Date().toISOString(),
      supportCount: sug.supportCount,
    };
    const updated = [...rules, newRule];
    save(updated, threshold);
    setSuggestions(suggestions.filter((_, i) => i !== idx));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.1em' }}>
        LOADING SUPERVISION RULES...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={14} style={{ color: 'var(--ice)' }} />
          <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--ice)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            {t('supervision.title', 'Supervision Rules')}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            ({rules.length})
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {!isDemoMode && (
            <>
              <button
                onClick={handleExtract}
                disabled={extracting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '3px 10px', fontSize: '9px', letterSpacing: '0.1em',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  background: extracting ? 'var(--surface-2)' : 'var(--ice-bg-subtle)',
                  color: extracting ? 'var(--text-muted)' : 'var(--ice)',
                  border: `1px solid ${extracting ? 'var(--border)' : 'var(--ice)'}`,
                  borderRadius: '2px', cursor: extracting ? 'default' : 'pointer',
                }}
              >
                <Sparkles size={10} /> {extracting ? t('supervision.extracting', 'Analyzing...') : t('supervision.extract', 'Discover')}
              </button>
              <button
                onClick={() => setShowAddInput(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '3px 10px', fontSize: '9px', letterSpacing: '0.1em',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  background: 'var(--phosphor-bg-subtle)', color: 'var(--phosphor)',
                  border: '1px solid var(--phosphor)', borderRadius: '2px', cursor: 'pointer',
                }}
              >
                <Plus size={10} /> {t('supervision.add', 'Add Rule')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: '9px', color: 'var(--crimson)', letterSpacing: '0.06em', padding: '6px 10px', background: 'var(--crimson-bg-subtle)', border: '1px solid var(--crimson-border-subtle)', borderRadius: '3px' }}>
          {error}
        </div>
      )}

      {/* Threshold slider */}
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '3px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {t('supervision.threshold_label', 'Supervision Level')}
          </span>
          <span style={{ fontSize: '10px', color: threshold < 30 ? 'var(--amber)' : threshold > 70 ? 'var(--phosphor)' : 'var(--ice)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {threshold < 30 ? t('supervision.conservative', 'Conservative') : threshold > 70 ? t('supervision.autonomous', 'Autonomous') : t('supervision.balanced', 'Balanced')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.06em', flexShrink: 0 }}>
            {t('supervision.pause_often', 'Pause often')}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={threshold}
            onChange={e => handleThresholdChange(parseInt(e.target.value, 10))}
            disabled={isDemoMode}
            style={{ flex: 1, accentColor: 'var(--ice)', cursor: isDemoMode ? 'default' : 'pointer' }}
          />
          <span style={{ fontSize: '9px', color: 'var(--phosphor)', letterSpacing: '0.06em', flexShrink: 0 }}>
            {t('supervision.autonomous_short', 'Autonomous')}
          </span>
        </div>
      </div>

      {/* Add rule input */}
      {showAddInput && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <input
            autoFocus
            value={newRuleText}
            onChange={e => setNewRuleText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddRule(); if (e.key === 'Escape') { setShowAddInput(false); setNewRuleText(''); } }}
            placeholder={t('supervision.add_placeholder', 'e.g., Always ask before running npm publish')}
            style={{
              flex: 1, padding: '6px 10px', fontSize: '10px',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
              background: 'var(--surface-1)', color: 'var(--text-primary)',
              border: '1px solid var(--phosphor)', borderRadius: '3px', outline: 'none',
            }}
          />
          <button onClick={handleAddRule} disabled={!newRuleText.trim()}
            style={{
              padding: '6px 12px', fontSize: '9px', letterSpacing: '0.1em',
              fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
              background: 'var(--phosphor-bg-subtle)', color: 'var(--phosphor)',
              border: '1px solid var(--phosphor)', borderRadius: '2px',
              cursor: newRuleText.trim() ? 'pointer' : 'default', opacity: newRuleText.trim() ? 1 : 0.4,
            }}>
            {t('panel.save', 'Save')}
          </button>
          <button onClick={() => { setShowAddInput(false); setNewRuleText(''); }}
            style={{
              padding: '6px 10px', fontSize: '9px', letterSpacing: '0.1em',
              fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: '2px', cursor: 'pointer',
            }}>
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      )}

      {/* Suggestions from extraction */}
      {suggestions.length > 0 && (
        <div style={{ border: '1px solid var(--ice)33', borderRadius: '3px', padding: '10px', background: 'var(--surface-1)' }}>
          <div style={{ fontSize: '9px', color: 'var(--ice)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: '8px', textTransform: 'uppercase' }}>
            {t('supervision.suggestions', 'Suggested Rules')} ({suggestions.length})
          </div>
          {suggestions.map((sug, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0', borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{sug.text}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>{sug.reason} ({sug.supportCount} corrections)</div>
              </div>
              <button onClick={() => handleAcceptSuggestion(idx)}
                style={{
                  padding: '2px 8px', fontSize: '9px', letterSpacing: '0.08em',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  background: 'var(--phosphor-bg-subtle)', color: 'var(--phosphor)',
                  border: '1px solid var(--phosphor)', borderRadius: '2px', cursor: 'pointer', flexShrink: 0,
                }}>
                {t('supervision.accept', 'Accept')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0 && !showAddInput ? (
        <div style={{
          padding: '24px', textAlign: 'center',
          background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '3px',
        }}>
          <Shield size={20} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.5 }} />
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '4px' }}>
            {t('supervision.empty_title', 'No supervision rules yet')}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', opacity: 0.7, lineHeight: 1.5 }}>
            {t('supervision.empty_desc', 'Add rules to control when agents should pause and ask for approval. Rules are written to TEAM_GUIDE.md so agents can read them.')}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {rules.map((rule, idx) => (
            <div key={rule.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 10px',
              background: 'var(--surface-1)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${rule.source === 'auto' ? 'var(--ice)' : 'var(--phosphor)'}`,
              borderRadius: '3px',
              animation: `fade-up 0.2s ease-out ${idx * 0.03}s both`,
            }}>
              <span style={{
                fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase',
                color: rule.source === 'auto' ? 'var(--ice)' : 'var(--phosphor)',
                fontFamily: 'var(--font-mono)', flexShrink: 0,
                padding: '1px 5px', background: rule.source === 'auto' ? 'var(--ice-bg-subtle)' : 'var(--phosphor-bg-subtle)',
                border: `1px solid ${rule.source === 'auto' ? 'var(--ice)' : 'var(--phosphor)'}40`,
                borderRadius: '2px',
              }}>
                {rule.source}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-primary)', flex: 1, lineHeight: 1.4, letterSpacing: '0.02em' }}>
                {rule.text}
              </span>
              {rule.supportCount != null && (
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {rule.supportCount}x
                </span>
              )}
              {!isDemoMode && (
                <button
                  onClick={() => handleRemoveRule(rule.id)}
                  title={t('supervision.remove', 'Remove rule')}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', padding: '2px', flexShrink: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--crimson)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Saving indicator */}
      {saving && (
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em', textAlign: 'center' }}>
          {t('supervision.saving', 'Saving to TEAM_GUIDE.md...')}
        </div>
      )}
    </div>
  );
}
