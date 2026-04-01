/**
 * ETag generation utility for HTTP cache validation.
 * Generates a simple hash of JSON data for 304 Not Modified responses.
 */

import crypto from 'crypto';

/**
 * Generate an ETag from JSON data.
 * Uses SHA-1 hash of stringified data for efficient comparison.
 */
export function generateETag(data: unknown): string {
  const json = JSON.stringify(data);
  const hash = crypto.createHash('sha1').update(json).digest('hex');
  return `"${hash.slice(0, 16)}"`;
}

/**
 * Check if client's ETag matches server's computed ETag.
 * Returns true if they match (indicating data hasn't changed).
 */
export function eTagMatches(clientETag: string | null, serverETag: string): boolean {
  return clientETag !== null && clientETag === serverETag;
}
