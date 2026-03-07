/**
 * Reads the lead session JSONL and returns a structured message list.
 * Only processes 'user' and 'assistant' records; skips file-history-snapshot,
 * progress, queue-operation, and system records.
 */

import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { cwdToProjectDir } from './humanInputDetector.js';
import type { SessionMessage, SessionEntry, AgentSessionInfo } from './types.js';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

function parseContent(content: unknown): SessionEntry[] {
  const entries: SessionEntry[] = [];

  if (typeof content === 'string') {
    if (content.trim()) entries.push({ kind: 'text', text: content });
    return entries;
  }

  if (!Array.isArray(content)) return entries;

  for (const c of content) {
    if (!c || typeof c !== 'object') continue;
    const block = c as Record<string, unknown>;

    if (block.type === 'text') {
      const text = String(block.text ?? '').trim();
      if (text) entries.push({ kind: 'text', text });

    } else if (block.type === 'tool_use') {
      entries.push({
        kind: 'tool_use',
        toolName: String(block.name ?? ''),
        toolInput: (block.input ?? {}) as Record<string, unknown>,
        toolUseId: String(block.id ?? ''),
      });

    } else if (block.type === 'tool_result') {
      const tc = block.content;
      let resultText = '';
      if (typeof tc === 'string') {
        resultText = tc;
      } else if (Array.isArray(tc)) {
        resultText = tc
          .filter((item): item is Record<string,unknown> => item?.type === 'text')
          .map(item => String(item.text ?? ''))
          .join('\n');
      }
      entries.push({
        kind: 'tool_result',
        toolResultId: String(block.tool_use_id ?? ''),
        toolResultText: resultText.trim(),
        isError: block.is_error === true,
      });
    }
  }

  return entries;
}

export async function getSessionHistory(
  memberCwds: string[],
  leadSessionId: string,
): Promise<SessionMessage[]> {
  // Find the JSONL file in the project directory
  const uniqueCwds = [...new Set(memberCwds.filter(Boolean))];
  let jsonlPath: string | null = null;

  for (const cwd of uniqueCwds) {
    const candidate = path.join(
      CLAUDE_PROJECTS_DIR,
      cwdToProjectDir(cwd),
      `${leadSessionId}.jsonl`,
    );
    try {
      await fs.access(candidate);
      jsonlPath = candidate;
      break;
    } catch { /* try next */ }
  }

  if (!jsonlPath) return [];

  const messages: SessionMessage[] = [];

  const rl = readline.createInterface({
    input: createReadStream(jsonlPath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    const type = record.type as string;
    if (type !== 'user' && type !== 'assistant') continue;

    const msg = record.message as Record<string, unknown> | undefined;
    if (!msg) continue;

    const entries = parseContent(msg.content);
    if (entries.length === 0) continue;

    messages.push({
      uuid: String(record.uuid ?? ''),
      role: type as 'user' | 'assistant',
      timestamp: String(record.timestamp ?? ''),
      entries,
    });
  }

  return messages;
}

/**
 * B3: List all session files associated with a team and label each with the
 * agent name inferred from the JSONL filename prefix matching config members.
 *
 * This is a lightweight scan — just counts message lines, no full parse.
 */
export async function listAvailableAgentSessions(
  memberNames: string[],
  memberCwds: string[],
  leadSessionId?: string,
  leadName?: string,
): Promise<AgentSessionInfo[]> {
  const uniqueCwds = [...new Set(memberCwds.filter(Boolean))];
  const result: AgentSessionInfo[] = [];
  const seenSessions = new Set<string>();

  for (const cwd of uniqueCwds) {
    const projectDir = path.join(CLAUDE_PROJECTS_DIR, cwdToProjectDir(cwd));
    let entries: string[];
    try { entries = await fs.readdir(projectDir); } catch { continue; }

    for (const file of entries.filter(f => f.endsWith('.jsonl'))) {
      const sessionId = file.replace('.jsonl', '');
      if (seenSessions.has(sessionId)) continue;
      seenSessions.add(sessionId);

      const filePath = path.join(projectDir, file);
      const isLead = sessionId === leadSessionId;
      let agentName = isLead && leadName ? leadName : null;

      if (!agentName) {
        // Try inferring from filename prefix match against member names
        const lower = sessionId.toLowerCase();
        agentName = memberNames.find(n => lower.includes(n.toLowerCase())) ?? null;
      }
      if (!agentName) continue;

      // Count messages quickly
      let raw = '';
      try { raw = await fs.readFile(filePath, 'utf-8'); } catch { continue; }
      const messageCount = raw.split('\n').filter(l => {
        if (!l.trim()) return false;
        try {
          const r = JSON.parse(l) as Record<string, unknown>;
          return r.type === 'assistant';
        } catch { return false; }
      }).length;

      if (messageCount === 0) continue;

      result.push({ agentName, sessionId, messageCount, isLead });
    }
  }

  return result;
}
