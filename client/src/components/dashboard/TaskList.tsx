import { useState } from 'react';
import { CheckCircle2, Loader2, Clock, Lock, ChevronRight, ExternalLink } from 'lucide-react';
import type { Task, TeamMember } from '../../types';
import { getTaskStatus, STATUS_COLORS, type StatusKey } from '../../utils/statusColors';

interface TaskListProps {
  tasks: Task[];
  members: TeamMember[];
  onTaskSelect: (taskId: string | null) => void;
}

const STATUS_LABELS: Record<StatusKey, string> = {
  completed: 'DONE',
  in_progress: 'ACTIVE',
  pending: 'QUEUE',
  blocked: 'BLOCKED',
};

export default function TaskList({ tasks, onTaskSelect }: TaskListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusKey | 'all'>('all');

  const allTasksSimple = tasks.map(t => ({ id: t.id, status: t.status }));

  const filtered = filter === 'all' ? tasks : tasks.filter(t => {
    const s = getTaskStatus(t, allTasksSimple);
    return s === filter;
  });

  const counts = {
    all: tasks.length,
    completed: tasks.filter(t => getTaskStatus(t, allTasksSimple) === 'completed').length,
    in_progress: tasks.filter(t => getTaskStatus(t, allTasksSimple) === 'in_progress').length,
    pending: tasks.filter(t => getTaskStatus(t, allTasksSimple) === 'pending').length,
    blocked: tasks.filter(t => getTaskStatus(t, allTasksSimple) === 'blocked').length,
  };

  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--surface-1)',
      }}>
        <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>
          TASK REGISTRY
        </span>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {(['all', 'in_progress', 'completed', 'pending', 'blocked'] as const).map(f => {
            const isActive = filter === f;
            const color = f === 'all' ? 'var(--text-secondary)'
              : f === 'in_progress' ? 'var(--amber)'
              : f === 'completed' ? 'var(--phosphor)'
              : f === 'blocked' ? 'var(--crimson)'
              : '#4a6070';
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '3px 8px',
                  fontSize: '9px',
                  letterSpacing: '0.08em',
                  fontFamily: 'var(--font-mono)',
                  background: isActive ? `${color}18` : 'transparent',
                  color: isActive ? color : 'var(--text-muted)',
                  border: `1px solid ${isActive ? color + '40' : 'transparent'}`,
                  borderRadius: '2px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {f === 'all' ? 'ALL' : f === 'in_progress' ? 'ACTIVE' : f.toUpperCase()}
                <span style={{ marginLeft: '4px', opacity: 0.7 }}>{counts[f]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task list */}
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
          }}>
            — NO TASKS —
          </div>
        )}
        {filtered.map((task, idx) => {
          const status = getTaskStatus(task, allTasksSimple);
          const colors = STATUS_COLORS[status];
          const isExpanded = expandedId === task.id;

          return (
            <div
              key={task.id}
              onClick={() => setExpandedId(isExpanded ? null : task.id)}
              style={{
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.1s',
                borderLeft: `2px solid ${colors.border}`,
                animation: `fade-up 0.3s ease-out ${idx * 0.03}s both`,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--active-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Main row */}
              <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Status icon */}
                <StatusIcon status={status} />

                {/* ID */}
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  minWidth: '28px',
                }}>
                  #{task.id}
                </span>

                {/* Subject */}
                <span style={{
                  fontSize: '12px',
                  color: status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: status === 'completed' ? 'line-through' : 'none',
                  letterSpacing: '0.02em',
                }}>
                  {task.subject}
                </span>

                {/* Active form when in progress */}
                {status === 'in_progress' && task.activeForm && (
                  <span style={{
                    fontSize: '9px',
                    color: 'var(--amber)',
                    background: 'var(--amber-glow)',
                    border: '1px solid var(--amber-dim)',
                    borderRadius: '2px',
                    padding: '2px 6px',
                    letterSpacing: '0.04em',
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {task.activeForm}
                  </span>
                )}

                {/* Owner */}
                {task.owner && (
                  <span style={{
                    fontSize: '9px',
                    color: colors.text,
                    background: colors.bg,
                    border: `1px solid ${colors.border}40`,
                    borderRadius: '2px',
                    padding: '2px 6px',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {task.owner}
                  </span>
                )}

                {/* Time in status */}
                {(status === 'in_progress' || status === 'pending') && task.updatedAt && (
                  <span style={{
                    fontSize: '8px', color: 'var(--text-muted)',
                    letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    flexShrink: 0, fontFamily: 'var(--font-mono)',
                  }}>
                    {timeInStatus(task.updatedAt)}
                  </span>
                )}

                {/* Status label */}
                <span style={{
                  fontSize: '9px',
                  color: colors.text,
                  letterSpacing: '0.1em',
                  minWidth: '50px',
                  textAlign: 'right',
                  flexShrink: 0,
                }}>
                  {STATUS_LABELS[status]}
                </span>

                {/* Open detail button */}
                <button
                  onClick={e => { e.stopPropagation(); onTaskSelect(task.id); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--phosphor)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <ExternalLink size={11} />
                </button>

                {/* Chevron */}
                <ChevronRight style={{
                  width: '12px', height: '12px',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                  transition: 'transform 0.2s',
                }} />
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{
                  padding: '0 16px 12px 56px',
                  animation: 'fade-up 0.2s ease-out',
                }}>
                  {task.description && (
                    <p style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      marginBottom: '8px',
                      letterSpacing: '0.02em',
                    }}>
                      {task.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {task.blockedBy.length > 0 && (
                      <span style={{ fontSize: '10px', color: 'var(--crimson)', letterSpacing: '0.06em' }}>
                        BLOCKED BY: {task.blockedBy.map(id => `#${id}`).join(', ')}
                      </span>
                    )}
                    {task.blocks.length > 0 && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                        BLOCKS: {task.blocks.map(id => `#${id}`).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeInStatus(updatedAt?: string): string | null {
  if (!updatedAt) return null;
  const ms = Date.now() - new Date(updatedAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function StatusIcon({ status }: { status: StatusKey }) {
  const size = 13;
  if (status === 'completed') return <CheckCircle2 size={size} style={{ color: 'var(--phosphor)', flexShrink: 0 }} />;
  if (status === 'in_progress') return <Loader2 size={size} style={{ color: 'var(--amber)', flexShrink: 0, animation: 'spin-slow 2.5s linear infinite' }} />;
  if (status === 'blocked') return <Lock size={size} style={{ color: 'var(--crimson)', flexShrink: 0 }} />;
  return <Clock size={size} style={{ color: '#4a6070', flexShrink: 0 }} />;
}
