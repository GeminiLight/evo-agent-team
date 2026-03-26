import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { TeamMember, Task } from '../../types';
import { agentColor } from '../../utils/agentColors';
import RespondModal from '../shared/RespondModal';

interface AgentCardProps {
  member: TeamMember;
  tasks: Task[];
  onAgentSelect: (agentId: string) => void;
  sortRank?: number;
  awaitingInput?: boolean;
  blockingTool?: string;
  blockingDetail?: string;
  isLead?: boolean;
  unreadCount?: number;
  teamId?: string;
}

function blockingLabel(toolName: string | undefined, t: TFunction): string {
  if (!toolName) return t('agent_card.input');
  if (toolName === 'Bash') return t('agent_card.bash');
  if (toolName === 'AskUserQuestion') return t('agent_card.input');
  if (toolName === 'Edit' || toolName === 'Write' || toolName === 'NotebookEdit') return t('agent_card.edit');
  return t('agent_card.input');
}

export default function AgentCard({ member, tasks, onAgentSelect, sortRank, awaitingInput = false, blockingTool, blockingDetail, isLead = false, unreadCount = 0, teamId }: AgentCardProps) {
  const { t } = useTranslation();
  const [respondOpen, setRespondOpen] = useState(false);
  const isDemo = teamId === 'demo-team' || !teamId;

  const assignedTasks = tasks.filter(t => t.owner === member.name);
  const activeTasks = assignedTasks.filter(t => t.status === 'in_progress');
  const completedTasks = assignedTasks.filter(t => t.status === 'completed');
  const isActive = activeTasks.length > 0;
  const currentWork = activeTasks[0]?.activeForm;

  const completionRate = assignedTasks.length > 0
    ? Math.round((completedTasks.length / assignedTasks.length) * 100)
    : 0;

  const accent = member.color ? member.color : agentColor(member.name);
  const accentBg = `${accent}12`;
  const accentBorder = `${accent}40`;
  const accentBorderHi = `${accent}70`;
  const accentGlow = `0 0 6px ${accent}80`;

  return (
    <div
      onClick={() => onAgentSelect(member.agentId)}
      style={{
        background: awaitingInput ? 'var(--amber-bg-subtle)' : isActive ? `${accent}08` : 'var(--surface-0)',
        border: `1px solid ${awaitingInput ? 'var(--amber-dim)' : isActive ? accentBorder : 'var(--border)'}`,
        borderRadius: '4px',
        padding: '14px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = accentGlow;
        e.currentTarget.style.borderColor = accentBorderHi;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = isActive ? accentBorder : 'var(--border)';
      }}
    >
      {/* Accent top bar */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: '2px',
        background: awaitingInput
          ? 'linear-gradient(90deg, transparent, var(--amber), transparent)'
          : `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        opacity: awaitingInput ? 0.9 : isActive ? 0.7 : 0.25,
        animation: (awaitingInput || isActive) ? 'data-stream 3s linear infinite' : 'none',
      }} />

      {/* LEAD badge */}
      {isLead && (
        <div style={{
          position: 'absolute', top: '6px', left: '6px',
          padding: '1px 5px',
          fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
          color: 'var(--amber)',
          background: 'var(--amber-bg-subtle)',
          border: '1px solid var(--amber-border-subtle)',
          borderRadius: '2px',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
        }}>
          {t('status.lead')}
        </div>
      )}

      {/* Sort rank badge */}
      {sortRank !== undefined && (
        <div style={{
          position: 'absolute', top: '6px', right: '6px',
          width: '16px', height: '16px',
          borderRadius: '50%',
          background: sortRank === 1 ? `${accent}22` : 'var(--surface-2)',
          border: `1px solid ${sortRank === 1 ? `${accent}55` : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '9px', fontWeight: 700,
          color: sortRank === 1 ? accent : 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1,
        }}>
          {sortRank}
        </div>
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Avatar with optional unread badge */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '3px',
            background: accentBg,
            border: `1px solid ${accentBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '15px', fontWeight: 700,
            color: accent,
            fontFamily: 'var(--font-display)',
            textShadow: isActive ? `0 0 10px ${accent}80` : 'none',
          }}>
            {member.name.charAt(0).toUpperCase()}
          </div>
          {unreadCount > 0 && (
            <div style={{
              position: 'absolute', top: '-5px', right: '-5px',
              minWidth: '14px', height: '14px', padding: '0 3px',
              borderRadius: '7px',
              background: 'var(--crimson)',
              boxShadow: '0 0 6px var(--crimson-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: 700, color: '#fff',
              fontFamily: 'var(--font-mono)', lineHeight: 1,
              border: '1px solid var(--surface-0)',
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '12px', fontWeight: 600,
            color: 'var(--text-primary)', letterSpacing: '0.04em',
            marginBottom: '2px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {member.name}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {member.agentType}
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
          padding: '2px 7px',
          background: isActive ? accentBg : 'transparent',
          border: `1px solid ${isActive ? accentBorder : 'var(--border)'}`,
          borderRadius: '2px',
        }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: awaitingInput ? 'var(--amber)' : isActive ? accent : 'var(--text-muted)',
            boxShadow: awaitingInput ? '0 0 5px var(--amber)' : isActive ? `0 0 5px ${accent}` : 'none',
            animation: (awaitingInput || isActive) ? 'status-pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: '9px', color: awaitingInput ? 'var(--amber)' : isActive ? accent : 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {awaitingInput ? blockingLabel(blockingTool, t) : isActive ? t('status.run') : t('status.idle')}
          </span>
        </div>
      </div>

      {/* Current work — task activeForm or idle */}
      {currentWork ? (
        <div style={{
          fontSize: '10px', lineHeight: 1.45, letterSpacing: '0.02em',
          color: 'var(--amber)', background: 'var(--amber-glow)',
          border: '1px solid var(--amber-dim)', borderRadius: '2px',
          padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          <span style={{ color: 'var(--amber-dim)', flexShrink: 0 }}>▸</span>
          <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {currentWork}
          </span>
        </div>
      ) : (
        <div style={{
          fontSize: '10px', lineHeight: 1.45, letterSpacing: '0.02em',
          color: 'var(--text-muted)', minHeight: '18px',
          display: 'flex', alignItems: 'center',
        }}>
          <span>{t('agent_card.awaiting_assignment')}</span>
        </div>
      )}

      {/* Progress row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, height: '3px', background: 'var(--surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${completionRate}%`,
            background: accent,
            boxShadow: completionRate > 0 ? `0 0 4px ${accent}` : 'none',
            transition: 'width 0.6s ease-out',
          }} />
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {completedTasks.length}/{assignedTasks.length}
        </span>
      </div>

      {/* Awaiting input urgency banner */}
      {awaitingInput && (
        <div style={{
          marginTop: '2px',
          padding: '6px 10px',
          background: 'var(--amber-glow)',
          border: '1px solid var(--amber-dim)',
          borderRadius: '3px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--amber)',
            boxShadow: '0 0 6px var(--amber)',
            animation: 'status-pulse 1.5s ease-in-out infinite',
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('agent_card.awaiting_input')}
            </div>
            {blockingTool && (
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em', marginTop: '1px' }}>
                {blockingTool}
              </div>
            )}
          </div>
          <button
            onClick={e => { e.stopPropagation(); if (!isDemo) setRespondOpen(true); }}
            title={isDemo ? t('agent_card.demo_unavailable') : t('agent_card.respond_to', { name: member.name })}
            style={{
              padding: '3px 10px', fontSize: '9px', letterSpacing: '0.1em', fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              background: isDemo ? 'transparent' : 'var(--amber-bg-subtle)',
              color: isDemo ? 'var(--text-muted)' : 'var(--amber)',
              border: `1px solid ${isDemo ? 'var(--border)' : 'var(--amber-dim)'}`,
              borderRadius: '2px',
              cursor: isDemo ? 'default' : 'pointer',
              flexShrink: 0,
              textTransform: 'uppercase',
            }}
          >
            {t('agent_card.respond')}
          </button>
        </div>
      )}

      {/* Respond modal */}
      {respondOpen && teamId && (
        <RespondModal
          agentName={member.name}
          toolName={blockingTool}
          detail={blockingDetail}
          teamId={teamId}
          onClose={() => setRespondOpen(false)}
        />
      )}
    </div>
  );
}
