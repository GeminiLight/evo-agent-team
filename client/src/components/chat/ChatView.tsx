import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Users } from 'lucide-react';
import type { TeamDetail, AgentMessage, CommLogResponse } from '../../types';
import { useAgentRespond } from '../../hooks/useAgentRespond';
import { agentColor, agentInitials } from '../../utils/agentColors';
import type { PendingHumanRequests } from '../../hooks/usePendingHumanRequests';
import MarkdownContent from '../shared/MarkdownContent';

interface ChatViewProps {
  teamId: string;
  teamDetail: TeamDetail | null;
  pendingHumanRequests?: PendingHumanRequests;
}

// ─── Data hook: fetch agent-to-agent messages ────────────────────────────────
function useGroupChat(teamId: string) {
  const [data, setData] = useState<CommLogResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(`/api/teams/${teamId}/messages`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    }
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return { data, loading };
}

// ─── Main view ──────────────────────────────────────────────────────────────
export default function ChatView({ teamId, teamDetail, pendingHumanRequests }: ChatViewProps) {
  const { t } = useTranslation();
  const { data, loading } = useGroupChat(teamId);
  const { respond, sending } = useAgentRespond(teamId);

  const [inputText, setInputText] = useState('');
  const [targetAgent, setTargetAgent] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const prevCountRef = useRef(0);

  const teamName = teamDetail?.name ?? teamId;
  const agentNames = data?.agentNames ?? [];
  const messages = useMemo(() => {
    const msgs = data?.messages ?? [];
    return [...msgs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [data?.messages]);

  const pendingAgents = pendingHumanRequests?.agentNames ?? [];

  // Auto-select first pending agent as target, or first agent
  useEffect(() => {
    if (!targetAgent || !agentNames.includes(targetAgent)) {
      if (pendingAgents.length > 0) {
        setTargetAgent(pendingAgents[0]);
      } else if (agentNames.length > 0) {
        setTargetAgent(agentNames[0]);
      }
    }
  }, [agentNames, pendingAgents, targetAgent]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > prevCountRef.current && isFollowing && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
    prevCountRef.current = messages.length;
  }, [messages.length, isFollowing]);

  // Detect user scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom > 80) {
      setIsFollowing(false);
    } else {
      setIsFollowing(true);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending || !targetAgent) return;
    setInputText('');
    await respond(targetAgent, text);
  }, [inputText, sending, targetAgent, respond]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', minHeight: '300px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
        flexShrink: 0,
      }}>
        <Users size={14} style={{ color: 'var(--phosphor)' }} />
        <span style={{
          fontSize: '11px', fontWeight: 700,
          color: 'var(--phosphor)', letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textShadow: '0 0 10px var(--phosphor-glow)',
        }}>
          {t('chat.title', { name: teamName })}
        </span>
        <span style={{ flex: 1 }} />
        {!loading && (
          <span style={{
            fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
            letterSpacing: '0.1em',
          }}>
            {messages.length} {t('chat.messages_count', 'messages')}
          </span>
        )}
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1, minHeight: 0,
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Message scroll area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            flex: 1, overflowY: 'auto',
            padding: '12px 16px',
            display: 'flex', flexDirection: 'column',
            gap: '4px',
          }}
        >
          {loading && messages.length === 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '200px', color: 'var(--text-muted)',
              fontSize: '10px', letterSpacing: '0.12em',
            }}>
              {t('common.loading', 'LOADING...')}
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              height: '200px', gap: '8px',
            }}>
              <Users size={28} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
                {t('chat.no_messages', 'No Messages')}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', opacity: 0.6 }}>
                {t('chat.group_empty_sub', 'Agent conversations will appear here in real-time')}
              </span>
            </div>
          )}
          {messages.map((msg, idx) => (
            <GroupChatBubble
              key={msg.id}
              message={msg}
              prevMessage={idx > 0 ? messages[idx - 1] : null}
              isPendingHuman={pendingAgents.includes(msg.sender)}
            />
          ))}
        </div>

        {/* Pending human input banner */}
        {pendingAgents.length > 0 && (
          <div style={{
            padding: '6px 16px',
            borderTop: '1px solid var(--amber-dim, rgba(255,191,0,0.2))',
            background: 'rgba(255,191,0,0.05)',
            display: 'flex', alignItems: 'center', gap: '8px',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '11px' }}>⚠</span>
            <span style={{
              fontSize: 'var(--text-xs)', color: 'var(--amber)',
              letterSpacing: '0.1em', fontWeight: 700,
            }}>
              {t('chat.agents_waiting', {
                names: pendingAgents.join(', '),
                defaultValue: `Waiting for your input: ${pendingAgents.join(', ')}`,
              })}
            </span>
          </div>
        )}

        {/* Input area */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: '8px',
          flexShrink: 0,
          background: 'var(--surface-1)',
        }}>
          {/* Target agent selector */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
              letterSpacing: '0.1em', marginRight: '4px',
            }}>
              {t('chat.send_to', 'SEND TO')}:
            </span>
            {agentNames.map(name => {
              const active = name === targetAgent;
              const color = agentColor(name);
              const isPending = pendingAgents.includes(name);
              return (
                <button
                  key={name}
                  onClick={() => setTargetAgent(name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px',
                    background: active ? `${color}22` : 'transparent',
                    border: `1px solid ${active ? `${color}55` : 'var(--border)'}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: active ? color : 'var(--text-muted)',
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                >
                  <span style={{
                    width: '14px', height: '14px',
                    borderRadius: '50%',
                    background: `${color}22`,
                    border: `1px solid ${color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '7px', fontWeight: 700, color,
                  }}>
                    {agentInitials(name)}
                  </span>
                  {name}
                  {isPending && (
                    <span style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: 'var(--amber)',
                      boxShadow: '0 0 4px var(--amber)',
                      animation: 'status-pulse 2s ease-in-out infinite',
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Text input + send */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={targetAgent
                ? t('chat.input_placeholder', { name: targetAgent })
                : t('chat.select_agent_first', 'Select an agent above...')
              }
              rows={2}
              disabled={!targetAgent}
              style={{
                flex: 1,
                background: 'var(--surface-0)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-primary)',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
                opacity: targetAgent ? 1 : 0.5,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--phosphor)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || sending || !targetAgent}
              title="Ctrl+Enter to send"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '36px', height: '36px',
                background: inputText.trim() && targetAgent ? 'var(--phosphor)' : 'var(--surface-0)',
                color: inputText.trim() && targetAgent ? 'var(--void)' : 'var(--text-muted)',
                border: `1px solid ${inputText.trim() && targetAgent ? 'var(--phosphor)' : 'var(--border)'}`,
                borderRadius: '6px',
                cursor: inputText.trim() && !sending && targetAgent ? 'pointer' : 'default',
                transition: 'all 0.15s',
                opacity: sending ? 0.5 : 1,
              }}
            >
              <Send size={14} />
            </button>
          </div>

          {/* Status line */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
            letterSpacing: '0.06em',
          }}>
            <span style={{ opacity: 0.6 }}>{t('chat.send_hint')}</span>
            <span style={{ flex: 1 }} />
            {sending && <span style={{ color: 'var(--amber)' }}>{t('chat.sending')}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Group chat bubble ──────────────────────────────────────────────────────

function GroupChatBubble({ message, prevMessage, isPendingHuman }: {
  message: AgentMessage;
  prevMessage: AgentMessage | null;
  isPendingHuman: boolean;
}) {
  const color = agentColor(message.sender);
  const isHuman = message.parsedType === 'human_input_request' || message.parsedType === 'human_response';
  const isSystem = message.parsedType === 'shutdown_request' || message.parsedType === 'shutdown_response'
    || message.parsedType === 'idle_notification' || message.parsedType === 'broadcast';

  // Show sender header if different from previous message's sender
  const showSender = !prevMessage || prevMessage.sender !== message.sender
    || timeDiffMinutes(prevMessage.timestamp, message.timestamp) > 2;

  // System messages rendered as centered notices
  if (isSystem) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center',
        padding: '4px 0',
      }}>
        <span style={{
          fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
          letterSpacing: '0.08em', opacity: 0.7,
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '2px 12px',
        }}>
          {message.sender} · {message.text.slice(0, 80)}{message.text.length > 80 ? '...' : ''}
          <span style={{ marginLeft: '6px', opacity: 0.5 }}>{fmtTime(message.timestamp)}</span>
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: showSender ? '6px 0 2px' : '1px 0' }}>
      {/* Sender header */}
      {showSender && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          marginBottom: '3px',
          paddingLeft: '4px',
        }}>
          {/* Avatar */}
          <span style={{
            width: '20px', height: '20px',
            borderRadius: '50%',
            background: `${color}22`,
            border: `1.5px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '8px', fontWeight: 700, color,
            flexShrink: 0,
          }}>
            {agentInitials(message.sender)}
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 700, color,
            letterSpacing: '0.04em',
          }}>
            {message.sender}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', opacity: 0.5 }}>
            → {message.recipient}
          </span>
          <span style={{
            fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
            opacity: 0.4, marginLeft: 'auto',
          }}>
            {fmtTime(message.timestamp)}
          </span>
          {isPendingHuman && (
            <span style={{
              fontSize: 'var(--text-xs)', color: 'var(--amber)',
              letterSpacing: '0.08em', fontWeight: 700,
            }}>
              ⚠ WAITING
            </span>
          )}
        </div>
      )}

      {/* Message bubble */}
      <div style={{
        marginLeft: '30px',
        maxWidth: 'calc(100% - 40px)',
      }}>
        <div style={{
          background: isHuman ? 'var(--amber-glow, rgba(255,191,0,0.08))' : 'var(--surface-1)',
          border: `1px solid ${isHuman ? 'var(--amber-dim, rgba(255,191,0,0.2))' : 'var(--border)'}`,
          borderLeft: `2px solid ${color}55`,
          borderRadius: '2px 8px 8px 2px',
          padding: '8px 12px',
          fontSize: '11px',
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
        }}>
          <MarkdownContent content={message.text} />
        </div>
      </div>
    </div>
  );
}

function fmtTime(ts: string) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ts.slice(11, 19); }
}

function timeDiffMinutes(ts1: string, ts2: string): number {
  try {
    return Math.abs(new Date(ts2).getTime() - new Date(ts1).getTime()) / 60000;
  } catch { return 999; }
}
