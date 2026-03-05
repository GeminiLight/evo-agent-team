import { useState, useEffect } from 'react';

export interface BlockingDetail {
  name: string;
  blocking: { toolName: string; detail: string };
}

export interface PendingHumanRequests {
  count: number;
  agentNames: string[];
  /** Per-agent detail (tool that is blocking + context snippet) */
  details: BlockingDetail[];
}

export function usePendingHumanRequests(teamId: string | null): PendingHumanRequests {
  const [result, setResult] = useState<PendingHumanRequests>({ count: 0, agentNames: [], details: [] });

  useEffect(() => {
    if (!teamId) { setResult({ count: 0, agentNames: [], details: [] }); return; }

    let cancelled = false;
    async function fetch_() {
      try {
        const res = await fetch(`/api/teams/${teamId}/human-input-status`);
        if (!res.ok) return;
        const json = await res.json() as { waitingAgents?: string[]; details?: BlockingDetail[] };
        const agents: string[] = json.waitingAgents ?? [];
        const details: BlockingDetail[] = json.details ?? [];
        if (!cancelled) {
          setResult({ count: agents.length, agentNames: agents, details });
        }
      } catch { /* silent */ }
    }
    fetch_();
    const interval = setInterval(fetch_, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return result;
}
