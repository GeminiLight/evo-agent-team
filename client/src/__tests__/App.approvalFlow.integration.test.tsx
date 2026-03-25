import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PermissionRequest, TeamDetail, TeamSummary } from '../types';

const permissionState: {
  requests: PermissionRequest[];
  resolveRequest: (id: string, decision: 'approve' | 'deny') => Promise<boolean>;
  resolvingId: string | null;
} = {
  requests: [],
  resolveRequest: vi.fn(async () => true),
  resolvingId: null,
};

const teams: TeamSummary[] = [{ id: 'team-1', name: 'Team 1', hasConfig: true, memberCount: 1, taskCount: 0 }];
const teamDetail: TeamDetail = {
  id: 'team-1',
  name: 'Team 1',
  config: { members: [{ name: 'lead', agentId: 'a1', agentType: 'general' }] },
  tasks: [],
  stats: { total: 0, pending: 0, inProgress: 0, completed: 0 },
};

const makeRequest = (id: string, agentName: string): PermissionRequest => ({
  id,
  createdAt: '2026-03-25T00:00:00.000Z',
  expiresAt: '2099-03-25T00:05:00.000Z',
  agentName,
  toolName: 'Bash',
  reason: 'Need approval',
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      if (key === 'approval.pending_requests') return `Pending Requests (${String(vars?.count ?? '')})`;
      if (key === 'approval.no_reason') return 'No reason';
      if (key === 'approval.ok') return 'OK';
      if (key === 'approval.deny') return 'Deny';
      if (key === 'approval.details') return 'Details';
      if (key === 'approval.notification_title') return 'Permission Request';
      if (key === 'approval.notification_body') return `${String(vars?.agent ?? '')} needs ${String(vars?.tool ?? '')}`;
      if (key === 'approval.wants_permission') return `${String(vars?.agent ?? '')} wants permission to run ${String(vars?.tool ?? '')}.`;
      if (key === 'approval.title') return 'Permission Request';
      if (key === 'approval.agent') return 'Agent';
      if (key === 'approval.tool') return 'Tool';
      if (key === 'approval.team') return 'Team';
      if (key === 'approval.reason') return 'Reason';
      if (key === 'approval.command') return 'Command';
      if (key === 'approval.expires_in') return `${String(vars?.minutes ?? 0)}m ${String(vars?.seconds ?? 0)}s`;
      if (key === 'approval.dismiss_notification') return 'Dismiss notification';
      if (key === 'dashboard.roster') return 'Roster';
      if (key === 'dashboard.sort') return 'Sort';
      if (key === 'dashboard.sort_default') return 'Default';
      if (key === 'dashboard.sort_workload') return 'Workload';
      if (key === 'dashboard.sort_completion') return 'Done';
      if (key === 'dashboard.sort_name') return 'Name';
      if (key === 'dashboard.sort_default_tooltip') return 'default';
      if (key === 'dashboard.sort_workload_tooltip') return 'workload';
      if (key === 'dashboard.sort_completion_tooltip') return 'completion';
      if (key === 'dashboard.sort_name_tooltip') return 'name';
      if (key === 'dashboard.no_agents') return 'No agents';
      if (key === 'dashboard.no_agents_sub') return 'No agents sub';
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../hooks/useTeamData', () => ({
  useTeamData: () => ({
    teams,
    selectedTeamId: 'team-1',
    setSelectedTeamId: vi.fn(),
    teamDetail,
    setTeamDetail: vi.fn(),
    loading: false,
    isDemoMode: false,
    enableDemo: vi.fn(),
    wsConnected: true,
  }),
}));
vi.mock('../hooks/usePendingHumanRequests', () => ({ usePendingHumanRequests: () => ({ count: 0, agentNames: [], details: [] }) }));
vi.mock('../hooks/useProjectTodos', () => ({ useProjectTodos: () => [] }));
vi.mock('../hooks/useInboxSummary', () => ({ useInboxSummary: () => ({}) }));
vi.mock('../hooks/useSessionStats', () => ({ useSessionStats: () => ({}) }));
vi.mock('../hooks/useAlerts', () => ({ useAlerts: () => ({ alerts: [], loading: false }) }));
vi.mock('../hooks/useCostData', () => ({ useCostData: () => ({ data: null, loading: false }) }));
vi.mock('../hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: () => undefined }));
vi.mock('../hooks/usePermissionRequests', () => ({ usePermissionRequests: () => permissionState }));
vi.mock('../components/Layout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../components/EmptyState', () => ({ default: () => <div>empty</div> }));
vi.mock('../components/TaskDetailPanel', () => ({ default: () => null }));
vi.mock('../components/AgentProfilePanel', () => ({ default: () => null }));
vi.mock('../components/alerts/AlertBanner', () => ({ default: () => null }));
vi.mock('../components/dashboard/TeamOverview', () => ({
  ExecSummaryBlock: () => <div>summary</div>,
  ProgressSection: () => <div>progress</div>,
  StatsRow: () => <div>stats</div>,
}));
vi.mock('../components/dashboard/CompactAgentCard', () => ({ default: () => <div>agent-card</div> }));
vi.mock('../components/dashboard/ActionQueue', () => ({ default: () => <div>action-queue</div> }));
vi.mock('../components/dashboard/TaskList', () => ({ default: () => <div>task-list</div> }));
vi.mock('../components/dashboard/AgentHeatmap', () => ({ default: () => <div>heatmap</div> }));
vi.mock('../components/shared/CRTEmptyState', () => ({ default: () => <div>empty-state</div> }));
vi.mock('../hooks/useMediaQuery', () => ({ useIsTablet: () => false }));
vi.mock('../utils/exportUtils', () => ({
  exportGraphAsPng: vi.fn(),
  exportTeamAsJson: vi.fn(),
  exportTasksCsv: vi.fn(),
  exportCommLogCsv: vi.fn(),
  exportTimelineCsv: vi.fn(),
}));
vi.mock('../components/shared/ApprovalModal', () => ({
  default: ({ request }: { request: PermissionRequest }) => <div>modal-{request.id}</div>,
}));

describe('App + ApprovalPanel integration', () => {
  beforeEach(() => {
    permissionState.requests = [];
    permissionState.resolvingId = null;
    permissionState.resolveRequest = vi.fn(async () => true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('clicking Details in ApprovalPanel selects the matching modal request', async () => {
    permissionState.requests = [
      makeRequest('req-1', 'worker-one'),
      makeRequest('req-2', 'worker-two'),
    ];

    const { default: App } = await import('../App');

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('modal-req-1')).toBeInTheDocument();

    const detailsButtons = screen.getAllByText('Details');
    fireEvent.click(detailsButtons[1]);

    expect(screen.getByText('modal-req-2')).toBeInTheDocument();
  });
});
