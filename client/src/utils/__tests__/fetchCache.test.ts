import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchWithCache, invalidateCache, clearCache } from '../fetchCache';

describe('fetchWithCache', () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should cache requests within 500ms dedup window', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    mockFetch.mockResolvedValueOnce(mockResponse);

    // First request
    const res1 = await fetchWithCache('/api/test');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second request within 500ms should return cache hit
    const res2 = await fetchWithCache('/api/test');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Should not fetch again

    const headers2 = res2.headers;
    expect(headers2.get('X-Cache')).toBe('HIT');

    // After 500ms, should fetch again
    vi.advanceTimersByTime(501);
    mockFetch.mockResolvedValueOnce(mockResponse);
    const res3 = await fetchWithCache('/api/test');
    expect(mockFetch).toHaveBeenCalledTimes(2); // New fetch
  });

  it('should expire cache after 30 seconds', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    mockFetch.mockResolvedValueOnce(mockResponse);

    await fetchWithCache('/api/test');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // After 30s + 1ms, cache should be stale
    vi.advanceTimersByTime(30001);

    mockFetch.mockResolvedValueOnce(mockResponse);
    const res = await fetchWithCache('/api/test');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should invalidate cache for specific URL', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    mockFetch.mockResolvedValueOnce(mockResponse);

    await fetchWithCache('/api/test');
    invalidateCache('/api/test');

    mockFetch.mockResolvedValueOnce(mockResponse);
    await fetchWithCache('/api/test');
    expect(mockFetch).toHaveBeenCalledTimes(2); // Cache was invalidated
  });

  it('should clear all cache entries', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    mockFetch.mockResolvedValue(mockResponse);

    await fetchWithCache('/api/test1');
    await fetchWithCache('/api/test2');

    clearCache();

    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce(mockResponse);
    await fetchWithCache('/api/test1');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Cache was cleared
  });

  it('should handle non-JSON responses', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const mockResponse = new Response('plain text', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });

    mockFetch.mockResolvedValueOnce(mockResponse);

    const res = await fetchWithCache('/api/test');
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should not cache failed responses', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const mockResponse = new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });

    mockFetch.mockResolvedValueOnce(mockResponse);

    const res = await fetchWithCache('/api/test');
    expect(res.status).toBe(404);

    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce(mockResponse);
    await fetchWithCache('/api/test');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Should not use cache for failed response
  });
});
