import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import {
  getAppConfig,
  readJsonFile,
  readPreferences,
  writePreferences,
  normalizePreference,
  getRuleText,
  findRule,
  markFeedbackProcessed,
  cleanEmptyAgents,
  appendRuleToPreferencesSection,
  readTeamGuide,
  getTeamCwd,
  getGuideWritePath,
  preferencesToText,
} from './helpers.js';
import { getDemoFeedbackEntries, getDemoPreferences } from '../mockData.js';
import { llmComplete, isLLMConfigured } from '../llm.js';
import type { TeamConfig, PreferencesMap, PreferenceRule } from '../types.js';

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

// GET /api/teams/:id/preferences  — get per-agent preferences
router.get('/teams/:id/preferences', async (req, res) => {
  const { id } = req.params;
  if (id === 'demo-team') {
    res.json({ teamId: id, preferences: getDemoPreferences() });
    return;
  }

  const data = await readPreferences(id);
  res.json({ teamId: id, preferences: data });
});

// PUT /api/teams/:id/preferences  — save preferences (full replace)
router.put('/teams/:id/preferences', async (req, res) => {
  const { id } = req.params;
  if (id === 'demo-team') {
    res.status(403).json({ error: 'Not available in demo mode' });
    return;
  }

  const { preferences } = req.body as { preferences: PreferencesMap };
  if (!preferences || typeof preferences !== 'object') {
    res.status(400).json({ error: 'preferences must be an object' });
    return;
  }

  // Normalize all entries before writing
  const normalized: PreferencesMap = {};
  for (const [agent, entries] of Object.entries(preferences)) {
    normalized[agent] = (entries ?? []).map(normalizePreference);
  }

  await writePreferences(id, normalized);
  res.json({ ok: true, preferences: normalized });
});

