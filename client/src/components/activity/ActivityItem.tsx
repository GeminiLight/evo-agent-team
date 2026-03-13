import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { AgentMessage, TaskChangeEvent } from '../../types';
import { STATUS_COLORS, type StatusKey } from '../../utils/statusColors';
import { agentColor, agentInitials, agentAvatarStyle } from '../../utils/agentColors';

// ─── Shared types ────────────────────────────────────────────────────────────

export type ActivityEntry =
  | { kind: 'message'; data: AgentMessage; timestamp: string }
  | { kind: 'event';   data: TaskChangeEvent; timestamp: string };

export function mergeActivityEntries(
  messages: AgentMessage[],
  events: TaskChangeEvent[],
): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    ...messages.map(m => ({ kind: 'message' as const, data: m, timestamp: m.timestamp })),
    ...events.map(e => ({ kind: 'event' as const, data: e, timestamp: e.timestamp })),
  ];
  return entries;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ts; }
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'PENDING', in_progress: 'ACTIVE', completed: 'DONE',
};

const MSG_TYPE_BADGE: Record<string, { color: string; labelKey: string; glow?: boolean }> = {
  idle_notification:      { color: 'var(--text-muted)',    labelKey: 'message.type_idle' },
  shutdown_request:       { color: 'var(--crimson)',       labelKey: 'message.type_shutdown' },
  shutdown_response:      { color: 'var(--crimson)',       labelKey: 'message.type_shutdown' },
  plan_approval_request:  { color: 'var(--amber)',         labelKey: 'message.type_plan_approval' },
  plan_approval_response: { color: 'var(--amber)',         labelKey: 'message.type_plan_approval' },
  task_assignment:        { color: 'var(--ice)',           labelKey: 'message.type_task_update' },
  broadcast:              { color: 'var(--phosphor)',      labelKey: 'message.type_broadcast' },
  human_input_request:    { color: 'var(--amber)',         labelKey: 'message.type_needs_input', glow: true },
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status as StatusKey];
  if (!colors) return null;
  return (
    <span style={{
      fontSize: '9px', letterSpacing: '0.1em',
      color: colors.text, background: colors.bg,
      border: `1px solid ${colors.border}`,
      padding: '1px 5px', borderRadius: '2px',
    }}>
      {STATUS_LABELS[status] ?? status.toUpperCase()}
    </span>
  );
}

// ─── Event item (task status change) ──────────────────────────────────────────

function EventItem({ event }: { event: TaskChangeEvent }) {
  const dotColor = STATUS_COLORS[event.newStatus as StatusKey]?.border ?? 'var(--text-muted)';
  const ownerColor = event.owner ? agentColor(event.owner) : undefined;
  const avatarStyle = event.owner ? agentAvatarStyle(event.owner) : undefined;

  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start',
      padding: '6px 12px',
      background: 'var(--surface-0)',
      borderLeft: `3px solid ${dotColor}`,
      borderRadius: '2px',
      transition: 'background 0.1s',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-1)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-0)'; }}
    >
      {/* Dot */}
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: dotColor, boxShadow: `0 0 5px ${dotColor}`,
        flexShrink: 0, marginTop: '4px',
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em', opacity: 0.7, flexShrink: 0 }}>
            {formatTs(event.timestamp)}
          </span>
          <span style={{
            fontSize: '9px', letterSpacing: '0.14em',
            color: dotColor, background: `${dotColor}15`,
            border: `1px solid ${dotColor}30`,
            padding: '0px 5px', borderRadius: '2px',
            fontWeight: 700,
          }}>
            EVENT
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>#{event.taskId}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-primary)', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event.taskSubject}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {event.oldStatus === null ? (
            <span style={{
              fontSize: '9px', letterSpacing: '0.1em', color: 'var(--text-muted)',
              border: '1px solid var(--border)', padding: '1px 5px', borderRadius: '2px',
            }}>CREATED</span>
          ) : (
            <><StatusBadge status={event.oldStatus} /><span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>→</span></>
          )}
          <StatusBadge status={event.newStatus} />

          {event.owner && ownerColor && avatarStyle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '16px', height: '16px', borderRadius: '3px',
                fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)',
                ...avatarStyle,
              }}>{agentInitials(event.owner)}</div>
              <span style={{ fontSize: '9px', color: ownerColor, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                {event.owner}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Message item ─────────────────────────────────────────────────────────────

function MessageItem({ message }: { message: AgentMessage }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const badge = message.parsedType ? MSG_TYPE_BADGE[message.parsedType] : undefined;
  const isHumanRequest = message.parsedType === 'human_input_request';
  const isLong = message.text.length > 160;
  const preview = isLong ? message.text.slice(0, 160) + '...' : message.text;
  const senderColor = agentColor(message.sender);
  const recipientColor = agentColor(message.recipient);
  const avatarStyle = agentAvatarStyle(message.sender);

  return (
    <div
      onClick={() => isLong && setExpanded(e => !e)}
      style={{
        display: 'flex', gap: '8px',
        padding: '6px 10px',
        borderLeft: isHumanRequest ? '3px solid var(--amber)' : `3px solid ${senderColor}55`,
        background: isHumanRequest ? 'var(--amber-glow)' : 'var(--surface-1)',
        borderRadius: '2px',
        cursor: isLong ? 'pointer' : 'default',
        transition: 'background 0.1s',
        alignItems: 'flex-start',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = isHumanRequest ? 'rgba(245,166,35,0.12)' : 'var(--surface-2)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = isHumanRequest ? 'var(--amber-glow)' : 'var(--surface-1)'; }}
    >
      {/* Avatar */}
      <div style={{
        width: '22px', height: '22px', borderRadius: '3px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em',
        fontFamily: 'var(--font-mono)', flexShrink: 0, marginTop: '1px',
        ...avatarStyle,
      }}>
        {agentInitials(message.sender)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginBottom: '2px' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: senderColor, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
            {message.sender}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>→</span>
          <span style={{ fontSize: '10px', color: recipientColor, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
            {message.recipient}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            {formatTs(message.timestamp)}
          </span>
          {badge && (
            <span style={{
              fontSize: '9px', letterSpacing: '0.12em',
              color: badge.color, border: `1px solid ${badge.color}`,
              padding: '0px 5px', borderRadius: '2px', opacity: 0.85,
              boxShadow: badge.glow ? `0 0 6px ${badge.color}88` : 'none',
              animation: badge.glow ? 'status-pulse 2s ease-in-out infinite' : 'none',
              textTransform: 'uppercase',
            }}>
              {t(badge.labelKey)}
            </span>
          )}
          {!message.read && (
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: 'var(--unread-dot)', boxShadow: '0 0 4px var(--unread-dot)',
              display: 'inline-block', flexShrink: 0,
            }} />
          )}
        </div>

        <div style={{
          fontSize: '10px', color: 'var(--text-secondary)',
          letterSpacing: '0.02em', lineHeight: 1.5,
          wordBreak: 'break-word', fontFamily: 'var(--font-mono)',
        }}>
          {expanded ? message.text : preview}
        </div>
        {isLong && (
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}>
            {expanded ? t('commlog.collapse') : t('commlog.expand')}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Unified ActivityItem ─────────────────────────────────────────────────────

export default function ActivityItem({ entry }: { entry: ActivityEntry }) {
  if (entry.kind === 'event') return <EventItem event={entry.data} />;
  return <MessageItem message={entry.data} />;
}
