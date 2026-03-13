import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, X, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import type { TeamDetail, AgentSessionStats, ExecSummaryResponse } from '../../types';
import MarkdownContent, { inlineRender } from '../shared/MarkdownContent';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useSummary } from '../../hooks/useSummary';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function StatCell({ label, value, color, title }: { label: string; value: string; color: string; title?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }} title={title}>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '11px', fontWeight: 600, color, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
        {value}
      </span>
    </div>
  );
}

function fmtTokens(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function fmtDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  if (totalMins < 1) return '<1m';
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours < 24) return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d${remHours}h` : `${days}d`;
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

function computeBars(stats: TeamDetail['stats'], t: (key: string) => string) {
  const total = stats.total || 1;
  const completedPct = (stats.completed / total) * 100;
  const inProgressPct = (stats.inProgress / total) * 100;
  const pendingPct = (stats.pending / total) * 100;
  const blockedCount = Math.max(0, stats.total - stats.completed - stats.inProgress - stats.pending);
  const blockedPct = (blockedCount / total) * 100;

  return [
    { key: 'completed', label: t('overview.completed'), count: stats.completed, pct: completedPct, color: 'var(--color-completed)', glow: 'var(--phosphor-glow-strong)' },
    { key: 'active', label: t('overview.active'), count: stats.inProgress, pct: inProgressPct, color: 'var(--color-in-progress)', glow: 'var(--amber-glow)' },
    { key: 'pending', label: t('overview.pending'), count: stats.pending, pct: pendingPct, color: 'var(--color-pending)', glow: 'transparent' },
    { key: 'blocked', label: t('overview.blocked'), count: blockedCount, pct: blockedPct, color: 'var(--color-blocked)', glow: 'var(--crimson-glow)' },
  ];
}

function aggregateSessionStats(sessionStats: Record<string, AgentSessionStats>) {
  const values = Object.values(sessionStats);
  if (values.length === 0) return null;
  return {
    inputTokens: values.reduce((s, v) => s + v.inputTokens, 0),
    outputTokens: values.reduce((s, v) => s + v.outputTokens, 0),
    cacheReadTokens: values.reduce((s, v) => s + v.cacheReadTokens, 0),
    messageCount: values.reduce((s, v) => s + v.messageCount, 0),
    maxDurationMs: Math.max(...values.map(v => v.sessionDurationMs ?? 0)),
    agentCount: values.length,
  };
}

// ─── Exported sub-components ─────────────────────────────────────────────────

/** AI Executive Summary — always-open version for the 3-column layout */
export interface ExecSummaryBlockProps {
  teamId: string;
}

export function ExecSummaryBlock({ teamId }: ExecSummaryBlockProps) {
  const { t } = useTranslation();
  const { data, loading, refreshing, refresh } = useSummary(teamId);

  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', flex: 1 }}>
          {t('overview.exec_summary')}
        </span>
        {data?.isAIGenerated && (
          <span style={{
            fontSize: '9px', letterSpacing: '0.08em', color: 'var(--ice)',
            border: '1px solid var(--ice)', borderRadius: '2px', padding: '0 4px',
            opacity: 0.7, fontFamily: 'var(--font-mono)',
          }}>AI</span>
        )}
        {data?.isStale && (
          <span style={{ fontSize: '9px', color: 'var(--amber)', opacity: 0.7, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('overview.stale')}
          </span>
        )}
        <button
          onClick={refresh}
          disabled={refreshing}
          title={t('overview.refresh')}
          style={{
            background: 'transparent', border: 'none', cursor: refreshing ? 'default' : 'pointer',
            color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center',
            opacity: refreshing ? 0.4 : 1,
          }}
          onMouseEnter={e => { if (!refreshing) (e.currentTarget as HTMLElement).style.color = 'var(--phosphor)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          <RefreshCw size={9} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
        {data?.generatedAt && (
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>
            {new Date(data.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        )}
      </div>

      {/* Content — always visible */}
      <div>
        {(loading && !data) ? (
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {t('overview.generating')}
          </div>
        ) : data ? (
          <SummaryContent text={data.summary} />
        ) : (
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', opacity: 0.6 }}>
            {t('overview.no_summary')}
          </div>
        )}
      </div>
    </div>
  );
}

/** Progress bar + status legend — compact card */
export interface ProgressSectionProps {
  stats: TeamDetail['stats'];
}

export function ProgressSection({ stats }: ProgressSectionProps) {
  const { t } = useTranslation();
  const bars = computeBars(stats, t);
  const total = stats.total || 1;
  const overallPct = Math.round((stats.completed / total) * 100);

  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      minWidth: '160px',
    }}>
      {/* Percentage + label */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{
          fontSize: '24px', fontWeight: 700, lineHeight: 1,
          color: overallPct === 100 ? 'var(--phosphor)' : 'var(--text-primary)',
          textShadow: overallPct === 100 ? '0 0 20px var(--phosphor-glow-strong)' : 'none',
          fontFamily: 'var(--font-mono)', transition: 'all 0.5s',
        }}>
          {overallPct}
        </span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('overview.pct_done')}</span>
      </div>

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: '5px', borderRadius: '2px', overflow: 'hidden', background: 'var(--surface-2)', gap: '1px' }}>
        {bars.filter(b => b.count > 0).map(bar => (
          <div key={bar.key} style={{
            width: `${bar.pct}%`, background: bar.color,
            boxShadow: `0 0 4px ${bar.glow}`,
            transition: 'width 0.6s ease-out',
            animation: bar.key === 'active' ? 'status-pulse 2s ease-in-out infinite' : 'none',
          }} />
        ))}
      </div>

      {/* Legend — compact 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px' }}>
        {bars.map(bar => (
          <div key={bar.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '1px',
              background: bar.count > 0 ? bar.color : 'var(--surface-3)',
              boxShadow: bar.count > 0 ? `0 0 3px ${bar.glow}` : 'none',
            }} />
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{bar.label}</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: bar.count > 0 ? bar.color : 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
              {bar.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Token statistics — vertical compact card */
export interface StatsRowProps {
  sessionStats: Record<string, AgentSessionStats>;
}

export function StatsRow({ sessionStats }: StatsRowProps) {
  const { t } = useTranslation();
  const agg = useMemo(() => aggregateSessionStats(sessionStats), [sessionStats]);

  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: '6px',
      minWidth: '140px',
    }}>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', flexShrink: 0 }}>
        SESSION
      </span>
      {agg ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <StatCell label={t('overview.in_tokens')} value={fmtTokens(agg.inputTokens)} color="var(--ice)" title={`Input: ${agg.inputTokens.toLocaleString()}`} />
          <StatCell label={t('overview.out_tokens')} value={fmtTokens(agg.outputTokens)} color="var(--phosphor)" title={`Output: ${agg.outputTokens.toLocaleString()}`} />
          {agg.cacheReadTokens > 0 && (
            <StatCell label={t('overview.cache_tokens')} value={fmtTokens(agg.cacheReadTokens)} color="var(--text-secondary)" title={`Cache: ${agg.cacheReadTokens.toLocaleString()}`} />
          )}
          <StatCell label={t('overview.messages')} value={String(agg.messageCount)} color="var(--text-secondary)" title={`${agg.messageCount} msgs across ${agg.agentCount} agents`} />
          {agg.maxDurationMs > 0 && (
            <StatCell label={t('overview.time')} value={fmtDuration(agg.maxDurationMs)} color="var(--text-secondary)" title="Longest session" />
          )}
        </div>
      ) : (
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', opacity: 0.5, letterSpacing: '0.06em' }}>—</span>
      )}
    </div>
  );
}

// ─── Original TeamOverview (default export, kept for fallback) ───────────────

interface TeamOverviewProps {
  team: TeamDetail;
  sessionStats?: Record<string, AgentSessionStats>;
}

export default function TeamOverview({ team, sessionStats = {} }: TeamOverviewProps) {
  const { t } = useTranslation();
  const [guideOpen, setGuideOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(() => {
    try { return localStorage.getItem('exec-summary-open') !== 'false'; } catch { return true; }
  });

  const { data: summary, loading: summaryLoading, refreshing: summaryRefreshing, refresh: refreshSummary } = useSummary(team.id);

  const { stats } = team;
  const bars = computeBars(stats, t);
  const aggregatedStats = useMemo(() => aggregateSessionStats(sessionStats), [sessionStats]);
  const total = stats.total || 1;
  const overallPct = Math.round((stats.completed / total) * 100);

  return (
    <>
      <div style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}>
        {/* Corner decorations */}
        <CornerMark pos="tl" />
        <CornerMark pos="tr" />
        <CornerMark pos="bl" />
        <CornerMark pos="br" />

        {/* Left: label + name + description */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {t('overview.sys_overview')}
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
                fontSize: '9px', letterSpacing: '0.1em',
                color: 'var(--text-muted)',
                transition: 'all 0.15s',
                textTransform: 'uppercase',
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
              {t('overview.guide')}
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
            <div style={{ marginBottom: '14px', maxWidth: '480px' }}>
              <div style={{
                fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em',
                marginBottom: '4px', textTransform: 'uppercase',
              }}>
                {t('overview.mission')}
              </div>
              <div
                onClick={() => setDescExpanded(prev => !prev)}
                style={{
                  fontSize: '11px', color: 'var(--text-secondary)',
                  letterSpacing: '0.03em', lineHeight: 1.5,
                  cursor: 'pointer',
                  ...(!descExpanded ? {
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                  } : {}),
                }}
                title={descExpanded ? 'Click to collapse' : 'Click to expand'}
              >
                {team.config.description}
              </div>
            </div>
          )}
        </div>

        {/* Task progress row: bar + legend (left) + percentage (right) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ flex: 1 }}>
            {/* Stacked bar */}
            <div style={{ marginBottom: '12px', maxWidth: '400px' }}>
              <div style={{ display: 'flex', height: '8px', borderRadius: '2px', overflow: 'hidden', background: 'var(--surface-2)', gap: '1px' }}>
                {bars.filter(b => b.count > 0).map(bar => (
                  <div key={bar.key} style={{
                    width: `${bar.pct}%`, background: bar.color,
                    boxShadow: `0 0 6px ${bar.glow}`,
                    transition: 'width 0.6s ease-out',
                    animation: bar.key === 'active' ? 'status-pulse 2s ease-in-out infinite' : 'none',
                  }} />
                ))}
              </div>
            </div>

            {/* Legend — 4 items in a row */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {bars.map(bar => (
                <div key={bar.key} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '1px',
                    background: bar.count > 0 ? bar.color : 'var(--surface-3)',
                    boxShadow: bar.count > 0 ? `0 0 4px ${bar.glow}` : 'none',
                  }} />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{bar.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: bar.count > 0 ? bar.color : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {bar.count}
                </span>
              </div>
            ))}
          </div>
          </div>

          {/* Right: big completion number — vertically centered with bar + legend */}
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
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('overview.pct_done')}</div>
          </div>
        </div>

          {/* Session stats — team-wide aggregated */}
          {aggregatedStats && (
            <div style={{
              display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center',
              marginTop: '14px', paddingTop: '12px',
              borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', flexShrink: 0, textTransform: 'uppercase' }}>
                SESSION
              </span>
              <StatCell label={t('overview.in_tokens')} value={fmtTokens(aggregatedStats.inputTokens)} color="var(--ice)" title={`Total input tokens: ${aggregatedStats.inputTokens.toLocaleString()}`} />
              <StatCell label={t('overview.out_tokens')} value={fmtTokens(aggregatedStats.outputTokens)} color="var(--phosphor)" title={`Total output tokens: ${aggregatedStats.outputTokens.toLocaleString()}`} />
              {aggregatedStats.cacheReadTokens > 0 && (
                <StatCell label={t('overview.cache_tokens')} value={fmtTokens(aggregatedStats.cacheReadTokens)} color="var(--text-secondary)" title={`Cache read tokens: ${aggregatedStats.cacheReadTokens.toLocaleString()}`} />
              )}
              <StatCell label={t('overview.messages')} value={String(aggregatedStats.messageCount)} color="var(--text-secondary)" title={`Total API messages across ${aggregatedStats.agentCount} agents`} />
              {aggregatedStats.maxDurationMs > 0 && (
                <StatCell label={t('overview.time')} value={fmtDuration(aggregatedStats.maxDurationMs)} color="var(--text-secondary)" title="Longest agent session duration" />
              )}
            </div>
          )}

          {/* D0: Executive Summary */}
          <InlineExecSummaryBlock
            data={summary}
            loading={summaryLoading}
            refreshing={summaryRefreshing}
            open={summaryOpen}
            onToggle={() => {
              const next = !summaryOpen;
              setSummaryOpen(next);
              try { localStorage.setItem('exec-summary-open', String(next)); } catch { /* ignore */ }
            }}
            onRefresh={refreshSummary}
          />
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
  const panelRef = useFocusTrap<HTMLDivElement>();

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
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(4,6,8,0.6)', zIndex: 99 }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Team guide for ${teamName}`}
        style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: '520px', maxWidth: '100vw',
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

