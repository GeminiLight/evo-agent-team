/**
 * Alert engine — B2 feature.
 * Computes in-memory alerts from team state without LLM.
 *
 * Rules:
 *   agent_stuck              — agent has no new messages for N minutes
 *   human_input_escalated    — agent is waiting for human input > M minutes
 *   critical_path_blocked    — all in-progress tasks are blocked (no runnable work)
 *   token_anomaly            — agent token rate is X× the team average
 */

import type { Alert, AlertThresholds, AgentSessionStats, AlertKind } from './types.js';
import type { Task } from './types.js';

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  stuckMinutes: 15,
  humanWaitMinutes: 5,
  tokenAnomalyMultiplier: 3,
  enabled: ['agent_stuck', 'human_input_escalated', 'critical_path_blocked', 'token_anomaly'],
};

function isEnabled(kind: AlertKind, thresholds: AlertThresholds): boolean {
  return thresholds.enabled.includes(kind);
}

function minutesAgo(isoString: string | null | undefined): number {
  if (!isoString) return 0;
  const diff = Date.now() - new Date(isoString).getTime();
  return diff / 60000;
}

export function computeAlerts(
  tasks: Task[],
  sessionStats: AgentSessionStats[],
  humanWaiters: string[],
  humanWaiterDetails: Array<{ agentName: string; since?: string }>,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  // ── agent_stuck ──────────────────────────────────────────────────────────
  if (isEnabled('agent_stuck', thresholds)) {
    for (const stat of sessionStats) {
      // Only check agents that have an active task
      const hasActive = tasks.some(
        t => t.status === 'in_progress' && t.owner === stat.agentName,
      );
      if (!hasActive) continue;

      const mins = minutesAgo(stat.lastMessageAt);
      if (mins >= thresholds.stuckMinutes) {
        const durationMs = Math.round(mins * 60000);
        alerts.push({
          id: `stuck-${stat.agentName}`,
          kind: 'agent_stuck',
          severity: mins >= thresholds.stuckMinutes * 2 ? 'critical' : 'warning',
          title: `${stat.agentName} appears stuck`,
          detail: `No activity for ${Math.round(mins)} min while task is in progress.`,
          agentName: stat.agentName,
          triggeredAt: now,
          durationMs,
        });
      }
    }
  }

  // ── human_input_escalated ────────────────────────────────────────────────
  if (isEnabled('human_input_escalated', thresholds)) {
    for (const agentName of humanWaiters) {
      const detail = humanWaiterDetails.find(d => d.agentName === agentName);
      const mins = detail?.since ? minutesAgo(detail.since) : thresholds.humanWaitMinutes;
      const durationMs = Math.round(mins * 60000);
      alerts.push({
        id: `human-${agentName}`,
        kind: 'human_input_escalated',
        severity: mins >= thresholds.humanWaitMinutes * 4 ? 'critical' : 'warning',
        title: `${agentName} awaiting human input`,
        detail: `Agent has been waiting ${Math.round(mins)} min for a human response.`,
        agentName,
        triggeredAt: now,
        durationMs,
      });
    }
  }

  // ── critical_path_blocked ────────────────────────────────────────────────
  if (isEnabled('critical_path_blocked', thresholds)) {
    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const pending    = tasks.filter(t => t.status === 'pending');

    // There are pending tasks but all are blocked by in-progress or other pending tasks
    if (pending.length > 0 && inProgress.length === 0) {
      const inProgressIds = new Set(inProgress.map(t => t.id));
      const completedIds  = new Set(tasks.filter(t => t.status === 'completed').map(t => t.id));
      const runnable = pending.filter(t =>
        t.blockedBy.every(dep => completedIds.has(dep)),
      );
      if (runnable.length === 0) {
        alerts.push({
          id: 'critical-path-blocked',
          kind: 'critical_path_blocked',
          severity: 'critical',
          title: 'Critical path blocked',
          detail: `${pending.length} pending task${pending.length !== 1 ? 's' : ''} with no runnable work — all dependencies unresolved.`,
          triggeredAt: now,
        });
      }
    }
  }

  // ── token_anomaly ────────────────────────────────────────────────────────
  if (isEnabled('token_anomaly', thresholds) && sessionStats.length >= 2) {
    const totals = sessionStats.map(s => s.inputTokens + s.outputTokens);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    if (avg > 0) {
      sessionStats.forEach((stat, i) => {
        const ratio = totals[i] / avg;
        if (ratio >= thresholds.tokenAnomalyMultiplier) {
          alerts.push({
            id: `token-${stat.agentName}`,
            kind: 'token_anomaly',
            severity: ratio >= thresholds.tokenAnomalyMultiplier * 2 ? 'critical' : 'warning',
            title: `${stat.agentName} token anomaly`,
            detail: `Token usage is ${ratio.toFixed(1)}× the team average (${(totals[i] / 1000).toFixed(0)}k vs ${(avg / 1000).toFixed(0)}k avg).`,
            agentName: stat.agentName,
            triggeredAt: now,
          });
        }
      });
    }
  }

  // Sort: critical first, then by kind priority
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}
