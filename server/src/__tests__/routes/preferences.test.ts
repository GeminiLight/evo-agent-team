import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

let app: express.Express;
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evo-pref-test-'));

  vi.resetModules();
  vi.doMock('../../config.js', () => ({
    config: {
      teamsDir: tmpDir,
      tasksDir: path.join(tmpDir, 'tasks'),
      port: 3099,
      pollIntervalMs: 2000,
      demoMode: 'auto',
    },
  }));

  // Stub all non-preference dependencies
  const noop = () => ({});
  vi.doMock('../../mockData.js', () => ({
    getDemoTeamSummary: () => [],
    getDemoTeamDetail: noop,
    getDemoTimeline: noop,
    getDemoTodos: noop,
    getDemoSessionStats: noop,
    getDemoAlerts: noop,
    getDemoAgentSessions: noop,
    getDemoCostData: noop,
    getDemoExecSummary: noop,
    getDemoFeedbackEntries: () => [],
    getDemoPreferences: () => ({}),
    getDemoMemory: () => ({ content: '', path: null }),
  }));
  vi.doMock('../../changeTracker.js', () => ({ recordSnapshot: noop, getTimeline: () => [] }));
  vi.doMock('../../humanInputDetector.js', () => ({ detectHumanInputWaiters: async () => ({}) }));
  vi.doMock('../../todoScanner.js', () => ({ getTodosForTeam: async () => [] }));
  vi.doMock('../../sessionScanner.js', () => ({ getSessionStatsForTeam: async () => [] }));
  vi.doMock('../../sessionHistory.js', () => ({ getSessionHistory: async () => [], listAvailableAgentSessions: async () => [] }));
  vi.doMock('../../alertEngine.js', () => ({ computeAlerts: () => [], DEFAULT_THRESHOLDS: {} }));
  vi.doMock('../../summaryEngine.js', () => ({ getSummary: async () => ({}), invalidateSummary: noop }));

  const { default: teamsRouter } = await import('../../routes/teams.js');
  const { default: preferencesRouter } = await import('../../routes/preferences.js');
  const { default: feedbackRouter } = await import('../../routes/feedback.js');
  app = express();
  app.use(express.json());
  app.use('/api', teamsRouter);
  app.use('/api', preferencesRouter);
  app.use('/api', feedbackRouter);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ── Helper: seed feedback file ──
async function seedFeedback(teamId: string, agentName: string, entries: object[]) {
  const fbDir = path.join(tmpDir, teamId, 'feedback');
  await fs.mkdir(fbDir, { recursive: true });
  const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  await fs.writeFile(path.join(fbDir, `${agentName}.jsonl`), content, 'utf-8');
}

// ── Helper: seed preferences file ──
async function seedPreferences(teamId: string, prefs: Record<string, unknown[]>) {
  const teamDir = path.join(tmpDir, teamId);
  await fs.mkdir(teamDir, { recursive: true });
  await fs.writeFile(path.join(teamDir, 'preferences.json'), JSON.stringify(prefs, null, 2), 'utf-8');
}

// ── GET /preferences ──

describe('GET /api/teams/:id/preferences', () => {
  it('returns empty object when no preferences file', async () => {
    const res = await request(app).get('/api/teams/test-team/preferences');
    expect(res.status).toBe(200);
    expect(res.body.preferences).toEqual({});
  });

  it('normalizes legacy string entries to PreferenceRule objects', async () => {
    await seedPreferences('test-team', {
      'agent-a': ['Use TypeScript', 'Always test'],
    });

    const res = await request(app).get('/api/teams/test-team/preferences');
    expect(res.status).toBe(200);

    const rules = res.body.preferences['agent-a'];
    expect(rules).toHaveLength(2);
    expect(rules[0].rule).toBe('Use TypeScript');
    expect(rules[0].confidence).toBe('confirmed');
    expect(rules[0].source).toBe('manual');
    expect(rules[0].id).toMatch(/^pref-legacy-/);
    expect(rules[1].rule).toBe('Always test');
  });

  it('passes through structured PreferenceRule entries unchanged', async () => {
    const structuredRule = {
      id: 'pref-123',
      rule: 'Prefer modular design',
      confidence: 'tentative',
      supportCount: 2,
      sourceEntryIds: ['fb-1'],
      createdAt: '2026-03-18T00:00:00Z',
      source: 'auto',
    };
    await seedPreferences('test-team', {
      'agent-b': [structuredRule],
    });

    const res = await request(app).get('/api/teams/test-team/preferences');
    const rules = res.body.preferences['agent-b'];
    expect(rules[0].id).toBe('pref-123');
    expect(rules[0].confidence).toBe('tentative');
    expect(rules[0].supportCount).toBe(2);
  });
});

