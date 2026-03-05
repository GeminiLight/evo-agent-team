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
}
export interface SessionStatsResponse {
  teamId: string;
  agents: AgentSessionStats[];
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
  messages: SessionMessage[];
}
