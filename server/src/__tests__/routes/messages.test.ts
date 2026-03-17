import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

let app: express.Express;
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evo-test-'));

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

  vi.doMock('../../mockData.js', () => ({
    getDemoCommLog: () => ({
      teamId: 'demo-team',
      messages: [{ id: 'demo-1', recipient: 'agent', sender: 'lead', text: 'hello', timestamp: '2024-01-01T00:00:00Z', color: '#fff', read: false }],
      agentNames: ['agent'],
    }),
    getDemoInboxSummary: () => ({
      teamId: 'demo-team',
      agents: [],
    }),
  }));

  const { default: messagesRouter } = await import('../../routes/messages.js');
  app = express();
  app.use(express.json());
  app.use('/api', messagesRouter);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('POST /api/teams/:id/agents/:name/respond', () => {
  it('returns 200 { ok: true } on success', async () => {
    const res = await request(app)
      .post('/api/teams/my-team/agents/worker/respond')
      .send({ message: 'Hello agent' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    // Verify file was created
    const inboxPath = path.join(tmpDir, 'my-team', 'inboxes', 'worker.json');
    const contents = JSON.parse(await fs.readFile(inboxPath, 'utf-8'));
    expect(contents).toHaveLength(1);
    expect(contents[0].text).toBe('Hello agent');
    expect(contents[0].from).toBe('human');
  });

  it('returns 403 for demo-team', async () => {
    const res = await request(app)
      .post('/api/teams/demo-team/agents/worker/respond')
      .send({ message: 'test' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('demo');
  });

  it('returns 400 for invalid agent name with special chars', async () => {
    // The regex /^[\w-]+$/ rejects names with dots, slashes, etc.
    const res = await request(app)
      .post('/api/teams/my-team/agents/evil.name/respond')
      .send({ message: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid');
  });

  it('returns 400 for empty message', async () => {
    const res = await request(app)
      .post('/api/teams/my-team/agents/worker/respond')
      .send({ message: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('non-empty');
  });

  it('returns 400 for missing message', async () => {
    const res = await request(app)
      .post('/api/teams/my-team/agents/worker/respond')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('GET /api/teams/:id/messages', () => {
  it('returns demo data for demo-team', async () => {
    const res = await request(app).get('/api/teams/demo-team/messages');

    expect(res.status).toBe(200);
    expect(res.body.teamId).toBe('demo-team');
    expect(res.body.messages).toHaveLength(1);
  });

  it('returns empty messages for non-existent team', async () => {
    const res = await request(app).get('/api/teams/nonexistent/messages');

    expect(res.status).toBe(200);
    expect(res.body.messages).toEqual([]);
    expect(res.body.agentNames).toEqual([]);
  });

  it('returns messages from inbox files', async () => {
    const inboxDir = path.join(tmpDir, 'real-team', 'inboxes');
    await fs.mkdir(inboxDir, { recursive: true });
    await fs.writeFile(
      path.join(inboxDir, 'agent-a.json'),
      JSON.stringify([
        { from: 'lead', text: 'do the work', timestamp: '2024-01-01T10:00:00Z', read: false },
      ]),
    );

    const res = await request(app).get('/api/teams/real-team/messages');

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.agentNames).toContain('agent-a');
    expect(res.body.messages[0].text).toBe('do the work');
  });
});
