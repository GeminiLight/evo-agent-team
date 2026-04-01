import { useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { TeamMember } from '../../types';
import { agentColor } from '../../utils/agentColors';

interface AgentNodeData {
  member: TeamMember;
  isActive: boolean;
  isLead?: boolean;
  taskCount: number;
  inProgressCount?: number;
  completedCount?: number;
  isSelected?: boolean;
  hasSelection?: boolean;
  isAlerted?: boolean;
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
      borderRadius: '6px',
      padding: '12px 14px',
      minWidth: '200px',
      fontFamily: 'var(--font-mono, monospace)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      zIndex: 9999,
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      backdropFilter: 'blur(8px)',
    }}>
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

      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
        {member.name}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TYPE</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>{member.agentType || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>STATUS</span>
          <span style={{ fontSize: 'var(--text-xs)', color: isActive ? 'var(--phosphor)' : 'var(--text-muted)', letterSpacing: '0.08em', textShadow: isActive ? '0 0 6px var(--phosphor-glow)' : 'none' }}>
            {isActive ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>TASKS</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ice)', letterSpacing: '0.06em' }}>{taskCount}</span>
        </div>
        {inProgressCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>ACTIVE</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--amber)', letterSpacing: '0.06em' }}>{inProgressCount}</span>
          </div>
        )}
        {completedCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>DONE</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--phosphor)', letterSpacing: '0.06em' }}>{completedCount}</span>
          </div>
        )}
        {member.model && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>MODEL</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', letterSpacing: '0.06em', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.model}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentNode({ data }: { data: AgentNodeData }) {
  const { member, isActive, isLead, taskCount, inProgressCount, completedCount, isSelected, hasSelection, isAlerted } = data;
  const initial = member.name.charAt(0).toUpperCase();
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setShowTooltip(true), 300);
  };
  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowTooltip(false);
  };

  const isDimmed = hasSelection && !isSelected;

  // Progress bar: completed / total tasks
  const total = taskCount;
  const done = completedCount ?? 0;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        background: isActive ? 'var(--active-bg-med)' : 'var(--surface-1)',
        border: isSelected
          ? '2px solid var(--phosphor)'
          : isAlerted
            ? '2px solid var(--crimson, #ff4466)'
            : isLead
              ? '2px solid var(--amber)'
              : `1px solid ${isActive ? 'var(--active-border-hi)' : 'var(--border)'}`,
        borderLeft: isSelected
          ? '2px solid var(--phosphor)'
          : isAlerted
            ? '2px solid var(--crimson, #ff4466)'
            : `3px solid ${agentColor(member.name)}`,
        borderRadius: '8px',
        padding: isSelected || isAlerted || isLead ? '9px 11px' : '10px 12px',
        width: '160px',
        fontFamily: 'var(--font-mono, monospace)',
        boxShadow: isSelected
          ? '0 0 16px var(--phosphor-glow-strong)'
          : isAlerted
            ? '0 0 12px var(--crimson-glow, rgba(255,68,102,0.5))'
            : isLead
              ? '0 0 10px var(--amber-glow)'
              : isActive ? 'var(--active-glow)' : '0 2px 8px rgba(0,0,0,0.2)',
        animation: isAlerted && !isSelected
          ? 'agent-alert-pulse 1.5s ease-in-out infinite'
          : isActive && !isSelected ? 'agent-glow 2s ease-in-out infinite' : 'none',
        position: 'relative',
        opacity: isDimmed ? 0.3 : 1,
        filter: isDimmed ? 'saturate(0.2)' : 'none',
        transform: isSelected ? 'scale(1.04)' : 'none',
        transition: 'opacity 0.3s, filter 0.3s, transform 0.2s, border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {showTooltip && (
        <AgentTooltip
          member={member} isActive={isActive}
          taskCount={taskCount} inProgressCount={inProgressCount} completedCount={completedCount}
        />
      )}

      {/* Header: avatar + name + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{
          width: '26px', height: '26px',
          borderRadius: isLead ? '50%' : '5px',
          background: isActive ? 'var(--active-bg-hi)' : 'var(--surface-2)',
          border: isLead
            ? '2px solid var(--amber)'
            : `1px solid ${isActive ? 'var(--active-border-hi)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700,
          color: isLead ? 'var(--amber)' : isActive ? 'var(--active-text)' : 'var(--text-secondary)',
          textShadow: isLead ? '0 0 8px var(--amber-glow)' : isActive ? '0 0 8px var(--phosphor-glow-strong)' : 'none',
          boxShadow: isLead ? '0 0 6px var(--amber-glow)' : 'none',
          flexShrink: 0,
        }}>
          {initial}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <div style={{
              fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)',
              letterSpacing: '0.04em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '80px',
            }}>
              {member.name}
            </div>
            {isLead && (
              <span style={{
                fontSize: 'var(--text-xs)', padding: '1px 3px',
                color: 'var(--amber)', background: 'var(--amber-bg-subtle)',
                border: '1px solid var(--amber-border-subtle)', borderRadius: '2px',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', fontWeight: 700,
              }}>LEAD</span>
            )}
          </div>
          <div style={{
            fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {member.agentType}
          </div>
        </div>
      </div>

      {/* Status row: dot + status + task badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: total > 0 ? '6px' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: isActive ? 'var(--phosphor)' : 'var(--text-muted)',
            boxShadow: isActive ? 'var(--active-glow)' : 'none',
            display: 'inline-block',
            animation: isActive ? 'status-pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontSize: 'var(--text-xs)',
            color: isActive ? 'var(--active-text)' : 'var(--text-muted)',
            letterSpacing: '0.1em',
          }}>
            {isActive ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>
        {taskCount > 0 && (
          <span style={{
            fontSize: 'var(--text-xs)', color: 'var(--ice)',
            background: 'var(--ice-glow)', border: '1px solid var(--ice-dim)',
            borderRadius: '3px', padding: '1px 5px',
            letterSpacing: '0.06em', fontWeight: 600,
          }}>
            {taskCount}T
          </span>
        )}
      </div>

      {/* Mini progress bar */}
      {total > 0 && (
        <div style={{
          height: '2px', borderRadius: '1px',
          background: 'var(--border)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: 'var(--phosphor)',
            borderRadius: '1px',
            transition: 'width 0.5s ease',
            boxShadow: progressPct > 0 ? '0 0 4px var(--phosphor-glow)' : 'none',
          }} />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: isActive ? 'var(--phosphor)' : 'var(--text-muted)',
          width: '7px', height: '7px',
          border: '2px solid var(--surface-1)',
          boxShadow: isActive ? 'var(--active-glow)' : 'none',
        }}
      />
    </div>
  );
}
