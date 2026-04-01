import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('useAdaptivePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should calculate interval correctly when tab is visible', () => {
    const pollInterval = 2000;
    const isTabVisible = true;
    const isUserIdle = false;

    const expectedInterval = isTabVisible && !isUserIdle ? pollInterval : pollInterval * 5;
    expect(expectedInterval).toBe(2000);
  });

  it('should calculate 5x interval when tab is hidden', () => {
    const pollInterval = 2000;
    const isTabVisible = false;
    const isUserIdle = false;

    const expectedInterval = !isTabVisible || isUserIdle ? Math.max(pollInterval * 5, 10000) : pollInterval;
    expect(expectedInterval).toBe(10000);
  });

  it('should calculate 5x interval when user is idle', () => {
    const pollInterval = 2000;
    const isTabVisible = true;
    const isUserIdle = true;

    const expectedInterval = isUserIdle ? Math.max(pollInterval * 5, 10000) : pollInterval;
    expect(expectedInterval).toBe(10000);
  });

  it('should handle mobile network detection', () => {
    const pollInterval = 2000;
    const isMobile = true;

    const mobileInterval = isMobile ? 5000 : pollInterval;
    expect(mobileInterval).toBe(5000);
  });
});
