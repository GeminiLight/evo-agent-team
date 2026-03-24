import { useState } from 'react';
import type { SessionEntry } from '../../types';
import { toolColor } from '../../utils/colorMaps';

function summarizeInput(input?: Record<string, unknown>): string {
  if (!input) return '';
  const keys = Object.keys(input);
  if (keys.length === 0) return '';
  // Show first meaningful value
  for (const k of ['command', 'pattern', 'query', 'file_path', 'path', 'content', 'description', 'prompt']) {
    if (input[k] && typeof input[k] === 'string') {
      const val = input[k] as string;
      return val.length > 80 ? val.slice(0, 77) + '...' : val;
    }
  }
  return keys.slice(0, 3).join(', ');
}

interface ToolCallBlockProps {
  entry: SessionEntry;
  resultEntry?: SessionEntry;
}

export default function ToolCallBlock({ entry, resultEntry }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const name = entry.toolName ?? 'Unknown';
  const color = toolColor(name);
  const summary = summarizeInput(entry.toolInput);

  return (
    <div style={{
      margin: '4px 0',
      borderRadius: '4px',
      border: `1px solid ${color}33`,
      background: `${color}08`,
      overflow: 'hidden',
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          padding: '6px 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--text-secondary)',
          textAlign: 'left',
        }}
      >
        <span style={{ color, fontWeight: 600, flexShrink: 0 }}>
          🔧 {name}
        </span>
        {summary && (
          <span style={{
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            fontSize: '9px',
          }}>
            {summary}
          </span>
        )}
        <span style={{
          fontSize: '9px',
          color: 'var(--text-muted)',
          flexShrink: 0,
          opacity: 0.6,
        }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${color}22`,
          padding: '8px 10px',
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.5,
        }}>
          {entry.toolInput && Object.keys(entry.toolInput).length > 0 && (
            <div style={{ marginBottom: resultEntry ? '8px' : 0 }}>
              <div style={{ color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px', textTransform: 'uppercase' }}>
                INPUT
              </div>
              <pre style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                padding: '8px',
                overflowX: 'auto',
                color: 'var(--text-secondary)',
                margin: 0,
                maxHeight: '200px',
                overflow: 'auto',
              }}>
                {JSON.stringify(entry.toolInput, null, 2)}
              </pre>
            </div>
          )}
          {resultEntry && (
            <div>
              <div style={{
                color: resultEntry.isError ? 'var(--crimson)' : 'var(--text-muted)',
                letterSpacing: '0.1em',
                marginBottom: '4px',
                textTransform: 'uppercase',
              }}>
                {resultEntry.isError ? 'ERROR' : 'RESULT'}
              </div>
              <pre style={{
                background: 'var(--surface-2)',
                border: `1px solid ${resultEntry.isError ? 'var(--crimson-border-subtle)' : 'var(--border)'}`,
                borderRadius: '3px',
                padding: '8px',
                overflowX: 'auto',
                color: resultEntry.isError ? 'var(--crimson)' : 'var(--text-secondary)',
                margin: 0,
                maxHeight: '200px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {resultEntry.toolResultText ?? '(empty)'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
