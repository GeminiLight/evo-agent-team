import { useState } from 'react';
import type { AgentMessage } from '../../types';
import { agentColor, agentInitials, agentAvatarStyle } from '../../utils/agentColors';

const TYPE_BADGE: Record<string, { color: string; label: string; glow?: boolean }> = {
  idle_notification:        { color: 'var(--text-muted)',    label: 'IDLE'           },
  shutdown_request:         { color: 'var(--crimson)',       label: 'SHUTDOWN'       },
  shutdown_response:        { color: 'var(--crimson)',       label: 'SHUTDOWN'       },
  plan_approval_request:    { color: 'var(--amber)',         label: 'PLAN'           },
  plan_approval_response:   { color: 'var(--amber)',         label: 'PLAN'           },
  task_assignment:          { color: 'var(--ice)',           label: 'TASK'           },
  broadcast:                { color: 'var(--phosphor)',      label: 'BROADCAST'      },
  human_input_request:      { color: 'var(--amber)',         label: '⚠ NEEDS INPUT', glow: true },
};

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

interface MessageBubbleProps {
  message: AgentMessage;
  /** When true, omit the sender avatar (used for grouped follow-up messages) */
  compact?: boolean;
}

export default function MessageBubble({ message, compact = false }: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const badge = message.parsedType ? TYPE_BADGE[message.parsedType] : undefined;
  const isHumanRequest = message.parsedType === 'human_input_request';
  const isLong = message.text.length > 120;
  const preview = isLong ? message.text.slice(0, 120) + '…' : message.text;
  const senderColor = agentColor(message.sender);
  const recipientColor = agentColor(message.recipient);
  const avatarStyle = agentAvatarStyle(message.sender);

  return (
    <div
      onClick={() => isLong && setExpanded(e => !e)}
      style={{
        display: 'flex',
        gap: '8px',
        padding: compact ? '3px 10px 3px 10px' : '7px 10px',
        borderRadius: '3px',
        cursor: isLong ? 'pointer' : 'default',
        transition: 'background 0.1s',
        alignItems: 'flex-start',
        borderLeft: isHumanRequest ? '2px solid var(--amber)' : `2px solid ${senderColor}55`,
        background: isHumanRequest ? 'var(--amber-glow)' : 'var(--surface-1)',
        marginBottom: '1px',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-1)'; }}
    >
      {/* Avatar column */}
      <div style={{ flexShrink: 0, width: '22px', paddingTop: '1px' }}>
        {!compact ? (
          <div style={{
            width: '22px', height: '22px',
            borderRadius: '3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '8px', fontWeight: 700, letterSpacing: '0.04em',
            fontFamily: 'var(--font-mono)',
            ...avatarStyle,
          }}>
            {agentInitials(message.sender)}
          </div>
        ) : (
          /* Continuation line */
          <div style={{ width: '1px', height: '100%', background: senderColor + '22', margin: '0 auto' }} />
        )}
      </div>

      {/* Content column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: only for non-compact */}
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
            {/* Sender */}
            <span style={{ fontSize: '10px', fontWeight: 600, color: senderColor, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
              {message.sender}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>→</span>
            {/* Recipient */}
            <span style={{ fontSize: '10px', color: recipientColor, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
              {message.recipient}
            </span>
            {/* Timestamp */}
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em', marginLeft: '2px' }}>
              {formatTs(message.timestamp)}
            </span>
            {/* Type badge */}
            {badge && (
              <span style={{
                fontSize: '8px',
                letterSpacing: '0.12em',
                color: badge.color,
                border: `1px solid ${badge.color}`,
                padding: '1px 5px',
                borderRadius: '2px',
                opacity: 0.85,
                boxShadow: badge.glow ? `0 0 6px ${badge.color}88` : 'none',
                animation: badge.glow ? 'status-pulse 2s ease-in-out infinite' : 'none',
              }}>
                {badge.label}
              </span>
            )}
            {/* Unread dot */}
            {!message.read && (
              <span style={{
                width: '5px', height: '5px',
                borderRadius: '50%',
                background: 'var(--unread-dot)',
                boxShadow: '0 0 4px var(--unread-dot)',
                display: 'inline-block',
                flexShrink: 0,
              }} />
            )}
          </div>
        )}

        {/* Compact: just timestamp + badge inline */}
        {compact && (badge || !message.read) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              {formatTs(message.timestamp)}
            </span>
            {badge && (
              <span style={{
                fontSize: '8px', letterSpacing: '0.12em',
                color: badge.color, border: `1px solid ${badge.color}`,
                padding: '1px 5px', borderRadius: '2px', opacity: 0.85,
              }}>
                {badge.label}
              </span>
            )}
            {!message.read && (
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--unread-dot)', boxShadow: '0 0 4px var(--unread-dot)', display: 'inline-block' }} />
            )}
          </div>
        )}

        {/* Message body */}
        <div style={{
          fontSize: '10px',
          color: 'var(--text-secondary)',
          letterSpacing: '0.02em',
          lineHeight: 1.5,
          wordBreak: 'break-word',
          fontFamily: 'var(--font-mono)',
        }}>
          {expanded ? message.text : preview}
        </div>

        {isLong && (
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px', letterSpacing: '0.08em' }}>
            {expanded ? '▲ COLLAPSE' : '▼ EXPAND'}
          </div>
        )}
      </div>
    </div>
  );
}
