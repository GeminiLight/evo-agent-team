import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { getDemoTeamSummary, getDemoTeamDetail, getDemoTimeline, getDemoTodos, getDemoSessionStats } from '../mockData.js';
import { recordSnapshot, getTimeline } from '../changeTracker.js';
import { detectHumanInputWaiters } from '../humanInputDetector.js';
import { getTodosForTeam } from '../todoScanner.js';
import { getSessionStatsForTeam } from '../sessionScanner.js';
import { getSessionHistory } from '../sessionHistory.js';
import type { Task, TeamConfig, TeamSummary, TeamDetail } from '../types.js';

const router = Router();

const HIDDEN_FILES = new Set(['.lock', '.highwatermark']);

function isHiddenFile(name: string): boolean {
  return name.startsWith('.') || HIDDEN_FILES.has(name);
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function getSubdirs(dirPath: string): Promise<string[]> {
  if (!(await dirExists(dirPath))) return [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function hasNonHiddenFiles(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.some((name) => !isHiddenFile(name));
  } catch {
    return false;
  }
}

// GET /api/teams
router.get('/teams', async (_req, res) => {
  try {
    const teamIds = new Set<string>();

    const [teamDirs, taskDirs] = await Promise.all([
      getSubdirs(config.teamsDir),
      getSubdirs(config.tasksDir),
    ]);

    // Teams from config dir (must have config.json)
    for (const dir of teamDirs) {
      const configPath = path.join(config.teamsDir, dir, 'config.json');
      const cfg = await readJsonFile<TeamConfig>(configPath);
      if (cfg) teamIds.add(dir);
    }

    // Teams from tasks dir (must have non-hidden files)
    for (const dir of taskDirs) {
      const taskDir = path.join(config.tasksDir, dir);
      if (await hasNonHiddenFiles(taskDir)) {
        teamIds.add(dir);
      }
    }

    const teams: TeamSummary[] = [];
    for (const id of teamIds) {
      const configPath = path.join(config.teamsDir, id, 'config.json');
      const cfg = await readJsonFile<TeamConfig>(configPath);
      const taskDir = path.join(config.tasksDir, id);
      let taskCount = 0;
      try {
        const files = await fs.readdir(taskDir);
        const jsonFiles = files.filter((f) => f.endsWith('.json') && !isHiddenFile(f));
        for (const file of jsonFiles) {
          const task = await readJsonFile<Task>(path.join(config.tasksDir, id, file));
          if (task && task.metadata?._internal !== true) taskCount++;
        }
      } catch {
        // no tasks dir for this team
      }

      teams.push({
        id,
        name: id,
        hasConfig: cfg !== null,
        memberCount: cfg?.members?.length ?? 0,
        taskCount,
      });
    }

    const isDemoMode =
      config.demoMode === 'on' ||
      (config.demoMode === 'auto' && teams.length === 0);

    if (isDemoMode) {
      teams.push(getDemoTeamSummary());
    }

    res.json({ teams, isDemoMode });
  } catch (err) {
    console.error('Error listing teams:', err);
    res.status(500).json({ error: 'Failed to list teams' });
  }
});

// GET /api/teams/:id
router.get('/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id === 'demo-team') {
      res.json(getDemoTeamDetail());
      return;
    }

    // Read config
    const configPath = path.join(config.teamsDir, id, 'config.json');
    const teamConfig = await readJsonFile<TeamConfig>(configPath);

    // Read tasks
    const taskDir = path.join(config.tasksDir, id);
    const tasks: Task[] = [];

    if (await dirExists(taskDir)) {
      const files = await fs.readdir(taskDir);
      const jsonFiles = files.filter(
        (f) => f.endsWith('.json') && !isHiddenFile(f)
      );

      for (const file of jsonFiles) {
        const task = await readJsonFile<Task>(path.join(taskDir, file));
        if (task && task.metadata?._internal !== true) {
          tasks.push(task);
        }
      }
    }

    // Sort tasks by numeric id
    tasks.sort((a, b) => {
      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.id.localeCompare(b.id);
    });

    const detail: TeamDetail = {
      id,
      name: id,
      config: teamConfig,
      tasks,
      stats: {
        total: tasks.length,
        pending: tasks.filter((t) => t.status === 'pending').length,
        inProgress: tasks.filter((t) => t.status === 'in_progress').length,
        completed: tasks.filter((t) => t.status === 'completed').length,
      },
    };

    recordSnapshot(id, tasks);
    res.json(detail);
  } catch (err) {
    console.error(`Error getting team ${req.params.id}:`, err);
    res.status(500).json({ error: 'Failed to get team details' });
  }
});

