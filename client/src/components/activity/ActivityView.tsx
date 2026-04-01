import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TeamDetail, AgentMessage, CommLogResponse, TaskChangeEvent, TimelineResponse } from '../../types';
import type { PendingHumanRequests } from '../../hooks/usePendingHumanRequests';
import { useAgentRespond } from '../../hooks/useAgentRespond';
import ActivityItem, { type ActivityEntry, mergeActivityEntries } from './ActivityItem';
import MessageBubble from '../commlog/MessageBubble';
import { agentColor } from '../../utils/agentColors';
import CRTEmptyState from '../shared/CRTEmptyState';

// ─── Data hooks ──────────────────────────────────────────────────────────────

function useCommLog(teamId: string) {
  const [data, setData] = useState<CommLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      try {
        const res = await fetch(`/api/teams/${teamId}/messages`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    }
    setLoading(true); fetch_();
    const interval = setInterval(fetch_, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);
  return { data, loading };
}

function useTimeline(teamId: string) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      try {
        const res = await fetch(`/api/teams/${teamId}/timeline`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    }
    setLoading(true); fetch_();
    const interval = setInterval(fetch_, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);
  return { data, loading };
}

// ─── Filter types ────────────────────────────────────────────────────────────

type StreamFilter = 'all' | 'comms' | 'events';
type TypeFilter = 'all' | 'human' | 'message' | 'plan' | 'task' | 'shutdown' | 'broadcast' | 'idle' | 'status_change';

interface TypeFilterOpt {
  id: TypeFilter;
  label: string;
  color: string;
  stream: 'comms' | 'events' | 'both';
  parsedTypes: string[];
}

function buildTypeFilterOpts(t: (key: string) => string): TypeFilterOpt[] {
  return [
    { id: 'all',           label: t('activity.type_all'),          color: 'var(--text-secondary)', stream: 'both',   parsedTypes: [] },
    { id: 'human',         label: t('activity.type_human'),        color: 'var(--amber)',          stream: 'comms',  parsedTypes: ['human_input_request'] },
    { id: 'message',       label: t('activity.type_dm'),           color: 'var(--ice)',            stream: 'comms',  parsedTypes: ['message', ''] },
    { id: 'broadcast',     label: t('activity.type_broadcast'),    color: 'var(--phosphor)',       stream: 'comms',  parsedTypes: ['broadcast'] },
    { id: 'plan',          label: t('activity.type_plan'),         color: 'var(--amber)',          stream: 'comms',  parsedTypes: ['plan_approval_request', 'plan_approval_response'] },
    { id: 'task',          label: t('activity.type_task'),         color: 'var(--ice)',            stream: 'comms',  parsedTypes: ['task_assignment'] },
    { id: 'shutdown',      label: t('activity.type_shutdown'),     color: 'var(--crimson)',        stream: 'comms',  parsedTypes: ['shutdown_request', 'shutdown_response'] },
    { id: 'idle',          label: t('activity.type_idle'),         color: 'var(--text-muted)',     stream: 'comms',  parsedTypes: ['idle_notification'] },
    { id: 'status_change', label: t('activity.type_status'),       color: 'var(--phosphor)',       stream: 'events', parsedTypes: [] },
  ];
}

// ─── Main view ───────────────────────────────────────────────────────────────

type SortOrder = 'desc' | 'asc';

interface ActivityViewProps {
  teamId: string;
  teamDetail: TeamDetail | null;
  onMessagesChange?: (messages: AgentMessage[]) => void;
  onEventsChange?: (events: TaskChangeEvent[]) => void;
  pendingHumanRequests?: PendingHumanRequests;
}

export default function ActivityView({ teamId, teamDetail, onMessagesChange, onEventsChange, pendingHumanRequests }: ActivityViewProps) {
  const { t } = useTranslation();
  const { data: commData, loading: commLoading } = useCommLog(teamId);
  const { data: timeData, loading: timeLoading } = useTimeline(teamId);

  const [activeAgent, setActiveAgent] = useState<string>('ALL');
  const [streamFilter, setStreamFilter] = useState<StreamFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [order, setOrder] = useState<SortOrder>('desc');
  const [expandedRespond, setExpandedRespond] = useState<string | null>(null);
  const [respondText, setRespondText] = useState('');
  const [sentAgent, setSentAgent] = useState<string | null>(null);
  const { respond, sending } = useAgentRespond(teamId);

  // Auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevCountRef = useRef(0);

  const loading = commLoading || timeLoading;
  const teamName = teamDetail?.name ?? teamId;
  const messages: AgentMessage[] = commData?.messages ?? [];
  const events: TaskChangeEvent[] = timeData?.events ?? [];
  const TYPE_FILTER_OPTS = useMemo(() => buildTypeFilterOpts(t), [t]);

  // Unique agent names from both streams
  const agentNames = useMemo(() => {
    const s = new Set<string>();
    for (const m of messages) { s.add(m.sender); s.add(m.recipient); }
    for (const e of events) { if (e.owner) s.add(e.owner); }
    s.delete('');
    return [...s].sort();
  }, [messages, events]);

  // Merge + sort
  const merged = useMemo(() => {
    const raw = mergeActivityEntries(messages, events);
    return raw.sort((a, b) =>
      order === 'asc'
        ? a.timestamp.localeCompare(b.timestamp)
        : b.timestamp.localeCompare(a.timestamp)
    );
  }, [messages, events, order]);

  // Filter pipeline
  const filtered = useMemo(() => {
    return merged.filter(entry => {
      // Stream filter
      if (streamFilter === 'comms' && entry.kind !== 'message') return false;
      if (streamFilter === 'events' && entry.kind !== 'event') return false;

      // Agent filter
      if (activeAgent !== 'ALL') {
        if (entry.kind === 'message') {
          const m = entry.data as AgentMessage;
          if (m.sender !== activeAgent && m.recipient !== activeAgent) return false;
        } else {
          const e = entry.data as TaskChangeEvent;
          if (e.owner !== activeAgent) return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all') {
        const opt = TYPE_FILTER_OPTS.find(o => o.id === typeFilter);
        if (opt) {
          if (opt.id === 'status_change') {
            if (entry.kind !== 'event') return false;
          } else {
            if (entry.kind !== 'message') return false;
            const m = entry.data as AgentMessage;
            if (!opt.parsedTypes.includes(m.parsedType ?? '')) return false;
          }
        }
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (entry.kind === 'message') {
          const m = entry.data as AgentMessage;
          if (!m.text.toLowerCase().includes(q) && !m.sender.toLowerCase().includes(q) && !m.recipient.toLowerCase().includes(q)) return false;
        } else {
          const e = entry.data as TaskChangeEvent;
          if (!e.taskSubject.toLowerCase().includes(q) && !(e.owner ?? '').toLowerCase().includes(q)) return false;
        }
      }

      return true;
    });
  }, [merged, streamFilter, activeAgent, typeFilter, searchQuery, TYPE_FILTER_OPTS]);

  // Expose to parent for export
  useEffect(() => { onMessagesChange?.(messages); }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onEventsChange?.(events); }, [events.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // New count tracking
  useEffect(() => {
    const currentCount = filtered.length;
    if (currentCount > prevCountRef.current && !isFollowing) {
      setNewCount(n => n + (currentCount - prevCountRef.current));
    }
    prevCountRef.current = currentCount;
  }, [filtered.length, isFollowing]);

  // Auto-scroll
  useEffect(() => {
    if (isFollowing && scrollRef.current) {
      if (order === 'desc') scrollRef.current.scrollTop = 0;
      else scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setNewCount(0);
    }
  }, [filtered.length, isFollowing, order]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (order === 'desc') {
      if (el.scrollTop > 60) setIsFollowing(false);
      else { setIsFollowing(true); setNewCount(0); }
    } else {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (dist > 60) setIsFollowing(false);
      else { setIsFollowing(true); setNewCount(0); }
    }
  }, [order]);

  const jumpToNewest = () => {
    if (scrollRef.current) {
      if (order === 'desc') scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      else scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
    setIsFollowing(true);
    setNewCount(0);
  };

  // Filtered type opts based on stream filter
  const visibleTypeOpts = TYPE_FILTER_OPTS.filter(opt => {
    if (opt.id === 'all') return true;
    if (streamFilter === 'comms') return opt.stream === 'comms' || opt.stream === 'both';
    if (streamFilter === 'events') return opt.stream === 'events' || opt.stream === 'both';
    return true;
  });

  // Stats
  const msgCount = filtered.filter(e => e.kind === 'message').length;
  const evtCount = filtered.filter(e => e.kind === 'event').length;

  return (
    <>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 100px)',
      minHeight: '280px',
    }}>
      {/* ── Single panel ── */}
      <div style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
        flex: 1,
      }}>
        {/* Panel header */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {t('activity.title', { name: teamName.toUpperCase() })}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Stream toggle: All / Comms / Events */}
            <div style={{ display: 'flex', gap: '2px' }}>
              <StreamBtn active={streamFilter === 'all'} onClick={() => { setStreamFilter('all'); setTypeFilter('all'); }} label={t('activity.stream_all')} />
              <StreamBtn active={streamFilter === 'comms'} onClick={() => { setStreamFilter('comms'); if (typeFilter === 'status_change') setTypeFilter('all'); }} label={t('activity.stream_comms')} />
              <StreamBtn active={streamFilter === 'events'} onClick={() => { setStreamFilter('events'); setTypeFilter('all'); }} label={t('activity.stream_events')} />
            </div>

            <div style={{ width: '1px', height: '14px', background: 'var(--border)' }} />

            {/* Order */}
            <div style={{ display: 'flex', gap: '2px' }}>
              <StreamBtn active={order === 'desc'} onClick={() => { setOrder('desc'); setIsFollowing(true); }} label={t('activity.new_old')} />
              <StreamBtn active={order === 'asc'} onClick={() => { setOrder('asc'); setIsFollowing(true); }} label={t('activity.old_new')} />
            </div>

            {/* Follow */}
            <button
              onClick={() => { setIsFollowing(f => !f); if (!isFollowing) jumpToNewest(); }}
              title={isFollowing ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '3px 8px',
                background: isFollowing ? 'var(--active-bg-med)' : 'transparent',
                border: `1px solid ${isFollowing ? 'var(--active-border)' : 'var(--border)'}`,
                borderRadius: '3px', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', letterSpacing: '0.1em',
                color: isFollowing ? 'var(--active-text)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: isFollowing ? 'var(--phosphor)' : 'var(--text-muted)',
                boxShadow: isFollowing ? '0 0 5px var(--phosphor)' : 'none',
                animation: isFollowing ? 'status-pulse 2s ease-in-out infinite' : 'none',
                display: 'inline-block',
              }} />
              <span style={{ textTransform: 'uppercase' }}>{t('activity.follow')}</span>
            </button>

            {!loading && (
              <div style={{ display: 'flex', gap: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                <span>{msgCount}<span style={{ opacity: 0.5 }}>M</span></span>
                <span>{evtCount}<span style={{ opacity: 0.5 }}>E</span></span>
              </div>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-0)', flexShrink: 0,
        }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '10px', color: 'var(--text-muted)', pointerEvents: 'none',
            }}>⌕</span>
            <input
              type="text"
              placeholder={t('activity.search')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '5px 8px 5px 24px',
                background: 'var(--surface-1)',
                border: '1px solid var(--border)', borderRadius: '3px',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                letterSpacing: '0.1em', color: 'var(--text-primary)',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--border-bright)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1, padding: '0 2px',
                }}
              >×</button>
            )}
          </div>
        </div>

        {/* Agent filter chips */}
        <div style={{
          display: 'flex', gap: '4px', padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-0)', flexShrink: 0, overflowX: 'auto',
        }}>
          {['ALL', ...agentNames].map(agent => {
            const isActive = activeAgent === agent;
            const color = agent === 'ALL' ? 'var(--text-secondary)' : agentColor(agent);
            return (
              <button
                key={agent}
                onClick={() => setActiveAgent(agent)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '3px 9px',
                  border: `1px solid ${isActive ? (agent === 'ALL' ? 'var(--active-border)' : color + '55') : 'var(--border)'}`,
                  borderRadius: '20px',
                  background: isActive ? (agent === 'ALL' ? 'var(--active-bg-med)' : color + '1a') : 'transparent',
                  color: isActive ? (agent === 'ALL' ? 'var(--active-text)' : color) : 'var(--text-muted)',
                  fontSize: 'var(--text-xs)', letterSpacing: '0.08em',
                  fontFamily: 'var(--font-mono)', cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {agent !== 'ALL' && (
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: color, flexShrink: 0,
                    boxShadow: isActive ? `0 0 4px ${color}` : 'none',
                  }} />
                )}
                {agent === 'ALL' ? t('activity.agents') : agent}
              </button>
            );
          })}
        </div>

        {/* Type filter chips */}
        <div style={{
          display: 'flex', gap: '4px', padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-0)', flexShrink: 0, overflowX: 'auto',
        }}>
          {visibleTypeOpts.map(opt => {
            const isActive = typeFilter === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setTypeFilter(opt.id)}
                style={{
                  padding: '3px 9px',
                  border: `1px solid ${isActive ? opt.color : 'var(--border)'}`,
                  borderRadius: '20px',
                  background: isActive ? opt.color + '1a' : 'transparent',
                  color: isActive ? opt.color : 'var(--text-muted)',
                  fontSize: 'var(--text-xs)', letterSpacing: '0.12em',
                  fontFamily: 'var(--font-mono)', cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                  boxShadow: isActive ? `0 0 6px ${opt.color}33` : 'none',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Human-input alert banner — inline respond */}
        {(pendingHumanRequests?.count ?? 0) > 0 && (
          <div style={{
            borderBottom: '1px solid var(--amber-dim)',
            background: 'var(--amber-glow)',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 14px',
            }}>
              <span style={{ fontSize: '13px', lineHeight: 1 }}>⚠</span>
              <span style={{ flex: 1, fontSize: 'var(--text-xs)', color: 'var(--amber)', letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase' }}>
                {t('activity.pending_alert', { count: pendingHumanRequests!.count })}
              </span>
            </div>
            {pendingHumanRequests!.details.map(detail => {
              const isExpanded = expandedRespond === detail.name;
              const isSent = sentAgent === detail.name;
              return (
                <div key={detail.name} style={{ borderTop: '1px solid var(--amber-dim)' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 14px 6px 36px',
                    cursor: 'pointer',
                  }}
                    onClick={() => {
                      if (isSent) return;
                      setExpandedRespond(isExpanded ? null : detail.name);
                      setRespondText('');
                    }}
                  >
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{isExpanded ? '▾' : '▸'}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--amber)', fontWeight: 600, letterSpacing: '0.08em' }}>{detail.name}</span>
                    {detail.blocking.toolName && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>[{detail.blocking.toolName}]</span>
                    )}
                    {detail.blocking.detail && (
                      <span style={{ flex: 1, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {detail.blocking.detail.slice(0, 80)}
                      </span>
                    )}
                    {isSent && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--phosphor)', letterSpacing: '0.1em' }}>✓ Sent</span>
                    )}
                  </div>
                  {isExpanded && !isSent && (
                    <div style={{ padding: '4px 14px 8px 36px' }}>
                      <textarea
                        autoFocus
                        rows={2}
                        value={respondText}
                        onChange={e => setRespondText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') { setExpandedRespond(null); setRespondText(''); }
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && respondText.trim()) {
                            e.preventDefault();
                            respond(detail.name, respondText.trim()).then(ok => {
                              if (ok) {
                                setSentAgent(detail.name);
                                setRespondText('');
                                setTimeout(() => { setSentAgent(null); setExpandedRespond(null); }, 1500);
                              }
                            });
                          }
                        }}
                        placeholder={t('agent_card.respond_to', { name: detail.name })}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          padding: '6px 8px', resize: 'vertical',
                          background: 'var(--surface-1)', color: 'var(--text-primary)',
                          border: '1px solid var(--border)', borderRadius: '3px',
                          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', letterSpacing: '0.06em',
                          outline: 'none',
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                        <button
                          onClick={() => { setExpandedRespond(null); setRespondText(''); }}
                          style={{
                            padding: '3px 10px', fontSize: 'var(--text-xs)', letterSpacing: '0.1em',
                            fontFamily: 'var(--font-mono)',
                            background: 'transparent', color: 'var(--text-muted)',
                            border: '1px solid var(--border)', borderRadius: '2px', cursor: 'pointer',
                          }}
                        >{t('common.cancel')}</button>
                        <button
                          disabled={!respondText.trim() || sending}
                          onClick={() => {
                            if (!respondText.trim()) return;
                            respond(detail.name, respondText.trim()).then(ok => {
                              if (ok) {
                                setSentAgent(detail.name);
                                setRespondText('');
                                setTimeout(() => { setSentAgent(null); setExpandedRespond(null); }, 1500);
                              }
                            });
                          }}
                          style={{
                            padding: '3px 10px', fontSize: 'var(--text-xs)', letterSpacing: '0.1em',
                            fontFamily: 'var(--font-mono)', fontWeight: 700,
                            background: 'var(--amber-bg-subtle)', color: 'var(--amber)',
                            border: '1px solid var(--amber-dim)', borderRadius: '2px', cursor: 'pointer',
                            opacity: !respondText.trim() || sending ? 0.5 : 1,
                          }}
                        >{sending ? '...' : t('message.send')} ⏎</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Scrollable activity feed */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', position: 'relative' }}
        >
          {loading && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '40px', textAlign: 'center', textTransform: 'uppercase' }}>
              {t('common.loading')}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <CRTEmptyState
              title={searchQuery || typeFilter !== 'all' || activeAgent !== 'ALL' || streamFilter !== 'all'
                ? t('activity.no_matching')
                : t('activity.no_items')}
              subtitle={searchQuery || typeFilter !== 'all' || activeAgent !== 'ALL' || streamFilter !== 'all'
                ? t('activity.no_items_sub_filter')
                : t('activity.no_items_sub')}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filtered.map((entry, i) => (
              <ActivityItem key={entry.kind === 'message' ? (entry.data as AgentMessage).id : (entry.data as TaskChangeEvent).id} entry={entry} />
            ))}
          </div>
        </div>

        {/* Floating "N new" banner */}
        {!isFollowing && newCount > 0 && (
          <button
            onClick={jumpToNewest}
            style={{
              position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
              padding: '5px 14px',
              background: 'var(--active-bg-hi)',
              border: '1px solid var(--active-border-hi)',
              borderRadius: '20px',
              color: 'var(--active-text)',
              fontSize: 'var(--text-xs)', letterSpacing: '0.12em',
              fontFamily: 'var(--font-mono)', cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(0,0,0,0.4), 0 0 10px var(--phosphor-glow)',
              zIndex: 20, whiteSpace: 'nowrap',
              animation: 'fade-up 0.2s ease-out',
            }}
          >
            {order === 'desc' ? '↑' : '↓'} <span style={{ textTransform: 'uppercase' }}>{t('activity.new_item', { count: newCount })}</span>
          </button>
        )}
      </div>
    </div>

    </>
  );
}

// ─── Shared button ───────────────────────────────────────────────────────────

function StreamBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 7px', fontSize: 'var(--text-xs)', letterSpacing: '0.08em',
        fontFamily: 'var(--font-mono)',
        background: active ? 'var(--active-bg-med)' : 'transparent',
        color: active ? 'var(--active-text)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--active-border)' : 'transparent'}`,
        borderRadius: '2px', cursor: 'pointer', transition: 'var(--transition-fast)',
        textTransform: 'uppercase',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = active ? 'var(--active-text)' : 'var(--text-muted)'; }}
    >
      {label}
    </button>
  );
}
