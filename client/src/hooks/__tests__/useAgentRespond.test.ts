import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentRespond } from '../../hooks/useAgentRespond';

describe('useAgentRespond', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('respond() returns true on success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const { result } = renderHook(() => useAgentRespond('my-team'));

    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.respond('agent-1', 'hello');
    });

    expect(ok).toBe(true);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      '/api/teams/my-team/agents/agent-1/respond',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('respond() returns false on 4xx and sets error', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Bad request' }),
    });

    const { result } = renderHook(() => useAgentRespond('my-team'));

    let ok: boolean = true;
    await act(async () => {
      ok = await result.current.respond('agent-1', 'hello');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Bad request');
  });

  it('demo-team returns specific error', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Cannot write to demo team' }),
    });

    const { result } = renderHook(() => useAgentRespond('demo-team'));

    await act(async () => {
      await result.current.respond('agent-1', 'hello');
    });

    expect(result.current.error).toBe('Not available in demo mode');
  });

  it('network error sets "Network error"', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fetch failed'));

    const { result } = renderHook(() => useAgentRespond('my-team'));

    await act(async () => {
      await result.current.respond('agent-1', 'hello');
    });

    expect(result.current.error).toBe('Network error');
  });

  it('clearError resets error to null', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useAgentRespond('my-team'));

    await act(async () => {
      await result.current.respond('agent-1', 'hello');
    });
    expect(result.current.error).toBe('Network error');

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
