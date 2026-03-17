/**
 * ChatView integration test.
 *
 * We test the ChatView component by mocking its heavy sub-hooks.
 * The internal useChatHistory hook (defined inside ChatView.tsx) can't
 * be mocked directly, so we mock `fetch` and use fake timers.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import type { TeamDetail } from '../../../types';

// Mock heavy external deps first
vi.mock('../../../hooks/useAgentSessions', () => ({
  useAgentSessions: vi.fn(() => ({
    agents: [
      { agentName: 'lead', sessionId: 's1', messageCount: 5, isLead: true },
      { agentName: 'worker', sessionId: 's2', messageCount: 3, isLead: false },
    ],
    loading: false,
  })),
}));

vi.mock('../../../hooks/useAgentRespond', () => ({
  useAgentRespond: vi.fn(() => ({
    respond: vi.fn(async () => true),
    sending: false,
    error: null,
    clearError: vi.fn(),
  })),
}));

vi.mock('lucide-react', () => ({ Send: () => null }));

// Pre-load the component once, before any tests
let ChatView: typeof import('../ChatView').default;
beforeAll(async () => {
  const mod = await import('../ChatView');
  ChatView = mod.default;
});

const teamDetail: TeamDetail = {
  id: 'team-1',
  name: 'Test Team',
  config: {
    members: [
      { name: 'lead', agentId: 'a1', agentType: 'general' },
      { name: 'worker', agentId: 'a2', agentType: 'general' },
    ],
  },
  tasks: [],
  stats: { total: 0, pending: 0, inProgress: 0, completed: 0 },
};

describe('ChatView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [] }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders agent tabs', async () => {
    await act(async () => { render(<ChatView teamId="team-1" teamDetail={teamDetail} />); });
    expect(screen.getByText('lead')).toBeInTheDocument();
    expect(screen.getByText('worker')).toBeInTheDocument();
  });

  it('shows textarea when agent is selected', async () => {
    await act(async () => { render(<ChatView teamId="team-1" teamDetail={teamDetail} />); });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows empty state when no agents', async () => {
    const { useAgentSessions } = await import('../../../hooks/useAgentSessions');
    (useAgentSessions as ReturnType<typeof vi.fn>).mockReturnValue({ agents: [], loading: false });

    await act(async () => {
      render(<ChatView teamId="team-1" teamDetail={{ ...teamDetail, config: { members: [] } }} />);
    });
    expect(screen.getByText('chat.select_agent')).toBeInTheDocument();
  });

  it('send button is disabled when input is empty', async () => {
    await act(async () => { render(<ChatView teamId="team-1" teamDetail={teamDetail} />); });
    expect(screen.getByTitle('Ctrl+Enter to send')).toBeDisabled();
  });
});
