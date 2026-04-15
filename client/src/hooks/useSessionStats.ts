/**
 * Session stats hook — uses usePolledData for shared polling logic
 */
import { useCallback } from 'react';
import type { AgentSessionStats } from '../types';
import { usePolledData } from './usePolledData';

export function useSessionStats(teamId: string | null): Record<string, AgentSessionStats> {
  const transform = useCallback((json: { agents?: AgentSessionStats[] }) => {
    const map: Record<string, AgentSessionStats> = {};
    for (const item of json.agents ?? []) map[item.agentName] = item;
    return map;
  }, []);

  const { data } = usePolledData<Record<string, AgentSessionStats>>({
    teamId,
    endpoint: 'session-stats',
    baseIntervalMs: 30000,
    transform,
    initialValue: {},
  });

  return data;
}
