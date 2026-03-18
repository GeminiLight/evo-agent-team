import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import {
  readJsonFile,
  findMemoryPath,
  getTeamCwd,
  getAppConfig,
  readTeamGuide,
  readPreferences,
  preferencesToText,
  estimateTokens,
  CONTEXT_SUMMARY_TOKEN_BUDGET,
  PROJECTS_DIRS,
  encodeCwd,
  dirExists,
  isHiddenFile,
} from './helpers.js';
import { getDemoMemory, getDemoContextSummary } from '../mockData.js';
import { getTimeline } from '../changeTracker.js';
import { getSessionStatsForTeam } from '../sessionScanner.js';
import { getSessionHistory } from '../sessionHistory.js';
import { getSummary } from '../summaryEngine.js';
import { llmComplete, isLLMConfigured } from '../llm.js';
import type { Task, TeamConfig } from '../types.js';

const router = Router();

// GET /api/teams/:id/memory — read MEMORY.md
router.get('/teams/:id/memory', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.json(getDemoMemory());
    return;
  }

  const config = getAppConfig();
  const configPath = path.join(config.teamsDir, id, 'config.json');
  const teamConfig = await readJsonFile<TeamConfig>(configPath);
  const cwd = getTeamCwd(teamConfig);

  if (!cwd) {
    res.json({ content: '', path: null, lastModified: null, source: null });
    return;
  }

  const found = await findMemoryPath(cwd);
  if (!found) {
    // Return empty but include the expected path for creation
    const encoded = encodeCwd(cwd);
    const expectedPath = path.join(PROJECTS_DIRS[0], encoded, 'memory', 'MEMORY.md');
    res.json({ content: '', path: expectedPath, lastModified: null, source: null });
    return;
  }

  try {
    const content = await fs.readFile(found.filePath, 'utf-8');
    const stat = await fs.stat(found.filePath);
    res.json({
      content,
      path: found.filePath,
      lastModified: stat.mtime.toISOString(),
      source: found.source,
    });
  } catch {
    res.json({ content: '', path: found.filePath, lastModified: null, source: found.source });
  }
});

// PUT /api/teams/:id/memory — write MEMORY.md
router.put('/teams/:id/memory', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.status(403).json({ error: 'Not available in demo mode' });
    return;
  }

  const { content } = req.body;
  if (typeof content !== 'string') {
    res.status(400).json({ error: 'content (string) is required' });
    return;
  }

  const config = getAppConfig();
  const configPath = path.join(config.teamsDir, id, 'config.json');
  const teamConfig = await readJsonFile<TeamConfig>(configPath);
  const cwd = getTeamCwd(teamConfig);

  if (!cwd) {
    res.status(400).json({ error: 'Team has no cwd configured' });
    return;
  }

  // Write to existing location, or create in primary projects dir
  const found = await findMemoryPath(cwd);
  const targetPath = found
    ? found.filePath
    : path.join(PROJECTS_DIRS[0], encodeCwd(cwd), 'memory', 'MEMORY.md');

  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf-8');
    res.json({ ok: true, path: targetPath });
  } catch (err) {
    console.error('[memory/put] write error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to write memory file' });
  }
});

