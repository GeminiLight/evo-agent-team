import type { TeamConfig, Task, TeamSummary, TeamDetail, TimelineResponse, CommLogResponse, ProjectTodosResponse, InboxSummaryResponse, SessionStatsResponse } from './types.js';

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
  return {
    teamId: 'demo-team',
    agents: [
      { agentName: 'team-lead',    inputTokens: 45200, outputTokens: 12300, cacheReadTokens: 89400,  messageCount: 47, sessionDurationMs: 5400000  },
      { agentName: 'frontend-dev', inputTokens: 38100, outputTokens: 9800,  cacheReadTokens: 71200,  messageCount: 39, sessionDurationMs: 4200000  },
      { agentName: 'backend-dev',  inputTokens: 52400, outputTokens: 14700, cacheReadTokens: 103000, messageCount: 58, sessionDurationMs: 6100000  },
      { agentName: 'tester',       inputTokens: 21000, outputTokens: 5600,  cacheReadTokens: 42100,  messageCount: 23, sessionDurationMs: 2800000  },
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
