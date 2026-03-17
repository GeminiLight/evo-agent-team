import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolCallBlock from '../ToolCallBlock';
import type { SessionEntry } from '../../../types';

function makeToolUse(overrides?: Partial<SessionEntry>): SessionEntry {
  return {
    kind: 'tool_use',
    toolName: 'Read',
    toolUseId: 'tu-1',
    toolInput: { file_path: '/src/index.ts' },
    ...overrides,
  };
}

function makeToolResult(overrides?: Partial<SessionEntry>): SessionEntry {
  return {
    kind: 'tool_result',
    toolResultId: 'tu-1',
    toolResultText: 'file contents here',
    isError: false,
    ...overrides,
  };
}

describe('ToolCallBlock', () => {
  it('shows tool name in collapsed state', () => {
    render(<ToolCallBlock entry={makeToolUse()} />);
    expect(screen.getByText(/Read/)).toBeInTheDocument();
    // Should show the collapse arrow
    expect(screen.getByText('▼')).toBeInTheDocument();
  });

  it('expands on click to show INPUT and RESULT', async () => {
    const user = userEvent.setup();
    render(<ToolCallBlock entry={makeToolUse()} resultEntry={makeToolResult()} />);

    // Click to expand
    await user.click(screen.getByRole('button'));

    expect(screen.getByText('INPUT')).toBeInTheDocument();
    expect(screen.getByText('RESULT')).toBeInTheDocument();
    expect(screen.getByText('▲')).toBeInTheDocument();
  });

  it('shows correct color for known tool (Read → #5bc8f5)', () => {
    render(<ToolCallBlock entry={makeToolUse({ toolName: 'Read' })} />);
    const toolNameSpan = screen.getByText(/Read/);
    expect(toolNameSpan).toHaveStyle({ color: '#5bc8f5' });
  });

  it('shows fallback color for unknown tool', () => {
    render(<ToolCallBlock entry={makeToolUse({ toolName: 'CustomTool' })} />);
    const toolNameSpan = screen.getByText(/CustomTool/);
    expect(toolNameSpan).toHaveStyle({ color: '#94a3b8' });
  });

  it('truncates long input values', () => {
    const longPath = 'a'.repeat(100);
    render(<ToolCallBlock entry={makeToolUse({ toolInput: { file_path: longPath } })} />);
    // The summary should be truncated to 80 chars (77 + ...)
    const summary = screen.getByText(/\.\.\.$/);
    expect(summary.textContent!.length).toBeLessThanOrEqual(80);
  });

  it('shows ERROR label when result has isError', async () => {
    const user = userEvent.setup();
    render(
      <ToolCallBlock
        entry={makeToolUse()}
        resultEntry={makeToolResult({ isError: true, toolResultText: 'something went wrong' })}
      />,
    );

    await user.click(screen.getByRole('button'));
    expect(screen.getByText('ERROR')).toBeInTheDocument();
  });
});
