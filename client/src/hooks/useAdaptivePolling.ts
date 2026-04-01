/**
 * Adaptive polling hook that adjusts fetch frequency based on:
 * - Tab visibility (focused: fast, hidden: slow)
 * - User idle state (idle >60s: slow, active: fast)
 * - Network conditions (optional mobile detection)
 *
 * Automatically reduces API calls when users aren't actively using the app.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchWithCache } from '../utils/fetchCache';

interface UseAdaptivePollingOptions {
  onVisibilityChange?: (isVisible: boolean) => void;
  onIdleChange?: (isIdle: boolean) => void;
  respectETag?: boolean;
}

interface UseAdaptivePollingReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  currentInterval: number;
  isTabVisible: boolean;
  isUserIdle: boolean;
}

/**
 * Adaptive polling hook with automatic frequency adjustment.
 */
export function useAdaptivePolling<T>(
  url: string,
  defaultInterval: number = 2000,
  options?: UseAdaptivePollingOptions,
): UseAdaptivePollingReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isUserIdle, setIsUserIdle] = useState(false);
  const [currentInterval, setCurrentInterval] = useState(defaultInterval);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Calculate effective interval based on visibility and idle state
  const calculateInterval = useCallback((): number => {
    if (!isTabVisible) return Math.max(defaultInterval * 5, 10000); // 5x slower when hidden
    if (isUserIdle) return Math.max(defaultInterval * 5, 10000); // 5x slower when idle
    return defaultInterval;
  }, [defaultInterval, isTabVisible, isUserIdle]);

  // Fetch function
  const performFetch = useCallback(async () => {
    if (!url) return;

    try {
      setLoading(true);
      const response = await fetchWithCache(url);

      // Handle 304 Not Modified
      if (response.status === 304) {
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = (await response.json()) as T;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [url]);

  // Track user activity for idle detection
  useEffect(() => {
    const resetIdleTimer = () => {
      lastActivityRef.current = Date.now();
      if (isUserIdle) {
        setIsUserIdle(false);
        options?.onIdleChange?.(false);
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        setIsUserIdle(true);
        options?.onIdleChange?.(true);
      }, 60000); // 60s idle threshold
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));

    // Initial timer
    resetIdleTimer();

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [isUserIdle, options]);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsTabVisible(isVisible);
      options?.onVisibilityChange?.(isVisible);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [options]);

  // Update current interval when factors change
  useEffect(() => {
    const newInterval = calculateInterval();
    setCurrentInterval(newInterval);
  }, [calculateInterval]);

  // Initial fetch and polling setup
  useEffect(() => {
    // Fetch immediately
    performFetch();

    // Set up interval with current calculated interval
    const newInterval = calculateInterval();
    intervalRef.current = setInterval(performFetch, newInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [performFetch, calculateInterval]);

  // Restart polling when interval changes
  useEffect(() => {
    const newInterval = calculateInterval();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(performFetch, newInterval);
    }
  }, [currentInterval, performFetch, calculateInterval]);

  return { data, loading, error, currentInterval, isTabVisible, isUserIdle };
}
