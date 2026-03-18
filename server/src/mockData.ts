import type { TeamConfig, Task, TeamSummary, TeamDetail, TimelineResponse, CommLogResponse, ProjectTodosResponse, InboxSummaryResponse, SessionStatsResponse, Alert, CostData, AgentSessionInfo, TokenDataPoint, ExecSummaryResponse } from './types.js';

const mockConfig: TeamConfig = {
  name: 'demo-team',
  description: 'A demonstration team showing the agent-team dashboard.',
  createdAt: 1772601907265,
  leadAgentId: 'team-lead@demo-team',
  leadSessionId: 'demo-lead-session-id',
  members: [
    { name: 'team-lead',    agentId: 'team-lead@demo-team',    agentType: 'leader', model: 'claude-opus-4-6', tmuxPaneId: '', subscriptions: [] },
    { name: 'frontend-dev', agentId: 'frontend-dev@demo-team', agentType: 'worker', model: 'claude-opus-4-6', color: 'blue',   tmuxPaneId: 'in-process', backendType: 'in-process', subscriptions: [] },
    { name: 'backend-dev',  agentId: 'backend-dev@demo-team',  agentType: 'worker', model: 'claude-opus-4-6', color: 'green',  tmuxPaneId: 'in-process', backendType: 'in-process', subscriptions: [] },
    { name: 'tester',       agentId: 'tester@demo-team',       agentType: 'worker', model: 'claude-opus-4-6', color: 'amber',  tmuxPaneId: 'in-process', backendType: 'in-process', subscriptions: [] },
  ],
};

const mockTasks: Task[] = [
  {
    id: '1',
    subject: 'Design system architecture',
    description: 'Create the high-level architecture diagram and define component boundaries for the dashboard application.',
    activeForm: 'Designing system architecture',
    status: 'completed',
    blocks: ['2', '3'],
    blockedBy: [],
    owner: 'team-lead',
    createdAt: '2026-03-04T08:00:00.000Z',
    updatedAt: '2026-03-04T09:30:00.000Z',
  },
  {
    id: '2',
    subject: 'Set up project scaffolding',
    description: 'Initialize the monorepo with server and client workspaces, install dependencies, and configure TypeScript.',
    activeForm: 'Setting up project scaffolding',
    status: 'completed',
    blocks: ['4', '5'],
    blockedBy: ['1'],
    owner: 'backend-dev',
    createdAt: '2026-03-04T08:04:00.000Z',
    updatedAt: '2026-03-04T10:45:00.000Z',
  },
  {
    id: '3',
    subject: 'Create UI component library',
    description: 'Build reusable React components: cards, badges, status indicators, and layout primitives.',
    activeForm: 'Creating UI component library',
    status: 'completed',
    blocks: ['5'],
    blockedBy: ['1'],
    owner: 'frontend-dev',
    createdAt: '2026-03-04T08:04:00.000Z',
    updatedAt: '2026-03-04T11:00:00.000Z',
  },
  {
    id: '4',
    subject: 'Implement REST API endpoints',
    description: 'Build Express routes for team listing, team detail, and configuration management endpoints.',
    activeForm: 'Implementing REST API endpoints',
    status: 'in_progress',
    blocks: ['6'],
    blockedBy: ['2'],
    owner: 'backend-dev',
    createdAt: '2026-03-04T10:47:00.000Z',
    updatedAt: '2026-03-04T11:02:00.000Z',
  },
  {
    id: '5',
    subject: 'Build dashboard view',
    description: 'Create the main dashboard page showing team overview, member cards, and task summary widgets.',
    activeForm: 'Building dashboard view',
    status: 'in_progress',
    blocks: ['6'],
    blockedBy: ['2', '3'],
    owner: 'frontend-dev',
    createdAt: '2026-03-04T10:47:00.000Z',
    updatedAt: '2026-03-04T11:03:00.000Z',
  },
  {
    id: '6',
    subject: 'Write integration tests',
    description: 'Create end-to-end tests covering API responses, UI rendering, and data flow between server and client.',
    activeForm: 'Writing integration tests',
    status: 'pending',
    blocks: [],
    blockedBy: ['4', '5'],
    owner: 'tester',
    createdAt: '2026-03-04T08:00:00.000Z',
    updatedAt: '2026-03-04T08:00:00.000Z',
  },
];

