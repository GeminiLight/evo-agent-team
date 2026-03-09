import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import type { SessionMessage, SessionEntry } from '../../types';
import CRTEmptyState from '../shared/CRTEmptyState';
import MarkdownContent from '../shared/MarkdownContent';

// ── Filter types ──────────────────────────────────────────────────────────────

type RoleFilter = 'all' | 'user' | 'assistant';
type KindFilter = 'text' | 'tool_use' | 'tool_result';

const TOOL_COLORS: Record<string, string> = {
  Read:            'var(--ice)',
  Write:           'var(--phosphor)',
  Edit:            'var(--phosphor)',
  Bash:            'var(--amber)',
  Task:            'var(--amber)',
  TaskCreate:      'var(--amber)',
  TaskUpdate:      'var(--amber)',
  TodoWrite:       'var(--amber)',
  SendMessage:     '#c084fc',
  Agent:           '#c084fc',
  TeamCreate:      '#c084fc',
  AskUserQuestion: 'var(--crimson)',
  Glob:            'var(--ice)',
  Grep:            'var(--ice)',
  WebSearch:       '#38bdf8',
  WebFetch:        '#38bdf8',
};

function toolColor(name: string) {
  return TOOL_COLORS[name] ?? 'var(--text-secondary)';
}

function fmtTime(ts: string) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ts.slice(11, 19); }
}

function fmtDate(ts: string) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ts.slice(0, 10); }
}

