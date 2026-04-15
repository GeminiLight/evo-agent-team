/**
 * Alerts hook — uses usePolledData for shared polling logic
 * Reduced from 89 LOC to 13 LOC (85% reduction)
 */
import type { Alert, AlertsResponse } from '../types';
import { usePolledData } from './usePolledData';

export function useAlerts(teamId: string | null): { alerts: Alert[]; loading: boolean } {
  const { data: alerts, loading } = usePolledData<Alert[]>({
    teamId,
    endpoint: 'alerts',
    baseIntervalMs: 15000,
    transform: (json: AlertsResponse) => json.alerts ?? [],
    initialValue: [],
  });

  return { alerts, loading };
}