export function getDemoTeamSummary(): TeamSummary {
  return {
    id: 'demo-team',
    name: 'Demo Team',
    hasConfig: true,
    memberCount: mockConfig.members.length,
    taskCount: mockTasks.length,
  };
}

export function getDemoTeamDetail(): TeamDetail {
  return {
    id: 'demo-team',
    name: 'Demo Team',
    config: mockConfig,
    tasks: mockTasks,
    stats: {
      total: mockTasks.length,
      pending: mockTasks.filter((t) => t.status === 'pending').length,
      inProgress: mockTasks.filter((t) => t.status === 'in_progress').length,
      completed: mockTasks.filter((t) => t.status === 'completed').length,
    },
  };
}

export function getDemoTimeline(): TimelineResponse {
  const base = new Date('2024-01-15T14:00:00Z');
  const t = (offsetMinutes: number) => new Date(base.getTime() + offsetMinutes * 60000).toISOString();

  return {
    teamId: 'demo-team',
    events: [
      { id: 'demo-1-init',    teamId:'demo-team', taskId:'1', taskSubject:'Design system architecture',   oldStatus: null,          newStatus:'pending',     owner:'team-lead',    timestamp: t(0)   },
      { id: 'demo-1-start',   teamId:'demo-team', taskId:'1', taskSubject:'Design system architecture',   oldStatus: 'pending',     newStatus:'in_progress', owner:'team-lead',    timestamp: t(2)   },
      { id: 'demo-2-init',    teamId:'demo-team', taskId:'2', taskSubject:'Set up project scaffolding',   oldStatus: null,          newStatus:'pending',     owner:'backend-dev',  timestamp: t(4)   },
      { id: 'demo-1-done',    teamId:'demo-team', taskId:'1', taskSubject:'Design system architecture',   oldStatus: 'in_progress', newStatus:'completed',   owner:'team-lead',    timestamp: t(18)  },
      { id: 'demo-2-start',   teamId:'demo-team', taskId:'2', taskSubject:'Set up project scaffolding',   oldStatus: 'pending',     newStatus:'in_progress', owner:'backend-dev',  timestamp: t(20)  },
      { id: 'demo-3-init',    teamId:'demo-team', taskId:'3', taskSubject:'Create UI component library',  oldStatus: null,          newStatus:'pending',     owner:'frontend-dev', timestamp: t(20)  },
      { id: 'demo-3-start',   teamId:'demo-team', taskId:'3', taskSubject:'Create UI component library',  oldStatus: 'pending',     newStatus:'in_progress', owner:'frontend-dev', timestamp: t(22)  },
      { id: 'demo-2-done',    teamId:'demo-team', taskId:'2', taskSubject:'Set up project scaffolding',   oldStatus: 'in_progress', newStatus:'completed',   owner:'backend-dev',  timestamp: t(45)  },
      { id: 'demo-3-done',    teamId:'demo-team', taskId:'3', taskSubject:'Create UI component library',  oldStatus: 'in_progress', newStatus:'completed',   owner:'frontend-dev', timestamp: t(60)  },
      { id: 'demo-4-start',   teamId:'demo-team', taskId:'4', taskSubject:'Implement REST API endpoints', oldStatus: null,          newStatus:'in_progress', owner:'backend-dev',  timestamp: t(62)  },
      { id: 'demo-5-start',   teamId:'demo-team', taskId:'5', taskSubject:'Build dashboard view',         oldStatus: null,          newStatus:'in_progress', owner:'frontend-dev', timestamp: t(63)  },
    ],
  };
}

export function getDemoTodos(): ProjectTodosResponse {
  return {
    teamId: 'demo-team',
    sessions: [
      {
        sessionId: 'a1b2c3d4-0000-0000-0000-000000000001',
        shortId: 'a1b2c3d4',
        isLead: true,
        cwd: '/demo/project',
        items: [
          { content: 'Read existing route structure in server/src/routes/', status: 'completed', activeForm: 'Reading route structure' },
          { content: 'Implement GET /api/teams/:id endpoint with task loading', status: 'completed', activeForm: 'Implementing team detail endpoint' },
          { content: 'Add pagination support to task listing', status: 'in_progress', activeForm: 'Adding pagination to task listing' },
          { content: 'Write unit tests for new endpoints', status: 'pending', activeForm: 'Writing endpoint tests' },
        ],
      },
      {
        sessionId: 'b2c3d4e5-0000-0000-0000-000000000002',
        shortId: 'b2c3d4e5',
        isLead: false,
        cwd: '/demo/project',
        items: [
          { content: 'Audit existing component styles for consistency', status: 'completed', activeForm: 'Auditing component styles' },
          { content: 'Build AgentCard with status indicators', status: 'in_progress', activeForm: 'Building AgentCard component' },
          { content: 'Hook up real API data to dashboard', status: 'pending', activeForm: 'Connecting dashboard to API' },
        ],
      },
    ],
  };
}

