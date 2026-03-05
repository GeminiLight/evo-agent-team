import { useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { TeamMember } from '../../types';

interface AgentNodeData {
  member: TeamMember;
  isActive: boolean;
  taskCount: number;
  inProgressCount?: number;
  completedCount?: number;
}

function AgentTooltip({ member, isActive, taskCount, inProgressCount = 0, completedCount = 0 }: AgentNodeData) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 'calc(100% + 10px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      padding: '10px 12px',
      minWidth: '180px',
      fontFamily: 'var(--font-mono, monospace)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      zIndex: 9999,
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
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

      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
        {member.name}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TYPE</span>
          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>{member.agentType || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>STATUS</span>
          <span style={{ fontSize: '9px', color: isActive ? 'var(--phosphor)' : 'var(--text-muted)', letterSpacing: '0.08em', textShadow: isActive ? '0 0 6px var(--phosphor-glow)' : 'none' }}>
            {isActive ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TASKS</span>
          <span style={{ fontSize: '9px', color: 'var(--ice)', letterSpacing: '0.06em' }}>{taskCount}</span>
        </div>
        {inProgressCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>IN PROGRESS</span>
            <span style={{ fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.06em' }}>{inProgressCount}</span>
          </div>
        )}
        {completedCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>COMPLETED</span>
            <span style={{ fontSize: '9px', color: 'var(--phosphor)', letterSpacing: '0.06em' }}>{completedCount}</span>
          </div>
        )}
        {member.model && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>MODEL</span>
            <span style={{ fontSize: '9px', color: 'var(--text-secondary)', letterSpacing: '0.06em', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.model}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentNode({ data }: { data: AgentNodeData }) {
  const { member, isActive, taskCount, inProgressCount, completedCount } = data;
  const initial = member.name.charAt(0).toUpperCase();
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
        background: isActive ? 'var(--active-bg-med)' : 'var(--surface-1)',
        border: `1px solid ${isActive ? 'var(--active-border-hi)' : 'var(--border)'}`,
        borderRadius: '4px',
        padding: '12px 14px',
        minWidth: '160px',
        fontFamily: 'var(--font-mono, monospace)',
        boxShadow: isActive ? 'var(--active-glow)' : '0 0 0 rgba(0,0,0,0)',
        animation: isActive ? 'agent-glow 2s ease-in-out infinite' : 'none',
        position: 'relative',
      }}
    >
      {showTooltip && (
        <AgentTooltip
          member={member}
          isActive={isActive}
          taskCount={taskCount}
          inProgressCount={inProgressCount}
          completedCount={completedCount}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{
          width: '28px', height: '28px',
          borderRadius: '3px',
          background: isActive ? 'var(--active-bg-hi)' : 'var(--surface-2)',
          border: `1px solid ${isActive ? 'var(--active-border-hi)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700,
          color: isActive ? 'var(--active-text)' : 'var(--text-secondary)',
          textShadow: isActive ? '0 0 8px var(--phosphor-glow-strong)' : 'none',
        }}>
          {initial}
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            {member.name}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {member.agentType}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: isActive ? 'var(--phosphor)' : 'var(--text-muted)',
            boxShadow: isActive ? 'var(--active-glow)' : 'none',
            display: 'inline-block',
            animation: isActive ? 'status-pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: '9px', color: isActive ? 'var(--active-text)' : 'var(--text-muted)', letterSpacing: '0.1em' }}>
            {isActive ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>
        {taskCount > 0 && (
          <span style={{
            fontSize: '9px',
            color: 'var(--ice)',
            background: 'var(--ice-glow)',
            border: '1px solid var(--ice-dim)',
            borderRadius: '2px',
            padding: '1px 6px',
            letterSpacing: '0.08em',
          }}>
            {taskCount}T
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: isActive ? 'var(--phosphor)' : 'var(--text-muted)',
          width: '8px', height: '8px',
          border: '2px solid var(--surface-1)',
          boxShadow: isActive ? 'var(--active-glow)' : 'none',
        }}
      />
    </div>
  );
}
