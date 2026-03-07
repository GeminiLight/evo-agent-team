import { useState, useEffect } from 'react';
import type { CostData } from '../types';

export function useCostData(teamId: string | null): { data: CostData | null; loading: boolean } {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) { setData(null); return; }

    let cancelled = false;
    async function fetch_() {
      setLoading(true);
      try {
        const res = await fetch(`/api/teams/${teamId}/cost`);
        if (!res.ok) return;
        const json = await res.json() as CostData;
        if (!cancelled) setData(json);
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch_();
    const interval = setInterval(fetch_, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return { data, loading };
}
