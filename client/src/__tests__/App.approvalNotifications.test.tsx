import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
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

const makeRequest = (id: string, agentName = 'worker'): PermissionRequest => ({
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
      if (key === 'approval.notification_title') return 'Permission Request';
      if (key === 'approval.notification_body') return `${String(vars?.agent ?? '')} needs ${String(vars?.tool ?? '')}`;
      if (key === 'approval.agent') return 'Agent';
      if (key === 'approval.tool') return 'Tool';
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

vi.mock('../components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../components/EmptyState', () => ({ default: () => <div>empty</div> }));
vi.mock('../components/dashboard/DashboardView', () => ({ default: () => <div>dashboard</div> }));
vi.mock('../components/TaskDetailPanel', () => ({ default: () => null }));
vi.mock('../components/AgentProfilePanel', () => ({ default: () => null }));
vi.mock('../components/alerts/AlertBanner', () => ({ default: () => null }));
vi.mock('../components/shared/ApprovalModal', () => ({ default: ({ request }: { request: PermissionRequest }) => <div>modal-{request.id}</div> }));
vi.mock('../utils/exportUtils', () => ({
  exportGraphAsPng: vi.fn(),
  exportTeamAsJson: vi.fn(),
  exportTasksCsv: vi.fn(),
  exportCommLogCsv: vi.fn(),
  exportTimelineCsv: vi.fn(),
}));

describe('App approval notification diff', () => {
  beforeEach(() => {
    permissionState.requests = [];
    permissionState.resolvingId = null;
    permissionState.resolveRequest = vi.fn(async () => true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('does not create a toast for requests already present on initial load', async () => {
    permissionState.requests = [makeRequest('req-1')];
    const { default: App } = await import('../App');

    await act(async () => {
      render(<App />);
    });

    expect(screen.queryByText('Permission Request')).not.toBeInTheDocument();
  });

  it('creates one toast when a new permission request arrives after initial load', async () => {
    const { default: App } = await import('../App');
    const view = render(<App />);

    expect(screen.queryByText('Permission Request')).not.toBeInTheDocument();

    permissionState.requests = [makeRequest('req-2', 'reviewer')];
    await act(async () => {
      view.rerender(<App />);
    });

    expect(screen.getByText('Permission Request')).toBeInTheDocument();
    expect(screen.getByText('reviewer needs Bash')).toBeInTheDocument();
  });

  it('does not duplicate toast for the same request id and auto-dismisses it', async () => {
    const { default: App } = await import('../App');
    const view = render(<App />);

    permissionState.requests = [makeRequest('req-3', 'writer')];
    await act(async () => {
      view.rerender(<App />);
    });

    expect(screen.getAllByText('Permission Request')).toHaveLength(1);

    await act(async () => {
      view.rerender(<App />);
    });
    expect(screen.getAllByText('Permission Request')).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(5180);
    });

    expect(screen.queryByText('Permission Request')).not.toBeInTheDocument();
  });
});
