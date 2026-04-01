import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Pencil, Save, X, Sparkles, Check, RotateCcw, ArrowLeftRight } from 'lucide-react';
import { renderMarkdown } from '../../utils/markdownRenderer';
import { fmtDate } from '../../utils/formatters';
import { sectionStyle, sectionHeaderStyle, sectionTitleStyle, btnStyle } from '../../utils/sharedStyles';
import KnowledgeTransfer from './KnowledgeTransfer';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemoryData {
  content: string;
  path: string | null;
  lastModified: string | null;
  source: string | null;
}

interface ExtractResult {
  suggestions: string[];
  merged: string;
}

interface MemoryViewProps {
  teamId: string;
  isDemoMode?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

type ViewState = 'viewing' | 'editing' | 'extracting' | 'previewing' | 'transferring';

export default function MemoryView({ teamId, isDemoMode }: MemoryViewProps) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ViewState>('viewing');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);

  const [extractError, setExtractError] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchMemory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/memory`);
      const json = await res.json();
      setData(json);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchMemory();
    setState('viewing');
    setExtractResult(null);
  }, [teamId, fetchMemory]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleEdit = () => {
    setEditContent(data?.content ?? '');
    setExtractError(null);
    setState('editing');
  };

  const handleCancel = () => {
    setState('viewing');
    setExtractResult(null);
    setExtractError(null);
  };

  const handleSave = async (content: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/memory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('save failed');
      await fetchMemory();
      setState('viewing');
      setExtractResult(null);
    } catch { /* stay in current state so user can retry */ } finally {
      setSaving(false);
    }
  };

  const handleExtract = async () => {
    setState('extracting');
    setExtractError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/memory/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error((errJson as { error?: string }).error || `Extract failed (${res.status})`);
      }
      const json: ExtractResult = await res.json();
      setExtractResult(json);
      setState(json.suggestions?.length > 0 ? 'previewing' : 'viewing');
    } catch (err) {
      setExtractError((err as Error).message);
      setState('viewing');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
        {t('common.loading')}
      </div>
    );
  }

  const hasContent = !!data?.content;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '800px' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Brain size={14} style={{ color: 'var(--phosphor)' }} />
        <span style={{
          fontSize: '12px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--text-primary)',
        }}>
          {t('memory.title', { id: teamId })}
        </span>
      </div>

      {/* ─── Memory Content Section ─── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>{t('memory.content')}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {state === 'viewing' && (
              <>
                <button
                  style={btnStyle('ghost')}
                  onClick={handleEdit}
                  disabled={isDemoMode}
                  title={isDemoMode ? t('memory.demo_readonly') : undefined}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <Pencil size={11} /> {t('memory.edit')}
                </button>
                <button
                  style={btnStyle('primary')}
                  onClick={handleExtract}
                  disabled={isDemoMode}
                  title={isDemoMode ? t('memory.demo_readonly') : undefined}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--phosphor-glow-strong)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--phosphor-glow)'; }}
                >
                  <Sparkles size={11} /> {t('memory.extract')}
                </button>
                <button
                  style={btnStyle('ghost')}
                  onClick={() => setState('transferring')}
                  disabled={isDemoMode}
                  title={isDemoMode ? t('memory.demo_readonly') : t('knowledge.import')}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <ArrowLeftRight size={11} /> {t('knowledge.import')}
                </button>
              </>
            )}
            {state === 'editing' && (
              <>
                <button style={btnStyle('ghost')} onClick={handleCancel}>
                  <X size={11} /> {t('memory.cancel')}
                </button>
                <button
                  style={btnStyle('primary')}
                  onClick={() => handleSave(editContent)}
                  disabled={saving}
                >
                  <Save size={11} /> {saving ? t('review.saving') : t('memory.save')}
                </button>
              </>
            )}
            {state === 'extracting' && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                <Sparkles size={11} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                {t('memory.extracting')}
              </span>
            )}
            {state === 'previewing' && (
              <>
                <button style={btnStyle('ghost')} onClick={handleCancel}>
                  <RotateCcw size={11} /> {t('memory.discard')}
                </button>
                <button
                  style={btnStyle('primary')}
                  onClick={() => handleSave(extractResult?.merged ?? data?.content ?? '')}
                  disabled={saving}
                >
                  <Check size={11} /> {saving ? t('review.saving') : t('memory.apply')}
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ padding: '14px' }}>
          {/* Editing */}
          {state === 'editing' && (
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: '400px',
                boxSizing: 'border-box',
                background: 'var(--void)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                padding: '12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                lineHeight: '1.6',
                resize: 'vertical',
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--phosphor)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          )}

          {/* Extracting spinner */}
          {state === 'extracting' && (
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
                {t('memory.extracting')}
              </span>
            </div>
          )}

          {/* Previewing extract results */}
          {state === 'previewing' && extractResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Suggestions list */}
              {extractResult.suggestions.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--phosphor)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    {t('memory.suggestions')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {extractResult.suggestions.map((s, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '6px',
                        padding: '6px 10px',
                        background: 'var(--phosphor-glow)',
                        border: '1px solid var(--phosphor)',
                        borderRadius: '3px',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.4',
                      }}>
                        <span style={{ color: 'var(--phosphor)', flexShrink: 0, fontSize: '10px' }}>+</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Merged preview */}
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  {t('memory.merged')}
                </div>
                <div style={{
                  background: 'var(--void)',
                  border: '1px solid var(--border)',
                  borderRadius: '3px',
                  padding: '12px',
                  maxHeight: '400px',
                  overflow: 'auto',
                }}>
                  {renderMarkdown(extractResult.merged)}
                </div>
              </div>
            </div>
          )}

          {/* Viewing */}
          {state === 'viewing' && (
            <>
              {extractError && (
                <div style={{ fontSize: '10px', color: 'var(--crimson, #ff4466)', marginBottom: '10px', padding: '6px 10px', background: 'var(--surface-1)', border: '1px solid var(--crimson, #ff4466)', borderRadius: '3px' }}>
                  {extractError}
                </div>
              )}
              {hasContent ? (
              <div>{renderMarkdown(data!.content)}</div>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '8px',
                padding: '40px 0',
                color: 'var(--text-muted)',
              }}>
                <Brain size={24} style={{ opacity: 0.3 }} />
                <span style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
                  {t('memory.empty')}
                </span>
              </div>
            )}
            </>
          )}

          {/* Transferring (E3: cross-team knowledge transfer) */}
          {state === 'transferring' && (
            <KnowledgeTransfer
              targetTeamId={teamId}
              onComplete={() => { fetchMemory(); setState('viewing'); }}
              onCancel={() => setState('viewing')}
              isDemoMode={isDemoMode}
            />
          )}
        </div>
      </div>

      {/* ─── Metadata Section ─── */}
      {data && (data.path || data.lastModified) && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>{t('memory.metadata')}</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.path && (
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: '80px' }}>{t('memory.path')}</span>
                <code style={{
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-1)',
                  padding: '1px 6px',
                  borderRadius: '2px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  wordBreak: 'break-all',
                }}>{data.path}</code>
              </div>
            )}
            {data.lastModified && (
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: '80px' }}>{t('memory.last_modified')}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(data.lastModified, i18n.language)}</span>
              </div>
            )}
            {data.source && (
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: '80px' }}>{t('memory.source')}</span>
                <span style={{
                  color: 'var(--phosphor)',
                  background: 'var(--phosphor-glow)',
                  padding: '1px 6px',
                  borderRadius: '2px',
                  fontSize: 'var(--text-xs)',
                  letterSpacing: '0.06em',
                }}>{data.source}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Demo mode notice */}
      {isDemoMode && (
        <div style={{
          fontSize: '10px',
          color: 'var(--amber)',
          letterSpacing: '0.06em',
          textAlign: 'center',
          padding: '4px 0',
        }}>
          {t('memory.demo_readonly')}
        </div>
      )}
    </div>
  );
}
