import { useState, useEffect, useRef } from 'react';
import { fetchWithCache } from '../utils/fetchCache';
import type { Alert, AlertsResponse } from '../types';

export function useAlerts(teamId: string | null): { alerts: Alert[]; loading: boolean } {
  const [alerts, setAlerts] = useState<Alert[]>([]);
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
    if (!teamId) { setAlerts([]); return; }

    let cancelled = false;

    async function fetch_() {
      setLoading(true);
      try {
        const res = await fetchWithCache(`/api/teams/${teamId}/alerts`);
        if (!res.ok) return;
        const json = await res.json() as AlertsResponse;
        if (!cancelled) setAlerts(json.alerts ?? []);
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch_();

    // Calculate adaptive interval: 15s base, 5x slower when hidden or idle
    const calculateInterval = () => {
      const baseInterval = 15000;
      if (!isTabVisible || isUserIdle) {
        return Math.max(baseInterval * 5, 75000); // 75s when hidden/idle
      }
      return baseInterval;
    };

    const interval = setInterval(fetch_, calculateInterval());

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [teamId, isTabVisible, isUserIdle]);

  return { alerts, loading };
}

