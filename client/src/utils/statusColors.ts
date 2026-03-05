// Status colors using CSS variables for theme compatibility
// The `border` field is used directly in inline styles and in graphLayout edge strokes.
// We use the CSS variable references where possible, and fall back to fixed values for
// graph edges that need concrete hex colors (ReactFlow requires concrete values for stroke).

export const STATUS_COLORS = {
  completed:   { bg: 'var(--color-completed-bg)',   border: 'var(--color-completed)',   text: 'var(--color-completed-text)'   },
  in_progress: { bg: 'var(--color-in-progress-bg)', border: 'var(--color-in-progress)', text: 'var(--color-in-progress-text)' },
  pending:     { bg: 'var(--color-pending-bg)',      border: 'var(--color-pending)',      text: 'var(--color-pending-text)'     },
  blocked:     { bg: 'var(--color-blocked-bg)',      border: 'var(--color-blocked)',      text: 'var(--color-blocked-text)'     },
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

export function getTaskStatus(task: { status: string; blockedBy: string[] }, allTasks: { id: string; status: string }[]): StatusKey {
  if (task.status === 'completed') return 'completed';
  if (task.status === 'in_progress') return 'in_progress';
  if (task.blockedBy.length > 0) {
    const hasUnfinishedDep = task.blockedBy.some(depId => {
      const dep = allTasks.find(t => t.id === depId);
      return dep && dep.status !== 'completed';
    });
    if (hasUnfinishedDep) return 'blocked';
  }
  return 'pending';
}

// Fallback hex colors for when CSS variables haven't resolved yet (e.g. first render)
const EDGE_FALLBACKS: Record<StatusKey, string> = {
  completed:   '#39ff6a',
  in_progress: '#f5a623',
  pending:     '#4a6070',
  blocked:     '#ff3b5c',
};

// For graph edges that need resolved CSS variable values (ReactFlow stroke requires concrete color)
export function getEdgeColor(status: StatusKey): string {
  const varName = status === 'in_progress' ? '--color-in-progress'
    : status === 'completed'  ? '--color-completed'
    : status === 'blocked'    ? '--color-blocked'
    : '--color-pending';
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val || EDGE_FALLBACKS[status];
}
