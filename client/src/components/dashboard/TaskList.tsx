import { useState, useCallback } from 'react';
import { CheckCircle2, Loader2, Clock, Lock, ChevronRight, ExternalLink } from 'lucide-react';
import type { Task, TeamMember } from '../../types';
import { getTaskStatus, STATUS_COLORS, type StatusKey } from '../../utils/statusColors';
import CRTEmptyState from '../shared/CRTEmptyState';

interface TaskListProps {
  tasks: Task[];
  members: TeamMember[];
  onTaskSelect: (taskId: string | null) => void;
  teamId?: string;
  onTaskUpdated?: (task: Task) => void;
}

const STATUS_LABELS: Record<StatusKey, string> = {
  completed: 'DONE',
  in_progress: 'ACTIVE',
  pending: 'QUEUE',
  blocked: 'BLOCKED',
};

const STATUS_CYCLE: Record<Task['status'], Task['status']> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'pending',
};

export default function TaskList({ tasks, onTaskSelect, teamId, onTaskUpdated }: TaskListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusKey | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<{ taskId: string; prevStatus: Task['status']; subject: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const revertStatus = useCallback(async (taskId: string, prevStatus: Task['status']) => {
    if (!teamId) return;
    try {
      const res = await fetch(`/api/teams/${teamId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: prevStatus }),
      });
      if (res.ok) {
        const json = await res.json();
        onTaskUpdated?.(json.task);
      }
    } catch { /* silent */ }
  }, [teamId, onTaskUpdated]);

  const handleStatusCycle = useCallback(async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (!teamId || updatingId) return;
    const prevStatus = task.status;
    const next = STATUS_CYCLE[task.status];
    setUpdatingId(task.id);
    try {
      const res = await fetch(`/api/teams/${teamId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        const json = await res.json();
        onTaskUpdated?.(json.task);
        // Show undo toast
        if (undoToast) clearTimeout(undoToast.timer);
        const timer = setTimeout(() => setUndoToast(null), 4000);
        setUndoToast({ taskId: task.id, prevStatus, subject: task.subject, timer });
      }
    } catch { /* silent */ }
    finally { setUpdatingId(null); }
  }, [teamId, updatingId, onTaskUpdated, undoToast]);

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
    <>
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
            const tooltips: Record<string, string> = {
              all: 'Show all tasks',
              in_progress: 'Show actively running tasks',
              completed: 'Show finished tasks',
              pending: 'Show queued tasks',
              blocked: 'Show blocked tasks waiting on dependencies',
            };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                title={tooltips[f]}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
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
          <CRTEmptyState
            title={filter !== 'all' ? 'NO MATCHING TASKS' : 'NO TASKS'}
            subtitle={filter !== 'all' ? 'Try adjusting filters to see more tasks' : undefined}
          />
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

                {/* Created / updated timestamps */}
                {task.createdAt && (
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.05em', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'var(--font-mono)' }} title={`Created: ${new Date(task.createdAt).toLocaleString()}`}>
                    +{timeAgo(task.createdAt)}
                  </span>
                )}

                {/* Clickable status label — cycles pending→active→done */}
                <button
                  onClick={e => handleStatusCycle(e, task)}
                  title={teamId ? `Click to cycle status (current: ${status})` : undefined}
                  style={{
                    fontSize: '9px',
                    color: colors.text,
                    background: updatingId === task.id ? 'var(--surface-2)' : colors.bg,
                    border: `1px solid ${colors.border}40`,
                    borderRadius: '2px',
                    padding: '2px 6px',
                    letterSpacing: '0.1em',
                    minWidth: '52px',
                    textAlign: 'center',
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    cursor: teamId ? 'pointer' : 'default',
                    transition: 'opacity 0.15s',
                    opacity: updatingId === task.id ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (teamId && updatingId !== task.id) e.currentTarget.style.opacity = '0.75'; }}
                  onMouseLeave={e => { if (updatingId !== task.id) e.currentTarget.style.opacity = '1'; }}
                >
                  {STATUS_LABELS[status]}
                </button>

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

                  {/* Metadata row: CREATED / UPDATED / DURATION */}
                  {(task.createdAt || task.updatedAt) && (
                    <div style={{
                      display: 'flex', gap: '16px', flexWrap: 'wrap',
                      marginBottom: '8px', paddingBottom: '8px',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      {task.createdAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>CREATED</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                            {fmtAbsoluteTime(task.createdAt)}
                          </span>
                        </div>
                      )}
                      {task.updatedAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>UPDATED</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                            {fmtAbsoluteTime(task.updatedAt)}
                          </span>
                        </div>
                      )}
                      {task.createdAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>DURATION</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                            {durationSince(task.createdAt)}
                          </span>
                        </div>
                      )}
                    </div>
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

    {/* Undo toast */}
    {undoToast && (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border-bright)',
        borderRadius: '4px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        fontFamily: 'var(--font-mono)',
        animation: 'fade-up 0.2s ease-out',
      }}>
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.04em', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Status changed: #{undoToast.taskId}
        </span>
        <button
          onClick={() => {
            revertStatus(undoToast.taskId, undoToast.prevStatus);
            clearTimeout(undoToast.timer);
            setUndoToast(null);
          }}
          style={{
            padding: '3px 10px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-mono)',
            background: 'var(--amber-glow)',
            color: 'var(--amber)',
            border: '1px solid var(--amber-dim)',
            borderRadius: '2px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          UNDO
        </button>
        <button
          onClick={() => {
            clearTimeout(undoToast.timer);
            setUndoToast(null);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '12px',
            padding: '2px',
            lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    )}
    </>
  );
}

function timeInStatus(updatedAt?: string): string | null {
  if (!updatedAt) return null;
  return timeAgo(updatedAt);
}

function timeAgo(iso?: string): string {
  if (!iso) return '?';
  const ms = Date.now() - new Date(iso).getTime();
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

function fmtAbsoluteTime(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${mins}`;
  } catch { return iso.slice(0, 16); }
}

function durationSince(iso?: string): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const totalMins = Math.floor(ms / 60000);
  if (totalMins < 1) return '<1m';
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}
