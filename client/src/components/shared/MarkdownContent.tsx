import type React from 'react';

// ─── Minimal markdown renderer ────────────────────────────────────────────────
// Renders headings, bold, inline code, code blocks, lists, tables, blockquotes,
// links — without any external dependency.

export default function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '3px', padding: '12px 14px', overflowX: 'auto',
          fontSize: '10px', lineHeight: 1.6, color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
          margin: '10px 0',
        }}>
          {lang && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.1em' }}>{lang.toUpperCase()}</div>}
          {codeLines.join('\n')}
        </pre>
      );
      i++;
      continue;
    }

    // Heading
    const hMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const sizes = ['18px', '15px', '13px', '11px'];
      const margins = ['20px 0 10px', '16px 0 8px', '14px 0 6px', '10px 0 4px'];
      elements.push(
        <div key={i} style={{
          fontSize: sizes[level - 1] ?? '11px',
          fontWeight: 700,
          color: level === 1 ? 'var(--phosphor)' : level === 2 ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontFamily: level <= 2 ? 'var(--font-display)' : 'var(--font-mono)',
          letterSpacing: level <= 2 ? '0.04em' : '0.08em',
          margin: margins[level - 1] ?? '8px 0 4px',
          textShadow: level === 1 ? '0 0 20px var(--phosphor-glow)' : 'none',
          borderBottom: level <= 2 ? '1px solid var(--border)' : 'none',
          paddingBottom: level <= 2 ? '6px' : '0',
        }}>
          {inlineRender(hMatch[2])}
        </div>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<div key={i} style={{ height: '1px', background: 'var(--border)', margin: '14px 0' }} />);
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && lines[i + 1]?.match(/^\|?[\s\-|]+\|?$/)) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        const cells = lines[i].split('|').map(c => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
        if (!cells.every(c => /^[-:\s]+$/.test(c))) tableRows.push(cells);
        i++;
      }
      if (tableRows.length > 0) {
        const [head, ...body] = tableRows;
        elements.push(
          <div key={i} style={{ overflowX: 'auto', margin: '10px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr>
                  {head.map((cell, ci) => (
                    <th key={ci} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-primary)', background: 'var(--surface-2)', border: '1px solid var(--border)', letterSpacing: '0.06em', fontWeight: 600, fontSize: 'var(--text-xs)' }}>
                      {inlineRender(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{ padding: '6px 10px', color: 'var(--text-secondary)', border: '1px solid var(--border)', verticalAlign: 'top' }}>
                        {inlineRender(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // List item
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)/);
    if (listMatch) {
      const indent = listMatch[1].length;
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '8px', paddingLeft: `${indent * 8 + 4}px`, margin: '2px 0' }}>
          <span style={{ fontSize: '10px', color: 'var(--phosphor)', flexShrink: 0, marginTop: '1px', opacity: 0.7 }}>▸</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {inlineRender(listMatch[3])}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      elements.push(
        <div key={i} style={{
          borderLeft: '2px solid var(--border-bright)', paddingLeft: '12px',
          margin: '4px 0', fontSize: '10px', color: 'var(--text-muted)',
          lineHeight: 1.5, fontStyle: 'italic',
        }}>
          {inlineRender(line.replace(/^>\s*/, ''))}
        </div>
      );
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: '6px' }} />);
      i++;
      continue;
    }

    // Paragraph
    elements.push(
      <p key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: '3px 0', letterSpacing: '0.01em' }}>
        {inlineRender(line)}
      </p>
    );
    i++;
  }

  return <div>{elements}</div>;
}

/** Render inline markdown: **bold**, `code`, *italic*, [links](url) */
export function inlineRender(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      parts.push(<strong key={m.index} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      parts.push(<code key={m.index} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px', padding: '1px 5px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--phosphor)' }}>{m[3]}</code>);
    } else if (m[4] !== undefined) {
      parts.push(<em key={m.index} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{m[4]}</em>);
    } else if (m[5] !== undefined && m[6] !== undefined) {
      parts.push(
        <a
          key={m.index}
          href={m[6]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--ice)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
        >
          {m[5]}
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}
