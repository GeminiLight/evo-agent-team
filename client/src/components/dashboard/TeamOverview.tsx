import { useState, useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';
import type { TeamDetail } from '../../types';

interface TeamOverviewProps {
  team: TeamDetail;
}

export default function TeamOverview({ team }: TeamOverviewProps) {
  const [guideOpen, setGuideOpen] = useState(false);

  const { stats } = team;
  const total = stats.total || 1;

  const completedPct = (stats.completed / total) * 100;
  const inProgressPct = (stats.inProgress / total) * 100;
  const pendingPct = (stats.pending / total) * 100;
  const blockedCount = Math.max(0, stats.total - stats.completed - stats.inProgress - stats.pending);
  const blockedPct = (blockedCount / total) * 100;

  const bars = [
    { label: 'COMPLETED', count: stats.completed, pct: completedPct, color: 'var(--color-completed)', glow: 'var(--phosphor-glow-strong)' },
    { label: 'ACTIVE', count: stats.inProgress, pct: inProgressPct, color: 'var(--color-in-progress)', glow: 'var(--amber-glow)' },
    { label: 'PENDING', count: stats.pending, pct: pendingPct, color: 'var(--color-pending)', glow: 'transparent' },
    { label: 'BLOCKED', count: blockedCount, pct: blockedPct, color: 'var(--color-blocked)', glow: 'var(--crimson-glow)' },
  ];

  const overallPct = Math.round(completedPct);

  return (
    <>
      <div style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        columnGap: '32px',
        alignItems: 'center',
      }}>
        {/* Corner decorations */}
        <CornerMark pos="tl" />
        <CornerMark pos="tr" />
        <CornerMark pos="bl" />
        <CornerMark pos="br" />

        {/* Left: label + name + bar + legend */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
              SYS // OVERVIEW
            </div>
            {/* GUIDE button */}
            <button
              onClick={() => setGuideOpen(true)}
              title="View Team Guide"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '2px 7px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '2px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '8px', letterSpacing: '0.1em',
                color: 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--phosphor)';
                e.currentTarget.style.color = 'var(--phosphor)';
                e.currentTarget.style.boxShadow = '0 0 6px var(--phosphor-glow)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <BookOpen size={9} />
              GUIDE
            </button>
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: '18px',
            color: 'var(--text-primary)', letterSpacing: '0.04em',
            marginBottom: team.config?.description ? '6px' : '16px',
          }}>
            {team.name.toUpperCase()}
          </div>

          {team.config?.description && (
            <div style={{
              fontSize: '11px', color: 'var(--text-muted)',
              letterSpacing: '0.03em', lineHeight: 1.5,
              marginBottom: '14px', maxWidth: '480px',
            }}>
              {team.config.description}
            </div>
          )}

          {/* Stacked bar */}
          <div style={{ marginBottom: '12px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', height: '8px', borderRadius: '2px', overflow: 'hidden', background: 'var(--surface-2)', gap: '1px' }}>
              {bars.filter(b => b.count > 0).map(bar => (
                <div key={bar.label} style={{
                  width: `${bar.pct}%`, background: bar.color,
                  boxShadow: `0 0 6px ${bar.glow}`,
                  transition: 'width 0.6s ease-out',
                  animation: bar.label === 'ACTIVE' ? 'status-pulse 2s ease-in-out infinite' : 'none',
                }} />
              ))}
            </div>
          </div>

          {/* Legend — 4 items in a row */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {bars.map(bar => (
              <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '1px',
                  background: bar.count > 0 ? bar.color : 'var(--surface-3)',
                  boxShadow: bar.count > 0 ? `0 0 4px ${bar.glow}` : 'none',
                }} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{bar.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: bar.count > 0 ? bar.color : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {bar.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: big completion number */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: '52px', fontWeight: 700, lineHeight: 1,
            color: overallPct === 100 ? 'var(--phosphor)' : 'var(--text-primary)',
            textShadow: overallPct === 100 ? '0 0 30px var(--phosphor-glow-strong)' : 'none',
            fontFamily: 'var(--font-mono)',
            transition: 'all 0.5s',
          }}>
            {overallPct}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>% DONE</div>
        </div>
      </div>

      {/* Team Guide panel */}
      {guideOpen && (
        <TeamGuidePanel teamId={team.id} teamName={team.name} onClose={() => setGuideOpen(false)} />
      )}
    </>
  );
}

