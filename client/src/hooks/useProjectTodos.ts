import { useState, useEffect } from 'react';
import type { SessionTodo } from '../types';

export function useProjectTodos(teamId: string | null): SessionTodo[] {
  const [sessions, setSessions] = useState<SessionTodo[]>([]);

  useEffect(() => {
    if (!teamId) { setSessions([]); return; }

    let cancelled = false;
    async function fetch_() {
      try {
        const res = await fetch(`/api/teams/${teamId}/todos`);
        if (!res.ok) return;
        const json = await res.json() as { sessions?: SessionTodo[] };
        if (!cancelled) setSessions(json.sessions ?? []);
      } catch { /* silent */ }
    }
    fetch_();
    const interval = setInterval(fetch_, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return sessions;
}
