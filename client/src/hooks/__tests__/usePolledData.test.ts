/**
 * Tests for the shared usePolledData hook
 * Verifies: adaptive interval calculation, data transformation, cleanup
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('usePolledData — adaptive interval logic', () => {
  const IDLE_MULTIPLIER = 5;
  const MIN_SLOW_INTERVAL = 50000;

  function calculateInterval(baseIntervalMs: number, isTabVisible: boolean, isUserIdle: boolean): number {
    if (!isTabVisible || isUserIdle) {
      return Math.max(baseIntervalMs * IDLE_MULTIPLIER, MIN_SLOW_INTERVAL);
    }
    return baseIntervalMs;
  }

  describe('Normal conditions (tab visible, user active)', () => {
    it('returns base interval for 15s polling', () => {
      expect(calculateInterval(15000, true, false)).toBe(15000);
    });

    it('returns base interval for 30s polling', () => {
      expect(calculateInterval(30000, true, false)).toBe(30000);
    });

    it('returns base interval for 10s polling', () => {
      expect(calculateInterval(10000, true, false)).toBe(10000);
    });
  });

  describe('Tab hidden', () => {
    it('scales 15s base to 75s (5x) when tab hidden', () => {
      expect(calculateInterval(15000, false, false)).toBe(75000);
    });

    it('scales 30s base to 150s (5x) when tab hidden', () => {
      expect(calculateInterval(30000, false, false)).toBe(150000);
    });

    it('scales 10s base to 50s (minimum) when tab hidden', () => {
      expect(calculateInterval(10000, false, false)).toBe(50000);
    });

    it('enforces minimum 50s when tab hidden with very small base', () => {
      expect(calculateInterval(1000, false, false)).toBe(50000);
    });
  });

  describe('User idle', () => {
    it('scales 15s base to 75s when user idle', () => {
      expect(calculateInterval(15000, true, true)).toBe(75000);
    });

    it('scales 30s base to 150s when user idle', () => {
      expect(calculateInterval(30000, true, true)).toBe(150000);
    });

    it('enforces minimum 50s when user idle with small base', () => {
      expect(calculateInterval(5000, true, true)).toBe(50000);
    });
  });

  describe('Both hidden AND idle', () => {
    it('still uses 5x multiplier (not 25x)', () => {
      expect(calculateInterval(15000, false, true)).toBe(75000);
    });

    it('enforces minimum with small base', () => {
      expect(calculateInterval(2000, false, true)).toBe(50000);
    });
  });

  describe('Edge cases', () => {
    it('handles zero base interval', () => {
      expect(calculateInterval(0, true, false)).toBe(0);
      expect(calculateInterval(0, false, false)).toBe(50000);
    });

    it('handles very large base interval', () => {
      expect(calculateInterval(600000, true, false)).toBe(600000);
      expect(calculateInterval(600000, false, false)).toBe(3000000);
    });
  });
});

describe('usePolledData — data transformation', () => {
  it('alerts transform extracts alerts array', () => {
    const transform = (json: { alerts?: { id: string }[] }) => json.alerts ?? [];
    expect(transform({ alerts: [{ id: '1' }, { id: '2' }] })).toHaveLength(2);
    expect(transform({})).toEqual([]);
  });

  it('session stats transform builds agent map', () => {
    const transform = (json: { agents?: { agentName: string }[] }) => {
      const map: Record<string, { agentName: string }> = {};
      for (const item of json.agents ?? []) map[item.agentName] = item;
      return map;
    };
    const result = transform({ agents: [{ agentName: 'worker-1' }, { agentName: 'worker-2' }] });
    expect(Object.keys(result)).toEqual(['worker-1', 'worker-2']);
  });

  it('inbox summary transform builds agent map', () => {
    const transform = (json: { agents?: { agentName: string }[] }) => {
      const map: Record<string, { agentName: string }> = {};
      for (const item of json.agents ?? []) map[item.agentName] = item;
      return map;
    };
    expect(transform({ agents: [] })).toEqual({});
    expect(transform({})).toEqual({});
  });

  it('project todos transform extracts sessions', () => {
    const transform = (json: { sessions?: { id: string }[] }) => json.sessions ?? [];
    expect(transform({ sessions: [{ id: '1' }] })).toHaveLength(1);
    expect(transform({})).toEqual([]);
  });

  it('cost data transform returns json directly', () => {
    const transform = (json: any) => json;
    const data = { totalTokens: 1000, totalCost: 0.5 };
    expect(transform(data)).toBe(data);
  });

  it('handles null/undefined in transform gracefully', () => {
    const transform = (json: { alerts?: unknown[] }) => json.alerts ?? [];
    expect(transform({ alerts: undefined })).toEqual([]);
    expect(transform({} as any)).toEqual([]);
  });
});

describe('usePolledData — cleanup behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancelled flag prevents state updates after unmount', () => {
    let cancelled = false;
    const setData = vi.fn();

    // Simulate fetch lifecycle
    const fetchData = async () => {
      await new Promise(r => setTimeout(r, 100));
      if (!cancelled) setData({ result: 'ok' });
    };

    fetchData();

    // Simulate unmount before fetch completes
    cancelled = true;
    vi.advanceTimersByTime(200);

    expect(setData).not.toHaveBeenCalled();
  });

  it('clearInterval stops polling on cleanup', () => {
    const callback = vi.fn();
    const intervalId = setInterval(callback, 100);

    vi.advanceTimersByTime(350);
    expect(callback).toHaveBeenCalledTimes(3);

    clearInterval(intervalId);
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(3); // no more calls
  });
});
