import { useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Loader2 } from 'lucide-react';
import type { Task } from '../../types';
import { STATUS_COLORS, type StatusKey } from '../../utils/statusColors';

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

function TaskTooltip({ task, derivedStatus }: { task: Task; derivedStatus: StatusKey }) {
  const colors = STATUS_COLORS[derivedStatus];
  const descPreview = task.description
    ? task.description.length > 120 ? task.description.slice(0, 120) + '…' : task.description
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
      borderRadius: '4px',
      padding: '10px 12px',
      minWidth: '220px',
      maxWidth: '280px',
      fontFamily: 'var(--font-mono, monospace)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      zIndex: 9999,
      pointerEvents: 'none',
      whiteSpace: 'normal',
    }}>
      {/* Arrow */}
      <div style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid var(--border)',
      }} />
      <div style={{
        position: 'absolute',
        top: 'calc(100% - 1px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '5px solid var(--surface-1)',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', gap: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1.3, flex: 1 }}>
          {task.subject}
        </span>
        <span style={{
          fontSize: '8px', color: colors.text, background: colors.bg,
          border: `1px solid ${colors.border}40`, borderRadius: '2px',
          padding: '1px 5px', letterSpacing: '0.1em', flexShrink: 0,
        }}>
          {STATUS_LABELS[derivedStatus]}
        </span>
      </div>

      {descPreview && (
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: 1.5, letterSpacing: '0.02em', marginBottom: '8px' }}>
          {descPreview}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TASK ID</span>
          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>#{task.id}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>OWNER</span>
          <span style={{ fontSize: '9px', color: task.owner ? colors.text : 'var(--text-muted)', letterSpacing: '0.06em', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.owner || 'UNASSIGNED'}
          </span>
        </div>
        {task.blockedBy.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>BLOCKED BY</span>
            <span style={{ fontSize: '9px', color: 'var(--crimson)', letterSpacing: '0.06em' }}>#{task.blockedBy.join(', #')}</span>
          </div>
        )}
        {task.blocks.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>BLOCKS</span>
            <span style={{ fontSize: '9px', color: 'var(--ice)', letterSpacing: '0.06em' }}>#{task.blocks.join(', #')}</span>
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
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setShowTooltip(true), 400);
  };
  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowTooltip(false);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        background: 'var(--surface-0)',
        borderRadius: '4px',
        minWidth: '200px',
        maxWidth: '240px',
        fontFamily: 'var(--font-mono, monospace)',
        overflow: 'visible',
        border: `1px solid ${colors.border}40`,
        borderLeft: `3px solid ${colors.border}`,
        boxShadow: isInProgress ? `0 0 15px ${colors.border}20` : 'none',
        animation: isInProgress ? 'status-pulse 2s ease-in-out infinite' : 'none',
        position: 'relative',
      }}
    >
      {showTooltip && <TaskTooltip task={task} derivedStatus={derivedStatus} />}

      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: colors.border,
          width: '7px', height: '7px',
          border: '2px solid var(--surface-0)',
        }}
      />

      <div style={{ padding: '10px 12px' }}>
        {/* Top row: id + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
          }}>
            #{task.id}
          </span>
          <span style={{
            fontSize: '8px',
            color: colors.text,
            background: colors.bg,
            border: `1px solid ${colors.border}40`,
            borderRadius: '2px',
            padding: '1px 5px',
            letterSpacing: '0.1em',
          }}>
            {STATUS_LABELS[derivedStatus]}
          </span>
        </div>

        {/* Subject */}
        <div style={{
          fontSize: '11px',
          fontWeight: 500,
          color: derivedStatus === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)',
          marginBottom: '6px',
          lineHeight: 1.3,
          letterSpacing: '0.02em',
          textDecoration: derivedStatus === 'completed' ? 'line-through' : 'none',
        }}>
          {task.subject}
        </div>

        {/* Active form */}
        {isInProgress && task.activeForm && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '9px',
            color: 'var(--amber)',
            marginBottom: '6px',
            letterSpacing: '0.04em',
          }}>
            <Loader2 size={9} style={{ animation: 'spin-slow 2.5s linear infinite', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.activeForm}
            </span>
          </div>
        )}

        {/* Bottom: owner + deps */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
          {task.owner ? (
            <span style={{
              fontSize: '9px',
              color: colors.text,
              background: colors.bg,
              borderRadius: '2px',
              padding: '1px 5px',
              border: `1px solid ${colors.border}30`,
              letterSpacing: '0.04em',
              maxWidth: '100px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {task.owner}
            </span>
          ) : (
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>UNASSIGNED</span>
          )}

          <div style={{ display: 'flex', gap: '6px', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            {task.blockedBy.length > 0 && <span title={`Blocked by #${task.blockedBy.join(', #')}`}>↑{task.blockedBy.length}</span>}
            {task.blocks.length > 0 && <span title={`Blocks #${task.blocks.join(', #')}`}>↓{task.blocks.length}</span>}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: colors.border,
          width: '7px', height: '7px',
          border: '2px solid var(--surface-0)',
        }}
      />
    </div>
  );
}