export function getDemoInboxSummary(): InboxSummaryResponse {
  return {
    teamId: 'demo-team',
    agents: [
      { agentName: 'team-lead',    unread: 2, total: 5 },
      { agentName: 'frontend-dev', unread: 0, total: 3 },
      { agentName: 'backend-dev',  unread: 1, total: 4 },
      { agentName: 'tester',       unread: 0, total: 2 },
    ],
  };
}

export function getDemoSessionStats(): SessionStatsResponse {
  const base = new Date('2026-03-07T09:00:00Z');
  const t = (offsetMinutes: number) => new Date(base.getTime() + offsetMinutes * 60000).toISOString();

  function makeSeries(msgs: number, startMin: number): TokenDataPoint[] {
    const pts: TokenDataPoint[] = [];
    let ci = 0, co = 0;
    for (let i = 0; i < msgs; i++) {
      ci += Math.round(800 + Math.random() * 400);
      co += Math.round(200 + Math.random() * 150);
      pts.push({ timestamp: t(startMin + i * 8), cumulativeInput: ci, cumulativeOutput: co });
    }
    return pts;
  }

  return {
    teamId: 'demo-team',
    agents: [
      {
        agentName: 'team-lead',
        inputTokens: 45200, outputTokens: 12300, cacheReadTokens: 89400, messageCount: 47, sessionDurationMs: 5400000,
        lastMessageAt: t(-3),
        toolCallCounts: { Task: 18, Read: 12, Bash: 8, SendMessage: 9 },
        tokenTimeSeries: makeSeries(8, 0),
      },
      {
        agentName: 'frontend-dev',
        inputTokens: 38100, outputTokens: 9800, cacheReadTokens: 71200, messageCount: 39, sessionDurationMs: 4200000,
        lastMessageAt: t(-25),
        toolCallCounts: { Read: 22, Edit: 15, Write: 8, Bash: 4 },
        tokenTimeSeries: makeSeries(7, 5),
      },
      {
        agentName: 'backend-dev',
        inputTokens: 52400, outputTokens: 14700, cacheReadTokens: 103000, messageCount: 58, sessionDurationMs: 6100000,
        lastMessageAt: t(-8),
        toolCallCounts: { Bash: 31, Read: 18, Write: 12, Edit: 9 },
        tokenTimeSeries: makeSeries(9, 2),
      },
      {
        agentName: 'tester',
        inputTokens: 21000, outputTokens: 5600, cacheReadTokens: 42100, messageCount: 23, sessionDurationMs: 2800000,
        lastMessageAt: t(-62),
        toolCallCounts: { Bash: 14, Read: 7, Write: 3 },
        tokenTimeSeries: makeSeries(5, 10),
      },
    ],
  };
}