// POST /api/teams/:id/preferences/generate  — LLM: extract preferences from feedback
router.post('/teams/:id/preferences/generate', async (req, res) => {
  const { id } = req.params;
  if (id === 'demo-team') {
    res.status(403).json({ error: 'Not available in demo mode' });
    return;
  }

  const feedbackDir = path.join(getAppConfig().teamsDir, id, 'feedback');
  const byAgent: Record<string, string[]> = {};
  const allConsumedIds: string[] = [];

  try {
    const files = await fs.readdir(feedbackDir);
    for (const file of files.filter(f => f.endsWith('.jsonl'))) {
      const agentName = file.replace('.jsonl', '');
      const raw = await fs.readFile(path.join(feedbackDir, file), 'utf-8');
      const corrections: string[] = [];
      const entryIds: string[] = [];
      for (const line of raw.split('\n').filter(Boolean)) {
        try {
          const entry = JSON.parse(line);
          if ((entry.type === 'correction' || entry.type === 'bookmark') && entry.content && !entry.processedAt) {
            corrections.push(entry.content);
            if (entry.id) entryIds.push(entry.id);
          }
        } catch { /* skip */ }
      }
      if (corrections.length > 0) byAgent[agentName] = corrections;
      if (entryIds.length > 0) allConsumedIds.push(...entryIds);
    }
  } catch {
    res.json({ ok: true, preferences: {} });
    return;
  }

  if (Object.keys(byAgent).length === 0) {
    res.json({ ok: true, preferences: {} });
    return;
  }

  // Read existing preferences to merge (not overwrite — Critical-2 fix)
  const existingPrefs = await readPreferences(id);
  const newRules: Record<string, string[]> = {};

  if (isLLMConfigured()) {
    // LLM available — extract rules from feedback
    for (const [agentName, feedbacks] of Object.entries(byAgent)) {
      const existingRules = (existingPrefs[agentName] ?? []).map(getRuleText);
      const prompt = `You are analyzing user feedback about an AI agent named "${agentName}".

User feedback entries:
${feedbacks.map((f, i) => `${i + 1}. "${f}"`).join('\n')}

${existingRules.length > 0 ? `Existing preference rules (DO NOT duplicate these):\n${existingRules.map(r => `- ${r}`).join('\n')}\n\n` : ''}Extract 3-6 concise behavioral preference rules from this feedback.
Rules should be general principles, not one-off fixes.
Skip any rules that overlap with existing rules above.
Format: one rule per line, starting with a verb (e.g. "Use natbib over biblatex", "Prefer modular file structure").
Return ONLY the rules, one per line, no numbering or bullets.`;

      try {
        const text = await llmComplete(prompt, 300);
        newRules[agentName] = text.split('\n').map(l => l.trim()).filter(Boolean);
      } catch {
        // Rule-based fallback: use feedback as-is (truncated)
        newRules[agentName] = feedbacks.slice(0, 5).map(f => f.slice(0, 80));
      }
    }
  } else {
    // No LLM: graceful fallback — use raw corrections as rules (no 503, this endpoint can degrade)
    for (const [agentName, feedbacks] of Object.entries(byAgent)) {
      newRules[agentName] = feedbacks.slice(0, 5).map(f => f.slice(0, 80));
    }
  }

  // Merge new rules into existing preferences (dedup via findRule)
  const now = new Date().toISOString();
  for (const [agentName, rules] of Object.entries(newRules)) {
    if (!existingPrefs[agentName]) existingPrefs[agentName] = [];
    for (const ruleText of rules) {
      if (!findRule(existingPrefs[agentName], ruleText)) {
        existingPrefs[agentName].push({
          id: `pref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          rule: ruleText,
          confidence: 'tentative',
          supportCount: 1,
          sourceEntryIds: [],
          createdAt: now,
          source: 'auto',
        });
      }
    }
  }

  // Persist (merge, not overwrite)
  await writePreferences(id, existingPrefs);

  // Mark all consumed feedback entries as processed
  if (allConsumedIds.length > 0) {
    await markFeedbackProcessed(id, allConsumedIds);
  }

  res.json({ ok: true, preferences: existingPrefs });
});

// POST /api/teams/:id/preferences/discover  — E1: batch-analyze all feedback to discover patterns
router.post('/teams/:id/preferences/discover', async (req, res) => {
  const { id } = req.params;
  if (id === 'demo-team') {
    res.status(403).json({ error: 'Not available in demo mode' });
    return;
  }

  if (!isLLMConfigured()) {
    res.status(503).json({ error: 'LLM not configured' });
    return;
  }

  // 1. Read all feedback entries (with IDs)
  const feedbackDir = path.join(getAppConfig().teamsDir, id, 'feedback');
  interface FeedbackEntry { id: string; agentName: string; type: string; content: string; messageContent?: string; processedAt?: string }
  const allEntries: FeedbackEntry[] = [];

  try {
    const files = await fs.readdir(feedbackDir);
    for (const file of files.filter(f => f.endsWith('.jsonl'))) {
      const agentName = file.replace('.jsonl', '');
      const raw = await fs.readFile(path.join(feedbackDir, file), 'utf-8');
      for (const line of raw.split('\n').filter(Boolean)) {
        try {
          const entry = JSON.parse(line);
          if ((entry.type === 'correction' || entry.type === 'bookmark') && entry.content) {
            allEntries.push({ ...entry, agentName });
          }
        } catch { /* skip */ }
      }
    }
  } catch {
    res.json({ discoveries: [], stats: { totalFeedback: 0, unprocessedFeedback: 0, newDiscoveries: 0, skippedDuplicates: 0 } });
    return;
  }

  if (allEntries.length === 0) {
    res.json({ discoveries: [], stats: { totalFeedback: 0, unprocessedFeedback: 0, newDiscoveries: 0, skippedDuplicates: 0 } });
    return;
  }

  // 2. Read existing preferences
  const existingPrefs = await readPreferences(id);
  const existingRulesList: string[] = [];
  for (const entries of Object.values(existingPrefs)) {
    for (const e of entries) existingRulesList.push(getRuleText(e));
  }

  // 3. Truncate to 200 entries if needed (Important-5)
  const unprocessedCount = allEntries.filter(e => !e.processedAt).length;
  const feedbackForPrompt = allEntries.slice(-200);

  // 4. Build LLM prompt (with feedback IDs — Important-4)
  const feedbackLines = feedbackForPrompt.map((e, i) =>
    `${i + 1}. [${e.id}] [${e.type}] ${e.agentName}: "${e.content}"${e.messageContent ? ` (context: "${e.messageContent.slice(0, 200)}")` : ''}`
  ).join('\n');

  const existingPrefsText = existingRulesList.length > 0
    ? `CURRENT PREFERENCES (already established — DO NOT duplicate these):\n${existingRulesList.map(r => `- ${r}`).join('\n')}\n\n`
    : '';

  const prompt = `You are analyzing ALL feedback history for an AI agent team to discover behavioral patterns and preferences.

${existingPrefsText}ALL FEEDBACK (chronological, ${feedbackForPrompt.length} entries):
${feedbackLines}

Instructions:
1. Find PATTERNS: repeated corrections/praises that suggest a consistent preference
2. DEDUPLICATE: if a pattern matches an existing preference, skip it
3. CLASSIFY each discovery:
   - "agent-specific": set target to the agent name
   - "team-wide": set target to "TEAM_GUIDE" (appears across 2+ agents or applies to all)
4. Rate CONFIDENCE: "confirmed" if 3+ supporting entries, "tentative" if 1-2
5. Distinguish "temporary fix" (one-off correction) from "lasting preference" (repeated pattern)
6. Return the EXACT feedback IDs (like "fb-...") from the list above that support each discovery

Return JSON (no markdown wrapping):
{
  "discoveries": [
    {
      "rule": "descriptive rule text starting with a verb",
      "target": "agentName" or "TEAM_GUIDE",
      "confidence": "tentative" or "confirmed",
      "supportingFeedbackIds": ["fb-...", "fb-..."],
      "reason": "why this is a pattern, not a one-off"
    }
  ]
}

Return ONLY valid JSON. No extra text.`;

  try {
    const text = await llmComplete(prompt, 1200);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { discoveries: [] };
    const discoveries: Array<{
      rule: string; target: string; confidence: string;
      supportingFeedbackIds: string[]; reason: string;
    }> = parsed.discoveries ?? [];

    // Validate feedback IDs: filter out any IDs the LLM fabricated
    const validIds = new Set(allEntries.map(e => e.id));
    for (const d of discoveries) {
      d.supportingFeedbackIds = (d.supportingFeedbackIds ?? []).filter(fid => validIds.has(fid));
      // Normalize confidence
      if (d.confidence !== 'tentative' && d.confidence !== 'confirmed') {
        d.confidence = d.supportingFeedbackIds.length >= 3 ? 'confirmed' : 'tentative';
      }
    }

    // Filter out discoveries that duplicate existing rules
    const newDiscoveries = discoveries.filter(d => !existingRulesList.includes(d.rule));
    const skippedDuplicates = discoveries.length - newDiscoveries.length;

    res.json({
      discoveries: newDiscoveries,
      stats: {
        totalFeedback: allEntries.length,
        unprocessedFeedback: unprocessedCount,
        newDiscoveries: newDiscoveries.length,
        skippedDuplicates,
      },
    });
  } catch (err) {
    console.error('[preferences/discover] LLM error:', (err as Error).message);
    res.status(500).json({
      error: 'LLM analysis failed',
      discoveries: [],
      stats: { totalFeedback: allEntries.length, unprocessedFeedback: unprocessedCount, newDiscoveries: 0, skippedDuplicates: 0 },
    });
  }
});

// POST /api/teams/:id/preferences/promote  — E1: promote agent-level rule to team-level
router.post('/teams/:id/preferences/promote', async (req, res) => {
  const { id } = req.params;
  if (id === 'demo-team') {
    res.status(403).json({ error: 'Not available in demo mode' });
    return;
  }

  const { ruleId, fromAgent } = req.body as { ruleId: string; fromAgent: string };
  if (!ruleId || !fromAgent) {
    res.status(400).json({ error: 'ruleId and fromAgent are required' });
    return;
  }

  const preferences = await readPreferences(id);
  const agentRules = preferences[fromAgent] ?? [];
  const ruleIndex = agentRules.findIndex(e => (typeof e === 'string' ? false : e.id === ruleId));

  if (ruleIndex === -1) {
    res.status(404).json({ error: 'Rule not found' });
    return;
  }

  const rule = normalizePreference(agentRules[ruleIndex]);
  const ruleText = rule.rule;

  // 1. Write to TEAM_GUIDE.md
  let guideUpdated = false;
  const configPath = path.join(getAppConfig().teamsDir, id, 'config.json');
  let teamConfig: TeamConfig | null = null;
  let guidePath = '';
  try {
    teamConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    const cwds: string[] = (teamConfig!.members ?? []).map((m: { cwd?: string }) => m.cwd).filter(Boolean) as string[];
    if (cwds.length > 0) guidePath = path.join(cwds[0], 'TEAM_GUIDE.md');
  } catch { /* no config */ }

  if (guidePath) {
    let guideContent = '';
    try { guideContent = await fs.readFile(guidePath, 'utf-8'); } catch { /* new file */ }

    if (!guideContent.includes(ruleText)) {
      guideContent = appendRuleToPreferencesSection(guideContent, ruleText);
      await fs.writeFile(guidePath, guideContent, 'utf-8');
      guideUpdated = true;
    }
  }

  // 2. Remove from agent-specific preferences
  agentRules.splice(ruleIndex, 1);
  preferences[fromAgent] = agentRules;

  // 3. Also add to all agents' system prompts via config.json
  const promptsUpdated: string[] = [];
  if (teamConfig) {
    for (const member of teamConfig.members ?? []) {
      if (!member.prompt) {
        member.prompt = `## Preferences\n- ${ruleText}`;
      } else if (!member.prompt.includes(ruleText)) {
        member.prompt = appendRuleToPreferencesSection(member.prompt, ruleText);
      }
      promptsUpdated.push(member.name);
    }
    await fs.writeFile(configPath, JSON.stringify(teamConfig, null, 2), 'utf-8');
  }

  const cleanedPrefs = cleanEmptyAgents(preferences);
  await writePreferences(id, cleanedPrefs);
  res.json({ ok: true, preferences: cleanedPrefs, guideUpdated, promptsUpdated });
});

export default router;
