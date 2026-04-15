import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import {
  getAppConfig,
  readPreferences,
  writePreferences,
  getRuleText,
  findRule,
  markFeedbackProcessed,
  cleanEmptyAgents,
  appendRuleToPreferencesSection,
} from './helpers.js';
import { getDemoFeedbackEntries } from '../mockData.js';
import { llmComplete, isLLMConfigured } from '../llm.js';
import type { TeamConfig, PreferenceRule } from '../types.js';

const router = Router();

// GET /api/teams/:id/feedback  — list all feedback entries across all agents
router.get('/teams/:id/feedback', async (req, res) => {
  const { id } = req.params;
  if (id === 'demo-team') {
    res.json({ teamId: id, entries: getDemoFeedbackEntries() });
    return;
  }

  const feedbackDir = path.join(getAppConfig().teamsDir, id, 'feedback');
  const entries: unknown[] = [];

  try {
    const files = await fs.readdir(feedbackDir);
    for (const file of files.filter(f => f.endsWith('.jsonl'))) {
      const raw = await fs.readFile(path.join(feedbackDir, file), 'utf-8');
      for (const line of raw.split('\n').filter(Boolean)) {
        try { entries.push(JSON.parse(line)); } catch { /* skip bad lines */ }
      }
    }
  } catch { /* dir may not exist yet */ }

  // Sort newest first
  entries.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ teamId: id, entries });
});

// DELETE /api/teams/:id/feedback/:entryId  — delete a single feedback entry
router.delete('/teams/:id/feedback/:entryId', async (req, res) => {
  const { id, entryId } = req.params;
  if (id === 'demo-team') {
    res.status(403).json({ error: 'Not available in demo mode' });
    return;
  }

  const feedbackDir = path.join(getAppConfig().teamsDir, id, 'feedback');
  let deleted = false;

  try {
    const files = await fs.readdir(feedbackDir);
    for (const file of files.filter(f => f.endsWith('.jsonl'))) {
      const filePath = path.join(feedbackDir, file);
      const raw = await fs.readFile(filePath, 'utf-8');
      const lines = raw.split('\n').filter(Boolean);
      const filtered = lines.filter(line => {
        try { return JSON.parse(line).id !== entryId; } catch { return true; }
      });
      if (filtered.length < lines.length) {
        await fs.writeFile(filePath, filtered.map(l => l + '\n').join(''), 'utf-8');
        deleted = true;
        break;
      }
    }
  } catch { /* ignore */ }

  if (deleted) res.json({ ok: true });
  else res.status(404).json({ error: 'Entry not found' });
});

// POST /api/teams/:id/feedback  — append a feedback entry to feedback/{agentName}.jsonl
router.post('/teams/:id/feedback', async (req, res) => {
  const { id } = req.params;
  if (id === 'demo-team') {
    res.status(403).json({ error: 'Not available in demo mode' });
    return;
  }
  const { agentName, messageUuid, sessionId, type, content, context } = req.body as {
    agentName?: string;
    messageUuid?: string;
    sessionId?: string;
    type?: string;
    content?: string;
    context?: Record<string, unknown>;
  };
  if (!agentName || !/^[\w-]+$/.test(agentName)) {
    res.status(400).json({ error: 'Invalid agentName' });
    return;
  }
  if (!type || !['praise', 'correction', 'bookmark'].includes(type)) {
    res.status(400).json({ error: 'type must be praise | correction | bookmark' });
    return;
  }
  if (type === 'correction' && (!content || !content.trim())) {
    res.status(400).json({ error: 'correction requires content' });
    return;
  }

  const feedbackDir = path.join(getAppConfig().teamsDir, id, 'feedback');
  await fs.mkdir(feedbackDir, { recursive: true });
  const filePath = path.join(feedbackDir, `${agentName}.jsonl`);

  const entry = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sessionId: sessionId ?? null,
    messageUuid: messageUuid ?? null,
    agentName,
    type,
    content: content?.trim() ?? null,
    context: context ?? null,
    createdAt: new Date().toISOString(),
  };

  await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8');
  res.json({ ok: true, id: entry.id });
});

