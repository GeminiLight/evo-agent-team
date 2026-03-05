import { useState, useEffect } from 'react';
import type { InboxSummaryItem } from '../types';

export function useInboxSummary(teamId: string | null): Record<string, InboxSummaryItem> {
  const [summary, setSummary] = useState<Record<string, InboxSummaryItem>>({});

  useEffect(() => {
    if (!teamId) { setSummary({}); return; }

    let cancelled = false;
    async function fetch_() {
      try {
        const res = await fetch(`/api/teams/${teamId}/inbox-summary`);
        if (!res.ok) return;
        const json = await res.json() as { agents?: InboxSummaryItem[] };
        if (!cancelled) {
          const map: Record<string, InboxSummaryItem> = {};
          for (const item of json.agents ?? []) map[item.agentName] = item;
          setSummary(map);
        }
      } catch { /* silent */ }
    }
    fetch_();
    const interval = setInterval(fetch_, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return summary;
}
