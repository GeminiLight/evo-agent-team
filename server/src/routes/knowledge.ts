import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { getDemoKnowledgeAnalysis } from '../mockData.js';
import { llmComplete, isLLMConfigured } from '../llm.js';
import type { TeamConfig, PreferencesMap } from '../types.js';
import {
  readJsonFile,
  getAppConfig,
  findMemoryPath,
  getTeamCwd,
  readTeamGuide,
  readPreferences,
  preferencesToText,
  getGuideWritePath,
  encodeCwd,
  PROJECTS_DIRS,
} from './helpers.js';

const router = Router();

// POST /api/teams/:id/knowledge/analyze — LLM classify source team knowledge
router.post('/teams/:id/knowledge/analyze', async (req, res) => {
  const { id: targetId } = req.params;
  const { sourceTeamId } = req.body as { sourceTeamId: string };

  if (!sourceTeamId || /[\/\\]|\.\./.test(sourceTeamId)) {
    res.status(400).json({ error: 'Valid sourceTeamId is required' });
    return;
  }

  // Demo mode
  if (targetId === 'demo-team' || sourceTeamId === 'demo-team') {
    res.json(getDemoKnowledgeAnalysis());
    return;
  }

  // Read source team data
  const config = getAppConfig();
  const srcConfigPath = path.join(config.teamsDir, sourceTeamId, 'config.json');
  const srcConfig = await readJsonFile<TeamConfig>(srcConfigPath);
  const srcCwd = getTeamCwd(srcConfig);

  let srcMemory = '';
  if (srcCwd) {
    const found = await findMemoryPath(srcCwd);
    if (found) {
      try { srcMemory = await fs.readFile(found.filePath, 'utf-8'); } catch { /* empty */ }
    }
  }

  const srcGuide = await readTeamGuide(sourceTeamId, srcConfig);
  const srcPrefs = await readPreferences(sourceTeamId);
  const srcPrefsText = preferencesToText(srcPrefs);

  // Read target team data
  const tgtConfigPath = path.join(config.teamsDir, targetId, 'config.json');
  const tgtConfig = await readJsonFile<TeamConfig>(tgtConfigPath);
  const tgtCwd = getTeamCwd(tgtConfig);

  let tgtMemory = '';
  if (tgtCwd) {
    const found = await findMemoryPath(tgtCwd);
    if (found) {
      try { tgtMemory = await fs.readFile(found.filePath, 'utf-8'); } catch { /* empty */ }
    }
  }

  const tgtGuide = await readTeamGuide(targetId, tgtConfig);

  // Check if source has anything
  if (!srcMemory && !srcGuide && Object.keys(srcPrefs).length === 0) {
    res.json({ items: [], stats: { total: 0, universal: 0, transferable: 0, projectSpecific: 0, ephemeral: 0, deduplicated: 0 } });
    return;
  }

  // LLM analyze
  if (!isLLMConfigured()) {
    // No LLM — return raw items without classification
    res.status(503).json({ error: 'LLM not configured' });
    return;
  }

  const prompt = `You are a knowledge transfer assistant. You help migrate useful knowledge from one AI agent team to another.

SOURCE TEAM: ${sourceTeamId}

SOURCE MEMORY.md:
${srcMemory || '(empty)'}

SOURCE TEAM_GUIDE.md:
${srcGuide || '(empty)'}

SOURCE PREFERENCES (confirmed rules only):
${srcPrefsText}

TARGET TEAM: ${targetId}

TARGET MEMORY.md:
${tgtMemory || '(empty)'}

TARGET TEAM_GUIDE.md:
${tgtGuide || '(empty)'}

Instructions:
1. Extract individual knowledge items from the source team's files. Each item should be a concise, self-contained statement.
2. Classify each item:
   - "universal": best practices applicable to any project (workflow rules, coding standards, tool usage patterns)
   - "transferable": technical knowledge that may be useful (architecture patterns, library choices, integration gotchas)
   - "project-specific": information tied to the source project (file paths, port numbers, specific configs)
   - "ephemeral": temporary fixes, resolved bugs, outdated information
3. DEDUPLICATE: skip items that already exist (same meaning) in the target team's files
4. For each item, specify where it should go:
   - "memory": factual/technical knowledge → MEMORY.md
   - "guide": workflow rules/conventions → TEAM_GUIDE.md

Return ONLY valid JSON, no other text:
{"items":[{"content":"...","category":"universal"|"transferable"|"project-specific"|"ephemeral","destination":"memory"|"guide","reason":"...","source":"memory"|"guide"|"preferences"}]}`;

  try {
    const raw = await llmComplete(prompt, 2000);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.json({ items: [], stats: { total: 0, universal: 0, transferable: 0, projectSpecific: 0, ephemeral: 0, deduplicated: 0 } });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { items?: Array<{ content: string; category: string; destination: string; reason: string; source: string }> };
    const items = (parsed.items ?? []).filter(
      (it) => it.content && ['universal', 'transferable', 'project-specific', 'ephemeral'].includes(it.category)
    );

    const stats = {
      total: items.length,
      universal: items.filter(i => i.category === 'universal').length,
      transferable: items.filter(i => i.category === 'transferable').length,
      projectSpecific: items.filter(i => i.category === 'project-specific').length,
      ephemeral: items.filter(i => i.category === 'ephemeral').length,
      deduplicated: 0, // LLM already deduplicates
    };

    res.json({ items, stats });
  } catch (err) {
    console.error('[knowledge/analyze] LLM error:', (err as Error).message);
    res.status(500).json({ error: 'LLM analysis failed' });
  }
});

