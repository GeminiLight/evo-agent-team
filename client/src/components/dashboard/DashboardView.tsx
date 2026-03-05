import { useState, useMemo } from 'react';
import { CheckCircle2, Loader2, Clock } from 'lucide-react';
import type { TeamDetail, TeamMember, Task, InboxSummaryItem, SessionTodo, TodoItem } from '../../types';
import type { BlockingDetail } from '../../hooks/usePendingHumanRequests';
import TeamOverview from './TeamOverview';
import AgentCard from './AgentCard';
import TaskList from './TaskList';
import AgentHeatmap from './AgentHeatmap';

type SortMode = 'default' | 'workload' | 'completion' | 'name';

const SORT_OPTS: { id: SortMode; label: string }[] = [
  { id: 'default',    label: 'DEFAULT'    },
  { id: 'workload',   label: 'WORKLOAD ↓' },
  { id: 'completion', label: 'DONE% ↓'    },
  { id: 'name',       label: 'A→Z'        },
];

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
      // active tasks first, then by total
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
  pendingHumanAgents?: string[];
  pendingHumanDetails?: BlockingDetail[];
  inboxSummary?: Record<string, InboxSummaryItem>;
  leadName?: string | null;
  projectTodos?: SessionTodo[];
}

export default function DashboardView({ team, onTaskSelect, onAgentSelect, pendingHumanAgents = [], pendingHumanDetails = [], inboxSummary = {}, leadName = null, projectTodos = [] }: DashboardViewProps) {
  const members = team.config?.members ?? [];
  const [sortMode, setSortMode] = useState<SortMode>('default');

  const sortedMembers = useMemo(
    () => sortMembers(members, team.tasks, sortMode),
    [members, team.tasks, sortMode],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Row 1: overview full-width */}
      <TeamOverview team={team} />

      {/* Row 2: agent roster full-width, wraps freely */}
      {members.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Roster header with sort controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
              AGENT ROSTER // {members.length} UNIT{members.length !== 1 ? 'S' : ''}
            </span>
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginRight: '4px' }}>SORT</span>
              {SORT_OPTS.map(opt => {
                const isActive = sortMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSortMode(opt.id)}
                    style={{
                      padding: '2px 8px',
                      fontSize: '8px', letterSpacing: '0.08em',
                      fontFamily: 'var(--font-mono)',
                      background: isActive ? 'var(--active-bg-med)' : 'transparent',
                      color: isActive ? 'var(--active-text)' : 'var(--text-muted)',
                      border: `1px solid ${isActive ? 'var(--active-border)' : 'transparent'}`,
                      borderRadius: '2px',
                      cursor: 'pointer',
                      transition: 'all 0.1s',
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


          {/* Agent cards — wrap into as many rows as needed */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '10px',
          }}>
            {sortedMembers.map((member, idx) => {
              const blockingDetail = pendingHumanDetails.find(d => d.name === member.name)?.blocking;
              const unreadCount = inboxSummary[member.name]?.unread ?? 0;
              return (
                <AgentCard
                  key={member.agentId}
                  member={member}
                  tasks={team.tasks}
                  onAgentSelect={onAgentSelect}
                  sortRank={sortMode !== 'default' ? idx + 1 : undefined}
                  awaitingInput={pendingHumanAgents.includes(member.name)}
                  blockingTool={blockingDetail?.toolName}
                  isLead={member.name === leadName}
                  unreadCount={unreadCount}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Session todos — inline, only when there are sessions with items */}
      {projectTodos.length > 0 && (
        <SessionTodoList sessions={projectTodos} />
      )}

      {/* Heatmap — only when there are ≥2 agents */}
      {members.length >= 2 && (
        <AgentHeatmap teamId={team.id} agentNames={members.map(m => m.name)} />
      )}

      {/* Task list — full width */}
      <TaskList tasks={team.tasks} members={members} onTaskSelect={onTaskSelect} />
    </div>
  );
}

// ─── Inline Session Todo List ─────────────────────────────────────────────────

function SessionTodoList({ sessions }: { sessions: SessionTodo[] }) {
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
        <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
          SESSION TODOS
        </span>
        {totalActive > 0 && (
          <span style={{
            fontSize: '9px', color: 'var(--amber)',
            background: 'var(--amber-glow)',
            border: '1px solid var(--amber-dim)',
            borderRadius: '2px', padding: '1px 6px',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
          }}>
            {totalActive} ACTIVE
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
                fontSize: '8px', padding: '1px 5px',
                color: 'var(--amber)', background: 'var(--amber-glow)',
                border: '1px solid var(--amber-dim)', borderRadius: '2px',
                letterSpacing: '0.1em',
              }}>LEAD</span>
            )}
            <span style={{ color: 'var(--text-muted)', opacity: 0.5, fontSize: '8px' }}>
              {session.cwd}
            </span>
            <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
              {session.items.filter(i => i.status === 'completed').length}/{session.items.length} done
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
