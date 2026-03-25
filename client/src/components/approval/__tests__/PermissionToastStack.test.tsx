import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PermissionToastStack from '../PermissionToastStack';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('PermissionToastStack', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders toast cards with entry animation', () => {
    render(
      <PermissionToastStack
        toasts={[{ id: 'req-1', title: 'Permission Request', body: 'worker needs Bash' }]}
        onDismiss={vi.fn()}
      />,
    );

    const toast = screen.getByTestId('permission-toast-req-1');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveStyle({ animation: 'fade-up 0.18s ease-out' });
  });

  it('clicking a toast opens the related approval request', () => {
    const onSelect = vi.fn();

    render(
      <PermissionToastStack
        toasts={[{ id: 'req-1', title: 'Permission Request', body: 'worker needs Bash' }]}
        onDismiss={vi.fn()}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByTestId('permission-toast-req-1'));
    expect(onSelect).toHaveBeenCalledWith('req-1');
  });

  it('shows interactive hover and focus styling for keyboard-accessible toasts', () => {
    const onSelect = vi.fn();

    render(
      <PermissionToastStack
        toasts={[{ id: 'req-1', title: 'Permission Request', body: 'worker needs Bash' }]}
        onDismiss={vi.fn()}
        onSelect={onSelect}
      />,
    );

    const toast = screen.getByTestId('permission-toast-req-1');
    expect(toast).toHaveAttribute('role', 'button');
    expect(toast).toHaveAttribute('tabindex', '0');

    fireEvent.mouseOver(toast);
    expect(toast.getAttribute('style')).toContain('var(--surface-2)');

    fireEvent.focus(toast);
    expect(toast.getAttribute('style')).toContain('var(--active-border-hi)');

    fireEvent.keyDown(toast, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('req-1');
  });

  it('waits for exit animation before dismissing', () => {
    const onDismiss = vi.fn();

    render(
      <PermissionToastStack
        toasts={[{ id: 'req-1', title: 'Permission Request', body: 'worker needs Bash' }]}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByLabelText('approval.dismiss_notification'));
    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(180);
    expect(onDismiss).toHaveBeenCalledWith('req-1');
  });
});
