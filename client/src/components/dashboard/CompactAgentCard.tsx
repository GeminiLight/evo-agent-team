import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Task } from '../../types';
import type { TeamMember } from '../../types';
import { agentColor, agentInitials } from '../../utils/agentColors';
import RespondModal from '../shared/RespondModal';

interface CompactAgentCardProps {
  member: TeamMember;
  tasks: Task[];
  onAgentSelect: (agentId: string) => void;
  awaitingInput?: boolean;
  blockingTool?: string;
  blockingDetail?: string;
  isLead?: boolean;
  hasAlert?: boolean;
  teamId?: string;
}

export default function CompactAgentCard({
  member, tasks, onAgentSelect, awaitingInput = false,
  blockingTool, blockingDetail, isLead = false, hasAlert = false, teamId,
}: CompactAgentCardProps) {
  const { t } = useTranslation();
  const [respondOpen, setRespondOpen] = useState(false);
  const isDemo = teamId === 'demo-team' || !teamId;

  const accent = agentColor(member.name);
  const assigned = tasks.filter(t => t.owner === member.name);
  const done = assigned.filter(t => t.status === 'completed').length;
  const active = assigned.filter(t => t.status === 'in_progress');
  const isActive = active.length > 0;
  const currentTask = active[0]?.subject ?? active[0]?.activeForm ?? null;
  const pct = assigned.length > 0 ? Math.round((done / assigned.length) * 100) : 0;

  const needsHighlight = awaitingInput || hasAlert;
  const highlightColor = awaitingInput ? 'var(--amber)' : 'var(--crimson)';

  return (
    <>
      <div
        onClick={() => onAgentSelect(member.agentId)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 12px',
          height: '64px',
          boxSizing: 'border-box',
          background: needsHighlight ? `${highlightColor}08` : 'var(--surface-0)',
          border: `1px solid ${needsHighlight ? highlightColor + '55' : 'var(--border)'}`,
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = accent + '70';
          e.currentTarget.style.boxShadow = `0 0 6px ${accent}40`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = needsHighlight ? highlightColor + '55' : 'var(--border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Accent top bar */}
        {(isActive || awaitingInput) && (
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: '2px',
            background: awaitingInput
              ? 'linear-gradient(90deg, transparent, var(--amber), transparent)'
              : `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            opacity: 0.7,
            animation: 'data-stream 3s linear infinite',
          }} />
        )}

        {/* Avatar circle */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: accent + '22',
          border: `1px solid ${accent}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700,
          color: accent,
          fontFamily: 'var(--font-display)',
          flexShrink: 0,
          textShadow: isActive ? `0 0 8px ${accent}80` : 'none',
        }}>
          {agentInitials(member.name)}
        </div>

        {/* Name + type */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px', width: '80px', flexShrink: 0 }}>
          <div style={{
            fontSize: '11px', fontWeight: 600,
            color: 'var(--text-primary)', letterSpacing: '0.03em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            {member.name}
            {isLead && (
              <span style={{
                fontSize: 'var(--text-xs)', padding: '0 3px', fontWeight: 700,
                color: 'var(--amber)', background: 'var(--amber-bg-subtle)',
                border: '1px solid var(--amber-border-subtle)',
                borderRadius: '2px', letterSpacing: '0.1em',
                fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
              }}>
                {t('status.lead')}
              </span>
            )}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {member.agentType}
          </div>
        </div>

        {/* Status indicator */}
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
          background: awaitingInput ? 'var(--amber)' : isActive ? accent : 'var(--text-muted)',
          boxShadow: awaitingInput ? '0 0 5px var(--amber)' : isActive ? `0 0 5px ${accent}` : 'none',
          animation: (awaitingInput || isActive) ? 'status-pulse 2s ease-in-out infinite' : 'none',
        }} />

        {/* Current task (1-line ellipsis) */}
        <div style={{
          flex: 1, minWidth: 0,
          fontSize: '10px', color: currentTask ? 'var(--text-secondary)' : 'var(--text-muted)',
          letterSpacing: '0.02em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontStyle: currentTask ? 'normal' : 'italic',
        }}>
          {currentTask ?? t('agent_card.awaiting_assignment')}
        </div>

        {/* Mini progress bar + count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, width: '70px' }}>
          <div style={{ flex: 1, height: '3px', background: 'var(--surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: accent,
              boxShadow: pct > 0 ? `0 0 3px ${accent}` : 'none',
              transition: 'width 0.6s ease-out',
            }} />
          </div>
          <span style={{
            fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}>
            {done}/{assigned.length}
          </span>
        </div>

        {/* Respond button when awaiting input */}
        {awaitingInput && (
          <button
            onClick={e => { e.stopPropagation(); if (!isDemo) setRespondOpen(true); }}
            title={isDemo ? t('agent_card.demo_unavailable') : t('agent_card.respond_to', { name: member.name })}
            style={{
              padding: '2px 8px', fontSize: 'var(--text-xs)', letterSpacing: '0.08em', fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              background: isDemo ? 'transparent' : 'var(--amber-bg-subtle)',
              color: isDemo ? 'var(--text-muted)' : 'var(--amber)',
              border: `1px solid ${isDemo ? 'var(--border)' : 'var(--amber-dim)'}`,
              borderRadius: '2px', cursor: isDemo ? 'default' : 'pointer',
              flexShrink: 0, textTransform: 'uppercase',
            }}
          >
            {t('agent_card.respond')}
          </button>
        )}
      </div>

      {respondOpen && teamId && (
        <RespondModal
          agentName={member.name}
          toolName={blockingTool}
          detail={blockingDetail}
          teamId={teamId}
          onClose={() => setRespondOpen(false)}
        />
      )}
    </>
  );
}
