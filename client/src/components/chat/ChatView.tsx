import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import type { TeamDetail, SessionMessage } from '../../types';
import { useAgentSessions } from '../../hooks/useAgentSessions';
import { useAgentRespond } from '../../hooks/useAgentRespond';
import { agentColor, agentInitials } from '../../utils/agentColors';
import ChatBubble from './ChatBubble';

interface ChatViewProps {
  teamId: string;
  teamDetail: TeamDetail | null;
}

export default function ChatView({ teamId, teamDetail }: ChatViewProps) {
  const { t } = useTranslation();
  const members = teamDetail?.config?.members ?? [];
  const { agents: sessionAgents } = useAgentSessions(teamId);

  // Pick agent names that have sessions — stabilized reference
  const agentNames = useMemo(() => {
    return sessionAgents.length > 0
      ? sessionAgents.map(a => a.agentName)
      : members.map(m => m.name);
  }, [sessionAgents, members]);

  const [selectedAgent, setSelectedAgent] = useState<string>('');

  // Auto-select first agent; reset if selected agent is no longer in list
  useEffect(() => {
    if (agentNames.length === 0) {
      setSelectedAgent('');
    } else if (!selectedAgent || !agentNames.includes(selectedAgent)) {
      setSelectedAgent(agentNames[0]);
    }
  }, [agentNames, selectedAgent]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ─── Header: Agent tabs ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '12px',
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--phosphor)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textShadow: '0 0 10px var(--phosphor-glow)',
          marginRight: '8px',
        }}>
          {t('chat.title', { name: teamDetail?.name ?? teamId })}
        </span>

        {agentNames.map(name => {
          const active = name === selectedAgent;
          const color = agentColor(name);
          return (
            <button
              key={name}
              onClick={() => setSelectedAgent(name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                background: active ? `${color}22` : 'transparent',
                border: `1px solid ${active ? `${color}55` : 'var(--border)'}`,
                borderRadius: '12px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: active ? color : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = `${color}44`; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <span style={{
                width: '18px', height: '18px',
                borderRadius: '50%',
                background: `${color}22`,
                border: `1px solid ${color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--text-xs)', fontWeight: 700, color,
              }}>
                {agentInitials(name)}
              </span>
              {name}
            </button>
          );
        })}
      </div>

      {/* ─── Chat body ─── */}
      {selectedAgent ? (
        <ChatBody key={selectedAgent} teamId={teamId} agentName={selectedAgent} />
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '11px',
          letterSpacing: '0.1em',
        }}>
          {t('chat.select_agent')}
        </div>
      )}
    </div>
  );
}

// ─── Chat body: message list + input ─────────────────────────────────────────

function ChatBody({ teamId, agentName }: { teamId: string; agentName: string }) {
  const { t } = useTranslation();
  const { messages, loading } = useChatHistory(teamId, agentName);
  const { respond, sending, error: respondError, clearError } = useAgentRespond(teamId);
  const [inputText, setInputText] = useState('');
  const [sentMessages, setSentMessages] = useState<SessionMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Clear optimistic messages when real message count grows (server confirmed receipt)
  const prevRealCountRef = useRef(0);
  useEffect(() => {
    if (sentMessages.length > 0 && messages.length > prevRealCountRef.current) {
      setSentMessages([]);
    }
    prevRealCountRef.current = messages.length;
  }, [messages.length, sentMessages.length]);

  // Clear input and sent messages when agent changes
  useEffect(() => {
    setInputText('');
    setSentMessages([]);
    clearError();
  }, [agentName, clearError]);

  const allMessages = [...messages, ...sentMessages];

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    // Optimistic update
    const optimistic: SessionMessage = {
      uuid: `optimistic-${Date.now()}`,
      role: 'user',
      timestamp: new Date().toISOString(),
      entries: [{ kind: 'text', text }],
    };
    setSentMessages(prev => [...prev, optimistic]);
    setInputText('');

    const ok = await respond(agentName, text);
    if (!ok) {
      // Remove optimistic message on failure
      setSentMessages(prev => prev.filter(m => m.uuid !== optimistic.uuid));
      setInputText(text); // restore
    }
  }, [inputText, sending, respond, agentName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setInputText('');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Message area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {loading && allMessages.length === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '200px', color: 'var(--text-muted)', fontSize: '10px',
            letterSpacing: '0.12em',
          }}>
            {t('chat.loading')}
          </div>
        )}
        {!loading && allMessages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '200px', gap: '8px',
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
              {t('chat.no_messages')}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', opacity: 0.6 }}>
              {t('chat.no_messages_sub')}
            </span>
          </div>
        )}
        {allMessages.map((msg, idx) => {
          const isLast = idx === allMessages.length - 1;
          const isStreaming = isLast && msg.role === 'assistant' && !msg.uuid.startsWith('optimistic-');
          return <ChatBubble key={msg.uuid} message={msg} isStreaming={isStreaming} />;
        })}
      </div>

      {/* ─── Input bar ─── */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '10px 0 0',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end',
      }}>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.input_placeholder', { name: agentName })}
          rows={2}
          style={{
            flex: 1,
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '8px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-primary)',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--phosphor)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || sending}
          title="Ctrl+Enter to send"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            background: inputText.trim() ? 'var(--phosphor)' : 'var(--surface-1)',
            color: inputText.trim() ? 'var(--void)' : 'var(--text-muted)',
            border: `1px solid ${inputText.trim() ? 'var(--phosphor)' : 'var(--border)'}`,
            borderRadius: '6px',
            cursor: inputText.trim() && !sending ? 'pointer' : 'default',
            transition: 'all 0.15s',
            opacity: sending ? 0.5 : 1,
          }}
        >
          <Send size={14} />
        </button>
      </div>

      {/* Status line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 0 0',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        letterSpacing: '0.06em',
      }}>
        <span style={{ opacity: 0.6 }}>{t('chat.send_hint')}</span>
        <span style={{ flex: 1 }} />
        {sending && <span style={{ color: 'var(--amber)' }}>{t('chat.sending')}</span>}
        {respondError && <span style={{ color: 'var(--crimson, #ff4466)' }}>{respondError}</span>}
      </div>
    </div>
  );
}

// ─── Custom hook: session history with faster polling for chat ────────────────

function useChatHistory(teamId: string | null, agentName: string | null) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const isFirstFetch = useRef(true);

  useEffect(() => {
    if (!teamId || !agentName) { setMessages([]); setLoading(false); return; }

    isFirstFetch.current = true;
    let cancelled = false;
    async function fetchData() {
      // Only show loading spinner on initial fetch, not on poll updates
      if (isFirstFetch.current) setLoading(true);
      try {
        const url = `/api/teams/${teamId}/session-history?agentName=${encodeURIComponent(agentName!)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json() as { messages?: SessionMessage[] };
        if (!cancelled) setMessages(json.messages ?? []);
      } catch { /* silent */ } finally {
        if (!cancelled) {
          if (isFirstFetch.current) { setLoading(false); isFirstFetch.current = false; }
        }
      }
    }
    fetchData();
    // 5s polling for chat real-time feel
    const interval = setInterval(fetchData, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId, agentName]);

  return { messages, loading };
}
