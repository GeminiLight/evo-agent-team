import { useState, useEffect } from 'react';
import type { Alert, AlertsResponse } from '../types';

export function useAlerts(teamId: string | null): { alerts: Alert[]; loading: boolean } {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) { setAlerts([]); return; }

    let cancelled = false;
    async function fetch_() {
      setLoading(true);
      try {
        const res = await fetch(`/api/teams/${teamId}/alerts`);
        if (!res.ok) return;
        const json = await res.json() as AlertsResponse;
        if (!cancelled) setAlerts(json.alerts ?? []);
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch_();
    const interval = setInterval(fetch_, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return { alerts, loading };
}