export function getDemoCommLog(): CommLogResponse {
  const base = new Date('2024-01-15T14:00:00Z');
  const t = (offsetMinutes: number) => new Date(base.getTime() + offsetMinutes * 60000).toISOString();

  return {
    teamId: 'demo-team',
    agentNames: ['team-lead', 'frontend-dev', 'backend-dev', 'tester'],
    messages: [
      {
        id: 'tl-0', recipient: 'team-lead', sender: 'backend-dev',
        text: JSON.stringify({ type: 'idle_notification', summary: 'Completed task #2 set up scaffolding' }),
        timestamp: t(45), color: '#39ff6a', read: true,
        parsedType: 'idle_notification', summary: 'Completed task #2 set up scaffolding',
      },
      {
        id: 'tl-1', recipient: 'team-lead', sender: 'frontend-dev',
        text: JSON.stringify({ type: 'idle_notification', summary: 'Completed task #3 UI component library' }),
        timestamp: t(60), color: '#39ff6a', read: true,
        parsedType: 'idle_notification', summary: 'Completed task #3 UI component library',
      },
      {
        id: 'be-0', recipient: 'backend-dev', sender: 'team-lead',
        text: JSON.stringify({ type: 'task_assignment', taskId: '4', summary: 'Implement REST API endpoints' }),
        timestamp: t(61), color: '#7eb8f7', read: true,
        parsedType: 'task_assignment', summary: 'Implement REST API endpoints',
      },
      {
        id: 'fe-0', recipient: 'frontend-dev', sender: 'team-lead',
        text: JSON.stringify({ type: 'task_assignment', taskId: '5', summary: 'Build dashboard view' }),
        timestamp: t(62), color: '#7eb8f7', read: true,
        parsedType: 'task_assignment', summary: 'Build dashboard view',
      },
      {
        id: 'tl-2', recipient: 'team-lead', sender: 'backend-dev',
        text: 'Quick check — should the API return paginated results or full list? Task #4.',
        timestamp: t(75), color: '#f5a623', read: true,
        parsedType: undefined, summary: undefined,
      },
      {
        id: 'be-1', recipient: 'backend-dev', sender: 'team-lead',
        text: 'Full list for now, we can add pagination later.',
        timestamp: t(76), color: '#39ff6a', read: false,
        parsedType: undefined, summary: undefined,
      },
      {
        id: 'qa-0', recipient: 'tester', sender: 'team-lead',
        text: JSON.stringify({ type: 'task_assignment', taskId: '6', summary: 'Write integration tests once tasks 4 and 5 complete' }),
        timestamp: t(80), color: '#7eb8f7', read: true,
        parsedType: 'task_assignment', summary: 'Write integration tests once tasks 4 and 5 complete',
      },
      {
        id: 'tl-3', recipient: 'team-lead', sender: 'frontend-dev',
        text: 'The design calls for a dark theme but the client brief mentions "accessible colours". Should I prioritise WCAG AA contrast or keep the phosphor aesthetic? Please confirm before I proceed.',
        timestamp: t(85), color: '#f5a623', read: false,
        parsedType: undefined, summary: undefined,
      },
      {
        id: 'tl-4', recipient: 'team-lead', sender: 'tester',
        text: 'Integration tests are failing on the /api/teams endpoint — it returns 404 in CI but works locally. Could you check the environment variables on the CI runner? Waiting for your input.',
        timestamp: t(90), color: '#f5a623', read: false,
        parsedType: undefined, summary: undefined,
      },
    ],
  };
}

export function getDemoAlerts(): Alert[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'human-frontend-dev',
      kind: 'human_input_escalated',
      severity: 'warning',
      title: 'frontend-dev awaiting human input',
      detail: 'Agent has been waiting 25 min for a human response.',
      agentName: 'frontend-dev',
      triggeredAt: now,
      durationMs: 25 * 60000,
    },
    {
      id: 'stuck-tester',
      kind: 'agent_stuck',
      severity: 'critical',
      title: 'tester appears stuck',
      detail: 'No activity for 62 min while task is in progress.',
      agentName: 'tester',
      triggeredAt: now,
      durationMs: 62 * 60000,
    },
  ];
}

export function getDemoAgentSessions(): AgentSessionInfo[] {
  return [
    { agentName: 'team-lead',    sessionId: 'demo-lead-session-id',    messageCount: 47, isLead: true  },
    { agentName: 'frontend-dev', sessionId: 'demo-fe-session-id',      messageCount: 39, isLead: false },
    { agentName: 'backend-dev',  sessionId: 'demo-be-session-id',      messageCount: 58, isLead: false },
    { agentName: 'tester',       sessionId: 'demo-tester-session-id',  messageCount: 23, isLead: false },
  ];
}

export function getDemoExecSummary(): ExecSummaryResponse {
  return {
    teamId: 'demo-team',
    summary: `- **Overall:** 4 of 6 tasks completed (67%), 1 in progress, 1 pending — team is on track\n- **Completed:** Architecture design, frontend UI implementation, backend REST API — all core features delivered\n- **Active:** Integration testing underway (tester) — CI environment issue blocking test runs\n- **Blockers:** \`/api/teams\` returns 404 in CI; environment variables on CI runner need verification\n- **Attention:** frontend-dev awaiting human input on WCAG vs phosphor aesthetic decision (25 min)\n- **Token usage:** 174k total across 4 agents (167 messages) — backend-dev highest consumer at ~38%`,
    generatedAt: new Date().toISOString(),
    isAIGenerated: false,
    isStale: false,
  };
}

