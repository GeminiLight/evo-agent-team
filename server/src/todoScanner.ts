/**
 * Reads todo lists from ~/.claude/todos/ for a team's active sessions.
 *
 * Filename format: {sessionId}-agent-{sessionId}.json
 *
 * Strategy: collect all session IDs from the team's project directory
 * (identified by member cwds), then match against todo files.
 *
 * We include all sessions — both the lead (non-zero JSONL) and in-process
 * sub-agents (0-byte JSONL, but they do write todo files). We exclude
 * file-history-snapshot-only files which are tool artifacts, not real sessions.
 * A real session either has a 0-byte JSONL (in-process agent) or a non-empty
 * JSONL whose first record is NOT file-history-snapshot.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { cwdToProjectDir } from './humanInputDetector.js';
import type { TodoItem } from './types.js';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const CLAUDE_TODOS_DIR    = path.join(os.homedir(), '.claude', 'todos');

/** Extract sessionId from a todo filename like "{sid}-agent-{sid}.json" */
function parseTodoFilename(fname: string): string | null {
  const m = fname.match(/^([0-9a-f-]{36})-agent-[0-9a-f-]{36}\.json$/);
  return m ? m[1] : null;
}

/**
 * Returns true if the JSONL is a real session (0 bytes = in-process agent,
 * or first record type is not file-history-snapshot).
 */
async function isRealSession(jsonlPath: string): Promise<boolean> {
  let size: number;
  try {
    size = (await fs.stat(jsonlPath)).size;
  } catch {
    return false;
  }
  if (size === 0) return true; // in-process sub-agent

  // Read just the first line to check record type
  try {
    const rl = readline.createInterface({ input: (await import('fs')).createReadStream(jsonlPath), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        rl.close();
        return r.type !== 'file-history-snapshot';
      } catch {
        rl.close();
        return false;
      }
    }
  } catch { /* unreadable */ }
  return false;
}

export interface SessionTodo {
  sessionId: string;
  /** Short 8-char prefix for display */
  shortId: string;
  /** True when this session matches the team's leadSessionId */
  isLead: boolean;
  /** The working directory this session ran in */
  cwd: string;
  items: TodoItem[];
}

export interface ProjectTodosResult {
  sessions: SessionTodo[];
}

export async function getTodosForTeam(
  memberCwds: string[],
  leadSessionId?: string,
): Promise<ProjectTodosResult> {
  // Map sessionId -> cwd (deduplicated by cwd)
  const sessionCwd = new Map<string, string>();

  // Always anchor with leadSessionId
  if (leadSessionId) {
    const leadCwd = memberCwds[0] ?? '';
    sessionCwd.set(leadSessionId, leadCwd);
  }

  const uniqueCwds = [...new Set(memberCwds.filter(Boolean))];

  for (const cwd of uniqueCwds) {
    const projectDir = path.join(CLAUDE_PROJECTS_DIR, cwdToProjectDir(cwd));
    try {
      const entries = await fs.readdir(projectDir);
      await Promise.all(
        entries
          .filter(e => e.endsWith('.jsonl'))
          .map(async e => {
            const sessionId = e.replace('.jsonl', '');
            const jsonlPath = path.join(projectDir, e);
            if (await isRealSession(jsonlPath)) {
              sessionCwd.set(sessionId, cwd);
            }
          })
      );
    } catch { /* project dir may not exist */ }
  }

  if (sessionCwd.size === 0) return { sessions: [] };

  // Scan todos dir for matching session files
  let todoFiles: string[];
  try {
    todoFiles = await fs.readdir(CLAUDE_TODOS_DIR);
  } catch {
    return { sessions: [] };
  }

  const sessions: SessionTodo[] = [];

  for (const fname of todoFiles) {
    const sessionId = parseTodoFilename(fname);
    if (!sessionId || !sessionCwd.has(sessionId)) continue;

    try {
      const raw = await fs.readFile(path.join(CLAUDE_TODOS_DIR, fname), 'utf-8');
      const items = JSON.parse(raw) as TodoItem[];
      if (!Array.isArray(items) || items.length === 0) continue;
      sessions.push({
        sessionId,
        shortId: sessionId.slice(0, 8),
        isLead: sessionId === leadSessionId,
        cwd: sessionCwd.get(sessionId)!,
        items,
      });
    } catch { /* skip malformed */ }
  }

  return { sessions };
}
