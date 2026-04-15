/**
 * Supervision routes — manage supervision rules in TEAM_GUIDE.md
 * Extracted from feedback.ts for separation of concerns
 */
import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { getAppConfig, readTeamGuide } from './helpers.js';
import type { SupervisionRule, SupervisionConfig } from '../types.js';

const router = Router();

const DEFAULT_THRESHOLD = 50;

/** Parse supervision rules and threshold from TEAM_GUIDE.md content */
function parseSupervisionSection(guideContent: string): SupervisionConfig {
  const rules: SupervisionRule[] = [];
  let threshold = DEFAULT_THRESHOLD;

  const normalized = guideContent.replace(/\r\n/g, '\n');
  const sectionMatch = normalized.match(/## Supervision Rules\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!sectionMatch) return { rules, threshold };

  const section = sectionMatch[1];

  const thresholdMatch = section.match(/<!-- supervision-threshold:\s*(\d+)\s*-->/);
  if (thresholdMatch) threshold = Math.max(0, Math.min(100, parseInt(thresholdMatch[1], 10)));

  const lines = section.split('\n');
  let pendingMeta: Partial<SupervisionRule> | null = null;

  for (const line of lines) {
    const metaMatch = line.match(/<!-- sr:(\{.*\}) -->/);
    if (metaMatch) {
      try { pendingMeta = JSON.parse(metaMatch[1]); } catch { pendingMeta = null; }
      continue;
    }

    const ruleMatch = line.match(/^- (.+)$/);
    if (ruleMatch) {
      const text = ruleMatch[1].trim();
      const now = new Date().toISOString();
      rules.push({
        id: pendingMeta?.id ?? `sr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text,
        source: (pendingMeta?.source as 'manual' | 'auto') ?? 'manual',
        createdAt: pendingMeta?.createdAt ?? now,
        ...(pendingMeta?.supportCount != null ? { supportCount: pendingMeta.supportCount } : {}),
      });
      pendingMeta = null;
    }
  }

  return { rules, threshold };
}

/** Serialize supervision rules into a TEAM_GUIDE.md section string */
function serializeSupervisionSection(config: SupervisionConfig): string {
  const lines: string[] = [
    '## Supervision Rules',
    '',
    `<!-- supervision-threshold: ${config.threshold} -->`,
  ];

  for (const rule of config.rules) {
    const meta: Record<string, unknown> = { id: rule.id, source: rule.source, createdAt: rule.createdAt };
    if (rule.supportCount != null) meta.supportCount = rule.supportCount;
    lines.push(`<!-- sr:${JSON.stringify(meta)} -->`);
    lines.push(`- ${rule.text}`);
  }

  return lines.join('\n');
}

/** Replace or append ## Supervision Rules section in TEAM_GUIDE.md content */
function replaceSupervisionSection(guideContent: string, newSection: string): string {
  const pattern = /## Supervision Rules\n[\s\S]*?(?=\n## |\n---|$)/;
  if (pattern.test(guideContent)) {
    return guideContent.replace(pattern, newSection);
  }
  const trimmed = guideContent.trimEnd();
  return trimmed + (trimmed ? '\n\n' : '') + newSection + '\n';
}

// GET /api/teams/:id/supervision
router.get('/teams/:id/supervision', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.json({
      rules: [
        { id: 'sr-demo-1', text: 'Ask before running destructive commands', source: 'manual', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'sr-demo-2', text: 'Pause before modifying files outside src/', source: 'auto', createdAt: '2026-01-02T00:00:00Z', supportCount: 4 },
      ],
      threshold: 40,
    });
    return;
  }

  let guideContent = '';
  try {
    guideContent = await fs.readFile(path.join(getAppConfig().teamsDir, id, 'TEAM_GUIDE.md'), 'utf-8');
  } catch { /* no guide yet */ }

  if (!guideContent) {
    try {
      const configPath = path.join(getAppConfig().teamsDir, id, 'config.json');
      const teamConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      guideContent = await readTeamGuide(id, teamConfig);
    } catch { /* no config */ }
  }

  const config = parseSupervisionSection(guideContent);
  res.json(config);
});

// PUT /api/teams/:id/supervision
router.put('/teams/:id/supervision', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.status(403).json({ error: 'Not available in demo mode' });
    return;
  }

  const { rules, threshold } = req.body as { rules?: SupervisionRule[]; threshold?: number };

  if (!Array.isArray(rules)) {
    res.status(400).json({ error: 'rules must be an array' });
    return;
  }

  const safeThreshold = Math.max(0, Math.min(100, threshold ?? DEFAULT_THRESHOLD));

  let guidePath = path.join(getAppConfig().teamsDir, id, 'TEAM_GUIDE.md');
  try {
    const configPath = path.join(getAppConfig().teamsDir, id, 'config.json');
    const teamConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    const cwds: string[] = (teamConfig?.members ?? []).map((m: { cwd?: string }) => m.cwd).filter(Boolean) as string[];
    if (cwds.length > 0) guidePath = path.join(cwds[0], 'TEAM_GUIDE.md');
  } catch { /* no config — use teamsDir */ }

  let guideContent = '';
  try { guideContent = await fs.readFile(guidePath, 'utf-8'); } catch { /* new file */ }

  const newSection = serializeSupervisionSection({ rules, threshold: safeThreshold });
  const updatedContent = replaceSupervisionSection(guideContent, newSection);

  await fs.mkdir(path.dirname(guidePath), { recursive: true });
  await fs.writeFile(guidePath, updatedContent, 'utf-8');

  res.json({ ok: true, rules, threshold: safeThreshold });
});

// POST /api/teams/:id/supervision/extract — Analyze corrections for supervision rule suggestions
router.post('/teams/:id/supervision/extract', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.json({ suggestions: [
      { text: 'Ask before running destructive commands', reason: 'Demo suggestion', supportCount: 3, sourceEntryIds: [] },
    ] });
    return;
  }

  const feedbackDir = path.join(getAppConfig().teamsDir, id, 'feedback');
  const entries: Array<{ id: string; type: string; content: string | null }> = [];
  try {
    const files = await fs.readdir(feedbackDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const raw = await fs.readFile(path.join(feedbackDir, file), 'utf-8');
      for (const line of raw.split('\n').filter(Boolean)) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'correction') entries.push(entry);
        } catch { /* skip malformed */ }
      }
    }
  } catch { /* no feedback dir */ }

  if (entries.length === 0) {
    res.json({ suggestions: [] });
    return;
  }

  const suggestions: Array<{ text: string; reason: string; supportCount: number; sourceEntryIds: string[] }> = [];
  const correctionTexts = entries.filter(e => e.content).map(e => ({ id: e.id, text: e.content! }));

  const deleteRelated = correctionTexts.filter(c => /\b(delete|rm|remove|drop)\b/i.test(c.text));
  if (deleteRelated.length >= 2) {
    suggestions.push({
      text: 'Pause before running destructive operations (delete, rm, drop)',
      reason: `${deleteRelated.length} corrections related to destructive operations`,
      supportCount: deleteRelated.length,
      sourceEntryIds: deleteRelated.map(c => c.id),
    });
  }

  const testRelated = correctionTexts.filter(c => /\b(test|spec|coverage)\b/i.test(c.text));
  if (testRelated.length >= 2) {
    suggestions.push({
      text: 'Ask before skipping or modifying test files',
      reason: `${testRelated.length} corrections related to testing`,
      supportCount: testRelated.length,
      sourceEntryIds: testRelated.map(c => c.id),
    });
  }

  const configRelated = correctionTexts.filter(c => /\b(config|env|setting|\.json|\.yaml|\.toml)\b/i.test(c.text));
  if (configRelated.length >= 2) {
    suggestions.push({
      text: 'Require approval before modifying configuration files',
      reason: `${configRelated.length} corrections related to config changes`,
      supportCount: configRelated.length,
      sourceEntryIds: configRelated.map(c => c.id),
    });
  }

  const gitRelated = correctionTexts.filter(c => /\b(git|push|commit|merge|rebase)\b/i.test(c.text));
  if (gitRelated.length >= 2) {
    suggestions.push({
      text: 'Ask before performing git operations (push, merge, rebase)',
      reason: `${gitRelated.length} corrections related to git operations`,
      supportCount: gitRelated.length,
      sourceEntryIds: gitRelated.map(c => c.id),
    });
  }

  res.json({ suggestions });
});

// Export helpers for testing
export { parseSupervisionSection, serializeSupervisionSection, replaceSupervisionSection };

export default router;
