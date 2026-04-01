/**
 * Request deduplication cache for reducing unnecessary API calls.
 * Returns cached results if same URL requested within 500ms window.
 * Auto-expires entries after 30 seconds.
 */

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DEDUP_WINDOW = 500; // ms — deduplicate requests within this window
const CACHE_STALE_AFTER = 30000; // ms — 30 seconds

/**
 * Fetch with built-in deduplication and optional ETag support.
 * Returns cached result if same URL requested within 500ms.
 */
export async function fetchWithCache(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const cached = cache.get(url);

  // Return cached response if within dedup window and not stale
  if (cached && now - cached.timestamp < CACHE_DEDUP_WINDOW) {
    // Return a response-like object that matches the fetch API
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  // Clear stale entries periodically
  if (now % 10000 < 500) {
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > CACHE_STALE_AFTER) {
        cache.delete(key);
      }
    }
  }

  // Make the actual request
  const response = await fetch(url, options);

  // Cache successful responses
  if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
    try {
      const data = await response.json();
      cache.set(url, { data, timestamp: now });
      // Return a new response from cached data to avoid body consumption issues
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      });
    } catch {
      return response;
    }
  }

  return response;
}

/**
 * Clear cache entry for a specific URL (useful after mutations).
 */
export function invalidateCache(url: string): void {
  cache.delete(url);
}

/**
 * Clear all cache entries.
 */
export function clearCache(): void {
  cache.clear();
}