// POST /api/teams/:id/memory/extract — LLM extract from session history
router.post('/teams/:id/memory/extract', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.json({
      suggestions: [
        'Project uses React + TypeScript with Vite bundler',
        'CRT aesthetic theme with phosphor green primary color',
        'REST API follows Express router pattern with typed responses',
      ],
      merged: getDemoMemory().content,
    });
    return;
  }

  const config = getAppConfig();
  const configPath = path.join(config.teamsDir, id, 'config.json');
  const teamConfig = await readJsonFile<TeamConfig>(configPath);
  if (!teamConfig) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }

  const cwd = getTeamCwd(teamConfig);

  // Read current memory
  let currentMemory = '';
  if (cwd) {
    const found = await findMemoryPath(cwd);
    if (found) {
      try { currentMemory = await fs.readFile(found.filePath, 'utf-8'); } catch { /* empty */ }
    }
  }

  // Read session history
  const memberCwds = teamConfig.members.map(m => m.cwd).filter(Boolean) as string[];
  const leadSessionId = teamConfig.leadSessionId ?? '';
  let sessionSnippet = '';
  if (leadSessionId && memberCwds.length > 0) {
    try {
      const messages = await getSessionHistory(memberCwds, leadSessionId);
      // Take last 10 assistant text messages as context
      const assistantTexts = messages
        .filter(m => m.role === 'assistant')
        .slice(-10)
        .flatMap(m => m.entries.filter(e => e.kind === 'text' && e.text).map(e => e.text!.slice(0, 500)));
      sessionSnippet = assistantTexts.join('\n\n---\n\n').slice(0, 4000);
    } catch { /* no session data */ }
  }

  if (!sessionSnippet && !currentMemory) {
    res.json({ suggestions: [], merged: '' });
    return;
  }

  if (!isLLMConfigured()) {
    res.status(503).json({ error: 'LLM not configured' });
    return;
  }

  try {
    const prompt = `You are a memory extraction assistant. Given:
1. Current MEMORY.md content (may be empty)
2. Recent session activity (messages, tool calls, decisions)

Extract NEW information that should be remembered for future sessions:
- Key architectural decisions
- New patterns or conventions established
- Important file paths and their purposes
- Resolved bugs and their root causes
- Configuration changes

Current MEMORY.md:
\`\`\`
${currentMemory || '(empty)'}
\`\`\`

Recent session activity:
\`\`\`
${sessionSnippet || '(no session data)'}
\`\`\`

Output a JSON object with exactly this structure:
{ "suggestions": ["item1", "item2", ...], "merged": "full updated MEMORY.md content" }

The "suggestions" array should contain only NEW items not already in the current memory.
The "merged" string should be the complete updated MEMORY.md incorporating both existing and new information.
Return ONLY valid JSON, no markdown fences.`;

    const raw = await llmComplete(prompt, 2000);
    // Try to parse JSON, handling possible markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
    const parsed = JSON.parse(cleaned);
    res.json({
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      merged: typeof parsed.merged === 'string' ? parsed.merged : currentMemory,
    });
  } catch (err) {
    console.error('[memory/extract] LLM error:', (err as Error).message);
    res.json({ suggestions: [], merged: currentMemory });
  }
});

// GET /api/teams/:id/context-summary
router.get('/teams/:id/context-summary', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    const demo = getDemoContextSummary();
    res.json({ ...demo, tokenEstimate: estimateTokens(demo.content) });
    return;
  }

  const config = getAppConfig();
  const filePath = path.join(config.teamsDir, id, 'context-summary.md');
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const stat = await fs.stat(filePath);
    res.json({
      content,
      path: filePath,
      lastModified: stat.mtime.toISOString(),
      tokenEstimate: estimateTokens(content),
    });
  } catch {
    res.json({ content: '', path: filePath, lastModified: null, tokenEstimate: 0 });
  }
});

// PUT /api/teams/:id/context-summary
router.put('/teams/:id/context-summary', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.status(403).json({ error: 'Not available in demo mode' });
    return;
  }

  const { content } = req.body;
  if (typeof content !== 'string') {
    res.status(400).json({ error: 'content (string) is required' });
    return;
  }

  const config = getAppConfig();
  const filePath = path.join(config.teamsDir, id, 'context-summary.md');
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    const tokenEstimate = estimateTokens(content);
    res.json({
      ok: true,
      path: filePath,
      tokenEstimate,
      ...(tokenEstimate > CONTEXT_SUMMARY_TOKEN_BUDGET ? { warning: 'exceeds_budget' } : {}),
    });
  } catch (err) {
    console.error('[context-summary/put] write error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to write context summary' });
  }
});

