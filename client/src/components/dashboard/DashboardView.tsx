import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, Clock } from 'lucide-react';
import type { TeamDetail, TeamMember, Task, InboxSummaryItem, AgentSessionStats, SessionTodo, TodoItem, Alert, TaskChangeEvent } from '../../types';
import type { BlockingDetail } from '../../hooks/usePendingHumanRequests';
import type { ViewType } from '../Layout';
import { ExecSummaryBlock, ProgressSection, StatsRow } from './TeamOverview';
import CompactAgentCard from './CompactAgentCard';
import ActionQueue from './ActionQueue';
import TaskList from './TaskList';
import AgentHeatmap from './AgentHeatmap';
import CRTEmptyState from '../shared/CRTEmptyState';

type SortMode = 'default' | 'workload' | 'completion' | 'name';

function sortMembers(members: TeamMember[], tasks: Task[], mode: SortMode): TeamMember[] {
  if (mode === 'name') return [...members].sort((a, b) => a.name.localeCompare(b.name));

  const getStats = (m: TeamMember) => {
    const assigned = tasks.filter(t => t.owner === m.name);
    const done = assigned.filter(t => t.status === 'completed').length;
    const active = assigned.filter(t => t.status === 'in_progress').length;
    return { total: assigned.length, done, active };
  };

  if (mode === 'workload') {
    return [...members].sort((a, b) => {
      const sa = getStats(a); const sb = getStats(b);
      const scoreA = sa.active * 1000 + sa.total;
      const scoreB = sb.active * 1000 + sb.total;
      return scoreB - scoreA;
    });
  }

  if (mode === 'completion') {
    return [...members].sort((a, b) => {
      const sa = getStats(a); const sb = getStats(b);
      const pctA = sa.total > 0 ? sa.done / sa.total : 0;
      const pctB = sb.total > 0 ? sb.done / sb.total : 0;
      return pctB - pctA;
    });
  }

  return members;
}

interface DashboardViewProps {
  team: TeamDetail;
  onTaskSelect: (taskId: string | null) => void;
  onAgentSelect: (agentId: string) => void;
  onTeamUpdate?: (updatedTask: Task) => void;
  pendingHumanAgents?: string[];
  pendingHumanDetails?: BlockingDetail[];
  inboxSummary?: Record<string, InboxSummaryItem>;
  sessionStats?: Record<string, AgentSessionStats>;
  leadName?: string | null;
  projectTodos?: SessionTodo[];
  teamId?: string;
  alerts?: Alert[];
  onDismissAlert?: (id: string) => void;
  onViewChange?: (view: ViewType) => void;
}

export default function DashboardView({
  team, onTaskSelect, onAgentSelect, onTeamUpdate,
  pendingHumanAgents = [], pendingHumanDetails = [],
  inboxSummary = {}, sessionStats = {}, leadName = null,
  projectTodos = [], teamId,
  alerts = [], onDismissAlert, onViewChange,
}: DashboardViewProps) {
  const { t } = useTranslation();
  const members = team.config?.members ?? [];
  const [sortMode, setSortMode] = useState<SortMode>('default');

  // Fetch recent timeline events for ActionQueue
  const [recentEvents, setRecentEvents] = useState<TaskChangeEvent[]>([]);
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    fetch(`/api/teams/${teamId}/timeline`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { events?: TaskChangeEvent[] } | null) => {
        if (!cancelled && data?.events) {
          // Most recent first, take top 10
          const sorted = data.events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setRecentEvents(sorted.slice(0, 10));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [teamId]);

  const SORT_OPTS: { id: SortMode; label: string; tooltip: string }[] = [
    { id: 'default',    label: t('dashboard.sort_default'),    tooltip: t('dashboard.sort_default_tooltip') },
    { id: 'workload',   label: t('dashboard.sort_workload'),   tooltip: t('dashboard.sort_workload_tooltip') },
    { id: 'completion', label: t('dashboard.sort_completion'), tooltip: t('dashboard.sort_completion_tooltip') },
    { id: 'name',       label: t('dashboard.sort_name'),       tooltip: t('dashboard.sort_name_tooltip') },
  ];

  const sortedMembers = useMemo(
    () => sortMembers(members, team.tasks, sortMode),
    [members, team.tasks, sortMode],
  );

  const alertedAgentNames = new Set(alerts.filter(a => a.agentName).map(a => a.agentName!));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top row: Overview strip — full width, horizontal */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '10px',
        alignItems: 'stretch',
      }}>
        <ProgressSection stats={team.stats} />
        <ExecSummaryBlock teamId={team.id} />
        <StatsRow sessionStats={sessionStats} />
      </div>

      {/* Main area: Agents + Action Queue side by side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 280px',
        gap: '16px',
        minHeight: '360px',
      }}>
        {/* Left: Agent grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
          {members.length > 0 ? (
            <>
              {/* Roster header with sort controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {t('dashboard.roster', { count: members.length })}
                </span>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginRight: '4px', textTransform: 'uppercase' }}>{t('dashboard.sort')}</span>
                  {SORT_OPTS.map(opt => {
                    const isActive = sortMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setSortMode(opt.id)}
                        title={opt.tooltip}
                        style={{
                          padding: '2px 8px',
                          fontSize: '9px', letterSpacing: '0.08em',
                          fontFamily: 'var(--font-mono)',
                          background: isActive ? 'var(--active-bg-med)' : 'transparent',
                          color: isActive ? 'var(--active-text)' : 'var(--text-muted)',
                          border: `1px solid ${isActive ? 'var(--active-border)' : 'transparent'}`,
                          borderRadius: '2px',
                          cursor: 'pointer',
                          transition: 'all 0.1s',
                          textTransform: 'uppercase',
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Compact agent cards — auto-fill grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '6px',
                flex: 1,
                alignContent: 'start',
                overflowY: 'auto',
              }}>
                {sortedMembers.map(member => {
                  const blockingDetail = pendingHumanDetails.find(d => d.name === member.name)?.blocking;
                  return (
                    <CompactAgentCard
                      key={member.agentId}
                      member={member}
                      tasks={team.tasks}
                      onAgentSelect={onAgentSelect}
                      awaitingInput={pendingHumanAgents.includes(member.name)}
                      blockingTool={blockingDetail?.toolName}
                      blockingDetail={blockingDetail?.detail}
                      isLead={member.name === leadName}
                      hasAlert={alertedAgentNames.has(member.name)}
                      teamId={teamId}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: '4px', flex: 1 }}>
              <CRTEmptyState title={t('dashboard.no_agents')} subtitle={t('dashboard.no_agents_sub')} />
            </div>
          )}
        </div>

        {/* Right: Action Queue */}
        <ActionQueue
          alerts={alerts}
          pendingHumanDetails={pendingHumanDetails}
          recentEvents={recentEvents}
          teamId={teamId}
          onDismissAlert={onDismissAlert ?? (() => {})}
          onViewChange={onViewChange ?? (() => {})}
        />
      </div>

      {/* Session todos — inline, only when there are sessions with items */}
      {projectTodos.length > 0 && (
        <SessionTodoList sessions={projectTodos} />
      )}

      {/* Task list — full width */}
      <TaskList tasks={team.tasks} members={members} onTaskSelect={onTaskSelect} teamId={team.id} onTaskUpdated={onTeamUpdate} />

      {/* Heatmap — only when there are ≥2 agents */}
      {members.length >= 2 && (
        <AgentHeatmap teamId={team.id} agentNames={members.map(m => m.name)} />
      )}
    </div>
  );
}

