import { useState, useEffect, useRef } from 'react';
import { fetchWithCache } from '../utils/fetchCache';
import type { CostData } from '../types';

export function useCostData(teamId: string | null): { data: CostData | null; loading: boolean } {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(false);
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
    if (!teamId) { setData(null); return; }

    let cancelled = false;

    async function fetch_() {
      setLoading(true);
      try {
        const res = await fetchWithCache(`/api/teams/${teamId}/cost`);
        if (!res.ok) return;
        const json = await res.json() as CostData;
        if (!cancelled) setData(json);
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch_();

    // Calculate adaptive interval: 30s base, 5x slower when hidden or idle
    const calculateInterval = () => {
      const baseInterval = 30000;
      if (!isTabVisible || isUserIdle) {
        return Math.max(baseInterval * 5, 150000); // 150s when hidden/idle
      }
      return baseInterval;
    };

    const interval = setInterval(fetch_, calculateInterval());

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [teamId, isTabVisible, isUserIdle]);

  return { data, loading };
}
