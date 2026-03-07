import { useState, useEffect } from 'react';
import type { AgentSessionInfo, AgentSessionsResponse } from '../types';

export function useAgentSessions(teamId: string | null): { agents: AgentSessionInfo[]; loading: boolean } {
  const [agents, setAgents] = useState<AgentSessionInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) { setAgents([]); return; }

    let cancelled = false;
    async function fetch_() {
      setLoading(true);
      try {
        const res = await fetch(`/api/teams/${teamId}/session-agents`);
        if (!res.ok) return;
        const json = await res.json() as AgentSessionsResponse;
        if (!cancelled) setAgents(json.agents ?? []);
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch_();
    const interval = setInterval(fetch_, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return { agents, loading };
}
