import { useEffect, useRef, useState } from 'react';
import type { SessionMessage, SessionEntry } from '../../types';
import MarkdownContent from '../shared/MarkdownContent';
import ToolCallBlock from './ToolCallBlock';

interface ChatBubbleProps {
  message: SessionMessage;
  isStreaming: boolean;
}

export default function ChatBubble({ message, isStreaming }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      padding: '4px 0',
    }}>
      {/* Timestamp + role label */}
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        letterSpacing: '0.08em',
        marginBottom: '3px',
        padding: isUser ? '0 8px 0 0' : '0 0 0 8px',
      }}>
        {isUser ? 'USER' : 'ASSISTANT'} · {fmtTime(message.timestamp)}
      </div>

      {/* Entries */}
      <div style={{
        maxWidth: '85%',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        {message.entries.map((entry, idx) => (
          <EntryRenderer
            key={idx}
            entry={entry}
            isUser={isUser}
            isStreaming={isStreaming && idx === message.entries.length - 1 && entry.kind === 'text'}
            nextEntry={message.entries[idx + 1]}
          />
        ))}
      </div>
    </div>
  );
}

function EntryRenderer({ entry, isUser, isStreaming, nextEntry }: {
  entry: SessionEntry;
  isUser: boolean;
  isStreaming: boolean;
  nextEntry?: SessionEntry;
}) {
  if (entry.kind === 'tool_use') {
    const resultEntry = nextEntry?.kind === 'tool_result' && nextEntry.toolResultId === entry.toolUseId
      ? nextEntry : undefined;
    return <ToolCallBlock entry={entry} resultEntry={resultEntry} />;
  }

  if (entry.kind === 'tool_result') {
    // Rendered inline with tool_use above — skip standalone rendering
    return null;
  }

  // text kind
  const text = entry.text ?? '';
  if (!text.trim()) return null;

  return (
    <div style={{
      background: isUser ? 'var(--ice-bg-subtle)' : 'var(--surface-1)',
      border: `1px solid ${isUser ? 'var(--ice-border-subtle)' : 'var(--border)'}`,
      borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
      padding: '10px 14px',
      fontSize: '11px',
      lineHeight: 1.6,
      color: 'var(--text-secondary)',
      position: 'relative',
    }}>
      {isStreaming ? (
        <StreamingText text={text} />
      ) : (
        <MarkdownContent content={text} />
      )}
    </div>
  );
}

/** Typewriter effect for the latest assistant message */
function StreamingText({ text }: { text: string }) {
  const [visibleLen, setVisibleLen] = useState(0);
  const rafRef = useRef(0);
  const posRef = useRef(0);

  useEffect(() => {
    const CHARS_PER_FRAME = 30;
    posRef.current = 0;
    setVisibleLen(0);

    function step() {
      posRef.current = Math.min(posRef.current + CHARS_PER_FRAME, text.length);
      setVisibleLen(posRef.current);
      if (posRef.current < text.length) {
        rafRef.current = requestAnimationFrame(step);
      }
    }
    rafRef.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafRef.current);
  }, [text]);

  const done = visibleLen >= text.length;

  return (
    <span>
      <MarkdownContent content={text.slice(0, visibleLen)} />
      {!done && (
        <span style={{
          color: 'var(--phosphor)',
          animation: 'blink 1s steps(2) infinite',
          marginLeft: '1px',
        }}>▊</span>
      )}
    </span>
  );
}

function fmtTime(ts: string) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ts.slice(11, 19); }
}
