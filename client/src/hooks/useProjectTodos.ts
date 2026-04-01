import { useState, useEffect, useRef } from 'react';
import { fetchWithCache } from '../utils/fetchCache';
import type { SessionTodo } from '../types';

export function useProjectTodos(teamId: string | null): SessionTodo[] {
  const [sessions, setSessions] = useState<SessionTodo[]>([]);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isUserIdle, setIsUserIdle] = useState(false);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track user activity for idle detection
  useEffect(() => {
    const resetIdleTimer = () => {
      if (isUserIdle) {
        setIsUserIdle(false);
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        setIsUserIdle(true);
      }, 60000); // 60s idle threshold
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));

    resetIdleTimer();

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [isUserIdle]);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!teamId) { setSessions([]); return; }

    let cancelled = false;

    async function fetch_() {
      try {
        const res = await fetchWithCache(`/api/teams/${teamId}/todos`);
        if (!res.ok) return;
        const json = await res.json() as { sessions?: SessionTodo[] };
        if (!cancelled) setSessions(json.sessions ?? []);
      } catch { /* silent */ }
    }

    fetch_();

    // Calculate adaptive interval: 10s base, 5x slower when hidden or idle
    const calculateInterval = () => {
      const baseInterval = 10000;
      if (!isTabVisible || isUserIdle) {
        return Math.max(baseInterval * 5, 50000); // 50s when hidden/idle
      }
      return baseInterval;
    };

    const interval = setInterval(fetch_, calculateInterval());

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [teamId, isTabVisible, isUserIdle]);

  return sessions;
}
