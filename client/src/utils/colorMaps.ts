/**
 * Shared color maps for agent and tool styling.
 * Extracted from AgentCard, AgentProfilePanel, ToolCallBlock, SessionHistoryView.
 */

// ── Agent accent colors ────────────────────────────────────────────────────────

export const AGENT_COLOR_MAP: Record<string, string> = {
  blue:   '#5bc8f5',
  green:  '#39ff6a',
  yellow: '#facc15',
  red:    '#ff3b5c',
  purple: '#c084fc',
  cyan:   '#22d3ee',
  orange: '#fb923c',
  pink:   '#f472b6',
};

/**
 * Resolve agent color string to hex.
 * Falls back to phosphor green for undefined/unknown.
 */
export function agentAccentColor(color?: string): string {
  if (!color) return 'var(--phosphor)';
  return AGENT_COLOR_MAP[color.toLowerCase()] ?? color;
}

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