// ── PUT /preferences ──

describe('PUT /api/teams/:id/preferences', () => {
  it('writes structured preferences', async () => {
    const prefs = {
      'agent-a': ['Rule one', 'Rule two'],
    };

    const res = await request(app)
      .put('/api/teams/test-team/preferences')
      .send({ preferences: prefs });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Written entries should be normalized
    expect(res.body.preferences['agent-a'][0].rule).toBe('Rule one');
    expect(res.body.preferences['agent-a'][0].id).toMatch(/^pref-legacy-/);
  });

  it('returns 400 if preferences missing', async () => {
    const res = await request(app)
      .put('/api/teams/test-team/preferences')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 403 for demo-team', async () => {
    const res = await request(app)
      .put('/api/teams/demo-team/preferences')
      .send({ preferences: {} });

    expect(res.status).toBe(403);
  });
});

// ── POST /feedback/apply with structured entries ──

describe('POST /api/teams/:id/feedback/apply', () => {
  it('writes PreferenceRule objects (not plain strings)', async () => {
    await seedPreferences('test-team', {});
    await seedFeedback('test-team', 'worker', [
      { id: 'fb-1', type: 'correction', content: 'fix something', createdAt: '2026-03-18T00:00:00Z' },
    ]);

    const accepted = [{
      id: 's1', target: 'worker', action: 'add', rule: 'Always fix things',
      reason: 'test', supportingFeedbackIds: ['fb-1'],
    }];

    const res = await request(app)
      .post('/api/teams/test-team/feedback/apply')
      .send({ accepted, sourceEntryId: 'fb-1' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const rules = res.body.preferences['worker'];
    expect(rules).toHaveLength(1);
    expect(rules[0].rule).toBe('Always fix things');
    expect(rules[0].id).toMatch(/^pref-/);
    expect(rules[0].confidence).toBe('tentative'); // 1 feedback < 3
    expect(rules[0].sourceEntryIds).toEqual(['fb-1']);
  });

  it('deduplicates when rule already exists', async () => {
    await seedPreferences('test-team', {
      worker: [{
        id: 'pref-existing',
        rule: 'Already exists',
        confidence: 'confirmed',
        supportCount: 3,
        sourceEntryIds: [],
        createdAt: '2026-03-17T00:00:00Z',
        source: 'manual',
      }],
    });

    const accepted = [{
      id: 's1', target: 'worker', action: 'add', rule: 'Already exists', reason: 'dup',
    }];

    const res = await request(app)
      .post('/api/teams/test-team/feedback/apply')
      .send({ accepted });

    expect(res.status).toBe(200);
    // Should still be 1, not 2
    expect(res.body.preferences['worker']).toHaveLength(1);
    expect(res.body.preferences['worker'][0].id).toBe('pref-existing');
  });

  it('sets confidence to confirmed when 3+ supporting feedback', async () => {
    await seedPreferences('test-team', {});

    const accepted = [{
      id: 's1', target: 'worker', action: 'add', rule: 'High confidence rule',
      reason: 'repeated', supportingFeedbackIds: ['fb-1', 'fb-2', 'fb-3'],
    }];

    const res = await request(app)
      .post('/api/teams/test-team/feedback/apply')
      .send({ accepted });

    expect(res.body.preferences['worker'][0].confidence).toBe('confirmed');
  });

  it('removes rules by text (works with structured entries)', async () => {
    await seedPreferences('test-team', {
      worker: [{
        id: 'pref-to-remove',
        rule: 'Remove me',
        confidence: 'confirmed',
        supportCount: 1,
        sourceEntryIds: [],
        createdAt: '2026-03-17T00:00:00Z',
        source: 'manual',
      }],
    });

    const accepted = [{
      id: 's1', target: 'worker', action: 'remove', rule: 'Remove me', reason: 'test',
    }];

    const res = await request(app)
      .post('/api/teams/test-team/feedback/apply')
      .send({ accepted });

    expect(res.status).toBe(200);
    expect(res.body.preferences['worker'] ?? []).toHaveLength(0);
  });
});

// ── POST /preferences/promote ──

describe('POST /api/teams/:id/preferences/promote', () => {
  it('removes rule from agent and updates TEAM_GUIDE', async () => {
    // Seed preferences with a confirmed rule
    await seedPreferences('test-team', {
      worker: [{
        id: 'pref-promote-me',
        rule: 'Shared rule for everyone',
        confidence: 'confirmed',
        supportCount: 5,
        sourceEntryIds: [],
        createdAt: '2026-03-17T00:00:00Z',
        source: 'auto',
      }],
    });

    // Seed config.json with cwd so TEAM_GUIDE path can be resolved
    const configPath = path.join(tmpDir, 'test-team', 'config.json');
    const cwdDir = path.join(tmpDir, 'project-cwd');
    await fs.mkdir(cwdDir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify({
      members: [{ name: 'worker', cwd: cwdDir }],
    }), 'utf-8');

    const res = await request(app)
      .post('/api/teams/test-team/preferences/promote')
      .send({ ruleId: 'pref-promote-me', fromAgent: 'worker' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.guideUpdated).toBe(true);

    // Rule should be removed from agent preferences
    expect(res.body.preferences['worker'] ?? []).toHaveLength(0);

    // TEAM_GUIDE.md should contain the rule
    const guideContent = await fs.readFile(path.join(cwdDir, 'TEAM_GUIDE.md'), 'utf-8');
    expect(guideContent).toContain('Shared rule for everyone');
  });

  it('returns 400 if ruleId missing', async () => {
    const res = await request(app)
      .post('/api/teams/test-team/preferences/promote')
      .send({ fromAgent: 'worker' });

    expect(res.status).toBe(400);
  });

  it('returns 404 if rule not found', async () => {
    await seedPreferences('test-team', { worker: [] });

    const res = await request(app)
      .post('/api/teams/test-team/preferences/promote')
      .send({ ruleId: 'nonexistent', fromAgent: 'worker' });

    expect(res.status).toBe(404);
  });

  it('returns 403 for demo-team', async () => {
    const res = await request(app)
      .post('/api/teams/demo-team/preferences/promote')
      .send({ ruleId: 'pref-1', fromAgent: 'worker' });

    expect(res.status).toBe(403);
  });
});

// ── POST /preferences/discover ──

describe('POST /api/teams/:id/preferences/discover', () => {
  it('returns 503 when LLM is not configured', async () => {
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;

    const res = await request(app)
      .post('/api/teams/test-team/preferences/discover')
      .send({});

    expect(res.status).toBe(503);
    expect(res.body.error).toContain('LLM not configured');
  });

  it('returns empty discoveries when no feedback', async () => {
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_BASE_URL = 'http://localhost:1234/v1';

    const res = await request(app)
      .post('/api/teams/test-team/preferences/discover')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toEqual([]);
    expect(res.body.stats.totalFeedback).toBe(0);

    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
  });

  it('returns 403 for demo-team', async () => {
    const res = await request(app)
      .post('/api/teams/demo-team/preferences/discover')
      .send({});

    expect(res.status).toBe(403);
  });
});