// POST /api/teams/:id/knowledge/apply — write selected knowledge items to target team
router.post('/teams/:id/knowledge/apply', async (req, res) => {
  const { id: targetId } = req.params;
  const { items } = req.body as { items?: Array<{ content: string; destination: string }> };

  if (targetId === 'demo-team') {
    res.status(403).json({ error: 'Cannot modify demo team' });
    return;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.json({ ok: true, memoryUpdated: false, guideUpdated: false, memoryItemCount: 0, guideItemCount: 0 });
    return;
  }

  const memoryItems = items.filter(i => i.destination === 'memory');
  const guideItems = items.filter(i => i.destination === 'guide');

  let memoryUpdated = false;
  let guideUpdated = false;

  const config = getAppConfig();
  const tgtConfigPath = path.join(config.teamsDir, targetId, 'config.json');
  const tgtConfig = await readJsonFile<TeamConfig>(tgtConfigPath);

  // Write to MEMORY.md
  if (memoryItems.length > 0) {
    const cwd = getTeamCwd(tgtConfig);

    if (cwd) {
      const found = await findMemoryPath(cwd);
      const targetPath = found
        ? found.filePath
        : path.join(PROJECTS_DIRS[0], encodeCwd(cwd), 'memory', 'MEMORY.md');

      let content = '';
      try { content = await fs.readFile(targetPath, 'utf-8'); } catch { /* new file */ }

      const newLines = memoryItems.map(i => `- ${i.content}`).join('\n');
      if (content.includes('## Transferred Knowledge')) {
        // Append to existing section — find the section and add before the next ## or end
        content = content.replace(
          /(## Transferred Knowledge\n(?:[\s\S]*?))((?=\n## )|\s*$)/,
          `$1\n${newLines}\n$2`
        );
      } else {
        content += `\n\n## Transferred Knowledge\n${newLines}\n`;
      }

      try {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, content, 'utf-8');
        memoryUpdated = true;
      } catch (err) {
        console.error('[knowledge/apply] memory write error:', (err as Error).message);
      }
    }
  }

  // Write to TEAM_GUIDE.md
  if (guideItems.length > 0) {
    const guidePath = getGuideWritePath(targetId, tgtConfig);

    let content = '';
    try { content = await fs.readFile(guidePath, 'utf-8'); } catch { /* new file */ }

    const newLines = guideItems.map(i => `- ${i.content}`).join('\n');
    if (content.includes('## Inherited Rules')) {
      content = content.replace(
        /(## Inherited Rules\n(?:[\s\S]*?))((?=\n## )|\s*$)/,
        `$1\n${newLines}\n$2`
      );
    } else {
      content += `\n\n## Inherited Rules\n${newLines}\n`;
    }

    try {
      await fs.writeFile(guidePath, content, 'utf-8');
      guideUpdated = true;
    } catch (err) {
      console.error('[knowledge/apply] guide write error:', (err as Error).message);
    }
  }

  res.json({ ok: true, memoryUpdated, guideUpdated, memoryItemCount: memoryItems.length, guideItemCount: guideItems.length });
});

export default router;
