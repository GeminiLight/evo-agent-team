import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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

const STATUS_CYCLE: Record<Task['status'], Task['status']> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'pending',
};

// ─── StatusPopover ─────────────────────────────────────────────────────────────

interface StatusPopoverProps {
  currentStatus: Task['status'];
  onSelect: (status: Task['status']) => void;
  onClose: () => void;
}

function StatusPopover({ currentStatus, onSelect, onClose }: StatusPopoverProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  const POPOVER_OPTIONS: { status: Task['status']; label: string; color: string }[] = [
    { status: 'pending',     label: t('task_list.queue'),  color: '#4a6070' },
    { status: 'in_progress', label: t('task_list.active'), color: 'var(--amber)' },
    { status: 'completed',   label: t('task_list.done'),   color: 'var(--phosphor)' },
  ];

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        right: 0,
        zIndex: 200,
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: '3px',
        padding: '4px 0',
        minWidth: '110px',
        fontFamily: 'var(--font-mono)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {POPOVER_OPTIONS.map(opt => {
        const isCurrent = opt.status === currentStatus;
        return (
          <div
            key={opt.status}
            onClick={() => { if (!isCurrent) { onSelect(opt.status); onClose(); } }}
            style={{
              padding: '5px 12px',
              fontSize: '9px',
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              cursor: isCurrent ? 'default' : 'pointer',
              color: isCurrent ? 'var(--text-muted)' : opt.color,
              transition: 'background 0.1s',
              textTransform: 'uppercase',
            }}
            onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: '8px', opacity: isCurrent ? 1 : 0.5 }}>
              {isCurrent ? '●' : '○'}
            </span>
            {opt.label}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function TaskList({ tasks, onTaskSelect, teamId, onTaskUpdated }: TaskListProps) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusKey | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<{ taskId: string; prevStatus: Task['status']; nextStatus: Task['status']; subject: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const STATUS_LABELS: Record<StatusKey, string> = {
    completed: t('task_list.done'),
    in_progress: t('task_list.active'),
    pending: t('task_list.queue'),
    blocked: t('task_list.blocked'),
  };

  const FILTER_TOOLTIPS: Record<string, string> = {
    all: t('task_list.all_tooltip'),
    in_progress: t('task_list.active_tooltip'),
    completed: t('task_list.completed_tooltip'),
    pending: t('task_list.pending_tooltip'),
    blocked: t('task_list.blocked_tooltip'),
  };

  const FILTER_LABELS: Record<string, string> = {
    all: t('task_list.all'),
    in_progress: t('task_list.active'),
    completed: t('task_list.done'),
    pending: t('task_list.queue'),
    blocked: t('task_list.blocked'),
  };

  const patchStatus = useCallback(async (task: Task, next: Task['status']) => {
    if (!teamId || updatingId) return;
    const prevStatus = task.status;
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
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        const timer = setTimeout(() => setUndoToast(null), 5000);
        toastTimerRef.current = timer;
        setUndoToast({ taskId: task.id, prevStatus, nextStatus: next, subject: task.subject });
      } else {
        const json = await res.json().catch(() => ({}));
        const msg = (json as { error?: string }).error ?? 'Failed to update';
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        const timer = setTimeout(() => setUndoToast(null), 4000);
        toastTimerRef.current = timer;
        setUndoToast({ taskId: task.id, prevStatus: task.status, nextStatus: task.status, subject: msg });
      }
    } catch {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      const timer = setTimeout(() => setUndoToast(null), 4000);
      toastTimerRef.current = timer;
      setUndoToast({ taskId: task.id, prevStatus: task.status, nextStatus: task.status, subject: 'Network error' });
    } finally {
      setUpdatingId(null);
    }
  }, [teamId, updatingId, onTaskUpdated]);

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

  const handleStatusClick = useCallback((e: React.MouseEvent, task: Task, status: StatusKey) => {
    e.stopPropagation();
    if (!teamId || updatingId || status === 'blocked') return;
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: quick cycle, skip popover
      setOpenPopoverId(null);
      patchStatus(task, STATUS_CYCLE[task.status]);
    } else {
      setOpenPopoverId(prev => prev === task.id ? null : task.id);
    }
  }, [teamId, updatingId, patchStatus]);

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
        <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          {t('task_list.registry')}
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
                title={FILTER_TOOLTIPS[f]}
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
                  textTransform: 'uppercase',
                }}
              >
                {FILTER_LABELS[f]}
                <span style={{ marginLeft: '4px', opacity: 0.7 }}>{counts[f]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task list */}
      <div style={{ maxHeight: '60vh', overflowY: 'auto', overflowX: 'visible' }}>
        {filtered.length === 0 && (
          <CRTEmptyState
            title={filter !== 'all' ? t('task_list.no_matching') : t('task_list.no_tasks')}
            subtitle={filter !== 'all' ? t('task_list.no_matching_sub') : undefined}
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

                {/* Clickable status label — popover or Ctrl+Click cycle */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={e => handleStatusClick(e, task, status)}
                    title={
                      !teamId ? undefined
                      : status === 'blocked' ? t('task_list.blocked_hint')
                      : t('task_list.status_hint', { status })
                    }
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
                      fontFamily: 'var(--font-mono)',
                      cursor: (!teamId || status === 'blocked') ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      transition: 'opacity 0.15s',
                      opacity: updatingId === task.id ? 0.5 : 1,
                      textTransform: 'uppercase',
                    }}
                    onMouseEnter={e => { if (teamId && updatingId !== task.id && status !== 'blocked') e.currentTarget.style.opacity = '0.75'; }}
                    onMouseLeave={e => { if (updatingId !== task.id) e.currentTarget.style.opacity = '1'; }}
                  >
                    {updatingId === task.id
                      ? <Loader2 size={10} style={{ animation: 'spin-slow 1s linear infinite' }} />
                      : <>
                          {STATUS_LABELS[status]}
                          {teamId && status !== 'blocked' && (
                            <span style={{ fontSize: '7px', opacity: 0.55, marginLeft: '1px' }}>▾</span>
                          )}
                        </>
                    }
                  </button>
                  {openPopoverId === task.id && (
                    <StatusPopover
                      currentStatus={task.status}
                      onSelect={next => patchStatus(task, next)}
                      onClose={() => setOpenPopoverId(null)}
                    />
                  )}
                </div>

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
                          <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('task_list.created')}</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                            {fmtAbsoluteTime(task.createdAt)}
                          </span>
                        </div>
                      )}
                      {task.updatedAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('task_list.updated')}</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                            {fmtAbsoluteTime(task.updatedAt)}
                          </span>
                        </div>
                      )}
                      {task.createdAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('task_list.duration')}</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                            {durationSince(task.createdAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {task.blockedBy.length > 0 && (
                      <span style={{ fontSize: '10px', color: 'var(--crimson)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {t('task_list.blocked_by')} {task.blockedBy.map(id => `#${id}`).join(', ')}
                      </span>
                    )}
                    {task.blocks.length > 0 && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {t('task_list.blocks')} {task.blocks.map(id => `#${id}`).join(', ')}
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
          ✓ #{undoToast.taskId} → {STATUS_LABELS[undoToast.nextStatus] ?? '...'}
        </span>
        <button
          onClick={() => {
            revertStatus(undoToast.taskId, undoToast.prevStatus);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
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
            textTransform: 'uppercase',
          }}
        >
          {t('task_list.undo')}
        </button>
        <button
          onClick={() => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
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
