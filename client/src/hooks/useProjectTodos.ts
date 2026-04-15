/**
 * Project todos hook — uses usePolledData for shared polling logic
 */
import { useCallback } from 'react';
import type { SessionTodo } from '../types';
import { usePolledData } from './usePolledData';

export function useProjectTodos(teamId: string | null): SessionTodo[] {
  const transform = useCallback(
    (json: { sessions?: SessionTodo[] }) => json.sessions ?? [],
    [],
  );

  const { data } = usePolledData<SessionTodo[]>({
    teamId,
    endpoint: 'todos',
    baseIntervalMs: 10000,
    transform,
    initialValue: [],
  });

  return data;
}
