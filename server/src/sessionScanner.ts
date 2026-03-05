/**
 * Scans Claude Code session JSONL files to aggregate token usage and
 * message counts per agent.
 *
 * Each assistant record in a session file contains a `usage` object:
 *   { input_tokens, output_tokens, cache_read_input_tokens }
 *
 * Session → agent name mapping reuses inferAgentName() from
 * humanInputDetector.ts (same two-pass strategy: TaskUpdate owner field,
 * then parentToolUseID cross-reference). Results are cached for the
 * server process lifetime since session→name mapping never changes.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { cwdToProjectDir, inferAgentName } from './humanInputDetector.js';
import type { AgentSessionStats } from './types.js';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

/** Module-level cache: sessionId → agentName */
const sessionNameCache = new Map<string, string>();

interface UsageAccum {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  messageCount: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
}

function parseTs(ts: unknown): number | null {
  if (typeof ts === 'string') { const n = Date.parse(ts); return isNaN(n) ? null : n; }
  if (typeof ts === 'number') return ts;
  return null;
}

async function scanSessionUsage(filePath: string): Promise<UsageAccum> {
  const acc: UsageAccum = {
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
    messageCount: 0, firstTimestamp: null, lastTimestamp: null,
  };
  let raw: string;
  try { raw = await fs.readFile(filePath, 'utf-8'); } catch { return acc; }

  for (const line of raw.split('\n').filter(Boolean)) {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(line) as Record<string, unknown>; } catch { continue; }

    const ts = parseTs(parsed.timestamp);
    if (ts !== null) {
      if (acc.firstTimestamp === null) acc.firstTimestamp = ts;
      acc.lastTimestamp = ts;
    }

    if (parsed.type !== 'assistant') continue;
    const msg = parsed.message as Record<string, unknown> | undefined;
    if (!msg) continue;
    const usage = msg.usage as Record<string, unknown> | undefined;
    if (!usage) continue;

    acc.inputTokens     += typeof usage.input_tokens             === 'number' ? usage.input_tokens             : 0;
    acc.outputTokens    += typeof usage.output_tokens            === 'number' ? usage.output_tokens            : 0;
    acc.cacheReadTokens += typeof usage.cache_read_input_tokens  === 'number' ? usage.cache_read_input_tokens  : 0;
    acc.messageCount    += 1;
  }
  return acc;
}

export async function getSessionStatsForTeam(
  memberNames: string[],
  memberCwds: string[],
  leadSessionId?: string,
  leadName?: string,
): Promise<AgentSessionStats[]> {
  if (memberNames.length === 0) return [];

  // Pre-seed cache with lead name (same pattern as todoScanner.ts)
  if (leadSessionId && leadName && !sessionNameCache.has(leadSessionId)) {
    sessionNameCache.set(leadSessionId, leadName);
  }

  const projectDirs = [...new Set(
    memberCwds.filter(Boolean).map(cwd => path.join(CLAUDE_PROJECTS_DIR, cwdToProjectDir(cwd)))
  )];

  const agentStats = new Map<string, AgentSessionStats>();

  for (const projectDir of projectDirs) {
    let entries: string[];
    try { entries = await fs.readdir(projectDir); } catch { continue; }

    for (const file of entries.filter(f => f.endsWith('.jsonl'))) {
      const sessionId = file.replace('.jsonl', '');
      const filePath  = path.join(projectDir, file);

      let agentName = sessionNameCache.get(sessionId);
      if (!agentName) {
        const resolved = await inferAgentName(filePath, memberNames, projectDir, leadSessionId);
        if (!resolved) continue;
        agentName = resolved;
        sessionNameCache.set(sessionId, agentName);
      }

      const acc = await scanSessionUsage(filePath);
      if (acc.messageCount === 0) continue;

      const dur = (acc.firstTimestamp !== null && acc.lastTimestamp !== null)
        ? acc.lastTimestamp - acc.firstTimestamp
        : null;

      const existing = agentStats.get(agentName);
      if (existing) {
        existing.inputTokens     += acc.inputTokens;
        existing.outputTokens    += acc.outputTokens;
        existing.cacheReadTokens += acc.cacheReadTokens;
        existing.messageCount    += acc.messageCount;
        if (dur !== null) existing.sessionDurationMs = (existing.sessionDurationMs ?? 0) + dur;
      } else {
        agentStats.set(agentName, {
          agentName,
          inputTokens:       acc.inputTokens,
          outputTokens:      acc.outputTokens,
          cacheReadTokens:   acc.cacheReadTokens,
          messageCount:      acc.messageCount,
          sessionDurationMs: dur,
        });
      }
    }
  }

  return [...agentStats.values()];
}