// POST /api/teams/:id/context-summary/generate
router.post('/teams/:id/context-summary/generate', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    const demo = getDemoContextSummary();
    res.json({ content: demo.content, tokenEstimate: estimateTokens(demo.content), sources: ['demo'] });
    return;
  }

  if (!isLLMConfigured()) {
    res.status(503).json({ error: 'LLM not configured' });
    return;
  }

  const config = getAppConfig();
  const configPath = path.join(config.teamsDir, id, 'config.json');
  const teamConfig = await readJsonFile<TeamConfig>(configPath);
  if (!teamConfig) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }

  // Gather data sources
  const sources: string[] = [];

  // 1. Existing context-summary
  let existing = '';
  try {
    existing = await fs.readFile(path.join(config.teamsDir, id, 'context-summary.md'), 'utf-8');
    sources.push('existing-context-summary');
  } catch { /* no existing */ }

  // 2. Read tasks once — shared by exec summary and task list summary
  const taskDir = path.join(config.tasksDir, id);
  const allTasks: Task[] = [];
  if (await dirExists(taskDir)) {
    try {
      const files = await fs.readdir(taskDir);
      for (const file of files.filter(f => f.endsWith('.json') && !isHiddenFile(f)).slice(0, 30)) {
        const task = await readJsonFile<Task>(path.join(taskDir, file));
        if (task && task.metadata?._internal !== true) allTasks.push(task);
      }
    } catch { /* */ }
  }

  // 3. D0 exec summary — use cached summary if available, don't trigger heavy pipeline
  let execSummaryText = '';
  try {
    const teamName = teamConfig.name ?? id;
    const memberNames = teamConfig.members.map(m => m.name) ?? [];
    const memberCwds = teamConfig.members.map(m => m.cwd ?? '').filter(Boolean) ?? [];
    const leadSessionId = teamConfig.leadSessionId;
    const leadName = teamConfig.members.find(m => !m.backendType)?.name;

    let agentStats: import('../types.js').AgentSessionStats[] = [];
    try { agentStats = await getSessionStatsForTeam(memberNames, memberCwds, leadSessionId, leadName); } catch { /* */ }

    const events = getTimeline(id);
    let sessionMessages: Array<{ role: string; entries: Array<{ kind: string; text?: string }> }> = [];
    if (leadSessionId) {
      try { sessionMessages = await getSessionHistory(memberCwds, leadSessionId); } catch { /* */ }
    }

    const summaryResult = await getSummary({ teamId: id, teamName, tasks: allTasks, events, agentStats, sessionMessages });
    execSummaryText = summaryResult.summary.slice(0, 500);
    if (execSummaryText) sources.push('exec-summary');
  } catch { /* non-critical */ }

  // 3. MEMORY.md
  let memoryText = '';
  const cwd = getTeamCwd(teamConfig);
  if (cwd) {
    const found = await findMemoryPath(cwd);
    if (found) {
      try { memoryText = (await fs.readFile(found.filePath, 'utf-8')).slice(0, 2000); sources.push('memory'); } catch { /* */ }
    }
  }

  // 4. TEAM_GUIDE.md
  let guideText = '';
  try {
    guideText = (await readTeamGuide(id, teamConfig)).slice(0, 1000);
    if (guideText) sources.push('team-guide');
  } catch { /* */ }

  // 5. Task list summary (reuse allTasks from step 2)
  let taskSummary = '';
  if (allTasks.length > 0) {
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
    const pending = allTasks.filter(t => t.status === 'pending').length;
    taskSummary = `Tasks: ${completed} done, ${inProgress} active, ${pending} pending\n`;
    taskSummary += allTasks.slice(0, 15).map(t => `[${t.status}] ${t.subject}`).join('\n');
    sources.push('tasks');
  }

  if (!existing && !execSummaryText && !memoryText && !guideText && !taskSummary) {
    res.json({ content: '', tokenEstimate: 0, sources: [] });
    return;
  }

  const prompt = `You are a context summary generator for an AI agent team.
Generate a concise context-summary.md with EXACTLY 3 sections:

## Decisions
Key architectural decisions and design choices (date-stamped with [YYYY-MM-DD]).

## Progress
Completed milestones and current stage status.

## Context
Current environment, configurations, active blockers.

CONSTRAINTS:
- Total length: under 3000 characters (~4K tokens)
- Each item is a single-line bullet starting with "- "
- Decisions items start with "[YYYY-MM-DD]"
- Be specific (file paths, port numbers, model names), not generic
- If updating existing content, preserve still-valid items and add new ones
- Remove outdated items from Context section first if over budget

EXISTING CONTEXT SUMMARY:
${existing || '(none — creating fresh)'}

EXECUTIVE SUMMARY:
${execSummaryText || '(unavailable)'}

MEMORY.md:
${memoryText || '(empty)'}

TEAM_GUIDE.md (excerpt):
${guideText || '(empty)'}

TASK LIST:
${taskSummary || '(no tasks)'}

Output the FULL context-summary.md content starting with "# Context Summary", nothing else.`;

  try {
    const content = (await llmComplete(prompt, 1200)).trim();
    res.json({ content, tokenEstimate: estimateTokens(content), sources });
  } catch (err) {
    console.error('[context-summary/generate] LLM error:', (err as Error).message);
    res.status(500).json({ error: 'LLM generation failed' });
  }
});

export default router;