// POST /api/teams/:id/feedback/analyze  — LLM: analyze feedback and suggest preference/guide updates
router.post('/teams/:id/feedback/analyze', async (req, res) => {
  const { id } = req.params;
  if (id === 'demo-team') {
    res.status(403).json({ error: 'Not available in demo mode' });
    return;
  }

  if (!isLLMConfigured()) {
    res.status(503).json({ error: 'LLM not configured' });
    return;
  }

  // 1. Read all feedback
  const feedbackDir = path.join(getAppConfig().teamsDir, id, 'feedback');
  const allFeedback: Array<{ agentName: string; type: string; content: string; createdAt: string; context?: { messageContent?: string } }> = [];
  try {
    const files = await fs.readdir(feedbackDir);
    for (const file of files.filter(f => f.endsWith('.jsonl'))) {
      const raw = await fs.readFile(path.join(feedbackDir, file), 'utf-8');
      for (const line of raw.split('\n').filter(Boolean)) {
        try { allFeedback.push(JSON.parse(line)); } catch { /* skip */ }
      }
    }
  } catch { /* no feedback dir */ }

  if (allFeedback.length === 0) {
    res.json({ suggestions: [] });
    return;
  }

  // 2. Read current preferences (structured, extract rule text for LLM)
  const structuredPrefs = await readPreferences(id);
  const preferences: Record<string, string[]> = {};
  for (const [agent, entries] of Object.entries(structuredPrefs)) {
    preferences[agent] = entries.map(getRuleText);
  }

  // 3. Read TEAM_GUIDE.md
  const configPath = path.join(getAppConfig().teamsDir, id, 'config.json');
  let guideContent = '(none)';
  try {
    const teamConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    const cwds: string[] = (teamConfig.members ?? []).map((m: { cwd?: string }) => m.cwd).filter(Boolean);
    for (const cwd of cwds) {
      try {
        guideContent = await fs.readFile(path.join(cwd, 'TEAM_GUIDE.md'), 'utf-8');
        break;
      } catch { /* try next */ }
    }
  } catch { /* no config */ }

  // 4. Call LLM
  const feedbackFormatted = allFeedback.map((f, i) => {
    let line = `${i + 1}. [${f.type}] ${f.agentName}: "${f.content ?? '(no content)'}"`;
    if (f.context?.messageContent) {
      line += `\n   Agent output: "${f.context.messageContent.slice(0, 300)}"`;
    }
    return line;
  }).join('\n');

  const { latestEntry } = req.body as { latestEntry?: { agentName: string; type: string; content: string; context?: { messageContent?: string } } };

  const prompt = `You are analyzing user feedback about an AI agent team.
Each feedback entry may include the agent's actual output that was evaluated.
Use this context to understand what specific behavior triggered the feedback.

CURRENT TEAM GUIDE:
${guideContent}

CURRENT PREFERENCES:
${JSON.stringify(preferences, null, 2)}

ALL FEEDBACK HISTORY:
${feedbackFormatted}

${latestEntry ? `LATEST FEEDBACK ENTRY:\n[${latestEntry.type}] ${latestEntry.agentName}: "${latestEntry.content}"${latestEntry.context?.messageContent ? `\nAgent output: "${latestEntry.context.messageContent.slice(0, 300)}"` : ''}` : ''}

Based on this feedback, suggest updates to the team guide or agent-specific preferences.
- Only suggest changes that are clearly supported by the feedback
- Prefer agent-specific preferences for individual behavior corrections
- Use TEAM_GUIDE for cross-cutting rules that apply to all agents
- Do NOT suggest rules that already exist in current preferences

Return a JSON array of suggestions:
[{"id":"sug-1","target":"TEAM_GUIDE"|"agentName","action":"add"|"remove","rule":"...","reason":"..."}]

Return ONLY valid JSON, no other text.`;

  try {
    const text = await llmComplete(prompt, 800);
    // Extract JSON array from response (handle possible markdown wrapping)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    res.json({ suggestions });
  } catch (err) {
    console.error('[feedback/analyze] LLM error:', (err as Error).message);
    res.json({ suggestions: [] });
  }
});