// PATCH /api/teams/:id/members/:agentName/prompt
router.patch('/teams/:id/members/:agentName/prompt', async (req, res) => {
  const { id, agentName } = req.params;

  if (id === 'demo-team') {
    res.status(403).json({ error: 'Cannot modify demo team' });
    return;
  }

  const { prompt } = req.body;
  if (typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt must be a string' });
    return;
  }

  const configPath = path.join(config.teamsDir, id, 'config.json');
  const teamConfig = await readJsonFile<TeamConfig>(configPath);
  if (!teamConfig) {
    res.status(404).json({ error: 'Team config not found' });
    return;
  }

  const member = teamConfig.members.find(m => m.name === agentName);
  if (!member) {
    res.status(404).json({ error: `Agent "${agentName}" not found` });
    return;
  }

  member.prompt = prompt;

  try {
    await fs.writeFile(configPath, JSON.stringify(teamConfig, null, 2), 'utf-8');
    res.json({ ok: true, name: member.name, prompt: member.prompt });
  } catch (err) {
    console.error('Error writing config:', err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// GET /api/teams/:id/human-input-status
router.get('/teams/:id/human-input-status', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    // Demo: return empty list (no real sessions to scan)
    res.json({ teamId: id, waitingAgents: [] });
    return;
  }

  const configPath = path.join(config.teamsDir, id, 'config.json');
  const teamConfig = await readJsonFile<TeamConfig>(configPath);

  if (!teamConfig?.members?.length) {
    res.json({ teamId: id, waitingAgents: [] });
    return;
  }

  const memberNames = teamConfig.members.map(m => m.name);
  const memberCwds = teamConfig.members.map(m => m.cwd ?? '').filter(Boolean);
  const leadSessionId = teamConfig.leadSessionId;

  try {
    const status = await detectHumanInputWaiters(memberNames, memberCwds, leadSessionId);
    res.json({ teamId: id, waitingAgents: status.waitingAgents, details: status.details });
  } catch (err) {
    console.error(`Error detecting human input status for ${id}:`, err);
    res.json({ teamId: id, waitingAgents: [], details: [] });
  }
});

// GET /api/teams/:id/guide
router.get('/teams/:id/guide', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.json({
      teamId: id,
      content: `# Demo Team — Guide\n\nThis is a demo team with no real guide file.\n\nCreate a \`TEAM_GUIDE.md\` in \`~/.claude/teams/${id}/\` to document your team's purpose, workflow, and coordination rules.`,
      filename: 'TEAM_GUIDE.md',
    });
    return;
  }

  const guidePath = path.join(config.teamsDir, id, 'TEAM_GUIDE.md');
  try {
    const content = await fs.readFile(guidePath, 'utf-8');
    res.json({ teamId: id, content, filename: 'TEAM_GUIDE.md' });
  } catch {
    res.json({ teamId: id, content: null, filename: 'TEAM_GUIDE.md' });
  }
});

