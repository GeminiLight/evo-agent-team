import { useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Loader2 } from 'lucide-react';
import type { Task } from '../../types';
import { STATUS_COLORS, type StatusKey } from '../../utils/statusColors';
import { agentColor } from '../../utils/agentColors';

interface TaskNodeData {
  task: Task;
  derivedStatus: StatusKey;
}

const STATUS_LABELS: Record<StatusKey, string> = {
  completed: 'DONE',
  in_progress: 'ACTIVE',
  pending: 'QUEUE',
  blocked: 'BLOCKED',
};

const STATUS_ICONS: Record<StatusKey, string> = {
  completed: '✓',
  in_progress: '●',
  pending: '○',
  blocked: '✕',
};

function TaskTooltip({ task, derivedStatus }: { task: Task; derivedStatus: StatusKey }) {
  const colors = STATUS_COLORS[derivedStatus];
  const descPreview = task.description
    ? task.description.length > 160 ? task.description.slice(0, 160) + '…' : task.description
    : null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 'calc(100% + 10px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--surface-1)',
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${colors.border}`,
      borderRadius: '6px',
      padding: '12px 14px',
      minWidth: '240px',
      maxWidth: '300px',
      fontFamily: 'var(--font-mono, monospace)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      zIndex: 9999,
      pointerEvents: 'none',
      whiteSpace: 'normal',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Arrow */}
      <div style={{
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
        borderTop: '6px solid var(--border)',
      }} />
      <div style={{
        position: 'absolute', top: 'calc(100% - 1px)', left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
        borderTop: '5px solid var(--surface-1)',
      }} />

      <div style={{ marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1.4 }}>
          {task.subject}
        </div>
      </div>

      {descPreview && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6, letterSpacing: '0.02em', marginBottom: '8px' }}>
          {descPreview}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TASK</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>#{task.id}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>STATUS</span>
          <span style={{ fontSize: 'var(--text-xs)', color: colors.text, letterSpacing: '0.08em' }}>{STATUS_LABELS[derivedStatus]}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>OWNER</span>
          <span style={{ fontSize: 'var(--text-xs)', color: task.owner ? agentColor(task.owner) : 'var(--text-muted)', letterSpacing: '0.06em' }}>
            {task.owner || 'UNASSIGNED'}
          </span>
        </div>
        {task.blockedBy.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>BLOCKED BY</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--crimson)', letterSpacing: '0.06em' }}>#{task.blockedBy.join(', #')}</span>
          </div>
        )}
        {task.blocks.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>BLOCKS</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ice)', letterSpacing: '0.06em' }}>#{task.blocks.join(', #')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskNode({ data }: { data: TaskNodeData }) {
  const { task, derivedStatus } = data;
  const colors = STATUS_COLORS[derivedStatus];
  const isInProgress = derivedStatus === 'in_progress';
  const isDone = derivedStatus === 'completed';
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setShowTooltip(true), 300);
  };
  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowTooltip(false);
  };

  // Truncate subject for compact display
  const maxSubjectLen = 48;
  const truncatedSubject = task.subject.length > maxSubjectLen
    ? task.subject.slice(0, maxSubjectLen) + '…'
    : task.subject;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        background: isDone ? 'var(--surface-0)' : 'var(--surface-1)',
        borderRadius: '6px',
        width: '190px',
        fontFamily: 'var(--font-mono, monospace)',
        overflow: 'visible',
        border: `1px solid ${colors.border}${isDone ? '25' : '50'}`,
        borderLeft: `3px solid ${colors.border}${isDone ? '60' : ''}`,
        boxShadow: isInProgress
          ? `0 0 20px ${colors.border}25, inset 0 0 0 1px ${colors.border}15`
          : 'none',
        position: 'relative',
        opacity: isDone ? 0.45 : 1,
        transform: isDone ? 'scale(0.97)' : 'none',
        transition: 'opacity 0.3s, box-shadow 0.3s, transform 0.15s',
      }}
    >
      {showTooltip && <TaskTooltip task={task} derivedStatus={derivedStatus} />}

      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: colors.border,
          width: '6px', height: '6px',
          border: '2px solid var(--surface-1)',
        }}
      />

      <div style={{ padding: '8px 10px' }}>
        {/* Compact header: status icon + id + status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '5px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              fontSize: '10px',
              color: colors.text,
              fontWeight: 700,
              textShadow: isInProgress ? `0 0 6px ${colors.border}` : 'none',
            }}>
              {STATUS_ICONS[derivedStatus]}
            </span>
            <span style={{
              fontSize: 'var(--text-xs)', fontFamily: 'monospace',
              color: 'var(--text-muted)', letterSpacing: '0.06em',
            }}>
              #{task.id}
            </span>
          </div>
          <span style={{
            fontSize: 'var(--text-xs)', color: colors.text,
            background: colors.bg, border: `1px solid ${colors.border}35`,
            borderRadius: '3px', padding: '1px 5px',
            letterSpacing: '0.1em', fontWeight: 600,
          }}>
            {STATUS_LABELS[derivedStatus]}
          </span>
        </div>

        {/* Subject — compact, 2 lines max */}
        <div style={{
          fontSize: '10px', fontWeight: 500,
          color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
          marginBottom: '4px',
          lineHeight: 1.35, letterSpacing: '0.02em',
          textDecoration: isDone ? 'line-through' : 'none',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {truncatedSubject}
        </div>

        {/* Active form spinner */}
        {isInProgress && task.activeForm && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: 'var(--text-xs)', color: 'var(--amber)',
            marginBottom: '3px', letterSpacing: '0.04em',
          }}>
            <Loader2 size={8} style={{ animation: 'spin-slow 2.5s linear infinite', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
              {task.activeForm}
            </span>
          </div>
        )}

        {/* Bottom row: owner tag */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: '2px',
        }}>
          {task.owner ? (
            <span style={{
              fontSize: 'var(--text-xs)', color: agentColor(task.owner), letterSpacing: '0.04em',
              maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              opacity: 0.8,
            }}>
              {task.owner}
            </span>
          ) : (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.06em', opacity: 0.6 }}>
              unassigned
            </span>
          )}

          <div style={{ display: 'flex', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            {task.blockedBy.length > 0 && <span title={`Blocked by #${task.blockedBy.join(', #')}`} style={{ color: 'var(--crimson, #ff3b5c)' }}>↑{task.blockedBy.length}</span>}
            {task.blocks.length > 0 && <span title={`Blocks #${task.blocks.join(', #')}`} style={{ color: 'var(--ice)' }}>↓{task.blocks.length}</span>}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: colors.border,
          width: '6px', height: '6px',
          border: '2px solid var(--surface-1)',
        }}
      />
    </div>
  );
}