// ─── Inline Session Todo List ─────────────────────────────────────────────────

function SessionTodoList({ sessions }: { sessions: SessionTodo[] }) {
  const { t } = useTranslation();
  const totalActive = sessions.reduce(
    (sum, s) => sum + s.items.filter(i => i.status === 'in_progress').length, 0
  );

  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface-1)',
      }}>
        <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          {t('dashboard.session_todos')}
        </span>
        {totalActive > 0 && (
          <span style={{
            fontSize: '9px', color: 'var(--amber)',
            background: 'var(--amber-glow)',
            border: '1px solid var(--amber-dim)',
            borderRadius: '2px', padding: '1px 6px',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {totalActive} {t('status.active')}
          </span>
        )}
      </div>

      {/* Sessions — each as a row group */}
      {sessions.map(session => (
        <div key={session.sessionId} style={{ borderBottom: '1px solid var(--border)' }}>
          {/* Session label */}
          <div style={{
            padding: '6px 20px',
            background: 'var(--surface-1)',
            fontSize: '9px', color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ color: 'var(--border-bright)' }}>▸</span>
            <span>{session.shortId}</span>
            {session.isLead && (
              <span style={{
                fontSize: '9px', padding: '1px 5px',
                color: 'var(--amber)', background: 'var(--amber-glow)',
                border: '1px solid var(--amber-dim)', borderRadius: '2px',
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>{t('status.lead')}</span>
            )}
            <span style={{ color: 'var(--text-muted)', opacity: 0.5, fontSize: '9px' }}>
              {session.cwd}
            </span>
            <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
              {t('dashboard.done_count', { done: session.items.filter(i => i.status === 'completed').length, total: session.items.length })}
            </span>
          </div>

          {/* Todo rows */}
          <div style={{ padding: '6px 20px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {session.items.map((item, idx) => (
              <TodoRow key={idx} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TodoRow({ item }: { item: TodoItem }) {
  const isActive = item.status === 'in_progress';
  const isDone   = item.status === 'completed';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <div style={{ flexShrink: 0, marginTop: '1px' }}>
        {isDone   && <CheckCircle2 size={11} style={{ color: 'var(--phosphor)' }} />}
        {isActive && <Loader2 size={11} style={{ color: 'var(--amber)', animation: 'spin-slow 2.5s linear infinite' }} />}
        {!isDone && !isActive && <Clock size={11} style={{ color: '#4a6070' }} />}
      </div>
      <div style={{ flex: 1 }}>
        <span style={{
          fontSize: '11px',
          color: isDone ? 'var(--text-muted)' : isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          letterSpacing: '0.02em', lineHeight: 1.5,
          textDecoration: isDone ? 'line-through' : 'none',
        }}>
          {item.content}
        </span>
        {isActive && item.activeForm && item.activeForm !== item.content && (
          <div style={{
            fontSize: '9px', color: 'var(--amber)',
            letterSpacing: '0.06em', marginTop: '1px', fontStyle: 'italic',
          }}>
            ▸ {item.activeForm}
          </div>
        )}
      </div>
    </div>
  );
}