// Summarize tool input into a one-liner
function summarizeInput(toolName: string, input: Record<string, unknown>): string {
  const vals = Object.values(input);
  if (vals.length === 0) return '';
  const first = String(vals[0]);
  // For file paths, show just the basename
  if (toolName === 'Read' || toolName === 'Write' || toolName === 'Edit' || toolName === 'Glob') {
    const parts = first.replace(/\\/g, '/').split('/');
    return parts.slice(-2).join('/');
  }
  if (toolName === 'Bash') return first.slice(0, 80);
  return first.slice(0, 80);
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface SessionHistoryViewProps {
  messages: SessionMessage[];
  sessionId: string | null;
  loading: boolean;
  teamId?: string;
  agentName?: string | null;
}

type SortOrder = 'desc' | 'asc';

export default function SessionHistoryView({ messages, sessionId, loading, teamId, agentName }: SessionHistoryViewProps) {
  const { t } = useTranslation();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [kindFilters, setKindFilters] = useState<Set<KindFilter>>(new Set(['text', 'tool_use', 'tool_result']));
  const [search, setSearch] = useState('');
  const [toolFilter, setToolFilter] = useState<string>('all');
  const [order, setOrder] = useState<SortOrder>('desc');
  const bottomRef = useRef<HTMLDivElement>(null);

  // All tool names seen
  const allTools = useMemo(() => {
    const s = new Set<string>();
    for (const m of messages)
      for (const e of m.entries)
        if (e.kind === 'tool_use' && e.toolName) s.add(e.toolName);
    return [...s].sort();
  }, [messages]);

  // Filtered messages
  const filtered = useMemo(() => {
    return messages.filter(m => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      // Check if message has any entry matching kind + tool filters
      const matchingEntries = m.entries.filter(e => {
        if (!kindFilters.has(e.kind)) return false;
        if (e.kind === 'tool_use' && toolFilter !== 'all' && e.toolName !== toolFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = [e.text, e.toolName, e.toolResultText, JSON.stringify(e.toolInput)].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      return matchingEntries.length > 0;
    });
  }, [messages, roleFilter, kindFilters, toolFilter, search]);

  function toggleKind(k: KindFilter) {
    setKindFilters(prev => {
      const next = new Set(prev);
      if (next.has(k)) { if (next.size > 1) next.delete(k); }
      else next.add(k);
      return next;
    });
  }

  // Group by date; in desc order both the group list and messages within are reversed
  const groups = useMemo(() => {
    const ordered = order === 'desc' ? [...filtered].reverse() : filtered;
    const map = new Map<string, SessionMessage[]>();
    for (const m of ordered) {
      const date = fmtDate(m.timestamp);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(m);
    }
    const entries = [...map.entries()];
    return order === 'desc' ? entries.reverse() : entries;
  }, [filtered, order]);

  if (loading && messages.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.1em' }}>
        LOADING SESSION HISTORY...
      </div>
    );
  }

  if (!loading && messages.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <CRTEmptyState title="NO SESSION HISTORY" subtitle="No leadSessionId configured" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%' }}>

      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        padding: '10px 0 14px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Session ID */}
        {sessionId && (
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
            SESSION // {sessionId.slice(0, 8)}
            <span style={{ opacity: 0.5 }}>  {messages.length} msgs  ·  {filtered.length} shown</span>
          </span>
        )}

        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />

        {/* Role filter */}
        <FilterGroup label="ROLE">
          {(['all', 'user', 'assistant'] as RoleFilter[]).map(r => (
            <FilterBtn key={r} active={roleFilter === r} onClick={() => setRoleFilter(r)}>
              <span style={{ textTransform: 'uppercase' }}>{r === 'all' ? t('history.role_all') : r === 'user' ? t('history.role_user') : t('history.role_asst')}</span>
            </FilterBtn>
          ))}
        </FilterGroup>

        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />

        {/* Kind filter */}
        <FilterGroup label="KIND">
          {(['text', 'tool_use', 'tool_result'] as KindFilter[]).map(k => (
            <FilterBtn key={k} active={kindFilters.has(k)} onClick={() => toggleKind(k)}>
              <span style={{ textTransform: 'uppercase' }}>{k === 'text' ? t('history.kind_text') : k === 'tool_use' ? t('history.kind_tool') : t('history.kind_result')}</span>
            </FilterBtn>
          ))}
        </FilterGroup>

        {/* Tool name filter */}
        {allTools.length > 0 && kindFilters.has('tool_use') && (
          <>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
            <FilterGroup label="TOOL">
              <select
                value={toolFilter}
                onChange={e => setToolFilter(e.target.value)}
                style={{
                  background: 'var(--surface-1)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', borderRadius: '2px',
                  fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                  padding: '2px 6px', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="all">ALL</option>
                {allTools.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FilterGroup>
          </>
        )}

        {/* Order toggle + Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', gap: '2px' }}>
            <OrderBtn active={order === 'desc'} onClick={() => setOrder('desc')} title="Newest first">NEW→OLD</OrderBtn>
            <OrderBtn active={order === 'asc'}  onClick={() => setOrder('asc')}  title="Oldest first">OLD→NEW</OrderBtn>
          </div>
          <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
          <Search size={11} style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('history.search')}
            style={{
              background: 'var(--surface-1)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: '2px',
              fontSize: '10px', fontFamily: 'var(--font-mono)',
              padding: '3px 8px', outline: 'none', width: '160px',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>
      </div>

      {/* ── Message list ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: '8px' }}>
        {groups.map(([date, msgs]) => (
          <div key={date}>
            {/* Date separator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 0 6px',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{date}</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            {msgs.map(m => (
              <MessageRow
                key={m.uuid}
                message={m}
                activeKinds={kindFilters}
                toolFilter={toolFilter}
                search={search}
                teamId={teamId}
                agentName={agentName}
                sessionId={sessionId}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Message row ───────────────────────────────────────────────────────────────

function MessageRow({ message, activeKinds, toolFilter, search, teamId, agentName, sessionId }: {
  message: SessionMessage;
  activeKinds: Set<KindFilter>;
  toolFilter: string;
  search: string;
  teamId?: string;
  agentName?: string | null;
  sessionId?: string | null;
}) {
  const isUser = message.role === 'user';
  const roleColor = isUser ? 'var(--ice)' : 'var(--phosphor)';
  const [hovered, setHovered] = useState(false);

  const visibleEntries = message.entries.filter(e => {
    if (!activeKinds.has(e.kind)) return false;
    if (e.kind === 'tool_use' && toolFilter !== 'all' && e.toolName !== toolFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [e.text, e.toolName, e.toolResultText, JSON.stringify(e.toolInput)].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (visibleEntries.length === 0) return null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', gap: '12px',
        padding: '6px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Role label */}
      <div style={{
        flexShrink: 0, width: '44px', paddingTop: '2px',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px',
      }}>
        <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', color: roleColor }}>
          {isUser ? 'USER' : 'ASST'}
        </span>
        <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {fmtTime(message.timestamp)}
        </span>
      </div>

      {/* Left border accent */}
      <div style={{ width: '2px', flexShrink: 0, background: `${roleColor}40`, borderRadius: '1px' }} />

      {/* Entries */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {visibleEntries.map((entry, idx) => (
          <EntryBlock key={idx} entry={entry} search={search} />
        ))}
        {/* Feedback strip — only on assistant messages */}
        {message.role === 'assistant' && teamId && agentName && (
          <FeedbackStrip
            teamId={teamId}
            agentName={agentName}
            messageUuid={message.uuid}
            sessionId={sessionId ?? null}
            rowHovered={hovered}
          />
        )}
      </div>
    </div>
  );
}

// ── Entry block ───────────────────────────────────────────────────────────────

function EntryBlock({ entry, search }: { entry: SessionEntry; search: string }) {
  const [expanded, setExpanded] = useState(false);

  if (entry.kind === 'text') {
    const text = entry.text ?? '';
    // Use markdown rendering if the text contains markdown patterns, otherwise plain text
    const hasMarkdown = /[#*`\->\[\]|]/.test(text) && text.length > 0;
    if (hasMarkdown && !search) {
      return (
        <div style={{ fontSize: '11px', lineHeight: 1.6, letterSpacing: '0.02em' }}>
          <MarkdownContent content={text} />
        </div>
      );
    }
    return (
      <div style={{
        fontSize: '11px', color: 'var(--text-primary)',
        lineHeight: 1.6, letterSpacing: '0.02em',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {highlight(text, search)}
      </div>
    );
  }

  if (entry.kind === 'tool_use') {
    const color = toolColor(entry.toolName ?? '');
    const summary = summarizeInput(entry.toolName ?? '', entry.toolInput ?? {});
    const hasInput = Object.keys(entry.toolInput ?? {}).length > 0;
    const inputJson = hasInput ? JSON.stringify(entry.toolInput, null, 2) : '';

    return (
      <div style={{
        background: 'var(--surface-1)',
        border: `1px solid ${color}30`,
        borderLeft: `3px solid ${color}`,
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div
          onClick={() => hasInput && setExpanded(e => !e)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '4px 8px',
            cursor: hasInput ? 'pointer' : 'default',
          }}
        >
          {hasInput && (
            expanded
              ? <ChevronDown size={10} style={{ color, flexShrink: 0 }} />
              : <ChevronRight size={10} style={{ color, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: '10px', fontWeight: 700, color, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
            {entry.toolName}
          </span>
          {summary && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {highlight(summary, search)}
            </span>
          )}
        </div>
        {expanded && inputJson && (
          <pre style={{
            margin: 0, padding: '6px 10px',
            fontSize: '9px', lineHeight: 1.5, color: 'var(--text-secondary)',
            background: 'var(--surface-2)',
            borderTop: `1px solid ${color}20`,
            overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            maxHeight: '300px', overflowY: 'auto',
          }}>
            {highlight(inputJson, search)}
          </pre>
        )}
      </div>
    );
  }

  if (entry.kind === 'tool_result') {
    const text = entry.toolResultText ?? '';
    const isErr = entry.isError;
    const color = isErr ? 'var(--crimson)' : 'var(--text-muted)';
    const truncated = text.length > 300;
    const [showFull, setShowFull] = useState(false);
    const display = (truncated && !showFull) ? text.slice(0, 300) + '…' : text;

    return (
      <div style={{
        background: isErr ? 'rgba(255,59,92,0.06)' : 'var(--surface-1)',
        border: `1px solid ${isErr ? 'rgba(255,59,92,0.2)' : 'var(--border)'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: '3px',
        padding: '4px 8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: text ? '3px' : 0 }}>
          <span style={{ fontSize: '8px', color, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
            {isErr ? 'ERROR' : 'RESULT'}
          </span>
          <span style={{ fontSize: '8px', color: 'var(--text-muted)', opacity: 0.5 }}>
            {entry.toolResultId?.slice(0, 16)}
          </span>
        </div>
        {text && (
          <pre style={{
            margin: 0, fontSize: '9px', lineHeight: 1.5,
            color: isErr ? 'var(--crimson)' : 'var(--text-secondary)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {highlight(display, search)}
          </pre>
        )}
        {truncated && (
          <button
            onClick={() => setShowFull(s => !s)}
            style={{ fontSize: '8px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', letterSpacing: '0.06em' }}
          >
            {showFull ? '▲ show less' : `▼ show ${text.length - 300} more chars`}
          </button>
        )}
      </div>
    );
  }

  return null;
}

// ── Feedback strip ────────────────────────────────────────────────────────────

type FeedbackType = 'praise' | 'correction' | 'bookmark';

interface FeedbackStripProps {
  teamId: string;
  agentName: string;
  messageUuid: string;
  sessionId: string | null;
  rowHovered: boolean;
}

function FeedbackStrip({ teamId, agentName, messageUuid, sessionId, rowHovered }: FeedbackStripProps) {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState<FeedbackType | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDemo = teamId === 'demo-team';
  const show = rowHovered || correcting || !!submitted;

  const submit = async (type: FeedbackType, content?: string) => {
    if (sending || isDemo) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName, messageUuid, sessionId, type, content }),
      });
      if (res.ok) {
        setSubmitted(type);
        setCorrecting(false);
        setNote('');
      } else {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? 'Failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setSending(false);
    }
  };

  const BTNS: { type: FeedbackType; icon: string; label: string; color: string; title: string }[] = [
    { type: 'praise',     icon: '👍', label: t('history.good'),  color: 'var(--phosphor)', title: 'Mark as good — this approach worked well' },
    { type: 'correction', icon: '👎', label: t('history.wrong'), color: 'var(--crimson)',  title: 'Correction — this needs rethinking' },
    { type: 'bookmark',   icon: '📌', label: t('history.mark'),  color: 'var(--ice)',      title: 'Bookmark — worth remembering this pattern' },
  ];

  return (
    <div style={{ marginTop: '2px', minHeight: '18px' }}>
      {/* Button row — appears on row hover or when correcting/submitted */}
      {show && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {submitted ? (
            <span style={{
              fontSize: '8px', color: submitted === 'praise' ? 'var(--phosphor)' : submitted === 'correction' ? 'var(--crimson)' : 'var(--ice)',
              letterSpacing: '0.1em', fontFamily: 'var(--font-mono)',
              opacity: 0.7,
            }}>
              {submitted === 'praise' ? '👍 MARKED GOOD' : submitted === 'correction' ? '👎 CORRECTION SAVED' : '📌 BOOKMARKED'}
            </span>
          ) : (
            <>
              {BTNS.map(btn => (
                <button
                  key={btn.type}
                  onClick={() => {
                    if (btn.type === 'correction') { setCorrecting(c => !c); }
                    else submit(btn.type);
                  }}
                  disabled={sending || isDemo}
                  title={isDemo ? 'Not available in demo mode' : btn.title}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '3px',
                    padding: '1px 6px',
                    fontSize: '8px', letterSpacing: '0.08em',
                    fontFamily: 'var(--font-mono)',
                    background: correcting && btn.type === 'correction' ? `${btn.color}18` : 'transparent',
                    color: isDemo ? 'var(--text-muted)' : (correcting && btn.type === 'correction' ? btn.color : 'var(--text-muted)'),
                    border: `1px solid ${correcting && btn.type === 'correction' ? btn.color + '55' : 'var(--border)'}`,
                    borderRadius: '2px',
                    cursor: (sending || isDemo) ? 'default' : 'pointer',
                    opacity: isDemo ? 0.4 : 1,
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { if (!sending && !isDemo) { e.currentTarget.style.color = btn.color; e.currentTarget.style.borderColor = btn.color + '55'; } }}
                  onMouseLeave={e => { if (!(correcting && btn.type === 'correction')) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
                >
                  <span style={{ fontSize: '9px' }}>{btn.icon}</span>
                  {btn.label}
                </button>
              ))}
              {sending && (
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>...</span>
              )}
              {error && (
                <span style={{ fontSize: '8px', color: 'var(--crimson)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>{error}</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Correction note input */}
      {correcting && !submitted && (
        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <textarea
            value={note}
            onChange={e => { setNote(e.target.value); setError(null); }}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && note.trim()) submit('correction', note); }}
            placeholder="What needs to change? (Ctrl+Enter to submit)"
            rows={2}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface-2)',
              border: `1px solid ${error ? 'var(--crimson)' : 'var(--crimson)55'}`,
              borderRadius: '3px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px', letterSpacing: '0.02em',
              padding: '5px 8px', resize: 'vertical', outline: 'none',
              minHeight: '48px',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--crimson)'; }}
            onBlur={e => { e.target.style.borderColor = error ? 'var(--crimson)' : 'var(--crimson)55'; }}
          />
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setCorrecting(false); setNote(''); setError(null); }}
              style={{
                padding: '2px 10px', fontSize: '8px', letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)',
                background: 'transparent', color: 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: '2px', cursor: 'pointer',
              }}
            >CANCEL</button>
            <button
              onClick={() => note.trim() && submit('correction', note)}
              disabled={!note.trim() || sending}
              style={{
                padding: '2px 10px', fontSize: '8px', letterSpacing: '0.08em', fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                background: 'rgba(255,59,92,0.1)', color: 'var(--crimson)',
                border: '1px solid var(--crimson)', borderRadius: '2px',
                cursor: (!note.trim() || sending) ? 'default' : 'pointer',
                opacity: (!note.trim() || sending) ? 0.4 : 1,
              }}
            >{sending ? '...' : 'SAVE'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Highlight matching search text ────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const q = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--amber-glow)', color: 'var(--amber)', borderRadius: '1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function OrderBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '2px 7px', fontSize: '8px', letterSpacing: '0.08em',
        fontFamily: 'var(--font-mono)',
        background: active ? 'var(--active-bg-med)' : 'transparent',
        color: active ? 'var(--active-text)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--active-border)' : 'transparent'}`,
        borderRadius: '2px', cursor: 'pointer', transition: 'all 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = active ? 'var(--active-text)' : 'var(--text-muted)'; }}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{label}</span>
      {children}
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 7px', fontSize: '8px', letterSpacing: '0.08em',
        fontFamily: 'var(--font-mono)',
        background: active ? 'var(--active-bg-med)' : 'transparent',
        color: active ? 'var(--active-text)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--active-border)' : 'transparent'}`,
        borderRadius: '2px', cursor: 'pointer', transition: 'all 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = active ? 'var(--active-text)' : 'var(--text-muted)'; }}
    >
      {children}
    </button>
  );
}
