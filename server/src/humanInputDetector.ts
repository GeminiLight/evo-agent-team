/**
 * Detects team members currently waiting for human input by scanning
 * Claude Code session JSONL files.
 *
 * An agent is "waiting" when the last tool_use in its session has no
 * matching tool_result. This covers:
 *   - AskUserQuestion  — explicit human question
 *   - Bash             — shell command pending approval
 *   - Edit / Write     — file edit pending approval (default permission mode)
 *
 * Strategy:
 * 1. Derive the Claude projects directory from each member's `cwd` field.
 * 2. Scan all *.jsonl files modified recently (within last 30 min) in that dir.
 * 3. For each file, find if the very last tool_use has no matching tool_result.
 * 4. Identify the file's owner via TaskUpdate/TaskCreate owner field, or via
 *    parentToolUseID cross-reference against the lead session.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

/** Tools that block the agent until the user approves or answers. */
const BLOCKING_TOOLS = new Set([
  'AskUserQuestion',
  'Bash',
  'Edit',
  'Write',
  'NotebookEdit',
]);

/** Encode a cwd path to a Claude projects subdirectory name. */
export function cwdToProjectDir(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

interface JournalEntry {
  type?: string;
  parentToolUseID?: string;
  sessionId?: string;
  message?: {
    role?: string;
    content?: unknown;
  };
}

type ContentBlock =
  | { type: 'tool_use'; id: string; name: string; input?: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string }
  | { type: 'text'; text: string }
  | Record<string, unknown>;

function getContentBlocks(entry: JournalEntry): ContentBlock[] {
  const content = entry.message?.content;
  if (!Array.isArray(content)) return [];
  return content as ContentBlock[];
}

export interface BlockingCall {
  toolName: string;
  /** Short description of what the tool was trying to do */
  detail: string;
}

/**
 * Returns the blocking tool call if the session has an unanswered last
 * tool_use that requires human confirmation, or null otherwise.
 */
async function getBlockingCall(filePath: string): Promise<BlockingCall | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lines = raw.split('\n').filter(Boolean);

  // Track the last blocking tool_use seen, and all answered tool_use ids
  let lastBlockingId: string | null = null;
  let lastBlockingName = '';
  let lastBlockingDetail = '';
  const answeredIds = new Set<string>();

  for (const line of lines) {
    let entry: JournalEntry;
    try {
      entry = JSON.parse(line) as JournalEntry;
    } catch {
      continue;
    }

    const blocks = getContentBlocks(entry);
    for (const block of blocks) {
      if (typeof block !== 'object' || block === null || !('type' in block)) continue;

      if (block.type === 'tool_use' && 'name' in block && 'id' in block) {
        const b = block as { type: 'tool_use'; id: string; name: string; input?: Record<string, unknown> };
        if (BLOCKING_TOOLS.has(b.name)) {
          lastBlockingId = b.id;
          lastBlockingName = b.name;
          // Extract a short detail snippet
          const inp = b.input ?? {};
          if (b.name === 'Bash') {
            const cmd = typeof inp.command === 'string' ? inp.command : '';
            lastBlockingDetail = cmd.split('\n')[0].slice(0, 80);
          } else if (b.name === 'AskUserQuestion') {
            const qs = inp.questions;
            const firstQ = Array.isArray(qs) && qs.length > 0
              ? (qs[0] as Record<string, unknown>).question
              : undefined;
            lastBlockingDetail = typeof firstQ === 'string' ? firstQ.slice(0, 80) : '';
          } else if (b.name === 'Edit' || b.name === 'Write' || b.name === 'NotebookEdit') {
            lastBlockingDetail = typeof inp.file_path === 'string'
              ? inp.file_path.split('/').pop() ?? ''
              : '';
          }
        }
      }

      if (block.type === 'tool_result' && 'tool_use_id' in block) {
        answeredIds.add((block as { type: 'tool_result'; tool_use_id: string }).tool_use_id);
      }
    }
  }

  if (lastBlockingId !== null && !answeredIds.has(lastBlockingId)) {
    return { toolName: lastBlockingName, detail: lastBlockingDetail };
  }
  return null;
}

/**
 * Given a session JSONL file, attempt to determine the team member name by:
 * 1. Scanning for TaskUpdate/TaskCreate with owner matching a known member name.
 * 2. Falling back to parentToolUseID lookup against the lead session.
 */
