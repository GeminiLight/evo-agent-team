import { useState, useEffect, useCallback } from 'react';
import type { ExecSummaryResponse } from '../types';

export function useSummary(teamId: string | null): {
  data: ExecSummaryResponse | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
} {
  const [data, setData] = useState<ExecSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async (force = false) => {
    if (!teamId) return;
    if (force) setRefreshing(true); else setLoading(true);
    try {
      const url = force
        ? `/api/teams/${teamId}/summary?refresh=1`
        : `/api/teams/${teamId}/summary`;
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json() as ExecSummaryResponse;
      setData(json);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (!teamId) { setData(null); return; }
    fetchSummary(false);
    // Poll every 5 minutes (summary is cached server-side)
    const interval = setInterval(() => fetchSummary(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [teamId, fetchSummary]);

  const refresh = useCallback(() => fetchSummary(true), [fetchSummary]);

  return { data, loading, refreshing, refresh };
}
