import { describe, it, expect } from 'vitest';
import { generateETag, eTagMatches } from '../etagUtils';

describe('etagUtils', () => {
  it('should generate consistent ETag for same data', () => {
    const data = { teams: [{ id: 'team1', name: 'Team 1' }] };
    const etag1 = generateETag(data);
    const etag2 = generateETag(data);

    expect(etag1).toBe(etag2);
  });

  it('should generate different ETag for different data', () => {
    const data1 = { teams: [{ id: 'team1', name: 'Team 1' }] };
    const data2 = { teams: [{ id: 'team2', name: 'Team 2' }] };

    const etag1 = generateETag(data1);
    const etag2 = generateETag(data2);

    expect(etag1).not.toBe(etag2);
  });

  it('should return quoted string format', () => {
    const data = { test: 'data' };
    const etag = generateETag(data);

    expect(etag).toMatch(/^"[a-f0-9]{16}"$/);
  });

  it('should match valid ETags', () => {
    const data = { teams: [] };
    const etag = generateETag(data);

    expect(eTagMatches(etag, etag)).toBe(true);
  });

  it('should not match different ETags', () => {
    const data1 = { teams: [{ id: 'team1' }] };
    const data2 = { teams: [{ id: 'team2' }] };

    const etag1 = generateETag(data1);
    const etag2 = generateETag(data2);

    expect(eTagMatches(etag1, etag2)).toBe(false);
  });

  it('should handle null client ETag', () => {
    const data = { test: 'data' };
    const etag = generateETag(data);

    expect(eTagMatches(null, etag)).toBe(false);
  });

  it('should be deterministic across runs', () => {
    const data = { a: 1, b: 'test', c: [1, 2, 3] };

    const etags = Array.from({ length: 5 }, () => generateETag(data));
    const firstETag = etags[0];

    expect(etags.every(e => e === firstETag)).toBe(true);
  });
});
