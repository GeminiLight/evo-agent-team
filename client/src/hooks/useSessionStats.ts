import { useState, useEffect } from 'react';
import type { AgentSessionStats } from '../types';

export function useSessionStats(teamId: string | null): Record<string, AgentSessionStats> {
  const [stats, setStats] = useState<Record<string, AgentSessionStats>>({});

  useEffect(() => {
    if (!teamId) { setStats({}); return; }

    let cancelled = false;
    async function fetch_() {
      try {
        const res = await fetch(`/api/teams/${teamId}/session-stats`);
        if (!res.ok) return;
        const json = await res.json() as { agents?: AgentSessionStats[] };
        if (!cancelled) {
          const map: Record<string, AgentSessionStats> = {};
          for (const item of json.agents ?? []) map[item.agentName] = item;
          setStats(map);
        }
      } catch { /* silent */ }
    }
    fetch_();
    const interval = setInterval(fetch_, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return stats;
}
