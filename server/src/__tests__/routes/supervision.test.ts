import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

let app: express.Express;
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evo-supervision-test-'));

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

  const { default: feedbackRouter } = await import('../../routes/feedback.js');
  app = express();
  app.use(express.json());
  app.use('/api', feedbackRouter);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ── GET /api/teams/:id/supervision ──────────────────────────────────────────

describe('GET /api/teams/:id/supervision', () => {
  it('returns empty rules and default threshold when no TEAM_GUIDE exists', async () => {
    await fs.mkdir(path.join(tmpDir, 'my-team'), { recursive: true });

    const res = await request(app).get('/api/teams/my-team/supervision');

    expect(res.status).toBe(200);
    expect(res.body.rules).toEqual([]);
    expect(res.body.threshold).toBe(50);
  });

  it('parses rules from TEAM_GUIDE.md ## Supervision Rules section', async () => {
    const teamDir = path.join(tmpDir, 'my-team');
    await fs.mkdir(teamDir, { recursive: true });
    await fs.writeFile(path.join(teamDir, 'TEAM_GUIDE.md'), `# Team Guide

## Supervision Rules

<!-- supervision-threshold: 30 -->
<!-- sr:{"id":"sr-1","source":"manual","createdAt":"2026-01-01T00:00:00Z"} -->
- Always ask before running rm -rf
<!-- sr:{"id":"sr-2","source":"auto","createdAt":"2026-01-02T00:00:00Z","supportCount":5} -->
- Pause before modifying config files

## Other Section

Some other content.
`);

    const res = await request(app).get('/api/teams/my-team/supervision');

    expect(res.status).toBe(200);
    expect(res.body.rules).toHaveLength(2);
    expect(res.body.rules[0].text).toBe('Always ask before running rm -rf');
    expect(res.body.rules[0].source).toBe('manual');
    expect(res.body.rules[1].text).toBe('Pause before modifying config files');
    expect(res.body.rules[1].source).toBe('auto');
    expect(res.body.rules[1].supportCount).toBe(5);
    expect(res.body.threshold).toBe(30);
  });

  it('returns demo supervision rules for demo-team', async () => {
    const res = await request(app).get('/api/teams/demo-team/supervision');

    expect(res.status).toBe(200);
    expect(res.body.rules).toBeDefined();
    expect(res.body.threshold).toBeDefined();
  });
});

// ── PUT /api/teams/:id/supervision ──────────────────────────────────────────

describe('PUT /api/teams/:id/supervision', () => {
  it('writes rules to TEAM_GUIDE.md ## Supervision Rules section', async () => {
    const teamDir = path.join(tmpDir, 'my-team');
    await fs.mkdir(teamDir, { recursive: true });
    await fs.writeFile(path.join(teamDir, 'TEAM_GUIDE.md'), '# Team Guide\n\nSome content.\n');

    const rules = [
      { id: 'sr-1', text: 'Ask before deleting files', source: 'manual', createdAt: '2026-01-01T00:00:00Z' },
    ];

    const res = await request(app)
      .put('/api/teams/my-team/supervision')
      .send({ rules, threshold: 30 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify file was written
    const content = await fs.readFile(path.join(teamDir, 'TEAM_GUIDE.md'), 'utf-8');
    expect(content).toContain('## Supervision Rules');
    expect(content).toContain('Ask before deleting files');
    expect(content).toContain('supervision-threshold: 30');
  });

  it('creates TEAM_GUIDE.md if it does not exist', async () => {
    const teamDir = path.join(tmpDir, 'my-team');
    await fs.mkdir(teamDir, { recursive: true });

    const rules = [
      { id: 'sr-1', text: 'Always pause before deploy', source: 'manual', createdAt: '2026-01-01T00:00:00Z' },
    ];

    const res = await request(app)
      .put('/api/teams/my-team/supervision')
      .send({ rules, threshold: 70 });

    expect(res.status).toBe(200);
    const content = await fs.readFile(path.join(teamDir, 'TEAM_GUIDE.md'), 'utf-8');
    expect(content).toContain('Always pause before deploy');
  });

  it('returns 403 for demo-team', async () => {
    const res = await request(app)
      .put('/api/teams/demo-team/supervision')
      .send({ rules: [], threshold: 50 });

    expect(res.status).toBe(403);
  });

  it('preserves non-supervision content in TEAM_GUIDE.md', async () => {
    const teamDir = path.join(tmpDir, 'my-team');
    await fs.mkdir(teamDir, { recursive: true });
    await fs.writeFile(path.join(teamDir, 'TEAM_GUIDE.md'), `# Team Guide

## Workflow
Use feature branches.

## Supervision Rules

<!-- supervision-threshold: 50 -->
- Old rule

## Code Style
Use TypeScript.
`);

    const res = await request(app)
      .put('/api/teams/my-team/supervision')
      .send({ rules: [{ id: 'sr-new', text: 'New rule', source: 'manual', createdAt: '2026-01-01T00:00:00Z' }], threshold: 80 });

    expect(res.status).toBe(200);

    const content = await fs.readFile(path.join(teamDir, 'TEAM_GUIDE.md'), 'utf-8');
    expect(content).toContain('## Workflow');
    expect(content).toContain('Use feature branches.');
    expect(content).toContain('## Code Style');
    expect(content).toContain('New rule');
    expect(content).not.toContain('Old rule');
    expect(content).toContain('supervision-threshold: 80');
  });

  it('validates rules array is provided', async () => {
    const teamDir = path.join(tmpDir, 'my-team');
    await fs.mkdir(teamDir, { recursive: true });

    const res = await request(app)
      .put('/api/teams/my-team/supervision')
      .send({ threshold: 50 });

    expect(res.status).toBe(400);
  });
});
