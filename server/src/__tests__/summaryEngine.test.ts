import { describe, it, expect } from 'vitest';
import { getSummary, invalidateSummary } from '../summaryEngine';

// Note: No LLM_API_KEY set in test env → always rule-based fallback.
// Tests use unique teamIds to avoid inter-test cache interference.

describe('summaryEngine', () => {
  it('returns 0/0 for empty tasks', async () => {
    const result = await getSummary({
      teamId: 'se-empty',
      teamName: 'Test Team',
      tasks: [],
      events: [],
      agentStats: [],
    });

    expect(result.summary).toContain('0/0');
    expect(result.teamId).toBe('se-empty');
    expect(result.isAIGenerated).toBe(false);
    expect(result.isStale).toBe(false);
  });

  it('counts completed/active/blocked correctly', async () => {
    const result = await getSummary({
      teamId: 'se-counts',
      teamName: 'Test Team',
      tasks: [
        { id: '1', subject: 'Task 1', description: '', activeForm: '', status: 'completed', blocks: [], blockedBy: [] },
        { id: '2', subject: 'Task 2', description: '', activeForm: '', status: 'in_progress', blocks: [], blockedBy: [] },
        { id: '3', subject: 'Task 3', description: '', activeForm: '', status: 'pending', blocks: [], blockedBy: ['2'] },
      ],
      events: [],
      agentStats: [],
    });

    expect(result.summary).toContain('1/3');
    expect(result.summary).toContain('1 task in progress');
    expect(result.summary).toContain('Blocked');
  });

  it('includes token stats when agentStats provided', async () => {
    const result = await getSummary({
      teamId: 'se-tokens',
      teamName: 'Test Team',
      tasks: [],
      events: [],
      agentStats: [
        {
          agentName: 'worker',
          inputTokens: 5000,
          outputTokens: 3000,
          cacheReadTokens: 0,
          messageCount: 10,
          sessionDurationMs: null,
        },
      ],
    });

    expect(result.summary).toContain('Tokens');
  });

  it('includes recent activity when events provided', async () => {
    const result = await getSummary({
      teamId: 'se-events',
      teamName: 'Test Team',
      tasks: [],
      events: [
        {
          id: 'e1',
          teamId: 'se-events',
          taskId: '1',
          taskSubject: 'Setup tests',
          oldStatus: 'pending' as const,
          newStatus: 'in_progress' as const,
          owner: 'lead',
          timestamp: new Date().toISOString(),
        },
      ],
      agentStats: [],
    });

    expect(result.summary).toContain('Recent activity');
  });

  it('returns isAIGenerated=false without API key', async () => {
    const result = await getSummary({
      teamId: 'se-noai',
      teamName: 'Test Team',
      tasks: [],
      events: [],
      agentStats: [],
    });

    expect(result.isAIGenerated).toBe(false);
  });

  it('returns cached result when inputs unchanged', async () => {
    const input = {
      teamId: 'se-cache',
      teamName: 'Test Team',
      tasks: [] as any[],
      events: [] as any[],
      agentStats: [] as any[],
    };

    const first = await getSummary(input);
    const second = await getSummary(input);

    expect(second.generatedAt).toBe(first.generatedAt);
  });

  it('regenerates on forceRefresh', async () => {
    const input = {
      teamId: 'se-refresh',
      teamName: 'Test Team',
      tasks: [] as any[],
      events: [] as any[],
      agentStats: [] as any[],
    };

    const first = await getSummary(input);
    await new Promise(r => setTimeout(r, 10));
    const second = await getSummary({ ...input, forceRefresh: true });

    expect(second.generatedAt).not.toBe(first.generatedAt);
  });

  it('invalidateSummary marks cache as stale', async () => {
    const input = {
      teamId: 'se-stale',
      teamName: 'Test Team',
      tasks: [] as any[],
      events: [] as any[],
      agentStats: [] as any[],
    };

    await getSummary(input);
    invalidateSummary('se-stale');

    const result = await getSummary(input);
    expect(result.isStale).toBe(true);
  });
});