export function getDemoCostData(): CostData {
  const base = new Date('2026-03-07T09:00:00Z');
  const t = (offsetMinutes: number) => new Date(base.getTime() + offsetMinutes * 60000).toISOString();

  function makeSeries(msgs: number, startMin: number) {
    const pts: TokenDataPoint[] = [];
    let ci = 0, co = 0;
    for (let i = 0; i < msgs; i++) {
      ci += Math.round(800 + Math.random() * 400);
      co += Math.round(200 + Math.random() * 150);
      pts.push({ timestamp: t(startMin + i * 8), cumulativeInput: ci, cumulativeOutput: co });
    }
    return pts;
  }

  const totalIn  = 45200 + 38100 + 52400 + 21000;
  const totalOut = 12300 + 9800  + 14700 + 5600;
  const totalCR  = 89400 + 71200 + 103000 + 42100;

  return {
    teamId: 'demo-team',
    totals: { inputTokens: totalIn, outputTokens: totalOut, cacheReadTokens: totalCR },
    byAgent: [
      { agentName: 'team-lead',    inputTokens: 45200, outputTokens: 12300, cacheReadTokens: 89400,  messageCount: 47, percentage: Math.round((45200+12300) / (totalIn+totalOut) * 100) },
      { agentName: 'frontend-dev', inputTokens: 38100, outputTokens: 9800,  cacheReadTokens: 71200,  messageCount: 39, percentage: Math.round((38100+9800)  / (totalIn+totalOut) * 100) },
      { agentName: 'backend-dev',  inputTokens: 52400, outputTokens: 14700, cacheReadTokens: 103000, messageCount: 58, percentage: Math.round((52400+14700) / (totalIn+totalOut) * 100) },
      { agentName: 'tester',       inputTokens: 21000, outputTokens: 5600,  cacheReadTokens: 42100,  messageCount: 23, percentage: Math.round((21000+5600)  / (totalIn+totalOut) * 100) },
    ],
    byTool: [
      { toolName: 'Bash',         callCount: 57 },
      { toolName: 'Read',         callCount: 59 },
      { toolName: 'Edit',         callCount: 24 },
      { toolName: 'Write',        callCount: 23 },
      { toolName: 'Task',         callCount: 18 },
      { toolName: 'SendMessage',  callCount: 9  },
      { toolName: 'TaskUpdate',   callCount: 14 },
      { toolName: 'TaskCreate',   callCount: 6  },
    ],
    timeSeries: [
      { agentName: 'team-lead',    dataPoints: makeSeries(8, 0)  },
      { agentName: 'frontend-dev', dataPoints: makeSeries(7, 5)  },
      { agentName: 'backend-dev',  dataPoints: makeSeries(9, 2)  },
      { agentName: 'tester',       dataPoints: makeSeries(5, 10) },
    ],
  };
}

export function getDemoFeedbackEntries(): object[] {
  const now = Date.now();
  const t = (offsetHours: number) => new Date(now - offsetHours * 3600000).toISOString();
  return [
    { id: 'fb-001', agentName: 'backend-dev',  type: 'correction', content: 'Error handling should use Result<T,E> pattern instead of try-catch everywhere', sessionId: 'demo-lead-session-id', messageUuid: 'uuid-001', createdAt: t(1)  },
    { id: 'fb-002', agentName: 'frontend-dev', type: 'praise',     content: null, sessionId: 'demo-lead-session-id', messageUuid: 'uuid-002', createdAt: t(3)  },
    { id: 'fb-003', agentName: 'tester',       type: 'bookmark',   content: 'Good pattern: testing API + UI integration together in the same test file', sessionId: 'demo-lead-session-id', messageUuid: 'uuid-003', createdAt: t(5)  },
    { id: 'fb-004', agentName: 'backend-dev',  type: 'correction', content: 'Always validate request body against a schema before processing — no raw access', sessionId: 'demo-lead-session-id', messageUuid: 'uuid-004', createdAt: t(8)  },
    { id: 'fb-005', agentName: 'frontend-dev', type: 'bookmark',   content: 'CRT aesthetic hover pattern: use onMouseEnter/Leave with inline style mutations', sessionId: 'demo-lead-session-id', messageUuid: 'uuid-005', createdAt: t(12) },
    { id: 'fb-006', agentName: 'team-lead',    type: 'praise',     content: null, sessionId: 'demo-lead-session-id', messageUuid: 'uuid-006', createdAt: t(20) },
  ];
}

