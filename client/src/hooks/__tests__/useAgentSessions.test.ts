import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentSessions } from '../../hooks/useAgentSessions';

const flushPromises = () => act(async () => {});

describe('useAgentSessions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches agent sessions and returns them', async () => {
    const mockAgents = [
      { agentName: 'lead', sessionId: 's1', messageCount: 10, isLead: true },
      { agentName: 'worker', sessionId: 's2', messageCount: 5, isLead: false },
    ];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ teamId: 'team-1', agents: mockAgents }),
    });

    const { result } = renderHook(() => useAgentSessions('team-1'));
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('/api/teams/team-1/session-agents');
    expect(result.current.agents).toHaveLength(2);
    expect(result.current.agents[0].agentName).toBe('lead');
  });

  it('returns empty agents when teamId is null', async () => {
    const { result } = renderHook(() => useAgentSessions(null));
    await flushPromises();

    expect(result.current.agents).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('polls every 30s', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ teamId: 'team-1', agents: [] }),
    });

    renderHook(() => useAgentSessions('team-1'));
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(30000); });
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('cleans up on unmount', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ teamId: 'team-1', agents: [] }),
    });

    const { unmount } = renderHook(() => useAgentSessions('team-1'));
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => { vi.advanceTimersByTime(30000); });
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
