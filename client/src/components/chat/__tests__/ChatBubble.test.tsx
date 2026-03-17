import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatBubble from '../ChatBubble';
import type { SessionMessage } from '../../../types';

function makeMessage(overrides?: Partial<SessionMessage>): SessionMessage {
  return {
    uuid: 'msg-1',
    role: 'user',
    timestamp: '2024-01-01T12:00:00Z',
    entries: [{ kind: 'text', text: 'Hello world' }],
    ...overrides,
  };
}

describe('ChatBubble', () => {
  it('shows USER label for user messages', () => {
    render(<ChatBubble message={makeMessage({ role: 'user' })} isStreaming={false} />);
    expect(screen.getByText(/USER/)).toBeInTheDocument();
  });

  it('shows ASSISTANT label for assistant messages', () => {
    render(<ChatBubble message={makeMessage({ role: 'assistant' })} isStreaming={false} />);
    expect(screen.getByText(/ASSISTANT/)).toBeInTheDocument();
  });

  it('renders ToolCallBlock for tool_use entries', () => {
    const msg = makeMessage({
      role: 'assistant',
      entries: [
        { kind: 'tool_use', toolName: 'Read', toolUseId: 'tu-1', toolInput: { file_path: '/a.ts' } },
      ],
    });
    render(<ChatBubble message={msg} isStreaming={false} />);
    // ToolCallBlock renders the tool name
    expect(screen.getByText(/Read/)).toBeInTheDocument();
  });

  it('does not render tool_result as standalone when following tool_use', () => {
    const msg = makeMessage({
      role: 'assistant',
      entries: [
        { kind: 'tool_use', toolName: 'Read', toolUseId: 'tu-1', toolInput: {} },
        { kind: 'tool_result', toolResultId: 'tu-1', toolResultText: 'data' },
      ],
    });
    const { container } = render(<ChatBubble message={msg} isStreaming={false} />);
    // tool_result should not create its own separate block — it's inline with tool_use
    // The "data" text should only appear when the tool block is expanded
    // Check that there's only one tool-related element (the ToolCallBlock)
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(1); // Only the ToolCallBlock expand button
  });

  it('does not render entry with empty text', () => {
    const msg = makeMessage({
      entries: [{ kind: 'text', text: '   ' }],
    });
    const { container } = render(<ChatBubble message={msg} isStreaming={false} />);
    // Should still have the label, but no text bubble
    expect(screen.getByText(/USER/)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="md"]')).toHaveLength(0);
  });

  it('shows content via MarkdownContent mock for text entries', () => {
    render(<ChatBubble message={makeMessage()} isStreaming={false} />);
    const md = screen.getByTestId('md');
    expect(md).toHaveTextContent('Hello world');
  });
});
