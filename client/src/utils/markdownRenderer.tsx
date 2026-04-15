/**
 * Simple Markdown renderer for MEMORY.md / context-summary.md style content.
 * Supports: # ## ### headers, - * lists, ``` code blocks, | tables, inline **bold** *italic* `code`.
 * No external dependencies.
 */

import React from 'react';

export function renderMarkdown(md: string): React.ReactElement {
  const lines = md.split('\n');
  const elements: React.ReactElement[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${codeKey++}`} style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            padding: '8px 12px',
            margin: '4px 0',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}>
            {codeLines.join('\n')}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headers — check most specific first (### before ## before #)
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      elements.push(<h4 key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', margin: '8px 0 3px', letterSpacing: '0.06em' }}>{h3[1]}</h4>);
      continue;
    }
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      elements.push(<h3 key={i} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--phosphor)', margin: '10px 0 4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h2[1]}</h3>);
      continue;
    }
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      elements.push(<h2 key={i} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 6px', letterSpacing: '0.04em' }}>{h1[1]}</h2>);
      continue;
    }

    // List items
    if (line.match(/^[-*] /)) {
      const content = line.replace(/^[-*] /, '');
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '6px', margin: '2px 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>•</span>
          <span dangerouslySetInnerHTML={{ __html: inlineFormat(content) }} />
        </div>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} style={{ height: '6px' }} />);
      continue;
    }

    // Table row
    if (line.includes('|') && line.trim().startsWith('|')) {
      // Skip separator rows
      if (line.match(/^\|[\s-|]+\|$/)) continue;
      const cells = line.split('|').filter(Boolean).map(c => c.trim());
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--text-secondary)', padding: '2px 0', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
          {cells.map((cell, ci) => (
            <span key={ci} style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: inlineFormat(cell) }} />
          ))}
        </div>
      );
      continue;
    }

    // Plain paragraph
    elements.push(
      <p key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
    );
  }

  return <>{elements}</>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineFormat(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code style="background:var(--surface-1);padding:1px 4px;border-radius:2px;font-size:10px;color:var(--phosphor)">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
