import { useState, useEffect, useRef, useCallback } from 'react';
import type { TeamDetail, AgentMessage, CommLogResponse } from '../../types';
import MessageBubble from './MessageBubble';
import { agentColor } from '../../utils/agentColors';

// ─── Data hook ────────────────────────────────────────────────────────────────
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
    setLoading(true);
    fetch_();
    const interval = setInterval(fetch_, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return { data, loading };
}

// ─── Message type filter options ──────────────────────────────────────────────
type TypeFilter = 'all' | 'human' | 'message' | 'plan' | 'task' | 'shutdown' | 'broadcast' | 'idle';

const TYPE_FILTER_OPTS: { id: TypeFilter; label: string; color: string; parsedTypes: string[] }[] = [
  { id: 'all',      label: 'ALL',       color: 'var(--text-secondary)', parsedTypes: [] },
  { id: 'human',    label: '⚠ HUMAN',  color: 'var(--amber)',          parsedTypes: ['human_input_request'] },
  { id: 'message',  label: 'MSG',       color: 'var(--ice)',            parsedTypes: ['message', ''] },
  { id: 'plan',     label: 'PLAN',      color: 'var(--amber)',          parsedTypes: ['plan_approval_request', 'plan_approval_response'] },
  { id: 'task',     label: 'TASK',      color: 'var(--ice)',            parsedTypes: ['task_assignment'] },
  { id: 'shutdown', label: 'SHUTDOWN',  color: 'var(--crimson)',        parsedTypes: ['shutdown_request', 'shutdown_response'] },
  { id: 'broadcast',label: 'BROADCAST', color: 'var(--phosphor)',       parsedTypes: ['broadcast'] },
  { id: 'idle',     label: 'IDLE',      color: 'var(--text-muted)',     parsedTypes: ['idle_notification'] },
];

// ─── Threading: group consecutive messages from same sender to same recipient ─
interface MessageGroup {
  key: string;
  sender: string;
  recipient: string;
  messages: AgentMessage[];
  collapsed: boolean;
}

function groupMessages(msgs: AgentMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const msg of msgs) {
    const last = groups[groups.length - 1];
    if (last && last.sender === msg.sender && last.recipient === msg.recipient && last.messages.length < 8) {
      last.messages.push(msg);
    } else {
      groups.push({
        key: msg.id,
        sender: msg.sender,
        recipient: msg.recipient,
        messages: [msg],
        collapsed: false,
      });
    }
  }
  return groups;
}

