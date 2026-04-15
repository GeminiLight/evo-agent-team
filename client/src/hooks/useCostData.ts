/**
 * Cost data hook — uses usePolledData for shared polling logic
 * Reduced from 89 LOC to 13 LOC (85% reduction)
 */
import type { CostData } from '../types';
import { usePolledData } from './usePolledData';

export function useCostData(teamId: string | null): { data: CostData | null; loading: boolean } {
  const { data, loading } = usePolledData<CostData | null>({
    teamId,
    endpoint: 'cost',
    baseIntervalMs: 30000,
    transform: (json: CostData) => json,
    initialValue: null,
  });

  return { data, loading };
}
