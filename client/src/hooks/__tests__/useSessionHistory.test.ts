import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionHistory } from '../../hooks/useSessionHistory';

// Helper to flush all pending microtasks
const flushPromises = () => act(async () => {});

describe('useSessionHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches session history with correct URL (no agentName)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ uuid: '1', role: 'user', timestamp: '', entries: [] }], sessionId: 'sid' }),
    });

    const { result } = renderHook(() => useSessionHistory('team-1'));
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('/api/teams/team-1/session-history');
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.sessionId).toBe('sid');
  });

  it('fetches with agentName query param', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [], sessionId: null }),
    });

    renderHook(() => useSessionHistory('team-1', 'agent-a'));
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith(
      '/api/teams/team-1/session-history?agentName=agent-a',
    );
  });

  it('polls every 30s', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [], sessionId: null }),
    });

    renderHook(() => useSessionHistory('team-1'));
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);

    // Advance 30s → second fetch
    await act(async () => { vi.advanceTimersByTime(30000); });
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(2);

    // Advance another 30s → third fetch
    await act(async () => { vi.advanceTimersByTime(30000); });
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('returns empty when teamId is null', async () => {
    const { result } = renderHook(() => useSessionHistory(null));
    await flushPromises();

    expect(result.current.messages).toEqual([]);
    expect(result.current.sessionId).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('cleans up interval on unmount', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [], sessionId: null }),
    });

    const { unmount } = renderHook(() => useSessionHistory('team-1'));
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => { vi.advanceTimersByTime(30000); });
    await flushPromises();
    // Should not fetch after unmount
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