// POST /api/teams/:id/feedback/apply  — apply accepted suggestions to preferences/TEAM_GUIDE
router.post('/teams/:id/feedback/apply', async (req, res) => {
  const { id } = req.params;
  if (id === 'demo-team') {
    res.status(403).json({ error: 'Not available in demo mode' });
    return;
  }

  const { accepted, sourceEntryId, sourceEntryIds: bulkEntryIds } = req.body as {
    accepted: Array<{ id: string; target: string; action: string; rule: string; reason: string; supportingFeedbackIds?: string[] }>;
    sourceEntryId?: string;
    sourceEntryIds?: string[];
  };

  if (!Array.isArray(accepted) || accepted.length === 0) {
    res.json({ ok: true, preferences: {}, guideUpdated: false });
    return;
  }

  // Read current preferences (structured)
  const preferences = await readPreferences(id);

  let guideUpdated = false;
  const guideSkipped: string[] = [];
  const promptsUpdated: string[] = [];

  // Read team config (needed for TEAM_GUIDE path + agent prompts)
  const configPath = path.join(getAppConfig().teamsDir, id, 'config.json');
  let teamConfig: TeamConfig | null = null;
  let guidePath = '';
  try {
    teamConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    const cwds: string[] = (teamConfig!.members ?? []).map((m: { cwd?: string }) => m.cwd).filter(Boolean) as string[];
    if (cwds.length > 0) guidePath = path.join(cwds[0], 'TEAM_GUIDE.md');
  } catch { /* no config */ }

  for (const sug of accepted) {
    if (sug.target === 'TEAM_GUIDE') {
      // Apply to TEAM_GUIDE.md
      if (!guidePath) {
        guideSkipped.push(sug.rule);
        continue;
      }
      let guideContent = '';
      try { guideContent = await fs.readFile(guidePath, 'utf-8'); } catch { /* new file */ }

      if (sug.action === 'add') {
        guideContent = appendRuleToPreferencesSection(guideContent, sug.rule);
      } else if (sug.action === 'remove') {
        guideContent = guideContent.split('\n').filter(l => !l.includes(sug.rule)).join('\n');
      }

      await fs.writeFile(guidePath, guideContent, 'utf-8');
      guideUpdated = true;
    } else {
      // Apply to agent preferences + agent prompt
      const agent = sug.target;
      if (!preferences[agent]) preferences[agent] = [];

      if (sug.action === 'add') {
        // Dedup: check if rule already exists (works with both string and PreferenceRule)
        if (!findRule(preferences[agent], sug.rule)) {
          const now = new Date().toISOString();
          const newRule: PreferenceRule = {
            id: `pref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            rule: sug.rule,
            confidence: (sug.supportingFeedbackIds?.length ?? 0) >= 3 ? 'confirmed' : 'tentative',
            supportCount: sug.supportingFeedbackIds?.length ?? 1,
            sourceEntryIds: sug.supportingFeedbackIds ?? (sourceEntryId ? [sourceEntryId] : []),
            createdAt: now,
            source: bulkEntryIds ? 'auto' : 'manual',
          };
          preferences[agent].push(newRule);
        }
        // Also append to agent's system prompt in config.json
        if (teamConfig) {
          const member = teamConfig.members?.find(m => m.name === agent);
          if (member) {
            const ruleLine = `\n- ${sug.rule}`;
            if (!member.prompt) {
              member.prompt = `## Preferences${ruleLine}`;
            } else if (!member.prompt.includes(sug.rule)) {
              member.prompt = appendRuleToPreferencesSection(member.prompt, sug.rule);
            }
            promptsUpdated.push(agent);
          }
        }
      } else if (sug.action === 'remove') {
        preferences[agent] = preferences[agent].filter(e => getRuleText(e) !== sug.rule);
        // Also remove from agent's system prompt
        if (teamConfig) {
          const member = teamConfig.members?.find(m => m.name === agent);
          if (member?.prompt) {
            member.prompt = member.prompt.split('\n').filter(l => !l.includes(sug.rule)).join('\n');
            promptsUpdated.push(agent);
          }
        }
      }
    }
  }

  // Save preferences (structured format — clean empty agent keys for W3)
  const cleanedPrefs = cleanEmptyAgents(preferences);
  await writePreferences(id, cleanedPrefs);

  // Save updated agent prompts to config.json
  if (teamConfig && promptsUpdated.length > 0) {
    await fs.writeFile(configPath, JSON.stringify(teamConfig, null, 2), 'utf-8');
  }

  // Mark source feedback entry/entries as processed
  const idsToMark: string[] = [];
  if (sourceEntryId) idsToMark.push(sourceEntryId);
  if (bulkEntryIds?.length) idsToMark.push(...bulkEntryIds);
  if (idsToMark.length > 0) {
    await markFeedbackProcessed(id, idsToMark);
  }

  res.json({
    ok: true, preferences: cleanedPrefs, guideUpdated, promptsUpdated,
    ...(guideSkipped.length > 0 ? { guideSkipped } : {}),
  });
});

export default router;
