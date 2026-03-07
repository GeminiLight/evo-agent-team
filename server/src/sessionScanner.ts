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
import type { AgentSessionStats, TokenDataPoint } from './types.js';

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
  lastMessageAt: string | null;
  toolCallCounts: Record<string, number>;
  tokenTimeSeries: TokenDataPoint[];
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
    lastMessageAt: null, toolCallCounts: {}, tokenTimeSeries: [],
  };
  let raw: string;
  try { raw = await fs.readFile(filePath, 'utf-8'); } catch { return acc; }

  let cumulativeInput  = 0;
  let cumulativeOutput = 0;

  for (const line of raw.split('\n').filter(Boolean)) {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(line) as Record<string, unknown>; } catch { continue; }

    const ts = parseTs(parsed.timestamp);
    const tsStr = typeof parsed.timestamp === 'string' ? parsed.timestamp : null;

    if (ts !== null) {
      if (acc.firstTimestamp === null) acc.firstTimestamp = ts;
      acc.lastTimestamp = ts;
    }

    if (parsed.type === 'assistant') {
      const msg = parsed.message as Record<string, unknown> | undefined;
      if (msg) {
        const usage = msg.usage as Record<string, unknown> | undefined;
        if (usage) {
          const inp  = typeof usage.input_tokens             === 'number' ? usage.input_tokens             : 0;
          const out  = typeof usage.output_tokens            === 'number' ? usage.output_tokens            : 0;
          const cach = typeof usage.cache_read_input_tokens  === 'number' ? usage.cache_read_input_tokens  : 0;
          acc.inputTokens     += inp;
          acc.outputTokens    += out;
          acc.cacheReadTokens += cach;
          acc.messageCount    += 1;
          cumulativeInput  += inp;
          cumulativeOutput += out;
          if (tsStr) {
            acc.lastMessageAt = tsStr;
            // Downsample: only keep one point per ~60s to limit array size
            const lastPt = acc.tokenTimeSeries[acc.tokenTimeSeries.length - 1];
            const gap = lastPt ? Date.parse(tsStr) - Date.parse(lastPt.timestamp) : Infinity;
            if (gap >= 60000) {
              acc.tokenTimeSeries.push({ timestamp: tsStr, cumulativeInput, cumulativeOutput });
            }
          }
        }

        // Count tool calls in assistant content
        const content = msg.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block && typeof block === 'object') {
              const b = block as Record<string, unknown>;
              if (b.type === 'tool_use' && typeof b.name === 'string') {
                acc.toolCallCounts[b.name] = (acc.toolCallCounts[b.name] ?? 0) + 1;
              }
            }
          }
        }
      }
    }
  }

  // Always add a final point
  if (acc.lastMessageAt && cumulativeInput + cumulativeOutput > 0) {
    const last = acc.tokenTimeSeries[acc.tokenTimeSeries.length - 1];
    if (!last || last.timestamp !== acc.lastMessageAt) {
      acc.tokenTimeSeries.push({
        timestamp: acc.lastMessageAt,
        cumulativeInput,
        cumulativeOutput,
      });
    }
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
        // Use latest lastMessageAt
        if (acc.lastMessageAt) {
          if (!existing.lastMessageAt || acc.lastMessageAt > existing.lastMessageAt) {
            existing.lastMessageAt = acc.lastMessageAt;
          }
        }
        // Merge tool call counts
        for (const [tool, count] of Object.entries(acc.toolCallCounts)) {
          existing.toolCallCounts ??= {};
          existing.toolCallCounts[tool] = (existing.toolCallCounts[tool] ?? 0) + count;
        }
        // Append and deduplicate time series
        if (acc.tokenTimeSeries.length) {
          existing.tokenTimeSeries ??= [];
          existing.tokenTimeSeries.push(...acc.tokenTimeSeries);
          existing.tokenTimeSeries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        }
      } else {
        agentStats.set(agentName, {
          agentName,
          inputTokens:       acc.inputTokens,
          outputTokens:      acc.outputTokens,
          cacheReadTokens:   acc.cacheReadTokens,
          messageCount:      acc.messageCount,
          sessionDurationMs: dur,
          lastMessageAt:     acc.lastMessageAt,
          toolCallCounts:    acc.toolCallCounts,
          tokenTimeSeries:   acc.tokenTimeSeries,
        });
      }
    }
  }

  return [...agentStats.values()];
}
