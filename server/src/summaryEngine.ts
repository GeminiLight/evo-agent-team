/**
 * D0: Executive Summary Engine
 *
 * Builds a structured "morning briefing" from the lead session JSONL.
 * Falls back to rule-based stats if LLM is unavailable or not configured.
 */

import OpenAI from 'openai';
import type { Task, AgentSessionStats, TaskChangeEvent } from './types.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SummaryResult {
  teamId: string;
  summary: string;          // Markdown string
  generatedAt: string;
  isAIGenerated: boolean;
  isStale: boolean;
}

// ── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  result: SummaryResult;
  inputHash: string;        // cheap hash of the inputs to detect changes
}

const cache = new Map<string, CacheEntry>();

function hashInputs(tasks: Task[], events: TaskChangeEvent[], agentStats: AgentSessionStats[]): string {
  const taskStr = tasks.map(t => `${t.id}:${t.status}:${t.updatedAt ?? ''}`).join('|');
  const eventStr = events.slice(-20).map(e => e.id).join('|');
  const statStr = agentStats.map(s => `${s.agentName}:${s.messageCount}`).join('|');
  return `${taskStr}##${eventStr}##${statStr}`;
}

// ── Rule-based fallback ──────────────────────────────────────────────────────

function buildRuleSummary(
  teamId: string,
  tasks: Task[],
  events: TaskChangeEvent[],
  agentStats: AgentSessionStats[],
): SummaryResult {
  const completed = tasks.filter(t => t.status === 'completed');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const pending = tasks.filter(t => t.status === 'pending');
  const blocked = tasks.filter(t => t.blockedBy && t.blockedBy.length > 0 && t.status !== 'completed');

  const totalTokens = agentStats.reduce((s, a) => s + a.inputTokens + a.outputTokens, 0);
  const totalMessages = agentStats.reduce((s, a) => s + a.messageCount, 0);

  const recentEvents = events.slice(-5).reverse();
  const eventLines = recentEvents.map(e => {
    const ts = new Date(e.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `- \`${ts}\` **${e.taskSubject}** → ${e.newStatus.replace('_', ' ')}${e.owner ? ` (${e.owner})` : ''}`;
  });

  const completionPct = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;

  const lines: string[] = [
    `**Progress:** ${completed.length}/${tasks.length} tasks completed (${completionPct}%)`,
    `**Active now:** ${inProgress.length} task${inProgress.length !== 1 ? 's' : ''} in progress, ${pending.length} pending`,
  ];

  if (blocked.length > 0) {
    lines.push(`**Blocked:** ${blocked.length} task${blocked.length !== 1 ? 's' : ''} waiting on dependencies`);
  }

  if (agentStats.length > 0) {
    const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
    lines.push(`**Tokens:** ${fmtK(totalTokens)} total across ${agentStats.length} agent${agentStats.length !== 1 ? 's' : ''} (${totalMessages} messages)`);
  }

  if (eventLines.length > 0) {
    lines.push('', '**Recent activity:**', ...eventLines);
  }

  return {
    teamId,
    summary: lines.join('\n'),
    generatedAt: new Date().toISOString(),
    isAIGenerated: false,
    isStale: false,
  };
}

// ── LLM summary ──────────────────────────────────────────────────────────────

function buildPrompt(
  teamName: string,
  tasks: Task[],
  events: TaskChangeEvent[],
  agentStats: AgentSessionStats[],
  sessionSnippet: string,
): string {
  const completed = tasks.filter(t => t.status === 'completed');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const pending = tasks.filter(t => t.status === 'pending');

  const taskLines = tasks.map(t =>
    `[${t.status}] #${t.id} "${t.subject}"${t.owner ? ` (owner: ${t.owner})` : ''}${t.blockedBy?.length ? ` [blocked by: ${t.blockedBy.join(', ')}]` : ''}`
  ).join('\n');

  const recentEvents = events.slice(-15).map(e =>
    `${e.timestamp.slice(0, 16)} ${e.taskSubject}: ${e.oldStatus ?? 'new'} → ${e.newStatus}${e.owner ? ` by ${e.owner}` : ''}`
  ).join('\n');

  const statLines = agentStats.map(s => {
    const total = s.inputTokens + s.outputTokens;
    return `${s.agentName}: ${s.messageCount} msgs, ${total} tokens`;
  }).join('\n');

  return `You are an AI assistant helping a developer understand their AI agent team's progress.
Generate a concise executive summary (4-8 bullet points in Markdown) for the team "${teamName}".

TASK DATA (${tasks.length} tasks total: ${completed.length} done, ${inProgress.length} active, ${pending.length} pending):
${taskLines}

RECENT EVENTS (last ${Math.min(15, events.length)}):
${recentEvents || '(none)'}

AGENT STATS:
${statLines || '(no stats)'}

SESSION SNIPPET (last few assistant messages):
${sessionSnippet || '(unavailable)'}

Instructions:
- Start with a one-line overall status
- Highlight completed work and key outcomes
- Call out current blockers or risks (if any)
- Mention notable decisions or patterns from the session
- End with token/activity overview
- Use **bold** for emphasis, keep each bullet under 120 chars
- Do NOT use headers, just bullet points (-)
- Write in present tense, be specific not generic`;
}

function extractSessionSnippet(sessionMessages: Array<{ role: string; entries: Array<{ kind: string; text?: string }> }>): string {
  // Take last 5 assistant text messages
  const assistantTexts = sessionMessages
    .filter(m => m.role === 'assistant')
    .slice(-5)
    .flatMap(m => m.entries.filter(e => e.kind === 'text' && e.text).map(e => e.text!.slice(0, 300)))
    .filter(Boolean);

  return assistantTexts.join('\n\n---\n\n').slice(0, 1500);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SummaryInput {
  teamId: string;
  teamName: string;
  tasks: Task[];
  events: TaskChangeEvent[];
  agentStats: AgentSessionStats[];
  sessionMessages?: Array<{ role: string; entries: Array<{ kind: string; text?: string }> }>;
  forceRefresh?: boolean;
}

export async function getSummary(input: SummaryInput): Promise<SummaryResult> {
  const { teamId, teamName, tasks, events, agentStats, sessionMessages = [], forceRefresh = false } = input;

  const currentHash = hashInputs(tasks, events, agentStats);
  const cached = cache.get(teamId);

  // Return cache if hash unchanged and not forced
  if (!forceRefresh && cached && cached.inputHash === currentHash) {
    return cached.result;
  }

  // Mark cached as stale if data changed
  if (cached && cached.inputHash !== currentHash) {
    cached.result.isStale = true;
  }

  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL ?? 'http://v2.open.venus.oa.com/llmproxy/v1';
  const model = process.env.LLM_MODEL ?? 'claude-sonnet-4-6';
  let result: SummaryResult;

  if (apiKey) {
    try {
      const client = new OpenAI({
        baseURL,
        apiKey,
      });

      const snippet = extractSessionSnippet(sessionMessages);
      const prompt = buildPrompt(teamName, tasks, events, agentStats, snippet);

      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
      });

      const text = completion.choices[0]?.message?.content ?? '';

      result = {
        teamId,
        summary: text.trim(),
        generatedAt: new Date().toISOString(),
        isAIGenerated: true,
        isStale: false,
      };
    } catch (err) {
      console.error('[summaryEngine] LLM error, falling back to rule-based:', (err as Error).message);
      result = buildRuleSummary(teamId, tasks, events, agentStats);
    }
  } else {
    result = buildRuleSummary(teamId, tasks, events, agentStats);
  }

  cache.set(teamId, { result, inputHash: currentHash });
  return result;
}

export function invalidateSummary(teamId: string) {
  const entry = cache.get(teamId);
  if (entry) entry.result.isStale = true;
}
