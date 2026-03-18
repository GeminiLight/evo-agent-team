export interface TeamMember {
  name: string;
  agentId: string;
  agentType: string;
  model?: string;
  prompt?: string;
  color?: string;
  planModeRequired?: boolean;
  joinedAt?: number;
  cwd?: string;
  /** "in-process" for spawned agents; absent for lead */
  backendType?: string;
  /** "" for lead; "in-process" for in-process spawned agents */
  tmuxPaneId?: string;
  subscriptions?: string[];
}

export interface TeamConfig {
  name?: string;
  description?: string;
  createdAt?: number;
  members: TeamMember[];
  leadAgentId?: string;
  leadSessionId?: string;
}

export interface Task {
  id: string;
  subject: string;
  description: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
  blocks: string[];
  blockedBy: string[];
  owner?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface InboxSummaryItem {
  agentName: string;
  unread: number;
  total: number;
}
export interface InboxSummaryResponse {
  teamId: string;
  agents: InboxSummaryItem[];
}

export interface AgentSessionStats {
  agentName: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  messageCount: number;
  sessionDurationMs: number | null;
  lastMessageAt?: string | null;
  toolCallCounts?: Record<string, number>;
  tokenTimeSeries?: TokenDataPoint[];
}
export interface TokenDataPoint {
  timestamp: string;
  cumulativeInput: number;
  cumulativeOutput: number;
}
export interface SessionStatsResponse {
  teamId: string;
  agents: AgentSessionStats[];
}

// B2: Alerts
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertKind = 'agent_stuck' | 'human_input_escalated' | 'critical_path_blocked' | 'token_anomaly';
export interface Alert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  agentName?: string;
  taskId?: string;
  triggeredAt: string;
  durationMs?: number;
}
export interface AlertsResponse {
  teamId: string;
  alerts: Alert[];
}

// B3: Agent session info
export interface AgentSessionInfo {
  agentName: string;
  sessionId: string;
  messageCount: number;
  isLead: boolean;
}
export interface AgentSessionsResponse {
  teamId: string;
  agents: AgentSessionInfo[];
}

// B4: Cost data
export interface AgentCostSummary {
  agentName: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  messageCount: number;
  percentage: number;
}
export interface ToolCostSummary {
  toolName: string;
  callCount: number;
}
export interface AgentTimeSeries {
  agentName: string;
  dataPoints: TokenDataPoint[];
}
export interface CostData {
  teamId: string;
  totals: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
  byAgent: AgentCostSummary[];
  byTool: ToolCostSummary[];
  timeSeries: AgentTimeSeries[];
}

export interface TeamSummary {
  id: string;
  name: string;
  hasConfig: boolean;
  memberCount: number;
  taskCount?: number;
}

export interface TeamDetail {
  id: string;
  name: string;
  config: TeamConfig | null;
  tasks: Task[];
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
  };
}

// D0: Executive Summary
export interface ExecSummaryResponse {
  teamId: string;
  summary: string;
  generatedAt: string;
  isAIGenerated: boolean;
  isStale: boolean;
}

// F1: WebSocket
export type WsMessageType = 'teams_update' | 'team_detail_update' | 'ping';
export interface WsMessage {
  type: WsMessageType;
  teamId?: string;
  payload?: unknown;
}

// F2: Agent Communication Log
export interface AgentMessage {
  id: string;
  recipient: string;
  sender: string;
  text: string;
  timestamp: string;
  color: string;
  read: boolean;
  parsedType?: string;
  summary?: string;
}
export interface CommLogResponse {
  teamId: string;
  messages: AgentMessage[];
  agentNames: string[];
}

// Session todo lists (from ~/.claude/todos/) — scoped to project, not agent
export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}
export interface SessionTodo {
  sessionId: string;
  shortId: string;
  isLead: boolean;
  cwd: string;
  items: TodoItem[];
}
export interface ProjectTodosResponse {
  teamId: string;
  sessions: SessionTodo[];
}

// F3: Timeline
export interface TaskChangeEvent {
  id: string;
  teamId: string;
  taskId: string;
  taskSubject: string;
  oldStatus: Task['status'] | null;
  newStatus: Task['status'];
  owner?: string;
  timestamp: string;
}
export interface TimelineResponse {
  teamId: string;
  events: TaskChangeEvent[];
}

// Session history (from ~/.claude/projects/{proj}/{leadSessionId}.jsonl)
export type SessionMessageRole = 'user' | 'assistant';
export type SessionEntryKind = 'text' | 'tool_use' | 'tool_result';

export interface SessionEntry {
  kind: SessionEntryKind;
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolUseId?: string;
  toolResultId?: string;
  toolResultText?: string;
  isError?: boolean;
}

export interface SessionMessage {
  uuid: string;
  role: SessionMessageRole;
  timestamp: string;
  entries: SessionEntry[];
}

export interface SessionHistoryResponse {
  teamId: string;
  sessionId: string | null;
  agentName?: string | null;
  messages: SessionMessage[];
}

// ── E1: Structured preference rules ──

export interface PreferenceRule {
  id: string;
  rule: string;
  confidence: 'tentative' | 'confirmed';
  supportCount: number;
  sourceEntryIds: string[];
  createdAt: string;
  promotedAt?: string;
  source: 'manual' | 'auto';
}

export type PreferenceEntry = string | PreferenceRule;
export type PreferencesMap = Record<string, PreferenceEntry[]>;