// ─── Team Guide slide-in panel ───────────────────────────────────────────────

function TeamGuidePanel({ teamId, teamName, onClose }: { teamId: string; teamName: string; onClose: () => void }) {
  const [content, setContent] = useState<string | null | 'loading'>('loading');

  useEffect(() => {
    fetch(`/api/teams/${teamId}/guide`)
      .then(r => r.json())
      .then((json: { content: string | null }) => setContent(json.content ?? null))
      .catch(() => setContent(null));
  }, [teamId]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(4,6,8,0.6)', zIndex: 99 }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: '520px',
        zIndex: 100,
        background: 'var(--surface-0)',
        borderLeft: '1px solid var(--border-bright)',
        display: 'flex', flexDirection: 'column',
        animation: 'slide-in-right 0.25s ease-out',
        boxShadow: '-4px 0 30px rgba(57,255,106,0.05)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
          background: 'var(--surface-1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={12} style={{ color: 'var(--phosphor)' }} />
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>
              TEAM GUIDE // {teamName.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {content === 'loading' && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textAlign: 'center', paddingTop: '40px' }}>
              LOADING...
            </div>
          )}
          {content === null && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textAlign: 'center', paddingTop: '40px', lineHeight: 1.8 }}>
              <div style={{ fontSize: '24px', marginBottom: '12px', opacity: 0.3 }}>📄</div>
              NO GUIDE FILE FOUND
              <div style={{ marginTop: '8px', fontSize: '9px', opacity: 0.6 }}>
                Create <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', padding: '1px 4px', borderRadius: '2px' }}>TEAM_GUIDE.md</code> in<br />
                <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', padding: '1px 4px', borderRadius: '2px' }}>~/.claude/teams/{teamId}/</code>
              </div>
            </div>
          )}
          {content && content !== 'loading' && (
            <MarkdownContent content={content} />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Minimal markdown renderer ────────────────────────────────────────────────
// Renders headings, bold, inline code, code blocks, lists, and tables
// without any external dependency.

function MarkdownContent({ content }: { content: string }) {
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
          {lang && <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.1em' }}>{lang.toUpperCase()}</div>}
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
                    <th key={ci} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-primary)', background: 'var(--surface-2)', border: '1px solid var(--border)', letterSpacing: '0.06em', fontWeight: 600, fontSize: '9px' }}>
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

/** Render inline markdown: **bold**, `code`, *italic* */
function inlineRender(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      parts.push(<strong key={m.index} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      parts.push(<code key={m.index} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px', padding: '1px 5px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--phosphor)' }}>{m[3]}</code>);
    } else if (m[4] !== undefined) {
      parts.push(<em key={m.index} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{m[4]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

function CornerMark({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const style: React.CSSProperties = {
    position: 'absolute',
    width: '8px',
    height: '8px',
    borderColor: 'var(--border-bright)',
    borderStyle: 'solid',
  };
  if (pos === 'tl') { style.top = 0; style.left = 0; style.borderWidth = '1px 0 0 1px'; }
  if (pos === 'tr') { style.top = 0; style.right = 0; style.borderWidth = '1px 1px 0 0'; }
  if (pos === 'bl') { style.bottom = 0; style.left = 0; style.borderWidth = '0 0 1px 1px'; }
  if (pos === 'br') { style.bottom = 0; style.right = 0; style.borderWidth = '0 1px 1px 0'; }
  return <div style={style} />;
}
