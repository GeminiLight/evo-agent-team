import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle2, Loader2, Clock, Lock, ChevronDown, ChevronRight, Pencil, Check, RotateCcw } from 'lucide-react';
import type { TeamMember, Task, AgentSessionStats } from '../types';
import { getTaskStatus, STATUS_COLORS, type StatusKey } from '../utils/statusColors';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface AgentProfilePanelProps {
  member: TeamMember;
  tasks: Task[];
  teamId: string;
  isLead?: boolean;
  sessionStats?: AgentSessionStats;
  onClose: () => void;
  onPromptSaved?: (agentName: string, newPrompt: string) => void;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

const STATUS_LABELS: Record<StatusKey, string> = {
  completed: 'DONE',
  in_progress: 'ACTIVE',
  pending: 'QUEUE',
  blocked: 'BLOCKED',
};

// Map agent color strings to CSS vars / hex values
const AGENT_COLOR_MAP: Record<string, string> = {
  blue:   '#5bc8f5',
  green:  '#39ff6a',
  yellow: '#facc15',
  red:    '#ff3b5c',
  purple: '#c084fc',
  cyan:   '#22d3ee',
  orange: '#fb923c',
  pink:   '#f472b6',
};

function agentAccentColor(color?: string): string {
  if (!color) return 'var(--phosphor)';
  return AGENT_COLOR_MAP[color.toLowerCase()] ?? color;
}

function StatusIcon({ status }: { status: StatusKey }) {
  const size = 11;
  if (status === 'completed')  return <CheckCircle2 size={size} style={{ color: 'var(--phosphor)', flexShrink: 0 }} />;
  if (status === 'in_progress') return <Loader2     size={size} style={{ color: 'var(--amber)',   flexShrink: 0, animation: 'spin-slow 2.5s linear infinite' }} />;
  if (status === 'blocked')    return <Lock         size={size} style={{ color: 'var(--crimson)', flexShrink: 0 }} />;
  return <Clock size={size} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono = false, accent }: { label: string; value: React.ReactNode; mono?: boolean; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', flexShrink: 0, paddingTop: '1px', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '10px', color: accent ?? 'var(--text-secondary)', fontFamily: mono ? 'var(--font-mono)' : undefined, letterSpacing: mono ? '0.04em' : undefined, wordBreak: 'break-all', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

export default function AgentProfilePanel({ member, tasks, teamId, isLead = false, sessionStats, onClose, onPromptSaved }: AgentProfilePanelProps) {
  const { t } = useTranslation();
  const panelRef = useFocusTrap<HTMLDivElement>();
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(member.prompt ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) { setEditing(false); setDraftPrompt(member.prompt ?? ''); }
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, editing, member.prompt]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${encodeURIComponent(member.name)}/prompt`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: draftPrompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setSaveError(err.error ?? 'Save failed');
        return;
      }
      setEditing(false);
      setSaveSuccess(true);
      onPromptSaved?.(member.name, draftPrompt);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      setSaveError('Network error');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditing(false);
    setDraftPrompt(member.prompt ?? '');
    setSaveError(null);
  }

  const accent = agentAccentColor(member.color);
  const allTasksSimple = tasks.map(t => ({ id: t.id, status: t.status }));
  const assignedTasks = tasks.filter(t => t.owner === member.name);
  const activeTasks   = assignedTasks.filter(t => t.status === 'in_progress');
  const completedTasks = assignedTasks.filter(t => t.status === 'completed');
  const isActive = activeTasks.length > 0;

  const completionRate = assignedTasks.length > 0
    ? Math.round((completedTasks.length / assignedTasks.length) * 100)
    : 0;

  const joinedAtStr = member.joinedAt
    ? new Date(member.joinedAt).toLocaleString()
    : null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'var(--overlay-backdrop)', zIndex: 99 }} />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Agent profile: ${member.name}`}
        style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: '400px', maxWidth: '100vw',
        zIndex: 100,
        background: 'var(--surface-0)',
        borderLeft: `1px solid ${isActive ? `${accent}55` : 'var(--border-bright)'}`,
        display: 'flex', flexDirection: 'column',
        animation: 'slide-in-right 0.25s ease-out',
        overflowY: 'auto',
        boxShadow: isActive ? `-4px 0 30px ${accent}12` : 'none',
      }}>
        {/* Scan line when active */}
        {isActive && (
          <div style={{
            position: 'absolute', left: 0, right: 0, height: '1px',
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            opacity: 0.3, top: 0, animation: 'data-stream 4s linear infinite', pointerEvents: 'none',
          }} />
        )}

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            {t('panel.agent_profile')}
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>

          {/* Avatar + identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '6px', flexShrink: 0,
              background: `${accent}18`,
              border: `1px solid ${accent}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 700,
              color: accent,
              fontFamily: 'var(--font-display)',
              textShadow: isActive ? `0 0 16px ${accent}88` : 'none',
              animation: isActive ? 'agent-glow 2s ease-in-out infinite' : 'none',
            }}>
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                  {member.name}
                </span>
                {isLead && (
                  <span style={{
                    padding: '1px 6px', fontSize: '9px', fontWeight: 700,
                    letterSpacing: '0.12em', color: 'var(--amber)',
                    background: 'var(--amber-bg-subtle)',
                    border: '1px solid var(--amber-border-subtle)',
                    borderRadius: '2px', fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                  }}>
                    ★ LEAD
                  </span>
                )}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>
                {member.agentType}
              </div>
              {/* Status pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '10px', background: isActive ? `${accent}12` : 'var(--surface-2)', border: `1px solid ${isActive ? `${accent}40` : 'var(--border)'}` }}>
                <div style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: isActive ? accent : 'var(--text-muted)',
                  boxShadow: isActive ? `0 0 5px ${accent}` : 'none',
                  animation: isActive ? 'status-pulse 2s ease-in-out infinite' : 'none',
                }} />
                <span style={{ fontSize: '9px', color: isActive ? accent : 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  {isActive ? 'ACTIVE' : 'IDLE'}
                </span>
              </div>
            </div>
          </div>

          {/* Identity details */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px 12px' }}>
            <InfoRow label={t('panel.agent_id')}    value={member.agentId}        mono />
            {member.model       && <InfoRow label={t('panel.model')}      value={member.model}         mono accent={accent} />}
            {member.backendType && <InfoRow label={t('panel.backend')}    value={member.backendType}   mono />}
            {member.color       && (
              <InfoRow label={t('panel.color')} value={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: accent, boxShadow: `0 0 4px ${accent}`, display: 'inline-block' }} />
                  {member.color}
                </span>
              } />
            )}
            {member.planModeRequired !== undefined && (
              <InfoRow label={t('panel.plan_mode')} value={member.planModeRequired ? 'REQUIRED' : 'OPTIONAL'} accent={member.planModeRequired ? 'var(--amber)' : 'var(--text-muted)'} />
            )}
            {joinedAtStr && <InfoRow label={t('panel.joined')}    value={joinedAtStr} />}
            {member.cwd  && <InfoRow label={t('panel.cwd')}       value={member.cwd}  mono />}
          </div>

          {/* System Prompt editor */}
          <div>
            {/* Section header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <button
                onClick={() => setPromptExpanded(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {promptExpanded
                  ? <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} />
                  : <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} />
                }
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                  {t('panel.system_prompt')}
                </span>
              </button>

              {/* Edit / Save / Cancel controls */}
              {promptExpanded && !editing && (
                <button
                  onClick={() => { setEditing(true); setPromptExpanded(true); setSaveError(null); }}
                  title="Edit prompt"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: '2px', cursor: 'pointer',
                    padding: '2px 7px',
                    fontSize: '9px', letterSpacing: '0.1em',
                    color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <Pencil size={9} /> <span style={{ textTransform: 'uppercase' }}>{t('panel.edit')}</span>
                </button>
              )}

              {promptExpanded && editing && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {saveSuccess && (
                    <span style={{ fontSize: '9px', color: 'var(--color-completed)', letterSpacing: '0.1em' }}>SAVED ✓</span>
                  )}
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: '2px', cursor: 'pointer',
                      padding: '2px 7px',
                      fontSize: '9px', letterSpacing: '0.1em',
                      color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <RotateCcw size={9} /> <span style={{ textTransform: 'uppercase' }}>{t('common.cancel')}</span>
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      background: saving ? 'var(--active-bg-med)' : `${accent}20`,
                      border: `1px solid ${saving ? 'var(--border)' : accent}`,
                      borderRadius: '2px', cursor: saving ? 'default' : 'pointer',
                      padding: '2px 9px',
                      fontSize: '9px', letterSpacing: '0.1em',
                      color: saving ? 'var(--text-muted)' : accent,
                      fontFamily: 'var(--font-mono)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Check size={9} /> <span style={{ textTransform: 'uppercase' }}>{saving ? 'SAVING…' : t('panel.save')}</span>
                  </button>
                </div>
              )}
            </div>

            {promptExpanded && (
              <div style={{ animation: 'fade-up 0.15s ease-out' }}>
                {editing ? (
                  <>
                    <textarea
                      ref={textareaRef}
                      value={draftPrompt}
                      onChange={e => setDraftPrompt(e.target.value)}
                      spellCheck={false}
                      style={{
                        width: '100%',
                        minHeight: '200px',
                        maxHeight: '360px',
                        resize: 'vertical',
                        fontSize: '10px',
                        color: 'var(--text-primary)',
                        lineHeight: 1.6,
                        background: 'var(--surface-1)',
                        border: `1px solid ${saveError ? 'var(--crimson)' : accent}`,
                        borderRadius: '3px',
                        padding: '10px 12px',
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.02em',
                        outline: 'none',
                        boxSizing: 'border-box',
                        boxShadow: `0 0 0 1px ${accent}20`,
                      }}
                      onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${accent}30`; }}
                      onBlur={e => { e.currentTarget.style.boxShadow = `0 0 0 1px ${accent}20`; }}
                    />
                    {saveError && (
                      <div style={{ fontSize: '9px', color: 'var(--crimson)', marginTop: '4px', letterSpacing: '0.06em' }}>
                        ✕ {saveError}
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    onClick={() => { setEditing(true); setSaveError(null); }}
                    title="Click to edit"
                    style={{
                      fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.6,
                      background: 'var(--surface-1)', border: '1px solid var(--border)',
                      borderRadius: '3px', padding: '10px 12px',
                      fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      maxHeight: '240px', overflowY: 'auto',
                      cursor: 'text',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    {draftPrompt || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No system prompt set. Click to add one.</span>}
                  </div>
                )}
              </div>
            )}

            {/* Always show "add prompt" nudge when collapsed and no prompt */}
            {!promptExpanded && !member.prompt && (
              <div
                onClick={() => { setPromptExpanded(true); setEditing(true); }}
                style={{
                  fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em',
                  cursor: 'pointer', opacity: 0.6,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; }}
              >
                + add system prompt
              </div>
            )}
          </div>

          <div style={{ height: '1px', background: 'var(--border)' }} />

          {/* Performance stats */}
          <div>
            <SectionLabel><span style={{ textTransform: 'uppercase' }}>{t('panel.performance')}</span></SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {[
                { label: 'TOTAL',  value: assignedTasks.length,  color: 'var(--text-primary)' },
                { label: 'DONE',   value: completedTasks.length, color: 'var(--phosphor)' },
                { label: 'ACTIVE', value: activeTasks.length,    color: 'var(--amber)' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '3px', padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: '4px' }}>{s.value}</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '4px', background: 'var(--surface-2)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${completionRate}%`,
                  background: completionRate === 100 ? accent : `linear-gradient(90deg, var(--phosphor-dim), ${accent})`,
                  boxShadow: completionRate > 0 ? `0 0 6px ${accent}66` : 'none',
                  transition: 'width 0.6s ease-out',
                }} />
              </div>
              <span style={{ fontSize: '11px', color: completionRate === 100 ? accent : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600, minWidth: '36px', textAlign: 'right' }}>
                {completionRate}%
              </span>
            </div>
          </div>

          {/* Current work */}
          {activeTasks.length > 0 && (
            <div>
              <SectionLabel><span style={{ textTransform: 'uppercase' }}>{t('panel.current_work')}</span></SectionLabel>
              {activeTasks.map(t => (
                <div key={t.id} style={{
                  fontSize: '10px', color: 'var(--amber)',
                  background: 'var(--amber-glow)', border: '1px solid var(--amber-dim)',
                  borderRadius: '3px', padding: '8px 10px',
                  lineHeight: 1.5, letterSpacing: '0.02em', marginBottom: '6px',
                }}>
                  <span style={{ color: 'var(--amber-dim)', marginRight: '6px', fontSize: '9px' }}>▸ #{t.id}</span>
                  {t.activeForm || t.subject}
                </div>
              ))}
            </div>
          )}


          {/* Session stats */}
          {sessionStats && (
            <div>
              <SectionLabel><span style={{ textTransform: 'uppercase' }}>{t('panel.session_stats')}</span></SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
                {[
                  { label: 'MSGS',    value: String(sessionStats.messageCount),         color: 'var(--text-primary)' },
                  { label: 'IN TOK',  value: fmtTokens(sessionStats.inputTokens),       color: 'var(--ice)'          },
                  { label: 'OUT TOK', value: fmtTokens(sessionStats.outputTokens),      color: 'var(--amber)'        },
                ].map(s => (
                  <div key={s.label} style={{
                    background: 'var(--surface-1)', border: '1px solid var(--border)',
                    borderRadius: '3px', padding: '8px 6px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)', lineHeight: 1, marginBottom: '4px' }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {sessionStats.cacheReadTokens > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', padding: '4px 0', letterSpacing: '0.06em', borderTop: '1px solid var(--border)' }}>
                  <span>CACHE READ</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {fmtTokens(sessionStats.cacheReadTokens)}
                  </span>
                </div>
              )}
              {sessionStats.sessionDurationMs !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', padding: '4px 0', letterSpacing: '0.06em', borderTop: '1px solid var(--border)' }}>
                  <span>SESSION TIME</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {fmtDuration(sessionStats.sessionDurationMs)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div style={{ height: '1px', background: 'var(--border)' }} />

          {/* Assigned tasks list */}
          <div>
            <SectionLabel><span style={{ textTransform: 'uppercase' }}>{t('panel.assigned_tasks', { count: assignedTasks.length })}</span></SectionLabel>
            {assignedTasks.length === 0 ? (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                — NO TASKS ASSIGNED —
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {assignedTasks.map((t, idx) => {
                  const s = getTaskStatus(t, allTasksSimple);
                  const c = STATUS_COLORS[s];
                  return (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 10px',
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${c.border}`,
                      borderRadius: '3px',
                      animation: `fade-up 0.2s ease-out ${idx * 0.04}s both`,
                    }}>
                      <StatusIcon status={s} />
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '22px' }}>
                        #{t.id}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        color: s === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)',
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textDecoration: s === 'completed' ? 'line-through' : 'none',
                        letterSpacing: '0.02em',
                      }}>
                        {t.subject}
                      </span>
                      <span style={{ fontSize: '9px', color: c.text, background: c.bg, border: `1px solid ${c.border}40`, borderRadius: '2px', padding: '1px 5px', letterSpacing: '0.08em', flexShrink: 0 }}>
                        {STATUS_LABELS[s]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