// GET /api/teams/:id/todos
router.get('/teams/:id/todos', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.json(getDemoTodos());
    return;
  }

  const configPath = path.join(config.teamsDir, id, 'config.json');
  const teamConfig = await readJsonFile<TeamConfig>(configPath);

  if (!teamConfig?.members?.length) {
    res.json({ teamId: id, sessions: [] });
    return;
  }

  const memberCwds    = teamConfig.members.map(m => m.cwd ?? '').filter(Boolean);
  const leadSessionId = teamConfig.leadSessionId;

  try {
    const result = await getTodosForTeam(memberCwds, leadSessionId);
    res.json({ teamId: id, sessions: result.sessions });
  } catch (err) {
    console.error(`Error getting todos for ${id}:`, err);
    res.json({ teamId: id, todos: {} });
  }
});

// GET /api/teams/:id/session-stats
router.get('/teams/:id/session-stats', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.json(getDemoSessionStats());
    return;
  }

  const configPath = path.join(config.teamsDir, id, 'config.json');
  const teamConfig = await readJsonFile<TeamConfig>(configPath);

  if (!teamConfig?.members?.length) {
    res.json({ teamId: id, agents: [] });
    return;
  }

  const memberNames   = teamConfig.members.map(m => m.name);
  const memberCwds    = teamConfig.members.map(m => m.cwd ?? '').filter(Boolean);
  const leadSessionId = teamConfig.leadSessionId;
  const leadName      = teamConfig.leadAgentId
    ? teamConfig.leadAgentId.split('@')[0]
    : teamConfig.members.find(m => !m.backendType)?.name;

  try {
    const agents = await getSessionStatsForTeam(memberNames, memberCwds, leadSessionId, leadName);
    res.json({ teamId: id, agents });
  } catch (err) {
    console.error(`Error getting session stats for ${id}:`, err);
    res.json({ teamId: id, agents: [] });
  }
});

// GET /api/teams/:id/session-history
router.get('/teams/:id/session-history', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.json({ teamId: id, sessionId: null, messages: [] });
    return;
  }

  const configPath = path.join(config.teamsDir, id, 'config.json');
  const teamConfig = await readJsonFile<TeamConfig>(configPath);
  const leadSessionId = teamConfig?.leadSessionId;

  if (!leadSessionId) {
    res.json({ teamId: id, sessionId: null, messages: [] });
    return;
  }

  const memberCwds = (teamConfig?.members ?? []).map(m => m.cwd ?? '').filter(Boolean);

  try {
    const messages = await getSessionHistory(memberCwds, leadSessionId);
    res.json({ teamId: id, sessionId: leadSessionId, messages });
  } catch (err) {
    console.error(`Error reading session history for ${id}:`, err);
    res.json({ teamId: id, sessionId: leadSessionId, messages: [] });
  }
});

// GET /api/teams/:id/timeline
router.get('/teams/:id/timeline', async (req, res) => {
  const { id } = req.params;
  if (id === 'demo-team') {
    res.json(getDemoTimeline());
    return;
  }
  res.json({ teamId: id, events: getTimeline(id) });
});

// GET /api/config
router.get('/config', (_req, res) => {
  res.json({
    teamsDir: config.teamsDir,
    tasksDir: config.tasksDir,
    port: config.port,
    pollIntervalMs: config.pollIntervalMs,
    demoMode: config.demoMode,
  });
});

// POST /api/config
router.post('/config', (req, res) => {
  const { teamsDir, tasksDir, pollIntervalMs, demoMode } = req.body;

  if (typeof teamsDir === 'string') config.teamsDir = teamsDir;
  if (typeof tasksDir === 'string') config.tasksDir = tasksDir;
  if (typeof pollIntervalMs === 'number' && pollIntervalMs > 0) {
    config.pollIntervalMs = pollIntervalMs;
  }
  if (demoMode === 'auto' || demoMode === 'on' || demoMode === 'off') {
    config.demoMode = demoMode;
  }

  res.json({
    teamsDir: config.teamsDir,
    tasksDir: config.tasksDir,
    port: config.port,
    pollIntervalMs: config.pollIntervalMs,
    demoMode: config.demoMode,
  });
});

export default router;
