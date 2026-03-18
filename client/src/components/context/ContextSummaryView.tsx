import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Pencil, Save, X, Sparkles, Check, RotateCcw } from 'lucide-react';
import { renderMarkdown } from '../../utils/markdownRenderer';
import { fmtDate } from '../../utils/formatters';
import { sectionStyle, sectionHeaderStyle, sectionTitleStyle, btnStyle } from '../../utils/sharedStyles';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContextData {
  content: string;
  path: string | null;
  lastModified: string | null;
  tokenEstimate: number;
}

interface GenerateResult {
  content: string;
  tokenEstimate: number;
  sources: string[];
}

interface ContextSummaryViewProps {
  teamId: string;
  isDemoMode?: boolean;
}

const TOKEN_BUDGET = 4000;

// ── Main component ────────────────────────────────────────────────────────────

type ViewState = 'viewing' | 'editing' | 'generating' | 'previewing';

export default function ContextSummaryView({ teamId, isDemoMode }: ContextSummaryViewProps) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ViewState>('viewing');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [generatedTokens, setGeneratedTokens] = useState(0);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchContext = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/context-summary`);
      const json = await res.json();
      setData(json);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchContext();
    setState('viewing');
    setGeneratedContent('');
  }, [teamId, fetchContext]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleEdit = () => {
    setEditContent(data?.content ?? '');
    setState('editing');
  };

  const handleCancel = () => {
    setState('viewing');
    setGeneratedContent('');
  };

  const handleSave = async (content: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/context-summary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('save failed');
      await fetchContext();
      setState('viewing');
      setGeneratedContent('');
    } catch { /* stay in current state */ } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setState('generating');
    try {
      const res = await fetch(`/api/teams/${teamId}/context-summary/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json: GenerateResult = await res.json();
      if (json.content) {
        setGeneratedContent(json.content);
        setGeneratedTokens(json.tokenEstimate);
        setState('previewing');
      } else {
        setState('viewing');
      }
    } catch {
      setState('viewing');
    }
  };

  // ── Token budget bar ────────────────────────────────────────────────────

  function TokenBar({ tokens }: { tokens: number }) {
    const pct = Math.min((tokens / TOKEN_BUDGET) * 100, 100);
    const overBudget = tokens > TOKEN_BUDGET;
    const warning = pct > 75;
    const color = overBudget ? 'var(--crimson, #ff4466)' : warning ? 'var(--amber)' : 'var(--phosphor)';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '80px', height: '4px',
          background: 'var(--surface-1)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: '2px',
            transition: 'width 0.3s',
          }} />
        </div>
        <span style={{ fontSize: '9px', color, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
          ≈ {t('context.token_count', { used: tokens, limit: TOKEN_BUDGET })}
        </span>
      </div>
    );
  }

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
        <FileText size={14} style={{ color: 'var(--phosphor)' }} />
        <span style={{
          fontSize: '12px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--text-primary)',
        }}>
          {t('context.title', { id: teamId })}
        </span>
      </div>

      {/* ─── Context Summary Section ─── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={sectionTitleStyle}>{t('context.content')}</span>
            {state === 'viewing' && data && data.tokenEstimate > 0 && (
              <TokenBar tokens={data.tokenEstimate} />
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {state === 'viewing' && (
              <>
                <button
                  style={btnStyle('ghost')}
                  onClick={handleEdit}
                  disabled={isDemoMode}
                  title={isDemoMode ? t('context.demo_readonly') : undefined}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <Pencil size={11} /> {t('context.edit')}
                </button>
                <button
                  style={btnStyle('primary')}
                  onClick={handleGenerate}
                  disabled={isDemoMode}
                  title={isDemoMode ? t('context.demo_readonly') : undefined}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--phosphor-glow-strong)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--phosphor-glow)'; }}
                >
                  <Sparkles size={11} /> {t('context.generate')}
                </button>
              </>
            )}
            {state === 'editing' && (
              <>
                <button style={btnStyle('ghost')} onClick={handleCancel}>
                  <X size={11} /> {t('context.cancel')}
                </button>
                <button
                  style={btnStyle('primary')}
                  onClick={() => handleSave(editContent)}
                  disabled={saving}
                >
                  <Save size={11} /> {saving ? t('review.saving') : t('context.save')}
                </button>
              </>
            )}
            {state === 'generating' && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                <Sparkles size={11} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                {t('context.generating')}
              </span>
            )}
            {state === 'previewing' && (
              <>
                <TokenBar tokens={generatedTokens} />
                <button style={btnStyle('ghost')} onClick={handleCancel}>
                  <RotateCcw size={11} /> {t('context.discard')}
                </button>
                <button
                  style={btnStyle('primary')}
                  onClick={() => handleSave(generatedContent)}
                  disabled={saving}
                >
                  <Check size={11} /> {saving ? t('review.saving') : t('context.apply')}
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

          {/* Generating spinner */}
          {state === 'generating' && (
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
                {t('context.generating')}
              </span>
            </div>
          )}

          {/* Previewing generated content */}
          {state === 'previewing' && generatedContent && (
            <div style={{
              background: 'var(--void)',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              padding: '12px',
              maxHeight: '500px',
              overflow: 'auto',
            }}>
              {renderMarkdown(generatedContent)}
            </div>
          )}

          {/* Viewing */}
          {state === 'viewing' && (
            hasContent ? (
              <div>{renderMarkdown(data!.content)}</div>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '8px',
                padding: '40px 0',
                color: 'var(--text-muted)',
              }}>
                <FileText size={24} style={{ opacity: 0.3 }} />
                <span style={{ fontSize: '11px', letterSpacing: '0.08em', textAlign: 'center', maxWidth: '300px' }}>
                  {t('context.empty')}
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* ─── Metadata Section ─── */}
      {data && (data.path || data.lastModified) && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>{t('context.metadata')}</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.path && (
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: '80px' }}>{t('context.path')}</span>
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
                <span style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: '80px' }}>{t('context.last_modified')}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(data.lastModified, i18n.language)}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
              <span style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: '80px' }}>{t('context.token_budget')}</span>
              <TokenBar tokens={data?.tokenEstimate ?? 0} />
            </div>
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
          {t('context.demo_readonly')}
        </div>
      )}
    </div>
  );
}
