import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { Task, TeamMember } from '../types';
import { getTaskStatus, STATUS_COLORS } from '../utils/statusColors';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface TaskDetailPanelProps {
  task: Task | null;
  allTasks: Task[];
  members: TeamMember[];
  onClose: () => void;
}

function timeAgo(iso?: string): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return '<1m ago';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDatetime(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TaskDetailPanel({ task, allTasks, members, onClose }: TaskDetailPanelProps) {
  const { t } = useTranslation();
  const panelRef = useFocusTrap<HTMLDivElement>();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!task) return null;

  const allTasksSimple = allTasks.map(t => ({ id: t.id, status: t.status }));
  const status = getTaskStatus(task, allTasksSimple);
  const colors = STATUS_COLORS[status];

  const STATUS_LABELS: Record<string, string> = {
    completed: 'DONE',
    in_progress: 'ACTIVE',
    pending: 'QUEUE',
    blocked: 'BLOCKED',
  };

  const ownerMember = task.owner ? members.find(m => m.name === task.owner || m.agentId === task.owner) : null;

  const metadataEntries = task.metadata
    ? Object.entries(task.metadata).filter(([key]) => !key.startsWith('_'))
    : [];

  const hasBlockedBy = task.blockedBy && task.blockedBy.length > 0;
  const hasBlocks = task.blocks && task.blocks.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--overlay-backdrop)',
          zIndex: 99,
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Task #${task.id}: ${task.subject}`}
        style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '380px',
        maxWidth: '100vw',
        zIndex: 100,
        background: 'var(--surface-0)',
        borderLeft: '1px solid var(--border-bright)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slide-in-right 0.25s ease-out',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '9px',
            color: 'var(--text-muted)',
            letterSpacing: '0.15em',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
          }}>
            {t('panel.task_detail', { id: task.id })}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          {/* Subject */}
          <h2 style={{
            fontSize: '16px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.3,
          }}>
            {task.subject}
          </h2>

          {/* Status badge */}
          <div>
            <span style={{
              fontSize: '9px',
              color: colors.text,
              background: colors.bg,
              border: `1px solid ${colors.border}40`,
              borderRadius: '2px',
              padding: '3px 8px',
              letterSpacing: '0.1em',
              fontFamily: 'var(--font-mono)',
            }}>
              {STATUS_LABELS[status]}
            </span>
          </div>

          {/* Separator */}
          <div style={{ height: '1px', background: 'var(--border)' }} />

          {/* Description */}
          <div>
            <div style={{
              fontSize: '9px',
              color: 'var(--text-muted)',
              letterSpacing: '0.15em',
              marginBottom: '8px',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
            }}>
              {t('panel.description')}
            </div>
            {task.description ? (
              <p style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: 0,
                letterSpacing: '0.02em',
              }}>
                {task.description}
              </p>
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                {t('panel.no_description')}
              </p>
            )}
          </div>

          {/* Owner */}
          <div>
            <div style={{
              fontSize: '9px',
              color: 'var(--text-muted)',
              letterSpacing: '0.15em',
              marginBottom: '8px',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
            }}>
              {t('panel.owner')}
            </div>
            {task.owner ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-bright)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: 'var(--phosphor)',
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                }}>
                  {task.owner.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                    {task.owner}
                  </div>
                  {ownerMember && (
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: '1px' }}>
                      {ownerMember.agentType}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <span style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)',
              }}>
                {t('panel.no_owner')}
              </span>
            )}
          </div>

          {/* Timing */}
          {(task.createdAt || task.updatedAt) && (
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: '8px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                {t('panel.timing')}
              </div>
              <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px 12px' }}>
                {task.createdAt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: task.updatedAt ? '1px solid var(--border)' : 'none', gap: '12px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', flexShrink: 0 }}>CREATED</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                      {timeAgo(task.createdAt)} · {fmtDatetime(task.createdAt)}
                    </span>
                  </div>
                )}
                {task.updatedAt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', gap: '12px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', flexShrink: 0 }}>
                      {task.status === 'in_progress' ? 'ACTIVE FOR' : 'UPDATED'}
                    </span>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', textAlign: 'right', color: task.status === 'in_progress' ? 'var(--amber)' : 'var(--text-secondary)' }}>
                      {timeAgo(task.updatedAt)} · {fmtDatetime(task.updatedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dependencies */}
          <div>
            <div style={{
              fontSize: '9px',
              color: 'var(--text-muted)',
              letterSpacing: '0.15em',
              marginBottom: '8px',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
            }}>
              {t('panel.dependencies')}
            </div>
            {!hasBlockedBy && !hasBlocks ? (
              <span style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)',
              }}>
                {t('panel.no_dependencies')}
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {hasBlockedBy && (
                  <div>
                    <div style={{
                      fontSize: '9px',
                      color: 'var(--crimson)',
                      letterSpacing: '0.1em',
                      marginBottom: '6px',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      BLOCKED BY:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {task.blockedBy.map(depId => {
                        const depTask = allTasks.find(t => t.id === depId);
                        const depStatus = depTask ? getTaskStatus(depTask, allTasksSimple) : null;
                        const depColors = depStatus ? STATUS_COLORS[depStatus] : null;
                        return (
                          <div key={depId} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {depColors && (
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: depColors.border,
                                flexShrink: 0,
                              }} />
                            )}
                            <span style={{
                              fontSize: '11px',
                              color: depColors ? depColors.text : 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}>
                              #{depId}{depTask ? ` ${depTask.subject}` : ''}
                            </span>
                            {depStatus === 'completed' && (
                              <span style={{ fontSize: '10px', color: 'var(--phosphor)' }}>✓</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {hasBlocks && (
                  <div>
                    <div style={{
                      fontSize: '9px',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.1em',
                      marginBottom: '6px',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      BLOCKS:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {task.blocks.map(depId => {
                        const depTask = allTasks.find(t => t.id === depId);
                        const depStatus = depTask ? getTaskStatus(depTask, allTasksSimple) : null;
                        const depColors = depStatus ? STATUS_COLORS[depStatus] : null;
                        return (
                          <div key={depId} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {depColors && (
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: depColors.border,
                                flexShrink: 0,
                              }} />
                            )}
                            <span style={{
                              fontSize: '11px',
                              color: depColors ? depColors.text : 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}>
                              #{depId}{depTask ? ` ${depTask.subject}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Metadata */}
          {metadataEntries.length > 0 && (
            <div>
              <div style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                letterSpacing: '0.15em',
                marginBottom: '8px',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
              }}>
                {t('panel.metadata')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {metadataEntries.map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ flexShrink: 0 }}>{key}:</span>
                    <span style={{ wordBreak: 'break-all' }}>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
