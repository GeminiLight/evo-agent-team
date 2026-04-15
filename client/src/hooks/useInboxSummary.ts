/**
 * Inbox summary hook — uses usePolledData for shared polling logic
 */
import { useCallback } from 'react';
import type { InboxSummaryItem } from '../types';
import { usePolledData } from './usePolledData';

export function useInboxSummary(teamId: string | null): Record<string, InboxSummaryItem> {
  const transform = useCallback((json: { agents?: InboxSummaryItem[] }) => {
    const map: Record<string, InboxSummaryItem> = {};
    for (const item of json.agents ?? []) map[item.agentName] = item;
    return map;
  }, []);

  const { data } = usePolledData<Record<string, InboxSummaryItem>>({
    teamId,
    endpoint: 'inbox-summary',
    baseIntervalMs: 10000,
    transform,
    initialValue: {},
  });

  return data;
}
