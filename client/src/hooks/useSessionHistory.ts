import { useState, useEffect } from 'react';
import type { SessionMessage } from '../types';

export function useSessionHistory(
  teamId: string | null,
  agentName?: string | null,
): { messages: SessionMessage[]; sessionId: string | null; loading: boolean } {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) { setMessages([]); setSessionId(null); return; }

    let cancelled = false;
    async function fetch_() {
      setLoading(true);
      try {
        const url = agentName
          ? `/api/teams/${teamId}/session-history?agentName=${encodeURIComponent(agentName)}`
          : `/api/teams/${teamId}/session-history`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json() as { messages?: SessionMessage[]; sessionId?: string | null };
        if (!cancelled) {
          setMessages(json.messages ?? []);
          setSessionId(json.sessionId ?? null);
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch_();
    const interval = setInterval(fetch_, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId, agentName]);

  return { messages, sessionId, loading };
}