export async function inferAgentName(
  filePath: string,
  memberNames: string[],
  projectDir: string,
  leadSessionId?: string,
): Promise<string | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lines = raw.split('\n').filter(Boolean);

  // --- Pass 1: TaskUpdate/TaskCreate owner field ---
  for (const line of lines) {
    let entry: JournalEntry;
    try {
      entry = JSON.parse(line) as JournalEntry;
    } catch {
      continue;
    }

    for (const block of getContentBlocks(entry)) {
      if (
        typeof block === 'object' && block !== null &&
        'type' in block && block.type === 'tool_use' &&
        'name' in block &&
        (block.name === 'TaskUpdate' || block.name === 'TaskCreate') &&
        'input' in block
      ) {
        const inp = block.input as Record<string, unknown>;
        const owner = typeof inp?.owner === 'string' ? inp.owner : null;
        if (owner && memberNames.includes(owner)) return owner;
      }
    }
  }

  // --- Pass 2: parentToolUseID cross-reference ---
  if (!leadSessionId) return null;

  let parentToolUseId: string | null = null;
  for (const line of lines.slice(0, 20)) {
    let entry: JournalEntry;
    try { entry = JSON.parse(line) as JournalEntry; } catch { continue; }
    if (entry.parentToolUseID) { parentToolUseId = entry.parentToolUseID; break; }
  }
  if (!parentToolUseId) return null;

  const leadPath = path.join(projectDir, `${leadSessionId}.jsonl`);
  let leadRaw: string;
  try {
    leadRaw = await fs.readFile(leadPath, 'utf-8');
  } catch {
    return null;
  }

  for (const line of leadRaw.split('\n').filter(Boolean)) {
    let entry: JournalEntry;
    try { entry = JSON.parse(line) as JournalEntry; } catch { continue; }
    for (const block of getContentBlocks(entry)) {
      if (
        typeof block === 'object' && block !== null &&
        'type' in block && block.type === 'tool_use' &&
        'id' in block && (block as { id: string }).id === parentToolUseId &&
        'name' in block && block.name === 'Agent' &&
        'input' in block
      ) {
        const inp = block.input as Record<string, unknown>;
        const agentName = typeof inp?.name === 'string' ? inp.name : null;
        if (agentName && memberNames.includes(agentName)) return agentName;
      }
    }
  }

  return null;
}

export interface WaitingAgent {
  name: string;
  blocking: BlockingCall;
}

export interface HumanInputStatus {
  waitingAgents: string[];
  /** Detailed info per waiting agent (tool name + context snippet) */
  details: WaitingAgent[];
}

const RECENT_MS = 30 * 60 * 1000; // 30 minutes

export async function detectHumanInputWaiters(
  memberNames: string[],
  memberCwds: string[],
  leadSessionId?: string,
): Promise<HumanInputStatus> {
  if (memberNames.length === 0) return { waitingAgents: [], details: [] };

  const projectDirs = [...new Set(
    memberCwds
      .filter(Boolean)
      .map(cwd => path.join(CLAUDE_PROJECTS_DIR, cwdToProjectDir(cwd)))
  )];

  const detailMap = new Map<string, BlockingCall>();
  const now = Date.now();

  for (const projectDir of projectDirs) {
    let entries: string[];
    try {
      entries = await fs.readdir(projectDir);
    } catch {
      continue;
    }

    // Filter to recently-modified JSONL files
    const recentFiles: string[] = [];
    for (const file of entries.filter(f => f.endsWith('.jsonl'))) {
      const full = path.join(projectDir, file);
      try {
        const stat = await fs.stat(full);
        if (now - stat.mtimeMs < RECENT_MS) recentFiles.push(full);
      } catch { /* skip */ }
    }

    for (const filePath of recentFiles) {
      const blocking = await getBlockingCall(filePath);
      if (!blocking) continue;

      const agentName = await inferAgentName(filePath, memberNames, projectDir, leadSessionId);
      if (agentName && !detailMap.has(agentName)) {
        detailMap.set(agentName, blocking);
      }
    }
  }

  const details: WaitingAgent[] = [];
  for (const [name, blocking] of detailMap) {
    details.push({ name, blocking });
  }

  return {
    waitingAgents: details.map(d => d.name),
    details,
  };
}
