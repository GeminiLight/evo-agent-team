import { useState, useEffect } from 'react';
import type { CommLogResponse } from '../../types';
import { agentColor } from '../../utils/agentColors';
import MessageBubble from '../commlog/MessageBubble';

interface AgentHeatmapProps {
  teamId: string;
  agentNames: string[];
}

function useCommData(teamId: string) {
  const [data, setData] = useState<CommLogResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      try {
        const res = await fetch(`/api/teams/${teamId}/messages`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* silent */ }
    }
    fetch_();
    const interval = setInterval(fetch_, 6000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  return data;
}

/** Build sender→recipient message count matrix */
function buildMatrix(
  messages: CommLogResponse['messages'],
  agents: string[],
): { matrix: number[][]; maxVal: number } {
  const idx = new Map(agents.map((a, i) => [a, i]));
  const n = agents.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (const msg of messages) {
    const si = idx.get(msg.sender);
    const ri = idx.get(msg.recipient);
    if (si !== undefined && ri !== undefined && si !== ri) {
      matrix[si][ri]++;
    }
  }

  let maxVal = 0;
  for (const row of matrix) for (const v of row) if (v > maxVal) maxVal = v;

  return { matrix, maxVal };
}

function cellColor(value: number, maxVal: number, senderName: string): string {
  if (value === 0 || maxVal === 0) return 'transparent';
  const intensity = value / maxVal;
  const base = agentColor(senderName);
  const alpha = Math.round(intensity * 220 + 30);
  return base + alpha.toString(16).padStart(2, '0');
}

export default function AgentHeatmap({ teamId, agentNames }: AgentHeatmapProps) {
  const data = useCommData(teamId);
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ sender: string; recipient: string } | null>(null);

  const agents = data?.agentNames?.length ? data.agentNames : agentNames;

  if (agents.length < 2) {
    return (
      <div style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        padding: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '120px',
      }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
          — NEED ≥2 AGENTS FOR MATRIX —
        </span>
      </div>
    );
  }

  const messages = data?.messages ?? [];
  const { matrix, maxVal } = buildMatrix(messages, agents);
  const totalMessages = messages.length;

  const workload = agents.map((_, i) => {
    const sent = matrix[i].reduce((s, v) => s + v, 0);
    const recv = agents.reduce((s, _, j) => s + matrix[j][i], 0);
    return sent + recv;
  });

  const cellSize = Math.max(28, Math.min(48, Math.floor(360 / agents.length)));
  const labelWidth = 80;

  // Default selection: the highest-intensity cell (most messages between any two agents)
  const hottestCell = (() => {
    let best: { sender: string; recipient: string } | null = null;
    let bestVal = 0;
    for (let ri = 0; ri < agents.length; ri++) {
      for (let ci = 0; ci < agents.length; ci++) {
        if (ri !== ci && matrix[ri][ci] > bestVal) {
          bestVal = matrix[ri][ci];
          best = { sender: agents[ri], recipient: agents[ci] };
        }
      }
    }
    return best;
  })();

  // Use explicit user selection if set, otherwise fall back to hottest cell
  const activeCell = selectedCell ?? hottestCell;

  const selectedMessages = activeCell
    ? messages.filter(m => m.sender === activeCell.sender && m.recipient === activeCell.recipient)
    : [];

  return (
    // Outer flex row: heatmap card (shrink-to-fit) + message panel (fills remaining space)
    <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>

      {/* ── Heatmap card ── */}
      <div style={{ background: 'var(--surface-0)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Header */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
            COMM MATRIX // INTENSITY
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            {totalMessages} TOTAL MSG{totalMessages !== 1 ? 'S' : ''}
          </span>
        </div>

        {/* Matrix body */}
        <div style={{ padding: '12px 16px', overflowX: 'auto' }}>
          {/* Column headers (recipients) */}
          <div style={{ display: 'flex', marginLeft: labelWidth + 4 }}>
            {agents.map((name, ci) => (
              <div key={ci} style={{ width: cellSize, flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '6px', height: '48px' }}>
                <span style={{
                  fontSize: 'var(--text-xs)', color: agentColor(name), letterSpacing: '0.08em',
                  writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                  whiteSpace: 'nowrap', maxHeight: '44px', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {name.toUpperCase()}
                </span>
              </div>
            ))}
            <div style={{ width: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '6px', height: '48px' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                TOTAL
              </span>
            </div>
          </div>

          {/* Matrix rows */}
          {agents.map((rowName, ri) => (
            <div key={ri} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
              <div style={{
                width: labelWidth, flexShrink: 0,
                fontSize: 'var(--text-xs)', color: agentColor(rowName), letterSpacing: '0.06em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                paddingRight: '8px', textAlign: 'right',
              }}>
                {rowName.toUpperCase()}
              </div>

              {agents.map((colName, ci) => {
                const isSelf = ri === ci;
                const val = isSelf ? 0 : matrix[ri][ci];
                const isHovered = hoveredCell?.r === ri && hoveredCell?.c === ci;
                const isSelected = activeCell?.sender === rowName && activeCell?.recipient === colName;
                const bg = isSelf ? 'var(--surface-2)' : cellColor(val, maxVal, rowName);

                return (
                  <div
                    key={ci}
                    onMouseEnter={() => !isSelf && setHoveredCell({ r: ri, c: ci })}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => { if (isSelf) return; setSelectedCell(isSelected ? null : { sender: rowName, recipient: colName }); }}
                    title={isSelf ? '' : `${rowName} → ${colName}: ${val} msg${val !== 1 ? 's' : ''}`}
                    style={{
                      width: cellSize, height: cellSize, flexShrink: 0,
                      background: bg, borderRadius: '2px', marginRight: '2px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: isSelf ? 'default' : 'pointer',
                      position: 'relative',
                      transition: 'transform 0.1s, box-shadow 0.1s',
                      transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: isSelected
                        ? `0 0 0 2px ${agentColor(rowName)}, 0 0 10px ${agentColor(rowName)}88`
                        : isHovered ? `0 0 8px ${agentColor(rowName)}88` : 'none',
                      zIndex: isHovered || isSelected ? 2 : 1,
                      border: isSelected
                        ? `1px solid ${agentColor(rowName)}`
                        : isSelf ? '1px solid var(--border)' : `1px solid ${val > 0 ? agentColor(rowName) + '30' : 'transparent'}`,
                    }}
                  >
                    {!isSelf && val > 0 && (
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        color: val / maxVal > 0.5 ? 'var(--void, #000)' : agentColor(rowName),
                        fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: 0, lineHeight: 1,
                      }}>
                        {val}
                      </span>
                    )}
                    {isSelf && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', opacity: 0.4 }}>—</span>}
                  </div>
                );
              })}

              {/* Workload bar */}
              <div style={{ width: 40, flexShrink: 0, marginLeft: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  height: '4px',
                  width: `${Math.max(4, workload[ri] / Math.max(1, Math.max(...workload)) * 30)}px`,
                  background: agentColor(rowName), borderRadius: '2px',
                  boxShadow: `0 0 4px ${agentColor(rowName)}88`,
                  transition: 'width 0.4s ease-out',
                }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {workload[ri]}
                </span>
              </div>
            </div>
          ))}

          {/* Legend */}
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: labelWidth + 4 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>LOW</span>
            <div style={{ height: '6px', width: '80px', borderRadius: '2px', background: 'linear-gradient(90deg, transparent, var(--ice))' }} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>HIGH</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.06em', marginLeft: '8px' }}>
              (ROW = SENDER, COL = RECIPIENT)
            </span>
          </div>
        </div>
      </div>

      {/* ── Message panel ── */}
      {activeCell && (
        <div style={{
          flex: 1,
          minWidth: 0,
          borderLeft: '1px solid var(--border)',
          background: 'var(--surface-0)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Panel header — same height as heatmap header */}
          <div style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-1)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: agentColor(activeCell.sender), letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeCell.sender.toUpperCase()}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>→</span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: agentColor(activeCell.recipient), letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeCell.recipient.toUpperCase()}
              </span>
              {!selectedCell && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.1em', border: '1px solid var(--border)', padding: '1px 4px', borderRadius: '2px', flexShrink: 0 }}>
                  TOP
                </span>
              )}
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.1em', flexShrink: 0 }}>
                · {selectedMessages.length}
              </span>
            </div>
            {selectedCell && (
              <button
                onClick={() => setSelectedCell(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                title="Reset to top pair"
              >×</button>
            )}
          </div>

          {/* Scrollable message list — height capped to match heatmap */}
          <div style={{ overflowY: 'auto', padding: '6px', maxHeight: '400px' }}>
            {selectedMessages.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
                — NO MESSAGES —
              </div>
            ) : (
              selectedMessages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
