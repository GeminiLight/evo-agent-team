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
import type { SessionMessage, SessionEntry } from './types.js';

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
