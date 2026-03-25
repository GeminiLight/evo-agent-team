import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ApprovalPanel from '../ApprovalPanel';
import type { PermissionRequest } from '../../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      if (key === 'approval.pending_requests') return `Pending Requests (${String(vars?.count ?? '')})`;
      if (key === 'approval.no_reason') return 'No reason';
      if (key === 'approval.ok') return 'OK';
      if (key === 'approval.deny') return 'Deny';
      if (key === 'approval.details') return 'Details';
      return key;
    },
  }),
}));

vi.mock('lucide-react', () => ({ Clock: () => null }));

const request = (overrides: Partial<PermissionRequest> = {}): PermissionRequest => ({
  id: 'req-1',
  createdAt: '2026-03-25T00:00:00.000Z',
  expiresAt: '2099-03-25T00:05:00.000Z',
  agentName: 'worker',
  toolName: 'Bash',
  reason: 'Need approval',
  ...overrides,
});

describe('ApprovalPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when there are no requests', () => {
    const { container } = render(
      <ApprovalPanel requests={[]} resolvingId={null} onResolve={vi.fn(async () => true)} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders translated content for requests', () => {
    render(
      <ApprovalPanel requests={[request()]} resolvingId={null} onResolve={vi.fn(async () => true)} />,
    );

    expect(screen.getByText('Pending Requests (1)')).toBeInTheDocument();
    expect(screen.getByText(/worker/)).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('Deny')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
  });

  it('falls back to translated no reason text', () => {
    render(
      <ApprovalPanel requests={[request({ reason: undefined })]} resolvingId={null} onResolve={vi.fn(async () => true)} />,
    );

    expect(screen.getByText('No reason')).toBeInTheDocument();
  });

  it('persists collapsed state to localStorage and restores it', () => {
    const { unmount } = render(
      <ApprovalPanel requests={[request()]} resolvingId={null} onResolve={vi.fn(async () => true)} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Pending Requests/i }));
    expect(localStorage.getItem('approval-panel-collapsed')).toBe('1');

    unmount();

    render(
      <ApprovalPanel requests={[request()]} resolvingId={null} onResolve={vi.fn(async () => true)} />,
    );

    expect(screen.queryByText('OK')).not.toBeInTheDocument();
  });

  it('adds scroll-margin-top for scrollIntoView alignment', () => {
    render(
      <ApprovalPanel requests={[request()]} resolvingId={null} onResolve={vi.fn(async () => true)} />,
    );
    const item = screen.getByText(/worker/).closest('div[id^="approval-req-"]');
    expect(item).toHaveStyle({ scrollMarginTop: '80px' });
  });

  it('adds hover styles to approval list items and action buttons', () => {
    render(
      <ApprovalPanel requests={[request()]} resolvingId={null} onResolve={vi.fn(async () => true)} />,
    );

    const item = screen.getByText(/worker/).closest('div[id^="approval-req-"]') as HTMLElement;
    
    // Test panel item hover
    fireEvent.mouseEnter(item);
    expect(item.getAttribute('style')).toContain('var(--surface-2)');
    
    fireEvent.mouseLeave(item);
    expect(item.getAttribute('style')).toContain('var(--surface-0)');

    // Test Deny button hover
    const denyBtn = screen.getByText('Deny');
    fireEvent.mouseEnter(denyBtn);
    expect(denyBtn.getAttribute('style')).toContain('var(--crimson)');
    
    fireEvent.mouseLeave(denyBtn);
    expect(denyBtn.getAttribute('style')).toContain('var(--text-muted)');

    // Test Details button hover
    const detailsBtn = screen.getByText('Details');
    fireEvent.mouseEnter(detailsBtn);
    expect(detailsBtn.getAttribute('style')).toContain('var(--text-primary)');
    
    fireEvent.mouseLeave(detailsBtn);
    expect(detailsBtn.getAttribute('style')).toContain('var(--text-secondary)');
  });

  it('does not crash when localStorage access fails', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => {
      render(
        <ApprovalPanel requests={[request()]} resolvingId={null} onResolve={vi.fn(async () => true)} />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Pending Requests/i }));
    }).not.toThrow();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('delegates details opening to the app layer', () => {
    const onOpenDetails = vi.fn();

    render(
      <ApprovalPanel
        requests={[request()]}
        resolvingId={null}
        onResolve={vi.fn(async () => true)}
        onOpenDetails={onOpenDetails}
      />,
    );

    fireEvent.click(screen.getByText('Details'));
    expect(onOpenDetails).toHaveBeenCalledWith(expect.objectContaining({ id: 'req-1' }));
  });
});
