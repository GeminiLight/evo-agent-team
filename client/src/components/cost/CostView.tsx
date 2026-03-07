import { useState } from 'react';
import type { CostData, AgentCostSummary, ToolCostSummary, AgentTimeSeries } from '../../types';
import CRTEmptyState from '../shared/CRTEmptyState';

interface CostViewProps {
  teamId: string;
  data: CostData | null;
  loading: boolean;
}

function fmtK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

// Deterministic color from agent name using existing CSS vars
const AGENT_COLORS = [
  'var(--phosphor, #39ff6a)',
  'var(--ice, #7eb8f7)',
  'var(--amber, #f5a623)',
  'var(--crimson, #ff4466)',
  'var(--lavender, #b8a4f5)',
];

function agentColor(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length];
}

// Pure CSS horizontal bar chart
function TokenBar({ agent, maxTokens, index }: { agent: AgentCostSummary; maxTokens: number; index: number }) {
  const total = agent.inputTokens + agent.outputTokens + agent.cacheReadTokens;
  const rawPct = maxTokens > 0 ? (total / maxTokens) * 100 : 0;
  const color = agentColor(index);

  const inputPct  = total > 0 ? (agent.inputTokens / total) * 100 : 0;
  const outputPct = total > 0 ? (agent.outputTokens / total) * 100 : 0;
  const cachePct  = total > 0 ? (agent.cacheReadTokens / total) * 100 : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
      {/* Agent name */}
      <div style={{
        width: '90px', flexShrink: 0,
        fontSize: '9px', letterSpacing: '0.06em',
        color, fontFamily: 'var(--font-mono)',
        textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {agent.agentName}
      </div>

      {/* Bar segments */}
      <div style={{
        flex: 1, height: '10px',
        background: 'var(--surface-2, rgba(255,255,255,0.04))',
        borderRadius: '2px', overflow: 'hidden',
        display: 'flex',
      }}>
        <div style={{ width: `${rawPct * inputPct / 100}%`, background: color, opacity: 0.9 }} />
        <div style={{ width: `${rawPct * outputPct / 100}%`, background: color, opacity: 0.5 }} />
        <div style={{ width: `${rawPct * cachePct / 100}%`, background: color, opacity: 0.2 }} />
      </div>

      {/* Total */}
      <div style={{
        width: '44px', flexShrink: 0, textAlign: 'right',
        fontSize: '9px', color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
      }}>
        {fmtK(total)}
      </div>

      {/* Pct */}
      <div style={{
        width: '30px', flexShrink: 0, textAlign: 'right',
        fontSize: '9px', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
      }}>
        {agent.percentage}%
      </div>
    </div>
  );
}

// Chart with X-axis time labels and Y-axis token scale
function TokenSparkline({ series, allAgents }: { series: AgentTimeSeries[]; allAgents: AgentCostSummary[] }) {
  if (!series.length) return null;

  // Layout constants (SVG user units)
  const LEFT = 52;   // Y-axis label area
  const BOTTOM = 22; // X-axis label area
  const W = 600;     // chart width (right of LEFT)
  const H = 100;     // chart height (above BOTTOM)
  const TOTAL_W = LEFT + W;
  const TOTAL_H = H + BOTTOM;

  // Collect all points
  const allPoints = series.flatMap(s => s.dataPoints);
  if (allPoints.length === 0) return null;

  const minTs = Math.min(...allPoints.map(p => new Date(p.timestamp).getTime()));
  const maxTs = Math.max(...allPoints.map(p => new Date(p.timestamp).getTime()));
  const maxY   = Math.max(...allPoints.map(p => p.cumulativeInput + p.cumulativeOutput));

  if (maxTs === minTs || maxY === 0) return null;

  const spanMs = maxTs - minTs;

  function toX(ts: string): number {
    return LEFT + ((new Date(ts).getTime() - minTs) / spanMs) * W;
  }
  function toY(val: number): number {
    return (1 - val / maxY) * H;
  }

  // ── X-axis time ticks (4 ticks: start, 33%, 67%, end) ──
  function fmtTick(ms: number): string {
    const d = new Date(ms);
    const spanDays = spanMs / 86400000;
    if (spanDays >= 1) {
      // multi-day: show "Mar 04 05:24"
      return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        hour12: false,
      }).replace(',', '');
    }
    // same-day: show HH:MM
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  const xTicks = [0, 0.33, 0.67, 1].map(r => ({
    ms: minTs + r * spanMs,
    x: LEFT + r * W,
    label: fmtTick(minTs + r * spanMs),
  }));

  // ── Y-axis token ticks (0, 25%, 50%, 75%, 100%) ──
  function fmtY(val: number): string {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000)     return `${Math.round(val / 1_000)}k`;
    return String(Math.round(val));
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({
    val: r * maxY,
    y: toY(r * maxY),
    label: fmtY(r * maxY),
  }));

  const agentIndexMap = new Map(allAgents.map((a, i) => [a.agentName, i]));

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
        CUMULATIVE TOKEN USAGE
      </div>
      <svg
        viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
        style={{ width: '100%', height: `${TOTAL_H * 1.4}px` }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis grid lines + labels */}
        {yTicks.map(t => (
          <g key={t.val}>
            <line
              x1={LEFT} y1={t.y}
              x2={LEFT + W} y2={t.y}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="0.5"
              strokeDasharray={t.val === 0 ? undefined : '3,3'}
            />
            <text
              x={LEFT - 4} y={t.y + 3}
              textAnchor="end"
              fontSize="8"
              fill="rgba(255,255,255,0.35)"
              fontFamily="monospace"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* X-axis baseline */}
        <line x1={LEFT} y1={H} x2={LEFT + W} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />

        {/* X-axis ticks + labels */}
        {xTicks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} y1={H} x2={t.x} y2={H + 4} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
            <text
              x={t.x}
              y={H + 14}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              fontSize="8"
              fill="rgba(255,255,255,0.4)"
              fontFamily="monospace"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* Data lines per agent */}
        {series.map(s => {
          if (!s.dataPoints.length) return null;
          const idx = agentIndexMap.get(s.agentName) ?? 0;
          const rawColor = AGENT_COLORS[idx % AGENT_COLORS.length];
          const pts = s.dataPoints.map(p => ({
            x: toX(p.timestamp),
            y: toY(p.cumulativeInput + p.cumulativeOutput),
          }));
          const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
          return (
            <path
              key={s.agentName}
              d={pathD}
              fill="none"
              stroke={rawColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
          );
        })}

        {/* Endpoint dots */}
        {series.map(s => {
          if (!s.dataPoints.length) return null;
          const idx = agentIndexMap.get(s.agentName) ?? 0;
          const rawColor = AGENT_COLORS[idx % AGENT_COLORS.length];
          const last = s.dataPoints[s.dataPoints.length - 1];
          return (
            <circle
              key={s.agentName}
              cx={toX(last.timestamp)}
              cy={toY(last.cumulativeInput + last.cumulativeOutput)}
              r={2.5}
              fill={rawColor}
              opacity={0.9}
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
        {series.map((s, i) => {
          const idx = agentIndexMap.get(s.agentName) ?? i;
          const color = AGENT_COLORS[idx % AGENT_COLORS.length];
          return (
            <div key={s.agentName} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '14px', height: '2px', background: color, borderRadius: '1px' }} />
              <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                {s.agentName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tool calls bar chart (horizontal)
function ToolChart({ tools }: { tools: ToolCostSummary[] }) {
  const maxCount = Math.max(...tools.map(t => t.callCount), 1);
  const top = tools.slice(0, 10);

  return (
    <div>
      {top.map((tool, i) => (
        <div key={tool.toolName} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          <div style={{
            width: '80px', flexShrink: 0, textAlign: 'right',
            fontSize: '9px', color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {tool.toolName}
          </div>
          <div style={{
            flex: 1, height: '8px',
            background: 'var(--surface-2, rgba(255,255,255,0.04))',
            borderRadius: '2px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${(tool.callCount / maxCount) * 100}%`,
              background: i === 0 ? 'var(--phosphor, #39ff6a)' : 'var(--ice, #7eb8f7)',
              opacity: 0.7 + (1 - i / top.length) * 0.3,
            }} />
          </div>
          <div style={{
            width: '28px', flexShrink: 0, textAlign: 'right',
            fontSize: '9px', color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}>
            {tool.callCount}
          </div>
        </div>
      ))}
    </div>
  );
}

type CostTab = 'overview' | 'tools' | 'trends';

export default function CostView({ teamId, data, loading }: CostViewProps) {
  const [tab, setTab] = useState<CostTab>('overview');

  const teamName = data?.teamId ?? teamId;

  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 100px)',
      minHeight: '280px',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          COST // {teamName.toUpperCase()}
        </span>

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {(['overview', 'tools', 'trends'] as CostTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '2px 8px', fontSize: '8px', letterSpacing: '0.1em',
                fontFamily: 'var(--font-mono)',
                background: tab === t ? 'var(--active-bg-med)' : 'transparent',
                color: tab === t ? 'var(--active-text)' : 'var(--text-muted)',
                border: `1px solid ${tab === t ? 'var(--active-border)' : 'transparent'}`,
                borderRadius: '2px', cursor: 'pointer', transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (tab !== t) e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { if (tab !== t) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
            LOADING...
          </div>
        )}

        {!loading && !data && (
          <CRTEmptyState title="NO COST DATA" subtitle="Token usage will appear when agents are active" />
        )}

        {!loading && data && tab === 'overview' && (
          <OverviewTab data={data} />
        )}

        {!loading && data && tab === 'tools' && (
          <ToolsTab data={data} />
        )}

        {!loading && data && tab === 'trends' && (
          <TrendsTab data={data} />
        )}
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: '8px', letterSpacing: '0.18em', color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono)', marginBottom: '10px', marginTop: '16px',
    }}>
      {label}
    </div>
  );
}

function TotalsRow({ data }: { data: CostData }) {
  const { totals } = data;
  const grand = totals.inputTokens + totals.outputTokens + totals.cacheReadTokens;
  const cells = [
    { label: 'TOTAL', value: fmtK(grand), color: 'var(--text-primary)' },
    { label: 'INPUT',  value: fmtK(totals.inputTokens),     color: 'var(--phosphor, #39ff6a)' },
    { label: 'OUTPUT', value: fmtK(totals.outputTokens),    color: 'var(--ice, #7eb8f7)' },
    { label: 'CACHE',  value: fmtK(totals.cacheReadTokens), color: 'var(--amber, #f5a623)' },
    { label: 'AGENTS', value: String(data.byAgent.length),  color: 'var(--text-secondary)' },
    { label: 'MSGS',   value: String(data.byAgent.reduce((s, a) => s + a.messageCount, 0)), color: 'var(--text-secondary)' },
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
      {cells.map(c => (
        <div key={c.label} style={{
          display: 'flex', flexDirection: 'column', gap: '2px',
          padding: '6px 12px',
          background: `${c.color}0d`,
          border: `1px solid ${c.color}28`,
          borderRadius: '3px',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: c.color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{c.value}</span>
          <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function OverviewTab({ data }: { data: CostData }) {
  const maxTokens = Math.max(...data.byAgent.map(a => a.inputTokens + a.outputTokens + a.cacheReadTokens), 1);

  return (
    <div>
      <TotalsRow data={data} />

      <SectionLabel label="USAGE BY AGENT" />

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
        {[
          { color: 'var(--phosphor, #39ff6a)', opacity: '0.9', label: 'INPUT' },
          { color: 'var(--phosphor, #39ff6a)', opacity: '0.5', label: 'OUTPUT' },
          { color: 'var(--phosphor, #39ff6a)', opacity: '0.2', label: 'CACHE' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '6px', background: l.color, opacity: parseFloat(l.opacity), borderRadius: '1px' }} />
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {data.byAgent.length === 0 ? (
        <CRTEmptyState title="NO AGENT DATA" subtitle="Run agents to see cost breakdown" />
      ) : (
        data.byAgent.map((agent, i) => (
          <TokenBar key={agent.agentName} agent={agent} maxTokens={maxTokens} index={i} />
        ))
      )}
    </div>
  );
}

function ToolsTab({ data }: { data: CostData }) {
  const totalCalls = data.byTool.reduce((s, t) => s + t.callCount, 0);

  return (
    <div>
      <TotalsRow data={data} />

      <SectionLabel label="TOOL CALL DISTRIBUTION" />

      {data.byTool.length === 0 ? (
        <CRTEmptyState title="NO TOOL DATA" subtitle="Tool call counts will appear when agents run" />
      ) : (
        <>
          <div style={{ marginBottom: '4px', fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
            {totalCalls} TOTAL CALLS
          </div>
          <ToolChart tools={data.byTool} />
        </>
      )}
    </div>
  );
}

function TrendsTab({ data }: { data: CostData }) {
  return (
    <div>
      <TotalsRow data={data} />

      <SectionLabel label="TOKEN BURN OVER TIME" />

      {data.timeSeries.length === 0 ? (
        <CRTEmptyState title="NO TIME SERIES" subtitle="Token trends will appear as agents work" />
      ) : (
        <TokenSparkline series={data.timeSeries} allAgents={data.byAgent} />
      )}
    </div>
  );
}
