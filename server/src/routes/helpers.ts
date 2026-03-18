import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { config } from '../config.js';
import type {
  Task,
  TeamConfig,
  PreferencesMap,
  PreferenceEntry,
  PreferenceRule,
  AppConfig,
} from '../types.js';

// ── Constants ────────────────────────────────────────────────────────────────

export const HIDDEN_FILES = new Set(['.lock', '.highwatermark']);

export const PROJECTS_DIRS = [
  path.join(os.homedir(), '.claude-internal', 'projects'),
  path.join(os.homedir(), '.claude', 'projects'),
];

export const CONTEXT_SUMMARY_TOKEN_BUDGET = 4000;

// ── App Config ───────────────────────────────────────────────────────────────

/** Return the mutable app config object (teamsDir, tasksDir, etc.) */
export function getAppConfig(): AppConfig {
  return config;
}

// ── Filesystem helpers ───────────────────────────────────────────────────────

export function isHiddenFile(name: string): boolean {
  return name.startsWith('.') || HIDDEN_FILES.has(name);
}

export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getSubdirs(dirPath: string): Promise<string[]> {
  if (!(await dirExists(dirPath))) return [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function hasNonHiddenFiles(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.some((name) => !isHiddenFile(name));
  } catch {
    return false;
  }
}

// ── Feedback helpers ─────────────────────────────────────────────────────────

/** Mark feedback entries as processed (set processedAt timestamp) */
export async function markFeedbackProcessed(teamId: string, entryIds: string[]): Promise<number> {
  const feedbackDir = path.join(config.teamsDir, teamId, 'feedback');
  const idSet = new Set(entryIds);
  let marked = 0;
  try {
    const files = await fs.readdir(feedbackDir);
    for (const file of files.filter(f => f.endsWith('.jsonl'))) {
      const filePath = path.join(feedbackDir, file);
      const raw = await fs.readFile(filePath, 'utf-8');
      const lines = raw.split('\n').filter(Boolean);
      let changed = false;
      const updated = lines.map(line => {
        try {
          const entry = JSON.parse(line);
          if (idSet.has(entry.id) && !entry.processedAt) {
            entry.processedAt = new Date().toISOString();
            changed = true;
            marked++;
            return JSON.stringify(entry);
          }
        } catch { /* skip */ }
        return line;
      });
      if (changed) {
        await fs.writeFile(filePath, updated.map(l => l + '\n').join(''), 'utf-8');
      }
    }
  } catch { /* dir may not exist */ }
  return marked;
}

// ── Preference helpers (E1-2): backward-compatible structured read/write ─────

/** Convert legacy string entry → PreferenceRule on read */
export function normalizePreference(entry: PreferenceEntry): PreferenceRule {
  if (typeof entry === 'string') {
    // Stable ID derived from content so the same string always gets the same ID
    let hash = 0;
    for (let i = 0; i < entry.length; i++) hash = ((hash << 5) - hash + entry.charCodeAt(i)) | 0;
    return {
      id: `pref-legacy-${Math.abs(hash).toString(36)}`,
      rule: entry,
      confidence: 'confirmed',
      supportCount: 0,
      sourceEntryIds: [],
      createdAt: '1970-01-01T00:00:00Z',
      source: 'manual',
    };
  }
  return entry;
}

/** Extract the rule text from either a string or PreferenceRule */
export function getRuleText(entry: PreferenceEntry): string {
  return typeof entry === 'string' ? entry : entry.rule;
}

/** Find a rule by text in an array of mixed entries */
export function findRule(entries: PreferenceEntry[], ruleText: string): PreferenceRule | undefined {
  for (const e of entries) {
    if (getRuleText(e) === ruleText) return normalizePreference(e);
  }
  return undefined;
}

/** Read preferences.json with normalization (backward-compatible) */
export async function readPreferences(teamId: string): Promise<PreferencesMap> {
  const prefPath = path.join(config.teamsDir, teamId, 'preferences.json');
  const raw = await readJsonFile<Record<string, PreferenceEntry[]>>(prefPath);
  if (!raw) return {};
  // Normalize every entry
  const result: PreferencesMap = {};
  for (const [agent, entries] of Object.entries(raw)) {
    result[agent] = (entries ?? []).map(normalizePreference);
  }
  return result;
}

/** Write preferences.json (always writes structured PreferenceRule format) */
export async function writePreferences(teamId: string, prefs: PreferencesMap): Promise<void> {
  const prefPath = path.join(config.teamsDir, teamId, 'preferences.json');
  await fs.mkdir(path.dirname(prefPath), { recursive: true });
  await fs.writeFile(prefPath, JSON.stringify(prefs, null, 2), 'utf-8');
}

/** Append a rule line under '## Preferences' header in a text block.
 *  Handles edge cases: no trailing newline after header, missing header entirely. */
export function appendRuleToPreferencesSection(text: string, rule: string): string {
  if (text.includes('## Preferences')) {
    // Insert after header — handle with or without trailing newline
    return text.replace(/(## Preferences\n?)/, `## Preferences\n- ${rule}\n`);
  }
  return text + `\n\n## Preferences\n- ${rule}\n`;
}

/** Remove empty agent keys from preferences map (visual cleanup) */
export function cleanEmptyAgents(prefs: PreferencesMap): PreferencesMap {
  const result: PreferencesMap = {};
  for (const [agent, rules] of Object.entries(prefs)) {
    if (rules.length > 0) result[agent] = rules;
  }
  return result;
}

// ── Memory helpers (D4) ──────────────────────────────────────────────────────

export function encodeCwd(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

export async function findMemoryPath(cwd: string): Promise<{ filePath: string; source: 'claude-internal' | 'claude' } | null> {
  const encoded = encodeCwd(cwd);
  for (const dir of PROJECTS_DIRS) {
    const candidate = path.join(dir, encoded, 'memory', 'MEMORY.md');
    try {
      await fs.access(candidate);
      return { filePath: candidate, source: dir.includes('.claude-internal') ? 'claude-internal' : 'claude' };
    } catch { /* try next */ }
  }
  return null;
}

export function getTeamCwd(teamConfig: TeamConfig | null): string | null {
  if (!teamConfig?.members) return null;
  for (const m of teamConfig.members) {
    if (m.cwd) return m.cwd;
  }
  return null;
}

// ── Team Guide helpers (E3) ──────────────────────────────────────────────────

/** Read TEAM_GUIDE.md for a team: cwd-based (D3 pattern) with fallback to teamsDir */
export async function readTeamGuide(teamId: string, teamConfig: TeamConfig | null): Promise<string> {
  // 1. Try cwd-based path (where D3 writes / Agent reads)
  const cwds: string[] = (teamConfig?.members ?? []).map((m: { cwd?: string }) => m.cwd).filter(Boolean) as string[];
  for (const cwd of cwds) {
    try {
      return await fs.readFile(path.join(cwd, 'TEAM_GUIDE.md'), 'utf-8');
    } catch { /* try next */ }
  }
  // 2. Fallback to teamsDir
  try {
    return await fs.readFile(path.join(config.teamsDir, teamId, 'TEAM_GUIDE.md'), 'utf-8');
  } catch { return ''; }
}

/** Get the writable TEAM_GUIDE path for a team (cwd first, then teamsDir fallback) */
export function getGuideWritePath(teamId: string, teamConfig: TeamConfig | null): string {
  const cwds: string[] = (teamConfig?.members ?? []).map((m: { cwd?: string }) => m.cwd).filter(Boolean) as string[];
  if (cwds.length > 0) return path.join(cwds[0], 'TEAM_GUIDE.md');
  return path.join(config.teamsDir, teamId, 'TEAM_GUIDE.md');
}

/** Read preferences as plain-text list for LLM consumption */
export function preferencesToText(prefs: PreferencesMap): string {
  const lines: string[] = [];
  for (const [agent, rules] of Object.entries(prefs)) {
    for (const r of rules) {
      const text = typeof r === 'string' ? r : r.rule;
      const conf = typeof r === 'string' ? '' : ` [${r.confidence}]`;
      lines.push(`- [${agent}]${conf} ${text}`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : '(none)';
}

// ── Token estimation (E4) ────────────────────────────────────────────────────

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