// ─── Thread component ──────────────────────────────────────────────────────────
function MessageThread({ group }: { group: MessageGroup }) {
  const [collapsed, setCollapsed] = useState(group.messages.length > 3);
  const isMulti = group.messages.length > 1;
  const senderColor = agentColor(group.sender);

  if (!isMulti) {
    return <MessageBubble message={group.messages[0]} />;
  }

  const head = group.messages[0];
  const tail = group.messages.slice(1);
  const hiddenCount = tail.length;

  return (
    <div style={{
      background: 'var(--surface-1)',
      border: `1px solid ${senderColor}22`,
      borderLeft: `2px solid ${senderColor}55`,
      borderRadius: '3px',
      marginBottom: '2px',
      overflow: 'hidden',
    }}>
      {/* Always show first message */}
      <MessageBubble message={head} />

      {/* Collapsed: show "N more" toggle */}
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            width: '100%', padding: '4px 10px 4px 40px',
            background: 'transparent',
            border: 'none', borderTop: `1px solid ${senderColor}15`,
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px', color: senderColor,
            letterSpacing: '0.1em',
            textAlign: 'left',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = senderColor + '0d'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ opacity: 0.6 }}>▶</span>
          {hiddenCount} MORE MESSAGE{hiddenCount !== 1 ? 'S' : ''}
        </button>
      ) : (
        <>
          {tail.map(msg => (
            <MessageBubble key={msg.id} message={msg} compact />
          ))}
          <button
            onClick={() => setCollapsed(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              width: '100%', padding: '4px 10px 4px 40px',
              background: 'transparent',
              border: 'none', borderTop: `1px solid ${senderColor}15`,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px', color: 'var(--text-muted)',
              letterSpacing: '0.1em',
              textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ opacity: 0.6 }}>▲</span>
            COLLAPSE
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
interface CommLogViewProps {
  teamId: string;
  teamDetail: TeamDetail | null;
  onMessagesChange?: (messages: AgentMessage[]) => void;
}

export default function CommLogView({ teamId, teamDetail, onMessagesChange }: CommLogViewProps) {
  const { data, loading } = useCommLog(teamId);

  const [activeAgent, setActiveAgent] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-scroll state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevCountRef = useRef(0);
  const isUserScrollingRef = useRef(false);

  const teamName = teamDetail?.name ?? teamId;
  const agentNames = data?.agentNames ?? [];
  const allMessages: AgentMessage[] = data?.messages ?? [];

  // Sort oldest-first (bottom = newest, natural chat order)
  const sorted = [...allMessages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Filter pipeline
  const filtered = sorted.filter(msg => {
    // Agent filter
    if (activeAgent !== 'ALL' && msg.sender !== activeAgent && msg.recipient !== activeAgent) return false;

    // Type filter
    if (typeFilter !== 'all') {
      const opt = TYPE_FILTER_OPTS.find(o => o.id === typeFilter);
      if (opt) {
        const msgType = msg.parsedType ?? '';
        if (!opt.parsedTypes.includes(msgType)) return false;
      }
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !msg.text.toLowerCase().includes(q) &&
        !msg.sender.toLowerCase().includes(q) &&
        !msg.recipient.toLowerCase().includes(q)
      ) return false;
    }

    return true;
  });

  const groups = groupMessages(filtered);

  // Unread human-input requests across ALL messages (not just filtered)
  const pendingHumanRequests = allMessages.filter(
    m => m.parsedType === 'human_input_request' && !m.read
  );

  // Expose current filtered messages to parent for export
  useEffect(() => { onMessagesChange?.(filtered); }, [filtered.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track new messages for the "N new" banner
  useEffect(() => {
    const currentCount = filtered.length;
    if (currentCount > prevCountRef.current && !isFollowing) {
      setNewCount(n => n + (currentCount - prevCountRef.current));
    }
    prevCountRef.current = currentCount;
  }, [filtered.length, isFollowing]);

  // Auto-scroll to bottom when following
  useEffect(() => {
    if (isFollowing && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setNewCount(0);
    }
  }, [filtered.length, isFollowing]);

  // Detect user scroll — pause following if scrolled up
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 60) {
      setIsFollowing(false);
    } else {
      setIsFollowing(true);
      setNewCount(0);
    }
  }, []);

  const jumpToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
    setIsFollowing(true);
    setNewCount(0);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr',
      gap: '16px',
      height: 'calc(100vh - 100px)',
      maxHeight: '780px',
    }}>
      {/* ── Left sidebar: agent filter ── */}
      <div style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border)',
          fontSize: '8px', letterSpacing: '0.18em', color: 'var(--text-muted)',
        }}>
          AGENTS
        </div>
        <div style={{ overflowY: 'auto', padding: '6px' }}>
          {['ALL', ...agentNames].map(agent => {
            const isActive = activeAgent === agent;
            const color = agent === 'ALL' ? 'var(--text-secondary)' : agentColor(agent);
            return (
              <button
                key={agent}
                onClick={() => setActiveAgent(agent)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  width: '100%', textAlign: 'left',
                  padding: '5px 8px', marginBottom: '2px',
                  fontSize: '10px', letterSpacing: '0.06em',
                  fontFamily: 'var(--font-mono)',
                  background: isActive ? (agent === 'ALL' ? 'var(--active-bg-med)' : color + '1a') : 'transparent',
                  color: isActive ? (agent === 'ALL' ? 'var(--active-text)' : color) : 'var(--text-muted)',
                  border: `1px solid ${isActive ? (agent === 'ALL' ? 'var(--active-border)' : color + '55') : 'transparent'}`,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {agent !== 'ALL' && (
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: color, flexShrink: 0,
                    boxShadow: isActive ? `0 0 5px ${color}` : 'none',
                  }} />
                )}
                {agent.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Panel header */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
            COMMS // {teamName.toUpperCase()}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Follow toggle */}
            <button
              onClick={() => { setIsFollowing(f => !f); if (!isFollowing) jumpToBottom(); }}
              title={isFollowing ? 'Auto-scroll ON — click to pause' : 'Auto-scroll OFF — click to follow'}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '3px 8px',
                background: isFollowing ? 'var(--active-bg-med)' : 'transparent',
                border: `1px solid ${isFollowing ? 'var(--active-border)' : 'var(--border)'}`,
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '8px', letterSpacing: '0.1em',
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
              FOLLOW
            </button>
            {!loading && (
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                {filtered.length} MSG{filtered.length !== 1 ? 'S' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-0)',
          flexShrink: 0,
        }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '10px', color: 'var(--text-muted)', pointerEvents: 'none',
            }}>⌕</span>
            <input
              type="text"
              placeholder="SEARCH MESSAGES..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '5px 8px 5px 24px',
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.1em',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
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
                  color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1,
                  padding: '0 2px',
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Type filter chips */}
        <div style={{
          display: 'flex', gap: '4px', padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-0)',
          flexShrink: 0,
          overflowX: 'auto',
        }}>
          {TYPE_FILTER_OPTS.map(opt => {
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
                  fontSize: '8px', letterSpacing: '0.12em',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                  boxShadow: isActive ? `0 0 6px ${opt.color}33` : 'none',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Human-input alert banner */}
        {pendingHumanRequests.length > 0 && (
          <div
            onClick={() => setTypeFilter('human')}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 14px',
              background: 'var(--amber-glow)',
              borderBottom: '1px solid var(--amber-dim)',
              cursor: 'pointer',
              flexShrink: 0,
              animation: 'status-pulse 2s ease-in-out infinite',
            }}
          >
            <span style={{ fontSize: '13px', lineHeight: 1 }}>⚠</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.12em', fontWeight: 700 }}>
                {pendingHumanRequests.length} AGENT{pendingHumanRequests.length !== 1 ? 'S' : ''} AWAITING YOUR INPUT
              </span>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pendingHumanRequests.map(m => m.sender).join(', ')}
              </div>
            </div>
            <span style={{ fontSize: '8px', color: 'var(--amber)', letterSpacing: '0.1em', flexShrink: 0 }}>VIEW →</span>
          </div>
        )}

        {/* Message scroll area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', padding: '8px', position: 'relative' }}
        >
          {loading && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '40px', textAlign: 'center' }}>
              LOADING...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '40px', textAlign: 'center' }}>
              {searchQuery || typeFilter !== 'all' || activeAgent !== 'ALL'
                ? '— NO MATCHING MESSAGES —'
                : '— NO MESSAGES —'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {groups.map(group => (
              <MessageThread key={group.key} group={group} />
            ))}
          </div>
        </div>

        {/* Floating "N new messages" banner */}
        {!isFollowing && newCount > 0 && (
          <button
            onClick={jumpToBottom}
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '5px 14px',
              background: 'var(--active-bg-hi)',
              border: '1px solid var(--active-border-hi)',
              borderRadius: '20px',
              color: 'var(--active-text)',
              fontSize: '9px', letterSpacing: '0.12em',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(0,0,0,0.4), 0 0 10px var(--phosphor-glow)',
              zIndex: 20,
              whiteSpace: 'nowrap',
              animation: 'fade-up 0.2s ease-out',
            }}
          >
            ↓ {newCount} NEW MESSAGE{newCount !== 1 ? 'S' : ''}
          </button>
        )}
      </div>
    </div>
  );
}
