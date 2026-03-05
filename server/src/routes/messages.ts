import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { getDemoCommLog } from '../mockData.js';
import type { AgentMessage, CommLogResponse, InboxSummaryItem, InboxSummaryResponse } from '../types.js';
import { getDemoInboxSummary } from '../mockData.js';

const router = Router();

router.get('/teams/:id/messages', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.json(getDemoCommLog());
    return;
  }

  const inboxesDir = path.join(config.teamsDir, id, 'inboxes');

  try {
    await fs.access(inboxesDir);
  } catch {
    res.json({ teamId: id, messages: [], agentNames: [] } satisfies CommLogResponse);
    return;
  }

  let files: string[];
  try {
    const entries = await fs.readdir(inboxesDir);
    files = entries.filter(f => f.endsWith('.json'));
  } catch {
    res.json({ teamId: id, messages: [], agentNames: [] } satisfies CommLogResponse);
    return;
  }

  const agentNames: string[] = [];
  const allMessages: AgentMessage[] = [];

  for (const file of files) {
    const agentName = file.replace(/\.json$/, '');
    agentNames.push(agentName);

    try {
      const raw = await fs.readFile(path.join(inboxesDir, file), 'utf-8');
      const entries: Array<{ from?: string; text?: string; summary?: string; timestamp?: string; color?: string; read?: boolean }> = JSON.parse(raw);

      entries.forEach((entry, idx) => {
        let parsedType: string | undefined;
        // Top-level summary field takes precedence; fall back to JSON-encoded summary
        let summary: string | undefined = typeof entry.summary === 'string' ? entry.summary : undefined;

        if (entry.text) {
          try {
            const parsed = JSON.parse(entry.text);
            if (parsed && typeof parsed === 'object') {
              parsedType = typeof parsed.type === 'string' ? parsed.type : undefined;
              if (!summary) {
                summary = typeof parsed.summary === 'string' ? parsed.summary : undefined;
              }
            }
          } catch { /* text is plain prose, not JSON */ }
        }

        allMessages.push({
          id: `${agentName}-${idx}`,
          recipient: agentName,
          sender: entry.from ?? 'unknown',
          text: entry.text ?? '',
          timestamp: entry.timestamp ?? new Date(0).toISOString(),
          color: entry.color ?? '#ffffff',
          read: entry.read ?? false,
          parsedType,
          summary,
        });
      });
    } catch { /* skip malformed inbox */ }
  }

  // Sort ascending by timestamp
  allMessages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  res.json({ teamId: id, messages: allMessages, agentNames } satisfies CommLogResponse);
});

// GET /api/teams/:id/inbox-summary
router.get('/teams/:id/inbox-summary', async (req, res) => {
  const { id } = req.params;

  if (id === 'demo-team') {
    res.json(getDemoInboxSummary());
    return;
  }

  const inboxesDir = path.join(config.teamsDir, id, 'inboxes');
  try { await fs.access(inboxesDir); } catch {
    res.json({ teamId: id, agents: [] } satisfies InboxSummaryResponse);
    return;
  }

  let files: string[];
  try {
    const entries = await fs.readdir(inboxesDir);
    files = entries.filter(f => f.endsWith('.json'));
  } catch {
    res.json({ teamId: id, agents: [] } satisfies InboxSummaryResponse);
    return;
  }

  const agents: InboxSummaryItem[] = [];
  for (const file of files) {
    const agentName = file.replace(/\.json$/, '');
    try {
      const raw = await fs.readFile(path.join(inboxesDir, file), 'utf-8');
      const entries: Array<{ read?: boolean }> = JSON.parse(raw);
      agents.push({
        agentName,
        total:  entries.length,
        unread: entries.filter(e => e.read === false).length,
      });
    } catch {
      agents.push({ agentName, unread: 0, total: 0 });
    }
  }

  res.json({ teamId: id, agents } satisfies InboxSummaryResponse);
});

export default router;
