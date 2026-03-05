import { useState, useEffect } from 'react';
import type { TodoItem } from '../types';

export function useAgentTodos(teamId: string | null): Record<string, TodoItem[]> {
  const [todos, setTodos] = useState<Record<string, TodoItem[]>>({});

  useEffect(() => {
    if (!teamId) { setTodos({}); return; }

    let cancelled = false;
    async function fetch_() {
      try {
        const res = await fetch(`/api/teams/${teamId}/todos`);
        if (!res.ok) return;
        const json = await res.json() as { todos?: Record<string, TodoItem[]> };
        if (!cancelled) setTodos(json.todos ?? {});
      } catch { /* silent */ }
    }
    fetch_();
    const interval = setInterval(fetch_, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return todos;
}
