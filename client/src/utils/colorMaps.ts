/**
 * Shared color maps for agent and tool styling.
 * Extracted from AgentCard, AgentProfilePanel, ToolCallBlock, SessionHistoryView.
 */

// ── Tool accent colors ─────────────────────────────────────────────────────────

/**
 * Maps tool names to CSS variables / hex colors.
 * Prefer CSS variables for theme flexibility where available.
 */
export const TOOL_COLORS: Record<string, string> = {
  Read:            'var(--ice)',
  Write:           'var(--phosphor)',
  Edit:            'var(--phosphor)',
  MultiEdit:       'var(--phosphor)',
  Bash:            'var(--amber)',
  Task:            'var(--amber)',
  TaskCreate:      'var(--amber)',
  TaskUpdate:      'var(--amber)',
  TaskList:        'var(--amber)',
  TaskGet:         'var(--amber)',
  TodoWrite:       'var(--amber)',
  SendMessage:     '#c084fc',
  Agent:           '#c084fc',
  TeamCreate:      '#c084fc',
  AskUserQuestion: 'var(--crimson)',
  Glob:            'var(--ice)',
  Grep:            'var(--ice)',
  WebSearch:       '#38bdf8',
  WebFetch:        '#38bdf8',
};

/**
 * Resolve tool name to color.
 * Falls back to muted text for unknown tools.
 */
export function toolColor(name: string): string {
  return TOOL_COLORS[name] ?? 'var(--text-secondary)';
}