export function getDemoMemory(): { content: string; path: string; lastModified: string; source: string } {
  return {
    content: `# Demo Team — Memory

## Project
- Path: \`/demo/project\`
- Stack: React + TypeScript (Vite) client, Express + TypeScript server
- Server runs on port 3006

## Completed Features
- **Stage 1**: Project scaffolding and initial setup
- **Stage 2**: UI component library with CRT aesthetic
- **Stage 3**: REST API endpoints (in progress)

## Key Decisions
- Use Result<T,E> pattern for error handling instead of try-catch
- Validate all request bodies against schema before processing
- Co-locate API and UI integration tests in same file

## Architecture Notes
- Dark theme with WCAG AA contrast compliance
- CSS vars for all colors — no hardcoded hex values
- Component files under 200 lines, extract sub-components
`,
    path: '~/.claude-internal/projects/-demo-project/memory/MEMORY.md',
    lastModified: new Date().toISOString(),
    source: 'claude-internal',
  };
}

export function getDemoKnowledgeAnalysis() {
  return {
    items: [
      { content: 'Use Result<T,E> pattern for error handling instead of try-catch', category: 'universal', destination: 'guide', reason: 'General best practice applicable to any TypeScript project', source: 'memory' },
      { content: 'CSS vars for all colors — no hardcoded hex values', category: 'universal', destination: 'guide', reason: 'Design system pattern applicable across projects', source: 'memory' },
      { content: 'Validate all request bodies against schema before processing', category: 'transferable', destination: 'guide', reason: 'API design pattern transferable to other Express servers', source: 'memory' },
      { content: 'Dark theme with WCAG AA contrast compliance', category: 'transferable', destination: 'memory', reason: 'Accessibility pattern worth carrying forward', source: 'memory' },
      { content: 'Server runs on port 3006', category: 'project-specific', destination: 'memory', reason: 'Port number is specific to the demo project', source: 'memory' },
    ],
    stats: { total: 5, universal: 2, transferable: 2, projectSpecific: 1, ephemeral: 0, deduplicated: 0 },
  };
}

export function getDemoPreferences(): Record<string, string[]> {
  return {
    'backend-dev':  ['Use Result<T,E> for error handling over try-catch', 'Validate all request bodies against a schema before processing', 'Prefer explicit return types on all functions'],
    'frontend-dev': ['Apply CRT aesthetic: onMouseEnter/Leave inline style mutations', 'Use var(--css-vars) for all colors — no hardcoded hex', 'Keep component files under 200 lines, extract sub-components'],
    'tester':       ['Co-locate API and UI integration tests in the same file', 'Write test descriptions in plain English, not camelCase'],
  };
}

export function getDemoContextSummary(): { content: string; path: string; lastModified: string } {
  return {
    content: `# Context Summary — Demo Team

## Decisions
- [2026-03-15] Use Express + TypeScript for server, React + Vite for client
- [2026-03-16] CRT phosphor-green aesthetic with CSS variables for all theming
- [2026-03-17] REST API over WebSocket for data, WS only for real-time push notifications
- [2026-03-18] LLM calls via @mariozechner/pi-ai (multi-provider support)

## Progress
- Stage A complete: full dashboard (matrix, graph, comms, timeline, sessions, cost, export)
- Stage B complete: alerts, cross-agent session browser, cost dashboard
- Stage D complete: feedback loop, preferences, memory management
- Stage E in progress: E1 preference distillation ✅, E3 knowledge transfer ✅

## Context
- Server port: 3006, client built to server/dist/public/
- LLM: @mariozechner/pi-ai (OpenAI, Anthropic, Google, or any OpenAI-compatible endpoint)
- Model: claude-sonnet-4-6 (default)
- Teams dir: ~/.claude/teams, Tasks dir: ~/.claude/tasks
- Demo mode: auto (shows mock data when no live teams exist)
- Current blocker: C1 (human intervention) needs IPC write to Claude Code process`,
    path: '~/.claude/teams/demo-team/context-summary.md',
    lastModified: new Date().toISOString(),
  };
}
