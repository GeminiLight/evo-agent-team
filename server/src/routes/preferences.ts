/**
 * Preferences routes — manage per-agent behavioral preferences
 * Extracted from feedback.ts for separation of concerns
 */
import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import {
  getAppConfig,
  readPreferences,
  writePreferences,
  normalizePreference,
  getRuleText,
  findRule,
  markFeedbackProcessed,
  cleanEmptyAgents,
  appendRuleToPreferencesSection,
} from './helpers.js';
import { getDemoPreferences } from '../mockData.js';
import { llmComplete, isLLMConfigured } from '../llm.js';
import type { TeamConfig, PreferencesMap } from '../types.js';

const router = Router();

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