// ─── Inline Exec Summary (collapsible, used in original TeamOverview) ────────

interface InlineExecSummaryBlockProps {
  data: ExecSummaryResponse | null;
  loading: boolean;
  refreshing: boolean;
  open: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}

function InlineExecSummaryBlock({ data, loading, refreshing, open, onToggle, onRefresh }: InlineExecSummaryBlockProps) {
  const { t } = useTranslation();

  return (
    <div style={{
      marginTop: '14px',
      borderTop: '1px solid var(--border)',
      paddingTop: '10px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onToggle}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 0, flex: 1,
          }}
        >
          {open
            ? <ChevronDown size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            : <ChevronRight size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          }
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            {t('overview.exec_summary')}
          </span>
          {data?.isAIGenerated && (
            <span style={{
              fontSize: '9px', letterSpacing: '0.08em', color: 'var(--ice)',
              border: '1px solid var(--ice)', borderRadius: '2px', padding: '0 4px',
              opacity: 0.7, fontFamily: 'var(--font-mono)',
            }}>AI</span>
          )}
          {data?.isStale && (
            <span style={{ fontSize: '9px', color: 'var(--amber)', opacity: 0.7, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('overview.stale')}
            </span>
          )}
        </button>

        <button
          onClick={e => { e.stopPropagation(); onRefresh(); }}
          disabled={refreshing}
          title={t('overview.refresh')}
          style={{
            background: 'transparent', border: 'none', cursor: refreshing ? 'default' : 'pointer',
            color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center',
            opacity: refreshing ? 0.4 : 1,
          }}
          onMouseEnter={e => { if (!refreshing) (e.currentTarget as HTMLElement).style.color = 'var(--phosphor)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          <RefreshCw size={9} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>

        {data?.generatedAt && (
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>
            {new Date(data.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        )}
      </div>

      {/* Content */}
      {open && (
        <div style={{ marginTop: '8px', paddingLeft: '15px' }}>
          {(loading && !data) ? (
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('overview.generating')}
            </div>
          ) : data ? (
            <SummaryContent text={data.summary} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function SummaryContent({ text }: { text: string }) {
  const lines = text.split('\n').filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {lines.map((line, i) => {
        const isBullet = line.startsWith('- ');
        const content = isBullet ? line.slice(2) : line;
        return (
          <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            {isBullet && (
              <span style={{ color: 'var(--phosphor)', fontSize: '9px', flexShrink: 0, marginTop: '1px', opacity: 0.6 }}>▸</span>
            )}
            <span style={{
              fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.5,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
            }}>
              {inlineRender(content)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
